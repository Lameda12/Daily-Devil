import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST as clearPOST } from '@/app/api/clear/route'
import { POST as deathPOST } from '@/app/api/death/route'
import { GET as dayGET } from '@/app/api/day/[day]/route'
import { dayKey } from '@/game/day'
import { generateLevel, minClearMs } from '@/game/level'
import { MemoryStore, sample, setStoreForTests } from '@/lib/server/store'
import { parseClearBody, parseDeathBody } from '@/lib/server/validate'

const today = dayKey()
const PID = '11111111-2222-4333-8444-555555555555'

const post = (path: string, body: unknown, pid: string | null = PID) =>
  new NextRequest(`http://test${path}`, {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(pid ? { cookie: `dd_pid=${pid}` } : {}) },
  })

const getDay = (day: string) => dayGET(new Request(`http://test/api/day/${day}`), { params: Promise.resolve({ day }) })

describe('validation', () => {
  it('accepts a death for today within bounds', () => {
    expect(parseDeathBody({ day: today, x: 100, y: 140, section: 2 }).ok).toBe(true)
  })

  it('rejects other days, out-of-bounds coordinates and bad sections', () => {
    expect(parseDeathBody({ day: '2020-01-01', x: 1, y: 1, section: 0 }).ok).toBe(false)
    expect(parseDeathBody({ day: today, x: -1, y: 1, section: 0 }).ok).toBe(false)
    expect(parseDeathBody({ day: today, x: 10, y: 181, section: 0 }).ok).toBe(false)
    expect(parseDeathBody({ day: today, x: 10, y: 10, section: 4 }).ok).toBe(false)
    expect(parseDeathBody({ day: today, x: 10, y: 10, section: 1.5 }).ok).toBe(false)
    expect(parseDeathBody({ day: today, x: '10', y: 10, section: 0 }).ok).toBe(false)
    expect(parseDeathBody(null).ok).toBe(false)
  })

  it('accepts batches up to 50', () => {
    const one = { x: 1, y: 1, section: 0 }
    expect(parseDeathBody({ day: today, deaths: Array(50).fill(one) }).ok).toBe(true)
    expect(parseDeathBody({ day: today, deaths: Array(51).fill(one) }).ok).toBe(false)
    expect(parseDeathBody({ day: today, deaths: [] }).ok).toBe(false)
  })

  it('rejects impossible clear times', () => {
    const min = minClearMs(generateLevel(today))
    expect(parseClearBody({ day: today, deaths: 3, timeMs: min - 1, inputsHash: 'deadbeef' }).ok).toBe(false)
    expect(parseClearBody({ day: today, deaths: 3, timeMs: min + 1, inputsHash: 'deadbeef' }).ok).toBe(true)
    expect(parseClearBody({ day: today, deaths: -1, timeMs: 9000, inputsHash: 'deadbeef' }).ok).toBe(false)
    expect(parseClearBody({ day: today, deaths: 1, timeMs: 9000, inputsHash: 'nothex!!' }).ok).toBe(false)
  })

  it('samples evenly', () => {
    const s = sample(Array.from({ length: 5000 }, (_, i) => i), 2000)
    expect(s).toHaveLength(2000)
    expect(s[0]).toBe(0)
    expect(s[1999]).toBeGreaterThan(4990)
  })
})

describe('routes (memory store)', () => {
  beforeEach(() => setStoreForTests(new MemoryStore()))
  afterEach(() => setStoreForTests(undefined as never))

  it('stores deaths and reports them', async () => {
    const res = await deathPOST(post('/api/death', { day: today, x: 120, y: 150, section: 1 }))
    expect(res.status).toBe(200)
    const stats = await (await getDay(today)).json()
    expect(stats.deaths).toEqual([[120, 150]])
    expect(stats.totalDeaths).toBe(1)
    expect(stats.players).toBe(1)
  })

  it('rate limits to one request per 300 ms per player', async () => {
    const body = { day: today, x: 1, y: 1, section: 0 }
    expect((await deathPOST(post('/api/death', body))).status).toBe(200)
    expect((await deathPOST(post('/api/death', body))).status).toBe(429)
    await new Promise((r) => setTimeout(r, 320))
    expect((await deathPOST(post('/api/death', body))).status).toBe(200)
  })

  it('issues an httpOnly id cookie when missing', async () => {
    const res = await deathPOST(post('/api/death', { day: today, x: 1, y: 1, section: 0 }, null))
    const set = res.headers.get('set-cookie') ?? ''
    expect(set).toMatch(/dd_pid=[0-9a-f-]{36}/)
    expect(set.toLowerCase()).toContain('httponly')
  })

  it('rejects bad JSON and bad payloads with 400', async () => {
    expect((await deathPOST(post('/api/death', '{nope'))).status).toBe(400)
    expect((await deathPOST(post('/api/death', { day: today, x: 999, y: 1, section: 0 }))).status).toBe(400)
  })

  it('records one clear per player and computes medians', async () => {
    const min = minClearMs(generateLevel(today))
    const a = await clearPOST(post('/api/clear', { day: today, deaths: 4, timeMs: min + 5000, inputsHash: 'deadbeef' }))
    expect(await a.json()).toEqual({ ok: true, recorded: true })
    const again = await clearPOST(post('/api/clear', { day: today, deaths: 0, timeMs: min + 1, inputsHash: 'deadbeef' }))
    expect(await again.json()).toEqual({ ok: true, recorded: false })
    await clearPOST(post('/api/clear', { day: today, deaths: 10, timeMs: min + 9000, inputsHash: 'cafebabe' }, '99999999-2222-4333-8444-555555555555'))
    const stats = await (await getDay(today)).json()
    expect(stats.clears).toBe(2)
    expect(stats.avgDeaths).toBe(7)
    expect(stats.medianDeaths).toBe(4)
    expect(stats.medianTime).toBe(min + 5000)
  })

  it('caches day stats at the edge for 15s and validates the day', async () => {
    const res = await getDay(today)
    expect(res.headers.get('cache-control')).toContain('s-maxage=15')
    expect((await getDay('2026-13-01')).status).toBe(400)
  })

  it('reports offline with 503 when no store is configured', async () => {
    setStoreForTests(null)
    expect((await deathPOST(post('/api/death', { day: today, x: 1, y: 1, section: 0 }))).status).toBe(503)
    expect((await getDay(today)).status).toBe(503)
  })
})
