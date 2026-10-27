import { type NextRequest, NextResponse } from 'next/server'
import { attachId, identify } from '@/lib/server/identity'
import { getStore } from '@/lib/server/store'
import { parseClearBody, readJson } from '@/lib/server/validate'

export async function POST(req: NextRequest) {
  const who = identify(req)
  const reply = (body: unknown, status = 200) => attachId(NextResponse.json(body, { status }), who)

  let body: unknown
  try {
    body = await readJson(req)
  } catch {
    return reply({ error: 'invalid JSON' }, 400)
  }
  const parsed = parseClearBody(body)
  if (!parsed.ok) return reply({ error: parsed.error }, 400)

  const store = getStore()
  if (!store) return reply({ error: 'offline' }, 503)
  try {
    const { day, deaths, timeMs, inputsHash } = parsed.value
    const recorded = await store.addClear(day, who.id, deaths, timeMs, inputsHash)
    return reply({ ok: true, recorded })
  } catch (err) {
    console.error('clear: store failed', err)
    return reply({ error: 'offline' }, 503)
  }
}
