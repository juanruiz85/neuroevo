// Barrel de exports del motor de simulación.

export * from './types'
export { World, Food } from './world'
export type { Creature, CreatureOpts } from './creature'
export {
  Brain,
  NN_IN,
  NN_H,
  NN_OUT,
  NN_SIZE,
  INPUT_LABELS,
  OUTPUT_LABELS,
} from './nn'
export {
  createBrain,
  type BrainKind,
  type ConnectomeActivity,
  type IBrainAdapter,
} from './connectome/adapter'
export {
  ElegansBrain,
  ELEGANS_GENES,
  ELEGANS_INFO,
  ELEGANS_NAMES,
  ELEGANS_CLASSES,
  ELEGANS_SENSORY_FUNCTIONS,
} from './connectome/elegans'
export { Rng } from './rng'
export {
  renderWorld,
  computeViewport,
  screenToWorld,
  type Viewport,
} from './render'
