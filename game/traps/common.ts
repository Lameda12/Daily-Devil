import * as T from '../tuning'
import type { BotCtl, Hazard } from '../types'
import type { World } from '../world'

export { floor, solid } from '../world'

export const SPIKE_H = 6

export function spike(x: number, w: number, hidden = false): Hazard {
  return { x, y: hidden ? T.FLOOR_Y : T.FLOOR_Y - SPIKE_H, w, h: SPIKE_H, active: !hidden, visible: !hidden }
}

/** Raise a hidden spike by `k` (0 = buried, 1 = fully up). */
export function setSpikeRise(h: Hazard, k: number) {
  h.y = T.FLOOR_Y - SPIKE_H * k
  h.visible = k > 0
  h.active = k > 0.5
}

// Scripted-bot helpers. The bot drives the same input layer a person does.

export const right = (ctl: BotCtl) => {
  ctl.input.right = true
  ctl.input.left = false
}
export const left = (ctl: BotCtl) => {
  ctl.input.left = true
  ctl.input.right = false
}
export const idle = (ctl: BotCtl) => {
  ctl.input.left = ctl.input.right = false
}

/** Press jump if standing and the button is released; hold it for `ticks`. */
export function jump(w: World, ctl: BotCtl, ticks = 60): boolean {
  if (!w.player.grounded || ctl.input.jump || ctl.jumpTicks > 0) return false
  ctl.jumpTicks = ticks
  return true
}

export const rightEdge = (w: World) => w.player.x + w.player.w

export const passed = (w: World, x: number) => w.player.grounded && w.player.x > x

/**
 * Get to a standstill with the right edge at or before `x`, backing up if needed.
 * Returns true once settled there.
 */
export function settleBefore(w: World, ctl: BotCtl, x: number): boolean {
  const p = w.player
  if (!p.grounded) return false
  if (p.x + p.w > x) {
    if (w.reversed) right(ctl)
    else left(ctl)
    return false
  }
  if (Math.abs(p.vx) > 1) {
    idle(ctl)
    return false
  }
  return true
}
