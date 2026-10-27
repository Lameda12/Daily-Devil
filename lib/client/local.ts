// Local-only persistence. Every access is guarded: storage can be missing or throw.
import { addDays } from '@/game/day'

export interface ClearRecord {
  timeMs: number
  deaths: number
  sectionDeaths: number[]
  inputsHash: string
}

export interface DayState {
  deaths: number
  sectionDeaths: number[]
  marks: number[] // flat x,y pairs of your own deaths
  firstInputAt: number | null
  cleared: ClearRecord | null
}

export interface Streak {
  current: number
  best: number
  last: string | null
}

export type MotionPref = 'auto' | 'reduce' | 'full'

const K = 'dd:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(K + key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(K + key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: the game still works for this session */
  }
}

const emptyDay = (): DayState => ({ deaths: 0, sectionDeaths: [0, 0, 0, 0], marks: [], firstInputAt: null, cleared: null })

export const loadDay = (day: string) => read<DayState>(`day:${day}`, emptyDay())

export function saveDay(day: string, s: DayState) {
  if (s.marks.length > 1200) s.marks = s.marks.slice(-1200)
  write(`day:${day}`, s)
}

/** Drop per-day records older than a week. */
export function pruneDays(today: string) {
  try {
    const cutoff = addDays(today, -7)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${K}day:`) && key.slice(K.length + 4) < cutoff) localStorage.removeItem(key)
    }
  } catch {
    /* ignore */
  }
}

export const loadStreak = () => read<Streak>('streak', { current: 0, best: 0, last: null })

export function recordStreak(day: string): Streak {
  const s = loadStreak()
  if (s.last === day) return s
  s.current = s.last === addDays(day, -1) ? s.current + 1 : 1
  s.best = Math.max(s.best, s.current)
  s.last = day
  write('streak', s)
  return s
}

/** A streak only survives if yesterday (or today) was cleared. */
export function liveStreak(today: string): Streak {
  const s = loadStreak()
  if (s.last !== today && s.last !== addDays(today, -1)) return { ...s, current: 0 }
  return s
}

export const loadSettings = () => read<{ muted: boolean; motion: MotionPref }>('settings', { muted: false, motion: 'auto' })
export const saveSettings = (s: { muted: boolean; motion: MotionPref }) => write('settings', s)
