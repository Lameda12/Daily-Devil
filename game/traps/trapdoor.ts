// A floor segment that drops the moment you stand on it. Beat it by jumping over.
import { randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { floor, jump, passed, right, rightEdge } from './common'

export const trapdoor: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const tx = x0 + randInt(rng, 16, 22)
  const tw = randInt(rng, 16, 22)
  const door = floor(tx, tx + tw)
  const homeY = door.y
  let state = 0 // 0 idle, 1 wobble, 2 falling
  let timer = 0
  let vy = 0

  const trap: Trap = {
    kind: 'trapdoor',
    x0,
    x1,
    floorEnd: x1,
    solids: [floor(floorStart, tx), door, floor(tx + tw, x1)],
    hazards: [],
    reset() {
      state = 0
      timer = vy = 0
      door.y = homeY
      door.collide = true
    },
    update(w, dt) {
      if (state === 0 && w.player.ground === door) {
        state = 1
        timer = 0.05
      } else if (state === 1) {
        timer -= dt
        if (timer <= 0) {
          state = 2
          door.collide = false
        }
      } else if (state === 2 && door.y < T.VIEW_H + 10) {
        vy += 1600 * dt
        door.dy = vy * dt
        door.y += door.dy
      }
    },
    bot(w, ctl) {
      if (passed(w, tx + tw)) return true
      right(ctl)
      if (rightEdge(w) >= tx - 3) jump(w, ctl)
      return false
    },
  }
  return trap
}
