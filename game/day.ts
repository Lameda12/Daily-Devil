const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
export const LAUNCH_DAY = '2026-10-27'
const MS_DAY = 86_400_000

export const dayKey = (d: Date = new Date()) => d.toISOString().slice(0, 10)

export function isValidDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false
  const d = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && dayKey(d) === day
}

export const dayToMs = (day: string) => Date.parse(`${day}T00:00:00Z`)

export const addDays = (day: string, n: number) => dayKey(new Date(dayToMs(day) + n * MS_DAY))

/** Level number, #1 on launch day. */
export const levelNumber = (day: string) => Math.round((dayToMs(day) - dayToMs(LAUNCH_DAY)) / MS_DAY) + 1

/** Milliseconds until the next 00:00 UTC. */
export function msUntilNextDay(now = Date.now()): number {
  return MS_DAY - (now % MS_DAY)
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 100)) / 10
  const m = Math.floor(total / 60)
  const s = total - m * 60
  return m > 0 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)}s`
}
