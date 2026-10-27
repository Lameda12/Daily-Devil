import { ImageResponse } from 'next/og'
import { formatTime, isValidDay, levelNumber } from '@/game/day'
import { TIER_COLORS, parseGrid } from '@/lib/share'

const SKY = '#625859'
const OX = '#2b0a07'
const BLOOD = '#e0412b'
const PAGE = '#0e0909'
const BONE = '#e8dedb'

let fontCache: Promise<ArrayBuffer | null> | null = null

/** Silkscreen from Google Fonts as TTF (Satori can't read woff2). Falls back to the default font. */
function silkscreen(): Promise<ArrayBuffer | null> {
  fontCache ??= (async () => {
    try {
      const css = await (await fetch('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400', { headers: { 'User-Agent': 'curl/8' } })).text()
      const url = css.match(/src:\s*url\((.+?)\)\s*format\('(?:truetype|opentype)'\)/)?.[1]
      if (!url) return null
      const res = await fetch(url)
      return res.ok ? await res.arrayBuffer() : null
    } catch {
      return null
    }
  })()
  return fontCache
}

const clampInt = (v: string | null, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : null
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const day = q.get('day')
  const valid = day && isValidDay(day)
  const deaths = clampInt(q.get('deaths'), 99_999)
  const time = clampInt(q.get('time'), 86_400_000 * 2)
  const grid = parseGrid(q.get('grid')).slice(0, 4)
  const result = valid && deaths !== null && time !== null
  const font = await silkscreen()

  const heading = valid ? `DAILY DEVIL #${levelNumber(day)}` : 'DAILY DEVIL'
  const line = result ? `${deaths} ${deaths === 1 ? 'DEATH' : 'DEATHS'} · ${formatTime(time).toUpperCase()}` : 'ONE TROLL LEVEL A DAY'
  const sub = result ? 'Same level for everyone. Can you do better?' : 'Everyone gets the same level. The crowd’s deaths are your hints.'

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: PAGE, padding: 40, fontFamily: font ? 'Silkscreen' : 'monospace' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: `24px solid ${OX}`, background: SKY, position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '40px 56px', flex: 1 }}>
            <div style={{ display: 'flex', fontSize: 40, color: OX, letterSpacing: 2 }}>{heading}</div>
            <div style={{ display: 'flex', fontSize: 84, color: BONE, marginTop: 20, lineHeight: 1 }}>{line}</div>
            <div style={{ display: 'flex', gap: 18, marginTop: 40 }}>
              {(grid.length ? grid : [0, 1, 2, 3]).map((t, i) => (
                <div key={i} style={{ width: 84, height: 84, background: grid.length ? TIER_COLORS[t] : OX, opacity: grid.length ? 1 : 0.35 }} />
              ))}
              <div style={{ width: 60, height: 84, background: OX, display: 'flex', padding: '10px 10px 0 10px' }}>
                <div style={{ flex: 1, background: '#140403' }} />
              </div>
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: '#2a1d1d', marginTop: 'auto', fontFamily: 'monospace' }}>{sub}</div>
          </div>
          {/* the devil */}
          <div style={{ position: 'absolute', right: 70, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', width: 72, justifyContent: 'space-between' }}>
              <div style={{ width: 12, height: 24, background: '#0d0707' }} />
              <div style={{ width: 12, height: 24, background: '#0d0707' }} />
            </div>
            <div style={{ width: 72, height: 96, background: '#0d0707', display: 'flex', justifyContent: 'flex-end', padding: '24px 12px' }}>
              <div style={{ width: 12, height: 12, background: SKY }} />
            </div>
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: -24, height: 24, background: OX }} />
          {/* a death mark */}
          <div style={{ position: 'absolute', right: 160, bottom: 14, width: 44, height: 44, display: 'flex' }}>
            <div style={{ position: 'absolute', left: 18, top: -4, width: 8, height: 52, background: BLOOD, transform: 'rotate(45deg)' }} />
            <div style={{ position: 'absolute', left: 18, top: -4, width: 8, height: 52, background: BLOOD, transform: 'rotate(-45deg)' }} />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: font ? [{ name: 'Silkscreen', data: font, style: 'normal', weight: 400 }] : undefined,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, immutable' },
    },
  )
}
