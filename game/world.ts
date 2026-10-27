import * as T from './tuning'
import type { Hazard, InputState, Rect, Solid, Trap } from './types'

export const EV_JUMP = 1
export const EV_LAND = 2
export const EV_DIE = 4
export const EV_SPIKE = 8
export const EV_SLAM = 16
export const EV_TAUNT = 32
export const EV_CLEAR = 64
export const EV_SECTION = 128

export type Status = 'playing' | 'dead' | 'cleared'
export type DeathCause = 'spike' | 'crush' | 'fall' | null

export interface Player extends Rect {
  vx: number
  vy: number
  grounded: boolean
  ground: Solid | null
  coyote: number
  buffer: number
  prevJump: boolean
  jumpCut: boolean
  facing: 1 | -1
  takeoffX: number
  airTime: number
  lastLandSpeed: number
}

export interface Door extends Rect {
  troll: boolean
  trolled: boolean
  hopT: number // <0 when not hopping
  fromX: number
  toX: number
}

export function solid(x: number, y: number, w: number, h: number, visible = true, collide = true): Solid {
  return { x, y, w, h, dx: 0, dy: 0, collide, visible }
}

export function floor(x0: number, x1: number): Solid {
  return solid(x0, T.FLOOR_Y, x1 - x0, T.VIEW_H - T.FLOOR_Y + 8)
}

const EPS = 0.0001
export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS

const approach = (v: number, target: number, step: number) =>
  v < target ? Math.min(v + step, target) : Math.max(v - step, target)

export class World {
  readonly solids: Solid[]
  readonly hazards: Hazard[]
  readonly player: Player
  readonly door: Door
  t = 0
  tick = 0
  status: Status = 'playing'
  cause: DeathCause = null
  deathX = 0
  deathY = 0
  progress = 0
  reversed = false
  events = 0

  constructor(
    readonly traps: Trap[],
    staticSolids: Solid[],
    doorTroll: boolean,
  ) {
    this.solids = [...staticSolids]
    this.hazards = []
    for (const trap of traps) {
      this.solids.push(...trap.solids)
      this.hazards.push(...trap.hazards)
    }
    this.player = {
      x: 0, y: 0, w: T.PLAYER_W, h: T.PLAYER_H, vx: 0, vy: 0, grounded: false, ground: null,
      coyote: 0, buffer: 0, prevJump: false, jumpCut: false, facing: 1, takeoffX: -999, airTime: 0, lastLandSpeed: 0,
    }
    this.door = { x: 0, y: T.FLOOR_Y - T.DOOR_H, w: T.DOOR_W, h: T.DOOR_H, troll: doorTroll, trolled: false, hopT: -1, fromX: 0, toX: 0 }
    this.reset()
  }

  reset() {
    const p = this.player
    p.x = T.SPAWN_X
    p.y = T.FLOOR_Y - T.PLAYER_H
    p.vx = p.vy = 0
    p.grounded = true
    p.ground = null
    p.coyote = p.buffer = 0
    p.prevJump = false
    p.jumpCut = false
    p.facing = 1
    p.takeoffX = -999
    p.airTime = 0
    const d = this.door
    d.x = d.troll ? T.DOOR_X : T.DOOR_X + T.DOOR_HOP
    d.trolled = false
    d.hopT = -1
    for (const s of this.solids) s.dx = s.dy = 0
    for (const trap of this.traps) trap.reset()
    this.t = 0
    this.tick = 0
    this.status = 'playing'
    this.cause = null
    this.progress = 0
    this.reversed = false
    this.events = 0
  }

  die(cause: DeathCause) {
    if (this.status !== 'playing') return
    const p = this.player
    this.status = 'dead'
    this.cause = cause
    this.deathX = p.x + p.w / 2
    this.deathY = Math.min(p.y + p.h / 2, T.VIEW_H - 3)
    this.events |= EV_DIE
  }

  /** Index of the trap section containing x (start runway counts as 0, end runway as the last). */
  sectionAt(x: number): number {
    const i = Math.floor((x - T.SECTIONS_X) / T.SECTION_W)
    return Math.max(0, Math.min(T.SECTION_COUNT - 1, i))
  }

  step(input: InputState) {
    this.events = 0
    if (this.status !== 'playing') return
    const dt = T.DT
    const p = this.player
    this.t += dt
    this.tick++

    for (const s of this.solids) s.dx = s.dy = 0
    for (const trap of this.traps) trap.update(this, dt)
    this.updateDoor(dt)

    // Anything that moved into the player crushes them, except the floor they ride.
    for (const s of this.solids) {
      if (!s.collide || (s.dx === 0 && s.dy === 0) || s === p.ground) continue
      if (overlaps(p, s)) return this.die('crush')
    }
    if (p.ground) {
      if (!p.ground.collide) {
        p.ground = null
        p.grounded = false
      } else if (p.ground.dx !== 0 || p.ground.dy !== 0) {
        p.x += p.ground.dx
        p.y += p.ground.dy
        for (const s of this.solids) if (s.collide && s !== p.ground && overlaps(p, s)) return this.die('crush')
      }
    }

    // Input, with the reverse zone swapping directions.
    const cx = p.x + p.w / 2
    this.reversed = false
    for (const trap of this.traps) {
      const z = trap.reverseZone
      if (z && cx >= z.x && cx <= z.x + z.w) this.reversed = true
    }
    let dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    if (this.reversed) dir = -dir

    const accel = p.grounded ? (dir !== 0 ? T.GROUND_ACCEL : T.GROUND_DECEL) : dir !== 0 ? T.AIR_ACCEL : T.AIR_DECEL
    p.vx = approach(p.vx, dir * T.RUN_SPEED, accel * dt)
    if (dir !== 0) p.facing = dir > 0 ? 1 : -1

    const pressed = input.jump && !p.prevJump
    p.prevJump = input.jump
    p.buffer = pressed ? T.JUMP_BUFFER : Math.max(0, p.buffer - dt)
    p.coyote = p.grounded ? T.COYOTE_TIME : Math.max(0, p.coyote - dt)

    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -T.JUMP_VELOCITY
      p.buffer = 0
      p.coyote = 0
      p.grounded = false
      p.ground = null
      p.jumpCut = false
      p.takeoffX = p.x
      p.airTime = 0
      this.events |= EV_JUMP
    }
    if (!input.jump && p.vy < 0 && !p.jumpCut) {
      p.vy *= T.JUMP_CUT
      p.jumpCut = true
    }

    p.vy = Math.min(p.vy + T.GRAVITY * dt, T.MAX_FALL)

    // Horizontal move and resolve.
    p.x += p.vx * dt
    for (const s of this.solids) {
      if (!s.collide || !overlaps(p, s)) continue
      if (p.vx > 0) p.x = s.x - p.w
      else if (p.vx < 0) p.x = s.x + s.w
      else p.x = p.x + p.w / 2 < s.x + s.w / 2 ? s.x - p.w : s.x + s.w
      p.vx = 0
    }

    // Vertical move and resolve.
    const wasGrounded = p.grounded
    const fallSpeed = p.vy
    p.y += p.vy * dt
    p.grounded = false
    p.ground = null
    for (const s of this.solids) {
      if (!s.collide || !overlaps(p, s)) continue
      if (p.vy >= 0) {
        p.y = s.y - p.h
        p.grounded = true
        p.ground = s
      } else {
        p.y = s.y + s.h
      }
      p.vy = 0
    }
    if (p.grounded && !wasGrounded) {
      p.lastLandSpeed = fallSpeed
      if (p.airTime > 0.05) this.events |= EV_LAND
    }
    p.airTime = p.grounded ? 0 : p.airTime + dt

    for (const trap of this.traps) trap.after?.(this)

    // Spikes, with an inset kill box.
    for (const h of this.hazards) {
      if (!h.active) continue
      if (p.x < h.x + h.w - 1 && p.x + p.w > h.x + 1 && p.y < h.y + h.h && p.y + p.h > h.y + 2) return this.die('spike')
    }
    if (p.y > T.KILL_Y) return this.die('fall')

    while (this.progress < this.traps.length && p.x > this.traps[this.progress].x1 - 2) {
      this.progress++
      this.events |= EV_SECTION
    }

    const d = this.door
    if (d.hopT < 0 && p.grounded && p.x + p.w > d.x + 3 && p.x < d.x + d.w - 3) {
      this.progress = this.traps.length + 1
      this.status = 'cleared'
      this.events |= EV_CLEAR | EV_SECTION
    }
  }

  private updateDoor(dt: number) {
    const d = this.door
    const p = this.player
    if (d.troll && !d.trolled && p.x + p.w >= d.x - 5) {
      d.trolled = true
      d.hopT = 0
      d.fromX = d.x
      d.toX = d.x + T.DOOR_HOP
      this.events |= EV_TAUNT
    }
    if (d.hopT >= 0) {
      d.hopT += dt / 0.32
      if (d.hopT >= 1) {
        d.hopT = -1
        d.x = d.toX
        d.y = T.FLOOR_Y - T.DOOR_H
      } else {
        const k = d.hopT
        d.x = d.fromX + (d.toX - d.fromX) * k
        d.y = T.FLOOR_Y - T.DOOR_H - Math.sin(Math.PI * k) * 14
      }
    }
  }
}
