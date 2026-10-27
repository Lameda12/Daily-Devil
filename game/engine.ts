import type { Sfx } from './audio'
import { encodeInput } from './bot'
import { MarkList, Particles } from './fx'
import { Input } from './input'
import { buildWorld, type LevelDef } from './level'
import { type Look, renderCrowd, renderWorld } from './render'
import * as T from './tuning'
import { EV_CLEAR, EV_DIE, EV_JUMP, EV_LAND, EV_SECTION, EV_SLAM, EV_SPIKE, EV_TAUNT, type World } from './world'

export interface GameHooks {
  onFirstInput?(): void
  onDeath?(x: number, y: number, section: number): void
  onSection?(progress: number): void
  onClear?(inputsHash: string): void
}

export interface GameOptions {
  sfx: Sfx
  reducedMotion: () => boolean
  hooks: GameHooks
}

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

/** Fixed-timestep loop around the sim, plus juice and rendering. */
export class Game {
  readonly world: World
  readonly input = new Input()
  readonly own = new MarkList()
  private readonly ctx: CanvasRenderingContext2D
  private readonly parts = new Particles()
  private crowd: HTMLCanvasElement | null = null
  private raf = 0
  private last = 0
  private acc = 0
  private freeze = 0
  private deadT = 0
  private shake = 0
  private runClock = 0
  private hash = FNV_OFFSET
  /** Optional recorded input tape (dev tooling): one encoded input per tick, replaces live input. */
  tape: Uint8Array | null = null
  private readonly look: Look = { sx: 1, sy: 1, runFrame: 0, shakeX: 0, shakeY: 0, showPlayer: true }

  constructor(
    canvas: HTMLCanvasElement,
    def: LevelDef,
    private readonly opts: GameOptions,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D is not available')
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.world = buildWorld(def)
    this.input.onFirstInput = () => {
      opts.sfx.unlock()
      opts.hooks.onFirstInput?.()
    }
  }

  start() {
    this.input.attach()
    this.last = performance.now()
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame)
      this.frame(now)
    }
    this.raf = requestAnimationFrame(frame)
  }

  stop() {
    cancelAnimationFrame(this.raf)
    this.input.detach()
  }

  setCrowd(marks: ArrayLike<number>) {
    if (typeof document === 'undefined') return
    if (!this.crowd) {
      this.crowd = document.createElement('canvas')
      this.crowd.width = T.VIEW_W
      this.crowd.height = T.VIEW_H
    }
    renderCrowd(marks, this.crowd)
  }

  /** Fresh attempt without counting a death (practice runs, replays). */
  restart() {
    this.world.reset()
    this.parts.clear()
    this.freeze = 0
    this.deadT = 0
    this.acc = 0
    this.hash = FNV_OFFSET
    this.look.showPlayer = true
  }

  private frame(now: number) {
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    const w = this.world

    if (this.freeze > 0) {
      this.freeze -= dt
    } else if (w.status === 'playing') {
      this.acc += dt
      while (this.acc >= T.DT && w.status === 'playing') {
        this.acc -= T.DT
        this.tick()
      }
      if (w.status !== 'playing') this.acc = 0
    } else if (w.status === 'dead') {
      this.deadT += dt
      if (this.deadT >= T.RESPAWN_DELAY) {
        w.reset()
        this.hash = FNV_OFFSET
        this.deadT = 0
        this.look.showPlayer = true
        this.look.sx = 0.7
        this.look.sy = 1.35
      }
    }

    this.parts.update(dt)
    const calm = this.opts.reducedMotion()
    this.shake = calm ? 0 : this.shake * Math.exp(-T.SHAKE_DECAY * dt)
    if (this.shake < 0.3) this.shake = 0
    this.look.shakeX = this.shake ? (Math.random() * 2 - 1) * this.shake : 0
    this.look.shakeY = this.shake ? (Math.random() * 2 - 1) * this.shake : 0
    const k = Math.min(1, dt * 14)
    this.look.sx += (1 - this.look.sx) * k
    this.look.sy += (1 - this.look.sy) * k
    const p = w.player
    if (p.grounded && Math.abs(p.vx) > 8) {
      this.runClock += dt
      this.look.runFrame = Math.floor(this.runClock * 10) % 2
    } else {
      this.runClock = 0
      this.look.runFrame = p.grounded ? 0 : 1
    }

    renderWorld(this.ctx, w, this.look, this.crowd, this.own, this.parts)
  }

  private tick() {
    const w = this.world
    const s = this.input.state
    if (this.tape) {
      const b = this.world.tick < this.tape.length ? this.tape[this.world.tick] : 0
      s.left = (b & 1) !== 0
      s.right = (b & 2) !== 0
      s.jump = (b & 4) !== 0
    }
    this.hash = Math.imul(this.hash ^ encodeInput(s.left, s.right, s.jump), FNV_PRIME) >>> 0
    w.step(s)
    const ev = w.events
    if (ev === 0) return
    const { sfx, hooks } = this.opts
    const p = w.player
    const fx = p.x + p.w / 2
    const fy = p.y + p.h

    if (ev & EV_JUMP) {
      sfx.play('jump')
      this.look.sx = 0.7
      this.look.sy = 1.35
      this.dust(fx, fy, 2)
    }
    if (ev & EV_LAND) {
      sfx.play('land')
      const hard = Math.min(1, p.lastLandSpeed / 260)
      this.look.sx = 1 + 0.4 * hard
      this.look.sy = 1 - 0.32 * hard
      this.dust(fx, fy, 3 + Math.round(hard * 3))
    }
    if (ev & EV_SPIKE) sfx.play('spike')
    if (ev & EV_SLAM) {
      sfx.play('slam')
      this.shake = Math.max(this.shake, T.SHAKE_SLAM)
    }
    if (ev & EV_TAUNT) sfx.play('taunt')
    if (ev & EV_SECTION && w.status === 'playing') hooks.onSection?.(w.progress)
    if (ev & EV_DIE) {
      sfx.play('death')
      this.freeze = T.DEATH_FREEZE
      this.deadT = 0
      this.shake = T.SHAKE_DEATH
      this.look.showPlayer = false
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2
        const v = 30 + Math.random() * 110
        this.parts.spawn(w.deathX, w.deathY, Math.cos(a) * v, Math.sin(a) * v - 40, 0.4 + Math.random() * 0.5, i % 4 === 0 ? 1 : 0, i % 3 === 0 ? 2 : 1)
      }
      this.own.push(w.deathX, w.deathY)
      hooks.onDeath?.(w.deathX, w.deathY, w.sectionAt(w.deathX))
    }
    if (ev & EV_CLEAR) {
      sfx.play('clear')
      for (let i = 0; i < 18; i++) {
        this.parts.spawn(w.door.x + w.door.w / 2, w.door.y + 4, (Math.random() * 2 - 1) * 60, -40 - Math.random() * 90, 0.7, 1, 1, 180)
      }
      hooks.onClear?.(this.hash.toString(16).padStart(8, '0'))
    }
  }

  private dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const dir = i % 2 === 0 ? 1 : -1
      this.parts.spawn(x + dir * 2, y - 1, dir * (14 + Math.random() * 18), -6 - Math.random() * 10, 0.22 + Math.random() * 0.12, 2, 1, 20)
    }
  }
}
