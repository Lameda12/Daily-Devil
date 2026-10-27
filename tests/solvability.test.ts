import { describe, expect, it } from 'vitest'
import { replay, runBot } from '@/game/bot'
import { addDays, dayKey } from '@/game/day'
import { buildWorld, generateLevel } from '@/game/level'
import { TRAPS } from '@/game/traps'
import { mulberry32 } from '@/game/prng'
import * as T from '@/game/tuning'
import { TRAP_KINDS } from '@/game/types'
import { floor, solid, World } from '@/game/world'

const start = dayKey()
const days = Array.from({ length: 365 }, (_, i) => addDays(start, i))

describe('solvability bot', () => {
  it('clears every level for the next 365 days', () => {
    const failures: string[] = []
    for (const day of days) {
      const def = generateLevel(day)
      const w = buildWorld(def)
      const r = runBot(w)
      if (!r.cleared) failures.push(`${day} [${def.kinds.join(', ')}] died in section ${r.failedSection} (${w.traps[r.failedSection]?.kind ?? 'door'}) cause=${w.cause} at x=${w.deathX.toFixed(1)}`)
    }
    expect(failures).toEqual([])
  })

  it('replays recorded inputs to the same result (deterministic sim)', () => {
    for (const day of days.slice(0, 30)) {
      const w = buildWorld(generateLevel(day))
      const r = runBot(w)
      expect(r.cleared).toBe(true)
      expect(replay(w, r.inputs)).toBe('cleared')
    }
  })

  it('every trap type clears in isolation across many jitter seeds', () => {
    for (const kind of TRAP_KINDS) {
      for (let seed = 1; seed <= 300; seed++) {
        const rng = mulberry32(seed)
        const trap = TRAPS[kind]({ x0: T.SECTIONS_X, floorStart: T.SECTIONS_X, rng })
        const statics = [solid(0, 0, T.VIEW_W, T.CEIL_Y), solid(0, 0, T.WALL, T.VIEW_H), solid(T.VIEW_W - T.WALL, 0, T.WALL, T.VIEW_H), floor(T.WALL, T.SECTIONS_X), floor(trap.floorEnd, T.VIEW_W - T.WALL)]
        const w = new World([trap], statics, seed % 2 === 0)
        const r = runBot(w)
        expect(r.cleared, `${kind} seed ${seed}: died cause=${w.cause} x=${w.deathX}`).toBe(true)
      }
    }
  })

  it('a player who just holds right dies on every day', () => {
    let survived = 0
    for (const day of days) {
      const w = buildWorld(generateLevel(day))
      const input = { left: false, right: true, jump: false }
      for (let i = 0; i < 20 * T.TICK_HZ && w.status === 'playing'; i++) w.step(input)
      if (w.status === 'cleared') survived++
    }
    expect(survived).toBe(0)
  })
})
