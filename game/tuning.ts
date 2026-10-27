// Every number that shapes how the game feels lives here.

export const VIEW_W = 320
export const VIEW_H = 180

export const TICK_HZ = 120
export const DT = 1 / TICK_HZ

// Player body (hitbox, px)
export const PLAYER_W = 6
export const PLAYER_H = 10

// Movement (px/s, px/s²)
export const RUN_SPEED = 70
export const GROUND_ACCEL = 1400
export const GROUND_DECEL = 1800
export const AIR_ACCEL = 1100
export const AIR_DECEL = 700
export const GRAVITY = 950
export const JUMP_VELOCITY = 270
export const JUMP_CUT = 0.42 // upward velocity multiplier when jump is released early
export const MAX_FALL = 320

// Forgiveness (s)
export const COYOTE_TIME = 0.08
export const JUMP_BUFFER = 0.1

// Flow (s)
export const DEATH_FREEZE = 0.06
export const RESPAWN_DELAY = 0.4

// Level geometry (px)
export const WALL = 6
export const CEIL_Y = 28
export const FLOOR_Y = 148
export const SPAWN_X = 14
export const START_RUNWAY = 36
export const SECTION_W = 55
export const SECTION_COUNT = 4
export const SECTIONS_X = WALL + START_RUNWAY // 42
export const END_X = SECTIONS_X + SECTION_W * SECTION_COUNT // 262
export const DOOR_W = 10
export const DOOR_H = 16
export const DOOR_X = END_X + 6 // 268 with the troll, otherwise moved to its final spot
export const DOOR_HOP = 36
export const DOOR_TROLL_CHANCE = 0.65
export const KILL_Y = VIEW_H + 6

// Juice
export const SHAKE_DEATH = 3
export const SHAKE_SLAM = 2
export const SHAKE_DECAY = 14 // per second, exponential
