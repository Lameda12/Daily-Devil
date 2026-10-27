// A ceiling block slams down in front of you and stays as a wall.
// Beat it by stopping, letting it land, then hopping it.
import { randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { EV_SLAM } from '../world'
import { floor, idle, jump, passed, right, rightEdge, settleBefore, solid } from './common'

export const crusher: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const cx = x0 + randInt(rng, 28, 34)
  const cw = randInt(rng, 10, 14)
  const ch = randInt(rng, 12, 16)
  const trig = randInt(rng, 14, 20)
  const homeY = T.CEIL_Y - ch // tucked flush inside the ceiling
  const block = solid(cx, homeY, cw, ch)
  let state = 0 // 0 armed, 1 delay, 2 falling, 3 landed
  let timer = 0
  let vy = 0

  const trap: Trap = {
    kind: 'crusher',
    x0,
    x1,
    floorEnd: x1,
    solids: [floor(floorStart, x1), block],
    hazards: [],
    reset() {
      state = 0
      timer = vy = 0
      block.y = homeY
    },
    update(w, dt) {
      if (state === 0 && rightEdge(w) >= cx - trig && w.player.x < cx + cw) {
        state = 1
        timer = 0.05
      } else if (state === 1) {
        timer -= dt
        if (timer <= 0) state = 2
      } else if (state === 2) {
        vy += 2400 * dt
        const target = T.FLOOR_Y - ch
        const ny = Math.min(target, block.y + vy * dt)
        block.dy = ny - block.y
        block.y = ny
        if (ny >= target) {
          state = 3
          w.events |= EV_SLAM
        }
      }
    },
    bot(w, ctl) {
      if (passed(w, cx + cw)) return true
      if (state === 0) {
        right(ctl)
        return false
      }
      if (state < 3) {
        idle(ctl)
        return false
      }
      if (ctl.phase === 0) {
        if (settleBefore(w, ctl, cx - 14)) ctl.phase = 1
        return false
      }
      right(ctl)
      if (rightEdge(w) >= cx - 11) jump(w, ctl)
      return false
    },
  }
  return trap
}
