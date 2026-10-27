// Hidden spikes burst out of the floor as you approach. Beat it by jumping early.
import { randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { EV_SPIKE } from '../world'
import { floor, jump, passed, right, rightEdge, setSpikeRise, spike } from './common'

export const popspikes: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const sx = x0 + randInt(rng, 26, 32)
  const sw = randInt(rng, 10, 14)
  const trig = randInt(rng, 8, 12)
  const spikes = spike(sx, sw, true)
  let rise = 0
  let triggered = false

  const trap: Trap = {
    kind: 'popspikes',
    x0,
    x1,
    floorEnd: x1,
    solids: [floor(floorStart, x1)],
    hazards: [spikes],
    reset() {
      rise = 0
      triggered = false
      setSpikeRise(spikes, 0)
    },
    update(w, dt) {
      if (!triggered && rightEdge(w) >= sx - trig && w.player.x < sx + sw) {
        triggered = true
        w.events |= EV_SPIKE
      }
      if (triggered && rise < 1) {
        rise = Math.min(1, rise + dt / 0.06)
        setSpikeRise(spikes, rise)
      }
    },
    bot(w, ctl) {
      if (passed(w, sx + sw)) return true
      right(ctl)
      if (rightEdge(w) >= sx - trig - 3) jump(w, ctl)
      return false
    },
  }
  return trap
}
