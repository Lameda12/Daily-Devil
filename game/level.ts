import { levelNumber } from './day'
import { hashString, mulberry32, shuffle } from './prng'
import { TRAPS } from './traps'
import * as T from './tuning'
import { TRAP_KINDS, type TrapKind } from './types'
import { floor, solid, World } from './world'

export interface LevelDef {
  day: string
  number: number
  seed: number
  kinds: TrapKind[]
  doorTroll: boolean
}

export const seedFor = (day: string) => hashString(`daily-devil:${day}`)

/** Pure description of a day's level. Same day, same level, everywhere. */
export function generateLevel(day: string): LevelDef {
  const seed = seedFor(day)
  const rng = mulberry32(seed)
  const kinds = shuffle(rng, [...TRAP_KINDS]).slice(0, T.SECTION_COUNT)
  const doorTroll = rng() < T.DOOR_TROLL_CHANCE
  return { day, number: levelNumber(day), seed, kinds, doorTroll }
}

/** Instantiate the simulation for a level. Trap parameters are jittered from a second seeded stream. */
export function buildWorld(def: LevelDef): World {
  const rng = mulberry32(def.seed ^ 0x9e3779b9)
  const traps = []
  let floorStart = T.SECTIONS_X
  for (let i = 0; i < def.kinds.length; i++) {
    const trap = TRAPS[def.kinds[i]]({ x0: T.SECTIONS_X + i * T.SECTION_W, floorStart, rng })
    traps.push(trap)
    floorStart = trap.floorEnd
  }
  const statics = [
    solid(0, 0, T.VIEW_W, T.CEIL_Y), // ceiling
    solid(0, 0, T.WALL, T.VIEW_H), // left wall
    solid(T.VIEW_W - T.WALL, 0, T.WALL, T.VIEW_H), // right wall
    floor(T.WALL, T.SECTIONS_X), // start runway
    floor(floorStart, T.VIEW_W - T.WALL), // end runway
  ]
  return new World(traps, statics, def.doorTroll)
}

/**
 * Lower bound on a legit clear, used to reject impossible submissions:
 * running flat out from spawn to the door with no waiting.
 */
export function minClearMs(def: LevelDef): number {
  const doorX = def.doorTroll ? T.DOOR_X + T.DOOR_HOP : T.DOOR_X + T.DOOR_HOP
  return Math.floor(((doorX - T.SPAWN_X) / T.RUN_SPEED) * 1000 * 0.9)
}
