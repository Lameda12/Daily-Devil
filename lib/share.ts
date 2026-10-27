import { formatTime } from '@/game/day'

export const TIER_EMOJI = ['🟩', '🟨', '🟧', '🟥'] as const
export const TIER_COLORS = ['#5f9e5a', '#d9b13b', '#e07a2b', '#e0412b'] as const
export const TIER_LABELS = ['no deaths', '1 to 2 deaths', '3 to 5 deaths', '6 or more deaths'] as const

export const tierFor = (deaths: number) => (deaths <= 0 ? 0 : deaths <= 2 ? 1 : deaths <= 5 ? 2 : 3)

/** Compact grid code for URLs, one digit per section: "0132". */
export const gridCode = (sectionDeaths: number[]) => sectionDeaths.map(tierFor).join('')

export const parseGrid = (code: string | null | undefined): number[] =>
  /^[0-3]{1,8}$/.test(code ?? '') ? [...code!].map(Number) : []

export interface ShareInput {
  number: number
  deaths: number
  timeMs: number
  sectionDeaths: number[]
  url: string
}

export function shareText({ number, deaths, timeMs, sectionDeaths, url }: ShareInput): string {
  const grid = sectionDeaths.map((d) => TIER_EMOJI[tierFor(d)]).join('') + '🚪'
  return `Daily Devil #${number}\n${deaths} ${deaths === 1 ? 'death' : 'deaths'} · ${formatTime(timeMs)}\n${grid}\n${url}`
}

export function shareUrl(origin: string, day: string, deaths: number, timeMs: number, sectionDeaths: number[]) {
  const q = new URLSearchParams({ day, deaths: String(deaths), time: String(timeMs), grid: gridCode(sectionDeaths) })
  return `${origin}/s?${q}`
}
