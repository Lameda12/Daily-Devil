import { dayKey, isValidDay } from '@/game/day'
import { generateLevel, minClearMs } from '@/game/level'
import { SECTION_COUNT, VIEW_H, VIEW_W } from '@/game/tuning'
import type { DeathIn } from './store'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isInt = (v: unknown): v is number => Number.isInteger(v)

export const MAX_BATCH = 50
export const MAX_BODY = 8 * 1024

function checkToday(day: unknown, now: Date): Result<string> {
  if (typeof day !== 'string' || !isValidDay(day)) return { ok: false, error: 'invalid day' }
  if (day !== dayKey(now)) return { ok: false, error: 'day is not today (UTC)' }
  return { ok: true, value: day }
}

function checkDeath(v: unknown): DeathIn | null {
  if (!isObj(v)) return null
  const { x, y, section } = v
  if (!isNum(x) || !isNum(y) || x < 0 || x > VIEW_W || y < 0 || y > VIEW_H) return null
  if (!isInt(section) || section < 0 || section >= SECTION_COUNT) return null
  return { x: Math.round(x), y: Math.round(y), section }
}

/** Accepts `{ day, x, y, section }` or a batch `{ day, deaths: [{ x, y, section }] }`. */
export function parseDeathBody(body: unknown, now = new Date()): Result<{ day: string; deaths: DeathIn[] }> {
  if (!isObj(body)) return { ok: false, error: 'body must be an object' }
  const day = checkToday(body.day, now)
  if (!day.ok) return day
  const list = Array.isArray(body.deaths) ? body.deaths : [body]
  if (list.length === 0 || list.length > MAX_BATCH) return { ok: false, error: `send 1 to ${MAX_BATCH} deaths` }
  const deaths: DeathIn[] = []
  for (const item of list) {
    const d = checkDeath(item)
    if (!d) return { ok: false, error: 'x, y or section out of bounds' }
    deaths.push(d)
  }
  return { ok: true, value: { day: day.value, deaths } }
}

export function parseClearBody(body: unknown, now = new Date()): Result<{ day: string; deaths: number; timeMs: number; inputsHash: string }> {
  if (!isObj(body)) return { ok: false, error: 'body must be an object' }
  const day = checkToday(body.day, now)
  if (!day.ok) return day
  const { deaths, timeMs, inputsHash } = body
  if (!isInt(deaths) || deaths < 0 || deaths > 1_000_000) return { ok: false, error: 'invalid deaths' }
  if (!isInt(timeMs) || timeMs > 2 * 86_400_000) return { ok: false, error: 'invalid timeMs' }
  if (timeMs < minClearMs(generateLevel(day.value))) return { ok: false, error: 'impossible time' }
  if (typeof inputsHash !== 'string' || !/^[0-9a-f]{8}$/.test(inputsHash)) return { ok: false, error: 'invalid inputsHash' }
  return { ok: true, value: { day: day.value, deaths, timeMs, inputsHash } }
}

export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > MAX_BODY) throw new Error('body too large')
  const text = await req.text()
  if (text.length > MAX_BODY) throw new Error('body too large')
  return JSON.parse(text)
}
