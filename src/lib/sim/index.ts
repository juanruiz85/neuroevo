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
  getElegansCircuit,
  type CircuitViewDef,
  type CircuitNodeDef,
  type CircuitEdgeDef,
  type CircuitBundleDef,
} from './connectome/elegans'
export {
  CH,
  NN_CHANNELS,
  SENSOR_CHANNELS,
  SENSOR_GROUP_LABEL,
  SENSOR_GROUP_COLOR,
  type SensorChannel,
  type SensorGroup,
} from './connectome/sensors'
export { Rng } from './rng'
export {
  renderWorld,
  computeViewport,
  screenToWorld,
  type Viewport,
} from './render'
