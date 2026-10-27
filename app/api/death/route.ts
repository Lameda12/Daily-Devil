import { type NextRequest, NextResponse } from 'next/server'
import { attachId, identify } from '@/lib/server/identity'
import { getStore } from '@/lib/server/store'
import { parseDeathBody, readJson } from '@/lib/server/validate'

const RATE_WINDOW_MS = 300

export async function POST(req: NextRequest) {
  const who = identify(req)
  const reply = (body: unknown, status = 200) => attachId(NextResponse.json(body, { status }), who)

  let body: unknown
  try {
    body = await readJson(req)
  } catch {
    return reply({ error: 'invalid JSON' }, 400)
  }
  const parsed = parseDeathBody(body)
  if (!parsed.ok) return reply({ error: parsed.error }, 400)

  const store = getStore()
  if (!store) return reply({ error: 'offline' }, 503)
  try {
    if (!(await store.rateLimit(who.id, RATE_WINDOW_MS))) return reply({ error: 'slow down' }, 429)
    await store.addDeaths(parsed.value.day, who.id, parsed.value.deaths)
    return reply({ ok: true, stored: parsed.value.deaths.length })
  } catch (err) {
    console.error('death: store failed', err)
    return reply({ error: 'offline' }, 503)
  }
}
