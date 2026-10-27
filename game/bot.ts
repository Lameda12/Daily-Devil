import type { BotCtl } from './types'
import type { World } from './world'
import { right } from './traps/common'
import { TICK_HZ } from './tuning'

export interface BotResult {
  cleared: boolean
  ticks: number
  failedSection: number
  inputs: Uint8Array
}

export const encodeInput = (l: boolean, r: boolean, j: boolean) => (l ? 1 : 0) | (r ? 2 : 0) | (j ? 4 : 0)

/** Drive the world with each trap's scripted solution, in order, and record every input. */
export function runBot(w: World, maxSeconds = 40): BotResult {
  w.reset()
  const max = maxSeconds * TICK_HZ
  const inputs = new Uint8Array(max)
  const ctl: BotCtl = { input: { left: false, right: false, jump: false }, jumpTicks: 0, phase: 0, timer: 0 }
  let section = 0
  for (let tick = 0; tick < max; tick++) {
    ctl.input.left = ctl.input.right = false
    while (section < w.traps.length && w.traps[section].bot(w, ctl)) {
      section++
      ctl.phase = 0
      ctl.timer = 0
      ctl.input.left = ctl.input.right = false
    }
    if (section >= w.traps.length) right(ctl)
    ctl.input.jump = ctl.jumpTicks > 0
    if (ctl.jumpTicks > 0) ctl.jumpTicks--
    inputs[tick] = encodeInput(ctl.input.left, ctl.input.right, ctl.input.jump)
    w.step(ctl.input)
    if (w.status === 'cleared') return { cleared: true, ticks: tick + 1, failedSection: -1, inputs: inputs.slice(0, tick + 1) }
    if (w.status === 'dead') return { cleared: false, ticks: tick + 1, failedSection: section, inputs: inputs.slice(0, tick + 1) }
  }
  return { cleared: false, ticks: max, failedSection: section, inputs }
}

/** Replay a recorded input tape from a fresh reset. */
export function replay(w: World, inputs: Uint8Array): World['status'] {
  w.reset()
  const input = { left: false, right: false, jump: false }
  for (let i = 0; i < inputs.length && w.status === 'playing'; i++) {
    const b = inputs[i]
    input.left = (b & 1) !== 0
    input.right = (b & 2) !== 0
    input.jump = (b & 4) !== 0
    w.step(input)
  }
  return w.status
}
