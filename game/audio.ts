// Every sound is synthesized. Nothing plays until the first user input unlocks the context.

export type Sound = 'jump' | 'land' | 'death' | 'spike' | 'slam' | 'taunt' | 'clear'

type Ctx = AudioContext

export class Sfx {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private noise: AudioBuffer | null = null
  muted = false

  unlock() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      try {
        this.ctx = new AC()
      } catch {
        return
      }
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.55
      this.master.connect(this.ctx.destination)
      const len = Math.floor(this.ctx.sampleRate * 0.5)
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  play(s: Sound) {
    const ctx = this.ctx
    if (!ctx || !this.master || this.muted || ctx.state !== 'running') return
    const t = ctx.currentTime
    switch (s) {
      case 'jump':
        this.tone('square', 300, 640, t, 0.09, 0.07)
        break
      case 'land':
        this.tone('sine', 150, 50, t, 0.09, 0.22)
        this.burst(t, 0.05, 500, 0.08)
        break
      case 'death':
        this.burst(t, 0.28, 2400, 0.32, 180)
        this.tone('sawtooth', 240, 38, t, 0.3, 0.12)
        break
      case 'spike':
        this.tone('square', 1300, 2100, t, 0.04, 0.06)
        this.burst(t, 0.04, 6000, 0.06)
        break
      case 'slam':
        this.tone('sine', 80, 32, t, 0.32, 0.5)
        this.burst(t, 0.2, 700, 0.3, 120)
        break
      case 'taunt':
        this.tone('square', 784, 760, t, 0.09, 0.07)
        this.tone('square', 659, 640, t + 0.11, 0.09, 0.07)
        this.tone('square', 784, 820, t + 0.22, 0.14, 0.07)
        break
      case 'clear': {
        const notes = [523.25, 659.25, 783.99, 1046.5]
        notes.forEach((f, i) => this.tone('triangle', f, f, t + i * 0.08, i === 3 ? 0.35 : 0.1, 0.16))
        this.tone('square', 1046.5, 1046.5, t + 0.24, 0.3, 0.04)
        break
      }
    }
  }

  private tone(type: OscillatorType, f0: number, f1: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(f0, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(g).connect(this.master!)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  private burst(t: number, dur: number, cutoff: number, vol: number, cutoffEnd = cutoff) {
    const ctx = this.ctx!
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(cutoff, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(20, cutoffEnd), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f).connect(g).connect(this.master!)
    src.start(t)
    src.stop(t + dur + 0.02)
  }
}
