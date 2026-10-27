// Two walls, one from the ceiling and one from the floor, slam together on a loop.
// Beat it by timing a pass while they are open.
import { randFloat, randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { EV_SLAM } from '../world'
import { floor, idle, passed, right, rightEdge, settleBefore, solid } from './common'

const CLOSE = 0.18
const SHUT = 0.35
const OPEN = 0.25

export const jaws: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const jx = x0 + randInt(rng, 20, 26)
  const jw = randInt(rng, 14, 18)
  const trig = randInt(rng, 10, 16)
  const rest = randFloat(rng, 0.9, 1.3)
  const period = CLOSE + SHUT + OPEN + rest
  const meet = T.FLOOR_Y - 26
  const topH = meet - T.CEIL_Y + 4
  const top = solid(jx, T.CEIL_Y - topH, jw, topH)
  const bottom = solid(jx, T.FLOOR_Y, jw, T.VIEW_H - meet + 8)
  let triggered = false
  let clock = 0
  let shutLatch = false

  // 0 = open, 1 = shut
  const closure = (t: number) => {
    const ph = t % period
    if (ph < CLOSE) return ph / CLOSE
    if (ph < CLOSE + SHUT) return 1
    if (ph < CLOSE + SHUT + OPEN) return 1 - (ph - CLOSE - SHUT) / OPEN
    return 0
  }

  const place = (k: number) => {
    const ty = T.CEIL_Y - topH + (meet - T.CEIL_Y) * k
    const by = T.FLOOR_Y - (T.FLOOR_Y - meet) * k
    top.dy = ty - top.y
    bottom.dy = by - bottom.y
    top.y = ty
    bottom.y = by
  }

  const trap: Trap = {
    kind: 'jaws',
    x0,
    x1,
    floorEnd: x1,
    solids: [floor(floorStart, jx), bottom, floor(jx + jw, x1), top],
    hazards: [],
    reset() {
      triggered = false
      clock = 0
      shutLatch = false
      top.y = T.CEIL_Y - topH
      bottom.y = T.FLOOR_Y
    },
    update(w, dt) {
      if (!triggered && rightEdge(w) >= jx - trig && w.player.x < jx + jw) triggered = true
      if (!triggered) return
      clock += dt
      const k = closure(clock)
      place(k)
      if (k === 1 && !shutLatch) {
        shutLatch = true
        w.events |= EV_SLAM
      } else if (k < 1) shutLatch = false
    },
    bot(w, ctl) {
      if (passed(w, jx + jw + 1)) return true
      if (!triggered) {
        right(ctl)
        return false
      }
      if (ctl.phase === 0) {
        if (settleBefore(w, ctl, jx - 3)) ctl.phase = 1
        return false
      }
      if (ctl.phase === 1) {
        idle(ctl)
        // Go the moment the jaws are fully open again.
        const ph = clock % period
        if (ph >= CLOSE + SHUT + OPEN && ph < CLOSE + SHUT + OPEN + 0.05) ctl.phase = 2
        return false
      }
      right(ctl)
      return false
    },
  }
  return trap
}
