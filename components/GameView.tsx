'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Sfx } from '@/game/audio'
import { dayKey, formatCountdown, formatTime, levelNumber, msUntilNextDay } from '@/game/day'
import { Game } from '@/game/engine'
import { generateLevel } from '@/game/level'
import { type ClearRecord, type DayState, type MotionPref, type Streak, liveStreak, loadDay, loadSettings, pruneDays, recordStreak, saveDay, saveSettings } from '@/lib/client/local'
import { type DayStats, DeathReporter, fetchDay, postClear } from '@/lib/client/net'
import ClearDialog from './ClearDialog'
import TouchPads from './TouchPads'

type Mode = 'daily' | 'archive'
type Stats = DayStats | 'offline' | null

const nf = new Intl.NumberFormat('en-US')

function flattenMarks(deaths: [number, number][]): Float32Array {
  const out = new Float32Array(deaths.length * 2)
  for (let i = 0; i < deaths.length; i++) {
    out[i * 2] = deaths[i][0]
    out[i * 2 + 1] = deaths[i][1]
  }
  return out
}

export default function GameView({ mode, day: fixedDay }: { mode: Mode; day?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const sfxRef = useRef<Sfx>(new Sfx())
  const deathsEl = useRef<HTMLSpanElement>(null)
  const timeEl = useRef<HTMLSpanElement>(null)
  const countdownEl = useRef<HTMLSpanElement>(null)

  const [day, setDay] = useState<string | null>(fixedDay ?? null)
  const [stats, setStats] = useState<Stats>(null)
  const [practice, setPractice] = useState(mode === 'archive')
  const [dialog, setDialog] = useState<{ record: ClearRecord; practice: boolean } | null>(null)
  const [streak, setStreak] = useState<Streak>({ current: 0, best: 0, last: null })
  const [settings, setSettings] = useState<{ muted: boolean; motion: MotionPref }>({ muted: false, motion: 'auto' })
  const [stale, setStale] = useState(false)

  // Mutable game-session state the loop callbacks read without re-rendering.
  const s = useRef({
    local: null as DayState | null,
    practice: mode === 'archive',
    practiceDeaths: 0,
    practiceStart: null as number | null,
    motion: 'auto' as MotionPref,
    mq: null as MediaQueryList | null,
  })

  useEffect(() => {
    const st = loadSettings()
    setSettings(st)
    s.current.motion = st.motion
    sfxRef.current.muted = st.muted
    s.current.mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fixedDay) setDay(dayKey())
  }, [fixedDay])

  const refreshStats = useCallback(async (d: string) => {
    const res = await fetchDay(d)
    setStats(res ?? 'offline')
    if (res) gameRef.current?.setCrowd(flattenMarks(res.deaths))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!day || !canvas) return
    const recordable = mode === 'daily'
    const ss = s.current
    const local = recordable ? loadDay(day) : null
    ss.local = local
    if (recordable) {
      pruneDays(day)
      setStreak(liveStreak(day))
    }
    if (local?.cleared) {
      ss.practice = true
      setPractice(true)
      setDialog({ record: local.cleared, practice: false })
    }

    const reporter = recordable ? new DeathReporter(day) : null
    const isRecording = () => recordable && !ss.practice && !ss.local?.cleared

    const game = new Game(canvas, generateLevel(day), {
      sfx: sfxRef.current,
      reducedMotion: () => ss.motion === 'reduce' || (ss.motion === 'auto' && !!ss.mq?.matches),
      hooks: {
        onFirstInput() {
          if (isRecording() && ss.local && !ss.local.firstInputAt) {
            ss.local.firstInputAt = Date.now()
            saveDay(day, ss.local)
          }
          if (ss.practice && !ss.practiceStart) ss.practiceStart = Date.now()
        },
        onDeath(x, y, section) {
          if (isRecording() && ss.local) {
            const l = ss.local
            l.deaths++
            l.sectionDeaths[section] = (l.sectionDeaths[section] ?? 0) + 1
            l.marks.push(Math.round(x), Math.round(y))
            saveDay(day, l)
            reporter?.push({ x: Math.round(x), y: Math.round(y), section })
          } else {
            ss.practiceDeaths++
          }
        },
        onClear(inputsHash) {
          if (isRecording() && ss.local) {
            const l = ss.local
            const timeMs = Date.now() - (l.firstInputAt ?? Date.now())
            const record: ClearRecord = { timeMs, deaths: l.deaths, sectionDeaths: l.sectionDeaths.slice(), inputsHash }
            l.cleared = record
            saveDay(day, l)
            setStreak(recordStreak(day))
            void reporter?.flush().then(() =>
              postClear({ day, deaths: record.deaths, timeMs: record.timeMs, inputsHash }).then(() => refreshStats(day)),
            )
            ss.practice = true
            setPractice(true)
            setDialog({ record, practice: false })
          } else {
            const timeMs = Date.now() - (ss.practiceStart ?? Date.now())
            setDialog({ record: { timeMs, deaths: ss.practiceDeaths, sectionDeaths: [], inputsHash }, practice: true })
          }
          game.input.enabled = false
          game.input.releaseAll()
        },
      },
    })
    if (local) game.own.load(local.marks)
    gameRef.current = game
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __dd?: Game }).__dd = game
    game.input.enabled = !local?.cleared
    game.start()
    reporter?.start()
    canvas.focus({ preventScroll: true })
    void refreshStats(day)
    const statsTimer = setInterval(() => void refreshStats(day), 60_000)

    const hud = setInterval(() => {
      const l = ss.local
      const now = Date.now()
      if (deathsEl.current) deathsEl.current.textContent = nf.format(ss.practice ? ss.practiceDeaths : (l?.deaths ?? 0))
      if (timeEl.current) {
        const ms = ss.practice
          ? ss.practiceStart ? now - ss.practiceStart : 0
          : l?.cleared ? l.cleared.timeMs : l?.firstInputAt ? now - l.firstInputAt : 0
        timeEl.current.textContent = formatTime(ms)
      }
      if (countdownEl.current) countdownEl.current.textContent = formatCountdown(msUntilNextDay(now))
      if (mode === 'daily' && dayKey(new Date(now)) !== day) setStale(true)
    }, 100)

    return () => {
      clearInterval(hud)
      clearInterval(statsTimer)
      reporter?.stop()
      game.stop()
      gameRef.current = null
    }
  }, [day, mode, refreshStats])

  const startPractice = useCallback(() => {
    const game = gameRef.current
    if (!game) return
    s.current.practice = true
    s.current.practiceDeaths = 0
    s.current.practiceStart = null
    setPractice(true)
    setDialog(null)
    game.input.resetFirstInput()
    game.restart()
    game.input.enabled = true
    canvasRef.current?.focus({ preventScroll: true })
  }, [])

  const closeDialog = useCallback(() => {
    setDialog(null)
    const game = gameRef.current
    if (game && game.world.status !== 'cleared') game.input.enabled = true
    canvasRef.current?.focus({ preventScroll: true })
  }, [])

  const toggleMute = () => {
    const next = { ...settings, muted: !settings.muted }
    sfxRef.current.muted = next.muted
    if (!next.muted) sfxRef.current.unlock()
    setSettings(next)
    saveSettings(next)
  }

  const cycleMotion = () => {
    const order: MotionPref[] = ['auto', 'reduce', 'full']
    const next = { ...settings, motion: order[(order.indexOf(settings.motion) + 1) % order.length] }
    s.current.motion = next.motion
    setSettings(next)
    saveSettings(next)
  }

  const num = day ? levelNumber(day) : null
  const st = stats && stats !== 'offline' ? stats : null

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-3 px-4 py-4 sm:py-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-pixel text-2xl leading-none tracking-wide text-bone sm:text-3xl">
            Daily <span className="text-blood">Devil</span>
          </h1>
          <p className="mt-1 h-4 text-xs text-mute">
            {num !== null ? `#${num} · ${day}` : ' '}
            {mode === 'archive' ? ' · archive practice' : ''}
          </p>
        </div>
        <nav className="flex gap-2 text-xs">
          <button type="button" onClick={toggleMute} aria-pressed={settings.muted} className="border border-line px-2 py-1 text-mute hover:text-bone">
            Sound {settings.muted ? 'off' : 'on'}
          </button>
          <button type="button" onClick={cycleMotion} className="border border-line px-2 py-1 text-mute hover:text-bone" aria-label={`Motion: ${settings.motion}. Change motion setting`}>
            Motion {settings.motion}
          </button>
        </nav>
      </header>

      <div className="grid grid-cols-3 border border-line bg-panel font-pixel text-[11px] sm:text-sm" role="status" aria-live="off">
        <div className="px-3 py-2">
          <span className="block text-[9px] text-mute sm:text-[10px]">{practice ? 'Practice deaths' : 'Deaths'}</span>
          <span ref={deathsEl} className="text-blood tabular-nums">0</span>
        </div>
        <div className="border-x border-line px-3 py-2">
          <span className="block text-[9px] text-mute sm:text-[10px]">Time</span>
          <span ref={timeEl} className="tabular-nums">0.0s</span>
        </div>
        <div className="px-3 py-2 text-right">
          <span className="block text-[9px] text-mute sm:text-[10px]">Next level</span>
          <span ref={countdownEl} className="tabular-nums">--:--:--</span>
        </div>
      </div>

      <div className="relative w-full border border-line bg-sky" style={{ aspectRatio: '16 / 9' }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={180}
          tabIndex={0}
          role="application"
          aria-label={`Daily Devil level${num ? ` ${num}` : ''}. Move with the arrow keys or A and D, jump with Space, W or the up arrow.`}
          className="pixelated no-touch block h-full w-full"
        />
        {stale && (
          <div className="absolute inset-x-0 top-0 flex justify-center p-2">
            <button type="button" onClick={() => location.reload()} className="border border-blood bg-ink px-3 py-1 font-pixel text-xs text-bone">
              New level is live. Load it
            </button>
          </div>
        )}
      </div>

      <TouchPads getGame={() => gameRef.current} />

      <p className="min-h-5 text-xs text-mute sm:text-sm" aria-live="polite">
        {stats === null && ' '}
        {stats === 'offline' && 'Offline: crowd stats are unavailable. Your progress is saved on this device.'}
        {st && (
          <>
            <span className="text-bone">{nf.format(st.players)}</span> {st.players === 1 ? 'player' : 'players'} · <span className="text-bone">{nf.format(st.totalDeaths)}</span> deaths ·{' '}
            <span className="text-bone">{st.players ? Math.round((st.clears / st.players) * 100) : 0}%</span> cleared ·{' '}
            {st.clears ? (
              <>
                median <span className="text-bone">{nf.format(st.medianDeaths)}</span> deaths
              </>
            ) : (
              'no clears yet'
            )}
          </>
        )}
      </p>

      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-mute">
        <span className="pointer-coarse:hidden">Arrows or WASD to move · Space to jump · faint X = someone died there</span>
        <span className="hidden pointer-coarse:inline">Faint X = someone died there</span>
        <span className="flex gap-3">
          {mode === 'archive' && <Link href="/" className="underline decoration-line underline-offset-4 hover:text-bone">Today’s level</Link>}
          {practice && mode === 'daily' && dialog === null && streak.last === day && (
            <button type="button" className="underline decoration-line underline-offset-4 hover:text-bone" onClick={() => s.current.local?.cleared && setDialog({ record: s.current.local.cleared, practice: false })}>
              Your result
            </button>
          )}
        </span>
      </footer>

      {dialog && day && (
        <ClearDialog
          day={day}
          number={levelNumber(day)}
          record={dialog.record}
          practice={dialog.practice}
          archive={mode === 'archive'}
          streak={streak}
          onPractice={startPractice}
          onClose={closeDialog}
        />
      )}
    </main>
  )
}
