import { Redis } from '@upstash/redis'

export interface DeathIn {
  x: number
  y: number
  section: number
}

export interface DayStats {
  deaths: [number, number][]
  players: number
  clears: number
  totalDeaths: number
  avgDeaths: number
  medianDeaths: number
  medianTime: number
}

export interface Store {
  /** True if the player may make a request now (1 per window). */
  rateLimit(player: string, windowMs: number): Promise<boolean>
  addDeaths(day: string, player: string, deaths: DeathIn[]): Promise<void>
  /** False if this player already has a clear recorded for the day. */
  addClear(day: string, player: string, deaths: number, timeMs: number, inputsHash: string): Promise<boolean>
  stats(day: string): Promise<DayStats>
}

export const DEATH_CAP = 5000
export const SAMPLE_CAP = 2000
const DEATHS_TTL = 3 * 86_400
const STATS_TTL = 30 * 86_400

/** Evenly thin a list to at most `cap` entries (keeps the spatial spread honest). */
export function sample<T>(items: T[], cap: number): T[] {
  if (items.length <= cap) return items
  const out: T[] = []
  const step = items.length / cap
  for (let i = 0; i < cap; i++) out.push(items[Math.floor(i * step)])
  return out
}

const encodeDeath = (d: DeathIn) => `${d.x},${d.y},${d.section}`
function decodeDeath(s: string): [number, number] | null {
  const [x, y] = String(s).split(',').map(Number)
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null
}

const median = (sortedScores: number[]) => (sortedScores.length ? sortedScores[Math.floor((sortedScores.length - 1) / 2)] : 0)

export class RedisStore implements Store {
  constructor(private readonly r: Redis) {}

  async rateLimit(player: string, windowMs: number) {
    return (await this.r.set(`rl:${player}`, 1, { px: windowMs, nx: true })) === 'OK'
  }

  async addDeaths(day: string, player: string, deaths: DeathIn[]) {
    if (!deaths.length) return
    const p = this.r.pipeline()
    p.lpush(`deaths:${day}`, ...deaths.map(encodeDeath))
    p.ltrim(`deaths:${day}`, 0, DEATH_CAP - 1)
    p.expire(`deaths:${day}`, DEATHS_TTL)
    p.hincrby(`stats:${day}`, 'deaths', deaths.length)
    p.expire(`stats:${day}`, STATS_TTL)
    p.pfadd(`players:${day}`, player)
    p.expire(`players:${day}`, STATS_TTL)
    await p.exec()
  }

  async addClear(day: string, player: string, deaths: number, timeMs: number, inputsHash: string) {
    const added = await this.r.zadd(`clears:${day}`, { nx: true }, { score: timeMs, member: player })
    if (!added) return false
    const p = this.r.pipeline()
    p.zadd(`cleardeaths:${day}`, { score: deaths, member: player })
    p.hset(`clearhash:${day}`, { [player]: inputsHash })
    p.hincrby(`stats:${day}`, 'clearDeaths', deaths)
    p.pfadd(`players:${day}`, player)
    for (const k of ['clears', 'cleardeaths', 'clearhash', 'stats', 'players']) p.expire(`${k}:${day}`, STATS_TTL)
    await p.exec()
    return true
  }

  async stats(day: string): Promise<DayStats> {
    const [raw, players, clears, counters] = await this.r
      .pipeline()
      .lrange<string>(`deaths:${day}`, 0, DEATH_CAP - 1)
      .pfcount(`players:${day}`)
      .zcard(`clears:${day}`)
      .hgetall<Record<string, number | string>>(`stats:${day}`)
      .exec<[string[], number, number, Record<string, number | string> | null]>()
    let medianTime = 0
    let medianDeaths = 0
    if (clears > 0) {
      const mid = Math.floor((clears - 1) / 2)
      const [t, d] = await this.r
        .pipeline()
        .zrange<(string | number)[]>(`clears:${day}`, mid, mid, { withScores: true })
        .zrange<(string | number)[]>(`cleardeaths:${day}`, mid, mid, { withScores: true })
        .exec<[(string | number)[], (string | number)[]]>()
      medianTime = Number(t?.[1] ?? 0)
      medianDeaths = Number(d?.[1] ?? 0)
    }
    const totalDeaths = Number(counters?.deaths ?? 0)
    const clearDeaths = Number(counters?.clearDeaths ?? 0)
    const deaths = sample((raw ?? []).map(decodeDeath).filter((d): d is [number, number] => d !== null), SAMPLE_CAP)
    return {
      deaths,
      players: Math.max(players, clears),
      clears,
      totalDeaths,
      avgDeaths: clears ? Math.round((clearDeaths / clears) * 10) / 10 : 0,
      medianDeaths,
      medianTime,
    }
  }
}

/** In-process store for local dev and tests. Not shared between serverless instances. */
export class MemoryStore implements Store {
  private rl = new Map<string, number>()
  private days = new Map<string, { deaths: string[]; total: number; players: Set<string>; clears: Map<string, { deaths: number; timeMs: number }> }>()

  private day(day: string) {
    let d = this.days.get(day)
    if (!d) this.days.set(day, (d = { deaths: [], total: 0, players: new Set(), clears: new Map() }))
    return d
  }

  async rateLimit(player: string, windowMs: number) {
    const now = Date.now()
    if ((this.rl.get(player) ?? 0) > now) return false
    this.rl.set(player, now + windowMs)
    return true
  }

  async addDeaths(day: string, player: string, deaths: DeathIn[]) {
    const d = this.day(day)
    d.deaths.unshift(...deaths.map(encodeDeath).reverse())
    d.deaths.length = Math.min(d.deaths.length, DEATH_CAP)
    d.total += deaths.length
    d.players.add(player)
  }

  async addClear(day: string, player: string, deaths: number, timeMs: number) {
    const d = this.day(day)
    if (d.clears.has(player)) return false
    d.clears.set(player, { deaths, timeMs })
    d.players.add(player)
    return true
  }

  async stats(day: string): Promise<DayStats> {
    const d = this.day(day)
    const cl = [...d.clears.values()]
    return {
      deaths: sample(d.deaths.map(decodeDeath).filter((x): x is [number, number] => x !== null), SAMPLE_CAP),
      players: d.players.size,
      clears: cl.length,
      totalDeaths: d.total,
      avgDeaths: cl.length ? Math.round((cl.reduce((a, c) => a + c.deaths, 0) / cl.length) * 10) / 10 : 0,
      medianDeaths: median(cl.map((c) => c.deaths).sort((a, b) => a - b)),
      medianTime: median(cl.map((c) => c.timeMs).sort((a, b) => a - b)),
    }
  }
}

let cached: Store | null | undefined
const g = globalThis as unknown as { __ddMemoryStore?: MemoryStore }

/**
 * Upstash if configured (either the KV_* or UPSTASH_* env pair), an in-memory
 * store outside production, otherwise null and the API reports offline.
 */
export function getStore(): Store | null {
  if (cached !== undefined) return cached
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) cached = new RedisStore(new Redis({ url, token, automaticDeserialization: false }))
  else if (process.env.NODE_ENV !== 'production') cached = g.__ddMemoryStore ??= new MemoryStore()
  else cached = null
  return cached
}

export function setStoreForTests(store: Store | null) {
  cached = store
}
