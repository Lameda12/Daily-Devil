'use client'

import type { PointerEvent } from 'react'
import type { Game } from '@/game/engine'
import type { Button } from '@/game/input'

const PADS: { b: Button; label: string; text: string; wide?: boolean }[] = [
  { b: 'left', label: 'Move left', text: '◀' },
  { b: 'right', label: 'Move right', text: '▶' },
  { b: 'jump', label: 'Jump', text: 'JUMP', wide: true },
]

/** On-screen pads for coarse pointers. Pointer capture keeps a press alive when the thumb slides. */
export default function TouchPads({ getGame }: { getGame: () => Game | null }) {
  const set = (b: Button, down: boolean) => getGame()?.input.setPad(b, down)

  const handlers = (b: Button) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      set(b, true)
    },
    onPointerUp: () => set(b, false),
    onPointerCancel: () => set(b, false),
    onLostPointerCapture: () => set(b, false),
    onContextMenu: (e: PointerEvent<HTMLButtonElement> | React.MouseEvent) => e.preventDefault(),
  })

  return (
    <div className="no-touch hidden select-none grid-cols-[1fr_1fr_1.4fr] gap-3 pointer-coarse:grid" aria-label="Touch controls">
      {PADS.map(({ b, label, text, wide }) => (
        <button
          key={b}
          type="button"
          aria-label={label}
          tabIndex={-1}
          {...handlers(b)}
          className={`no-touch h-16 border border-line bg-panel font-pixel text-bone active:bg-ox active:text-blood ${wide ? 'text-base' : 'text-xl'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
