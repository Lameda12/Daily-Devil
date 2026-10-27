import { type NextRequest, NextResponse } from 'next/server'
import { cookieOptions, newPlayerId, PLAYER_COOKIE } from '@/lib/server/identity'

/** Hand every first-time visitor an anonymous player id. No accounts. */
export function proxy(req: NextRequest) {
  const res = NextResponse.next()
  if (!req.cookies.has(PLAYER_COOKIE)) res.cookies.set(PLAYER_COOKIE, newPlayerId(), cookieOptions())
  return res
}

export const config = {
  matcher: ['/', '/d/:path*', '/s'],
}
