// Left and right swap inside a marked strip, with a spike in the middle of it.
// Beat it by pressing the opposite direction and hopping the spike.
import { randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { floor, jump, left, passed, right, rightEdge, spike } from './common'

export const reverse: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const rx = x0 + randInt(rng, 8, 12)
  const rw = randInt(rng, 32, 38)
  const sx = rx + Math.floor(rw / 2) - 3

  const trap: Trap = {
    kind: 'reverse',
    x0,
    x1,
    floorEnd: x1,
    solids: [floor(floorStart, x1)],
    hazards: [spike(sx, 6)],
    reverseZone: { x: rx, w: rw },
    reset() {},
    update() {},
    bot(w, ctl) {
      if (passed(w, rx + rw)) return true
      if (w.reversed) left(ctl)
      else right(ctl)
      if (rightEdge(w) >= sx - 5 && w.player.x < sx) jump(w, ctl)
      return false
    },
  }
  return trap
}
