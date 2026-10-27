import type { Rng } from './prng'
import type { World } from './world'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Solid extends Rect {
  /** Movement applied during the current tick, used for carrying and crushing. */
  dx: number
  dy: number
  collide: boolean
  visible: boolean
}

/** Spikes. The rect is the visual; the kill box is inset for fairness. */
export interface Hazard extends Rect {
  active: boolean
  visible: boolean
}

export interface InputState {
  left: boolean
  right: boolean
  jump: boolean
}

export const TRAP_KINDS = [
  'trapdoor',
  'popspikes',
  'crusher',
  'sinkledge',
  'secondspike',
  'jaws',
  'fakefloor',
  'reverse',
] as const

export type TrapKind = (typeof TRAP_KINDS)[number]

/** Scratch state a scripted bot keeps while solving one trap. */
export interface BotCtl {
  input: InputState
  /** Ticks the jump button stays held for the current jump. */
  jumpTicks: number
  phase: number
  timer: number
}

export interface Trap {
  readonly kind: TrapKind
  readonly x0: number
  readonly x1: number
  /** Where this trap's floor ends; the next section starts its floor here. */
  readonly floorEnd: number
  readonly solids: Solid[]
  readonly hazards: Hazard[]
  /** Horizontal strip in which left/right are swapped. */
  readonly reverseZone?: { x: number; w: number }
  reset(): void
  /** Runs before the player moves. Move solids here and record dx/dy. */
  update(w: World, dt: number): void
  /** Runs after the player moved (takeoff/landing reactions). */
  after?(w: World): void
  /** Scripted solution. Sets ctl.input and returns true once the trap is behind the player. */
  bot(w: World, ctl: BotCtl): boolean
}

export interface TrapContext {
  x0: number
  floorStart: number
  rng: Rng
}

export type TrapFactory = (ctx: TrapContext) => Trap
