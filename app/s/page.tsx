import type { Metadata } from 'next'
import Link from 'next/link'
import { formatTime, isValidDay, levelNumber } from '@/game/day'
import { TIER_COLORS, parseGrid } from '@/lib/share'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

function read(sp: Record<string, string | string[] | undefined>) {
  const day = one(sp.day)
  const deaths = Number(one(sp.deaths))
  const time = Number(one(sp.time))
  if (!isValidDay(day) || !Number.isFinite(deaths) || !Number.isFinite(time) || deaths < 0 || time < 0) return null
  return { day, deaths: Math.floor(deaths), time: Math.floor(time), grid: parseGrid(one(sp.grid)).slice(0, 4), gridCode: one(sp.grid) }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const r = read(await searchParams)
  if (!r) return { title: 'Daily Devil' }
  const title = `Daily Devil #${levelNumber(r.day)}: ${r.deaths} ${r.deaths === 1 ? 'death' : 'deaths'} in ${formatTime(r.time)}`
  const og = `/api/og?${new URLSearchParams({ day: r.day, deaths: String(r.deaths), time: String(r.time), grid: r.gridCode })}`
  return {
    title,
    description: 'One troll platformer level a day. Same level for everyone.',
    openGraph: { title, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title, images: [og] },
  }
}

export default async function SharePage({ searchParams }: Props) {
  const r = read(await searchParams)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="font-pixel text-3xl">
        Daily <span className="text-blood">Devil</span>
      </h1>
      {r ? (
        <section className="border border-line bg-panel p-5">
          <p className="font-pixel text-xs text-mute">#{levelNumber(r.day)} · {r.day}</p>
          <p className="mt-2 font-pixel text-2xl">
            <span className="text-blood">{r.deaths}</span> {r.deaths === 1 ? 'death' : 'deaths'} · {formatTime(r.time)}
          </p>
          {r.grid.length > 0 && (
            <div className="mt-4 flex gap-2" aria-label="Deaths per trap section">
              {r.grid.map((t, i) => (
                <span key={i} className="block size-8" style={{ background: TIER_COLORS[t] }} />
              ))}
              <span className="relative block h-8 w-6 bg-ox">
                <span className="absolute inset-x-1 top-1 bottom-0 bg-ink" />
              </span>
            </div>
          )}
        </section>
      ) : (
        <p className="text-mute">One troll platformer level a day. Same level for everyone.</p>
      )}
      <div className="flex flex-col gap-2">
        <Link href="/" className="border border-blood bg-blood px-4 py-3 text-center font-pixel text-sm text-ink hover:bg-bone">
          Play today’s level
        </Link>
        {r && (
          <Link href={`/d/${r.day}`} className="border border-line px-4 py-3 text-center font-pixel text-sm hover:border-bone">
            Practice that day
          </Link>
        )}
      </div>
    </main>
  )
}
