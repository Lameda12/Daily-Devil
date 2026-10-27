import { NextResponse } from 'next/server'
import { isValidDay } from '@/game/day'
import { getStore } from '@/lib/server/store'

export async function GET(_req: Request, ctx: { params: Promise<{ day: string }> }) {
  const { day } = await ctx.params
  if (!isValidDay(day)) return NextResponse.json({ error: 'invalid day' }, { status: 400 })
  const store = getStore()
  if (!store) return NextResponse.json({ error: 'offline' }, { status: 503 })
  try {
    const stats = await store.stats(day)
    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=30' },
    })
  } catch (err) {
    console.error('day: store failed', err)
    return NextResponse.json({ error: 'offline' }, { status: 503 })
  }
}
