import type { MarkList, Particles } from './fx'
import * as C from './palette'
import * as T from './tuning'
import type { Hazard } from './types'
import type { World } from './world'

export const PARTICLE_COLORS = [C.PLAYER, C.ACCENT, C.DUST, C.WALL]

export interface Look {
  sx: number // squash/stretch
  sy: number
  runFrame: number
  shakeX: number
  shakeY: number
  showPlayer: boolean
}

/** The X mark: 5x5 pixels. */
function drawX(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = Math.round(cx) - 2
  const y = Math.round(cy) - 2
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x + i, y + i, 1, 1)
    if (i !== 2) ctx.fillRect(x + 4 - i, y + i, 1, 1)
  }
}

/** Pre-render a crowd of marks once; per frame it's a single drawImage. */
export function renderCrowd(marks: ArrayLike<number>, target: HTMLCanvasElement | OffscreenCanvas) {
  const ctx = target.getContext('2d') as CanvasRenderingContext2D | null
  if (!ctx) return
  ctx.clearRect(0, 0, T.VIEW_W, T.VIEW_H)
  ctx.fillStyle = C.CROWD
  for (let i = 0; i + 1 < marks.length; i += 2) drawX(ctx, marks[i], marks[i + 1])
}

function drawSpikes(ctx: CanvasRenderingContext2D, h: Hazard) {
  const top = Math.round(h.y)
  const bx = Math.round(h.x)
  // Pixel teeth 5px wide: rows of 1, 1, 3, 3, 5, 5 pixels, tip up.
  for (let tx = 0; tx < h.w; tx += 5) {
    const tw = Math.min(5, h.w - tx)
    const mid = bx + tx + (tw >> 1)
    for (let r = 0; r < h.h; r++) {
      const half = Math.min(tw >> 1, r >> 1)
      ctx.fillRect(mid - half, top + r, half * 2 + 1, 1)
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, w: World, look: Look) {
  const p = w.player
  const bw = Math.max(3, Math.round(p.w * look.sx))
  const bh = Math.max(5, Math.round(p.h * look.sy))
  const x = Math.round(p.x + p.w / 2 - bw / 2)
  const y = Math.round(p.y + p.h - bh)
  ctx.fillStyle = C.PLAYER
  // Horns
  ctx.fillRect(x, y - 2, 1, 2)
  ctx.fillRect(x + bw - 1, y - 2, 1, 2)
  // Body, leaving room for legs
  ctx.fillRect(x, y, bw, bh - 2)
  // Legs: 2-frame run cycle
  const legY = y + bh - 2
  if (look.runFrame === 1) {
    ctx.fillRect(x, legY, 2, 1)
    ctx.fillRect(x + bw - 2, legY + 1, 2, 1)
    ctx.fillRect(x + 1, legY + 1, 1, 1)
    ctx.fillRect(x + bw - 2, legY, 1, 1)
  } else {
    ctx.fillRect(x, legY, 2, 2)
    ctx.fillRect(x + bw - 2, legY, 2, 2)
  }
  // Eye
  ctx.fillStyle = C.SKY
  const eyeX = p.facing > 0 ? x + bw - 2 : x + 1
  ctx.fillRect(eyeX, y + 2, 1, 1)
}

function drawDoor(ctx: CanvasRenderingContext2D, w: World) {
  const d = w.door
  const x = Math.round(d.x)
  const y = Math.round(d.y)
  ctx.fillStyle = C.WALL
  ctx.fillRect(x, y, d.w, d.h)
  ctx.fillStyle = C.DOOR_IN
  ctx.fillRect(x + 2, y + 2, d.w - 4, d.h - 2)
  ctx.fillStyle = C.SKY
  ctx.fillRect(x + d.w - 4, y + 9, 1, 1)
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  w: World,
  look: Look,
  crowd: CanvasImageSource | null,
  own: MarkList,
  parts: Particles,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = C.SKY
  ctx.fillRect(0, 0, T.VIEW_W, T.VIEW_H)
  ctx.setTransform(1, 0, 0, 1, Math.round(look.shakeX), Math.round(look.shakeY))

  // Reverse strips: tinted band, dashed edges, a swap glyph.
  for (let i = 0; i < w.traps.length; i++) {
    const z = w.traps[i].reverseZone
    if (!z) continue
    ctx.fillStyle = C.ZONE
    ctx.fillRect(z.x, T.CEIL_Y, z.w, T.FLOOR_Y - T.CEIL_Y)
    ctx.fillStyle = C.ZONE_MARK
    for (let y = T.CEIL_Y + 2; y < T.FLOOR_Y; y += 6) {
      ctx.fillRect(z.x, y, 1, 3)
      ctx.fillRect(z.x + z.w - 1, y, 1, 3)
    }
    const gx = Math.round(z.x + z.w / 2) - 4
    const gy = T.CEIL_Y + 16
    ctx.fillRect(gx, gy, 8, 1)
    ctx.fillRect(gx + 6, gy - 1, 1, 1)
    ctx.fillRect(gx, gy + 4, 8, 1)
    ctx.fillRect(gx + 1, gy + 5, 1, 1)
  }

  if (crowd) ctx.drawImage(crowd, 0, 0)

  ctx.fillStyle = C.WALL
  for (let i = 0; i < w.hazards.length; i++) if (w.hazards[i].visible) drawSpikes(ctx, w.hazards[i])

  drawDoor(ctx, w)

  ctx.fillStyle = C.WALL
  for (let i = 0; i < w.solids.length; i++) {
    const s = w.solids[i]
    if (!s.visible || s.y > T.VIEW_H || s.y + s.h < 0) continue
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.w, s.h)
  }

  ctx.fillStyle = C.ACCENT
  for (let i = 0; i < own.count; i++) drawX(ctx, own.xy[i * 2], own.xy[i * 2 + 1])

  if (look.showPlayer) drawPlayer(ctx, w, look)

  for (let i = 0; i < parts.capacity; i++) {
    if (parts.life[i] <= 0) continue
    ctx.fillStyle = PARTICLE_COLORS[parts.color[i]]
    const s = parts.size[i]
    ctx.fillRect(Math.round(parts.x[i]), Math.round(parts.y[i]), s, s)
  }

  // Progress: one square per trap section, then the door.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const n = w.traps.length + 1
  const size = 6
  const gap = 4
  const x0 = Math.round(T.VIEW_W / 2 - (n * size + (n - 1) * gap) / 2)
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (size + gap)
    if (i < w.progress) {
      ctx.fillStyle = C.ACCENT
      ctx.fillRect(x, 11, size, size)
    } else {
      ctx.fillStyle = C.HUD_EMPTY
      ctx.fillRect(x, 11, size, 1)
      ctx.fillRect(x, 16, size, 1)
      ctx.fillRect(x, 12, 1, 4)
      ctx.fillRect(x + size - 1, 12, 1, 4)
    }
  }
}
