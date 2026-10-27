import type { NextRequest, NextResponse } from 'next/server'

export const PLAYER_COOKIE = 'dd_pid'
const ID_RE = /^[0-9a-f-]{36}$/

export const newPlayerId = () => crypto.randomUUID()

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 365 * 86_400,
  }
}

/** Existing anonymous id from the cookie, or a fresh one the response must set. */
export function identify(req: NextRequest): { id: string; isNew: boolean } {
  const v = req.cookies.get(PLAYER_COOKIE)?.value
  return v && ID_RE.test(v) ? { id: v, isNew: false } : { id: newPlayerId(), isNew: true }
}

export function attachId(res: NextResponse, who: { id: string; isNew: boolean }) {
  if (who.isNew) res.cookies.set(PLAYER_COOKIE, who.id, cookieOptions())
  return res
}
