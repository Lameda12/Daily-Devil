// The ledge across a gap sinks away if you take off from the very edge.
// Beat it by jumping early.
import { randInt } from '../prng'
import * as T from '../tuning'
import type { Trap, TrapFactory } from '../types'
import { floor, jump, passed, right, rightEdge, settleBefore } from './common'

const EDGE_ZONE = 4 // takeoffs with the right edge this close to the lip trigger the sink

export const sinkledge: TrapFactory = ({ x0, floorStart, rng }) => {
  const x1 = x0 + T.SECTION_W
  const lip = x0 + randInt(rng, 14, 18)
  const gap = randInt(rng, 13, 16)
  const floorEnd = x1 + 12 // the ledge reaches into the next section so edge jumps can't overshoot it
  const ledge = floor(lip + gap, floorEnd)
  const homeY = ledge.y
  let sinking = false
  let vy = 0
  let seenTakeoff = -999

  const trap: Trap = {
    kind: 'sinkledge',
    x0,
    x1,
    floorEnd,
    solids: [floor(floorStart, lip), ledge],
    hazards: [],
    reset() {
      sinking = false
      vy = 0
      seenTakeoff = -999
      ledge.y = homeY
    },
    update(w, dt) {
      if (sinking && ledge.y < T.VIEW_H + 40) {
        vy += 900 * dt
        ledge.dy = vy * dt
        ledge.y += ledge.dy
      }
    },
    after(w) {
      const p = w.player
      if (sinking || p.grounded || p.takeoffX === seenTakeoff) return
      seenTakeoff = p.takeoffX
      const edge = p.takeoffX + p.w
      if (edge > lip - EDGE_ZONE && p.takeoffX < lip + gap) sinking = true
    },
    bot(w, ctl) {
      if (passed(w, lip + gap + 2)) return true
      if (ctl.phase === 0) {
        // Too close to the lip for an early takeoff: step back a little first.
        if (rightEdge(w) <= lip - 6 || settleBefore(w, ctl, lip - 9)) ctl.phase = 1
        return false
      }
      right(ctl)
      if (rightEdge(w) >= lip - 6) jump(w, ctl)
      return false
    },
  }
  return trap
}
