import type { InputState } from './types'

export type Button = 'left' | 'right' | 'jump'

const KEYS: Record<string, Button> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  KeyZ: 'jump',
  KeyK: 'jump',
}

/** Merges keyboard and touch pads into one held-button state the sim reads each tick. */
export class Input {
  readonly state: InputState = { left: false, right: false, jump: false }
  private kb: InputState = { left: false, right: false, jump: false }
  private pad: InputState = { left: false, right: false, jump: false }
  private touched = false
  onFirstInput: (() => void) | null = null
  enabled = true

  private onKeyDown = (e: KeyboardEvent) => {
    const b = KEYS[e.code]
    if (!b || e.metaKey || e.ctrlKey || e.altKey) return
    // Let Space/Enter activate a focused button instead of jumping.
    const t = e.target as HTMLElement | null
    if (b === 'jump' && e.code === 'Space' && t && (t.tagName === 'BUTTON' || t.tagName === 'A' || t.tagName === 'INPUT')) return
    if (!this.enabled) return
    e.preventDefault()
    this.kb[b] = true
    this.sync()
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const b = KEYS[e.code]
    if (!b) return
    this.kb[b] = false
    this.sync()
  }

  private onBlur = () => {
    this.kb.left = this.kb.right = this.kb.jump = false
    this.pad.left = this.pad.right = this.pad.jump = false
    this.sync()
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
  }

  setPad(b: Button, down: boolean) {
    if (!this.enabled && down) return
    this.pad[b] = down
    this.sync()
  }

  releaseAll() {
    this.onBlur()
  }

  private sync() {
    const s = this.state
    s.left = this.kb.left || this.pad.left
    s.right = this.kb.right || this.pad.right
    s.jump = this.kb.jump || this.pad.jump
    if (!this.touched && (s.left || s.right || s.jump)) {
      this.touched = true
      this.onFirstInput?.()
    }
  }

  resetFirstInput() {
    this.touched = false
  }
}
