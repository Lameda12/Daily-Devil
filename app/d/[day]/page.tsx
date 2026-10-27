import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GameView from '@/components/GameView'
import { dayKey, isValidDay, levelNumber } from '@/game/day'

type Props = { params: Promise<{ day: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { day } = await params
  if (!isValidDay(day)) return {}
  const n = levelNumber(day)
  return {
    title: `Daily Devil #${n} (${day})`,
    description: `Practice Daily Devil #${n} with that day's death marks.`,
    openGraph: { images: [`/api/og?day=${day}`] },
  }
}

export default async function ArchiveDay({ params }: Props) {
  const { day } = await params
  // Valid dates only, and no peeking at tomorrow.
  if (!isValidDay(day) || day > dayKey() || levelNumber(day) < 1) notFound()
  return <GameView mode="archive" day={day} />
}
