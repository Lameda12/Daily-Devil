// Talks to the API. Every call degrades to "offline" instead of throwing.

export interface DayStats {
  deaths: [number, number][]
  players: number
  clears: number
  totalDeaths: number
  avgDeaths: number
  medianDeaths: number
  medianTime: number
}

export interface DeathEvent {
  x: number
  y: number
  section: number
}

export async function fetchDay(day: string): Promise<DayStats | null> {
  try {
    const res = await fetch(`/api/day/${day}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as DayStats
  } catch {
    return null
  }
}

export async function postClear(body: { day: string; deaths: number; timeMs: number; inputsHash: string }): Promise<boolean> {
  try {
    const res = await fetch('/api/clear', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    })
    return res.ok
  } catch {
    return false
  }
}

/** Batches deaths and ships them every 2s, on clear, and when the tab hides. */
export class DeathReporter {
  private queue: DeathEvent[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private inFlight = false

  constructor(private readonly day: string) {}

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.flush(true)
  }

  start() {
    this.timer = setInterval(() => void this.flush(), 2000)
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('pagehide', this.onVisibility)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.onVisibility)
    this.flush(true)
  }

  push(d: DeathEvent) {
    if (this.queue.length < 200) this.queue.push(d)
  }

  async flush(beacon = false): Promise<void> {
    if (!this.queue.length || this.inFlight) return
    const batch = this.queue.splice(0, 50)
    const body = JSON.stringify({ day: this.day, deaths: batch })
    if (beacon && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon('/api/death', new Blob([body], { type: 'application/json' }))) return
    }
    this.inFlight = true
    try {
      const res = await fetch('/api/death', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true })
      // Rate limited: put them back for the next flush. Anything else (offline, 503) is dropped.
      if (res.status === 429) this.queue.unshift(...batch)
    } catch {
      /* offline: local stats still have them */
    } finally {
      this.inFlight = false
    }
  }
}
