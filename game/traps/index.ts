import type { TrapFactory, TrapKind } from '../types'
import { crusher } from './crusher'
import { fakefloor } from './fakefloor'
import { jaws } from './jaws'
import { popspikes } from './popspikes'
import { reverse } from './reverse'
import { secondspike } from './secondspike'
import { sinkledge } from './sinkledge'
import { trapdoor } from './trapdoor'

export const TRAPS: Record<TrapKind, TrapFactory> = {
  trapdoor,
  popspikes,
  crusher,
  sinkledge,
  secondspike,
  jaws,
  fakefloor,
  reverse,
}

export const TRAP_LABELS: Record<TrapKind, string> = {
  trapdoor: 'Trapdoor',
  popspikes: 'Pop-up spikes',
  crusher: 'Crusher',
  sinkledge: 'Sinking ledge',
  secondspike: 'Second spike',
  jaws: 'Closing walls',
  fakefloor: 'Fake floor',
  reverse: 'Reverse zone',
}
