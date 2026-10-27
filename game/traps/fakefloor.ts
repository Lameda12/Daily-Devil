// A floor tile that looks solid but isn't there. Beat it by jumping over.
import { randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { floor, jump, passed, right, rightEdge } from './common'

export const fakefloor: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const fx = x0 + randInt(rng, 18, 30)
  const fw = randInt(rng, 10, 14)
  const fake = floor(fx, fx + fw)
  fake.collide = false

  const trap: Trap = {
    kind: 'fakefloor',
    x0,
    x1,
    floorEnd: x1,
    solids: [floor(floorStart, fx), fake, floor(fx + fw, x1)],
    hazards: [],
    reset() {},
    update() {},
    bot(w, ctl) {
      if (passed(w, fx + fw)) return true
      right(ctl)
      if (rightEdge(w) >= fx - 4) jump(w, ctl)
      return false
    },
  }
  return trap
}
