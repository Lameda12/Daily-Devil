// Render-side juice: particles, shake, squash. Preallocated, no per-frame garbage.

const MAX = 160

export class Particles {
  readonly x = new Float32Array(MAX)
  readonly y = new Float32Array(MAX)
  readonly vx = new Float32Array(MAX)
  readonly vy = new Float32Array(MAX)
  readonly life = new Float32Array(MAX)
  readonly maxLife = new Float32Array(MAX)
  readonly grav = new Float32Array(MAX)
  readonly color = new Uint8Array(MAX) // index into the renderer's particle palette
  readonly size = new Uint8Array(MAX)
  private next = 0

  spawn(x: number, y: number, vx: number, vy: number, life: number, color: number, size = 1, grav = 300) {
    const i = this.next
    this.next = (this.next + 1) % MAX
    this.x[i] = x
    this.y[i] = y
    this.vx[i] = vx
    this.vy[i] = vy
    this.life[i] = life
    this.maxLife[i] = life
    this.color[i] = color
    this.size[i] = size
    this.grav[i] = grav
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue
      this.life[i] -= dt
      this.vy[i] += this.grav[i] * dt
      this.vx[i] *= 1 - 2 * dt
      this.x[i] += this.vx[i] * dt
      this.y[i] += this.vy[i] * dt
    }
  }

  clear() {
    this.life.fill(0)
  }

  get capacity() {
    return MAX
  }
}

/** Own death marks, kept flat so drawing them never allocates. */
export class MarkList {
  readonly xy: Float32Array
  count = 0
  constructor(readonly max = 600) {
    this.xy = new Float32Array(max * 2)
  }
  push(x: number, y: number) {
    const i = this.count < this.max ? this.count++ : Math.floor(Math.random() * this.max)
    this.xy[i * 2] = x
    this.xy[i * 2 + 1] = y
  }
  load(flat: number[]) {
    this.count = 0
    for (let i = 0; i + 1 < flat.length; i += 2) this.push(flat[i], flat[i + 1])
  }
}
