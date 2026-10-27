import { describe, expect, it } from 'vitest'
import { generateLevel, seedFor } from '@/game/level'
import { hashString, mulberry32 } from '@/game/prng'
import { addDays, isValidDay, levelNumber } from '@/game/day'

describe('prng', () => {
  it('mulberry32 is deterministic and in [0, 1)', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    for (let i = 0; i < 1000; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('produces a pinned sequence (guards against accidental changes)', () => {
    const r = mulberry32(hashString('daily-devil:2026-10-27'))
    const seq = Array.from({ length: 3 }, () => r().toFixed(8))
    expect(seq).toMatchInlineSnapshot(`
      [
        "0.17273581",
        "0.67561147",
        "0.92903568",
      ]
    `)
  })

  it('same day gives the same level, different days differ', () => {
    expect(generateLevel('2026-11-03')).toEqual(generateLevel('2026-11-03'))
    const kinds = new Set(Array.from({ length: 30 }, (_, i) => generateLevel(addDays('2026-11-01', i)).kinds.join()))
    expect(kinds.size).toBeGreaterThan(25)
    expect(seedFor('2026-11-03')).not.toBe(seedFor('2026-11-04'))
  })

  it('door troll lands near 65% of days', () => {
    let n = 0
    for (let i = 0; i < 2000; i++) if (generateLevel(addDays('2026-01-01', i)).doorTroll) n++
    expect(n / 2000).toBeGreaterThan(0.6)
    expect(n / 2000).toBeLessThan(0.7)
  })

  it('day helpers', () => {
    expect(isValidDay('2026-02-30')).toBe(false)
    expect(isValidDay('2026-10-27')).toBe(true)
    expect(isValidDay('../etc')).toBe(false)
    expect(levelNumber('2026-10-27')).toBe(1)
    expect(levelNumber('2026-10-28')).toBe(2)
  })
})
