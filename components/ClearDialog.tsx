'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCountdown, formatTime, msUntilNextDay } from '@/game/day'
import type { ClearRecord, Streak } from '@/lib/client/local'
import { TIER_COLORS, TIER_LABELS, shareText, shareUrl, tierFor } from '@/lib/share'

interface Props {
  day: string
  number: number
  record: ClearRecord
  practice: boolean
  archive: boolean
  streak: Streak
  onPractice(): void
  onClose(): void
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export default function ClearDialog({ day, number, record, practice, archive, streak, onPractice, onClose }: Props) {
  const primary = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  const [countdown, setCountdown] = useState('')

  useEffect(() => {
    primary.current?.focus()
    const tick = () => setCountdown(formatCountdown(msUntilNextDay()))
    tick()
    const t = setInterval(tick, 1000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const text = () => shareText({ number, deaths: record.deaths, timeMs: record.timeMs, sectionDeaths: record.sectionDeaths, url: shareUrl(location.origin, day, record.deaths, record.timeMs, record.sectionDeaths) })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="clear-title" className="w-full max-w-sm border border-line bg-panel p-5 shadow-[6px_6px_0_0_#2b0a07]">
        <p className="font-pixel text-xs text-mute">{practice ? 'Practice' : `Daily Devil #${number}`}</p>
        <h2 id="clear-title" className="mt-1 font-pixel text-2xl text-bone">
          {practice ? 'Cleared again' : 'You escaped'}
        </h2>

        <dl className="mt-4 grid grid-cols-2 gap-px border border-line bg-line text-sm">
          <div className="bg-panel p-3">
            <dt className="text-xs text-mute">Deaths</dt>
            <dd className="font-pixel text-xl text-blood tabular-nums">{record.deaths}</dd>
          </div>
          <div className="bg-panel p-3">
            <dt className="text-xs text-mute">Time</dt>
            <dd className="font-pixel text-xl tabular-nums">{formatTime(record.timeMs)}</dd>
          </div>
        </dl>

        {!practice && (
          <>
            <div className="mt-4 flex items-center gap-2" aria-label="Deaths per trap section">
              {record.sectionDeaths.map((d, i) => (
                <span key={i} title={`Trap ${i + 1}: ${TIER_LABELS[tierFor(d)]}`} className="block size-8" style={{ background: TIER_COLORS[tierFor(d)] }}>
                  <span className="sr-only">{`Trap ${i + 1}: ${d} deaths`}</span>
                </span>
              ))}
              <span className="relative block h-8 w-6 bg-ox" title="Door">
                <span className="absolute inset-x-1 top-1 bottom-0 bg-ink" />
                <span className="sr-only">Door</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-mute">
              Streak <span className="text-bone">{streak.current}</span> · best <span className="text-bone">{streak.best}</span>
            </p>
          </>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {!practice && (
            <button
              ref={primary}
              type="button"
              onClick={async () => setCopied(await copy(text()))}
              className="border border-blood bg-blood px-4 py-2 font-pixel text-sm text-ink hover:bg-bone"
            >
              {copied ? 'Copied' : 'Copy result'}
            </button>
          )}
          <button
            ref={practice ? primary : undefined}
            type="button"
            onClick={onPractice}
            className="border border-line px-4 py-2 font-pixel text-sm text-bone hover:border-bone"
          >
            {practice || archive ? 'Run again' : 'Practice run'}
          </button>
          <button type="button" onClick={onClose} className="px-4 py-1 text-xs text-mute hover:text-bone">
            Close
          </button>
        </div>

        <p className="mt-4 border-t border-line pt-3 text-xs text-mute">
          Next level in <span className="font-pixel text-bone tabular-nums">{countdown}</span>
          {!archive && !practice && <> · practice runs are not recorded</>}
        </p>
      </div>
    </div>
  )
}
