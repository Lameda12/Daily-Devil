// One honest spike, and a hidden one exactly where a minimal hop lands.
// Beat it with a long jump.
import { randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { EV_SPIKE } from '../world'
import { floor, jump, passed, right, rightEdge, setSpikeRise, spike } from './common'

export const secondspike: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const sx = x0 + randInt(rng, 12, 16)
  const sw = 7
  const hx = sx + sw + randInt(rng, 2, 4)
  const hw = randInt(rng, 12, 15)
  const hidden = spike(hx, hw, true)
  let rise = 0
  let triggered = false

  const trap: Trap = {
    kind: 'secondspike',
    x0,
    x1,
    floorEnd: x1,
    solids: [floor(floorStart, x1)],
    hazards: [spike(sx, sw), hidden],
    reset() {
      rise = 0
      triggered = false
      setSpikeRise(hidden, 0)
    },
    update(w, dt) {
      if (!triggered && rightEdge(w) > hx - 1 && w.player.x < hx + hw) {
        triggered = true
        w.events |= EV_SPIKE
      }
      if (triggered && rise < 1) {
        rise = Math.min(1, rise + dt / 0.05)
        setSpikeRise(hidden, rise)
      }
    },
    bot(w, ctl) {
      if (passed(w, hx + hw)) return true
      right(ctl)
      if (rightEdge(w) >= sx - 1) jump(w, ctl)
      return false
    },
  }
  return trap
}
