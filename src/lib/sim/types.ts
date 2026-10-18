// Tipos y constantes compartidas del ecosistema.

import type { BrainKind } from './connectome/adapter'

export type Species = 'fly' | 'worm'
export type FoodKind =
  | 'fruit'
  | 'detritus'
  | 'sugar'
  | 'poison'
  | 'bitter'

/** Modos de simulación (Fase 2 + modo 3D). */
export type SimMode = 'ecosystem' | 'arena' | 'lab' | 'neuro3d'

/** Pared de la arena (segmento con grosor de colisión). */
export interface Wall {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Meta de la arena (zona de llegada). */
export interface ArenaGoal {
  x: number
  y: number
  r: number
}

/** Resultado de un participante de arena. */
export interface ArenaResult {
  id: number
  species: Species
  brainKind: BrainKind
  /** Tiempo de llegada (éxito) o de muerte (s). */
  time: number
  success: boolean
  cause?: 'goal' | 'poison' | 'starve' | 'age'
}

/** Estímulos programables del Laboratorio. */
export type StimKind = 'tap' | 'shadow' | 'flash' | 'heat' | 'foodDrop' | 'airPuff'

/** Estímulo activo en el mundo (con epicentro y vida). */
export interface ActiveStimulus {
  kind: StimKind
  x: number
  y: number
  /** Tiempo transcurrido (s). */
  t: number
  /** Duración total (s). */
  dur: number
  /** Intensidad [0,1] (el looming la modula con el tiempo). */
  amp: number
}

/** Punto de la traza de actividad del cerebro seleccionado (Lab). */
export interface TracePoint {
  t: number
  /** Tasa del pool de avance. */
  fwd: number
  /** Reversa (gusano) o asimetría L/R de giro (mosca). */
  rev: number
  /** Tasa del pool de puesta. */
  egg: number
  /** Fracción de picos del conectoma. */
  spike: number
}

/**
 * Fases del ciclo de vida de C. elegans (los huevos son objetos del mundo,
 * no criaturas; las moscas mantienen su modelo simple de control).
 */
export type WormStage = 'l1' | 'l2' | 'l3' | 'l4' | 'adult' | 'dauer'

export const WORM_STAGE_LABEL: Record<WormStage, string> = {
  l1: 'L1',
  l2: 'L2',
  l3: 'L3',
  l4: 'L4',
  adult: 'Adulto',
  dauer: 'Dauer',
}

/**
 * Ciclo de vida biológico del gusano (escala 1 s ≈ 1 h real a 20 °C).
 * Duraciones reales del nemátodo; la senescencia adulta se comprime ×1.4
 * para que la vida completa sea observable en la simulación.
 * La velocidad de desarrollo sigue una Q10≈2 con la temperatura.
 */
export const WORM_LIFE = {
  /** Incubación del huevo tras la puesta (real ≈ 10 h a 20 °C). */
  eggEmbryo: 12,
  /** Duración de cada fase larvaria a 20 °C (real: L1 12 h, L2-L4 ~10 h). */
  stages: { l1: 12, l2: 10, l3: 10, l4: 10 } as Record<Exclude<WormStage, 'adult' | 'dauer'>, number>,
  /** Senescencia adulta mediana (real ≈ 432 h; comprimida ×1.4). */
  adultMedian: 300,
  /** Coste energético de madurar un huevo interno. */
  eggEnergy: 16,
  /** Reserva de vitelo del L1 recién eclosionado. */
  yolkEnergy: 24,
  /** Esperma limitado del hermafrodita (real ~300; capado por equilibrio). */
  spermCap: 140,
  /** Huevos maduros máximos en el útero (real ~10-15). */
  matureCap: 8,
  /** Energía mínima para madurar huevos. */
  eggMinEnergy: 55,
  /** Segundos entre huevos maduros sin feromona (real: ~1 h/óvulo). */
  eggInterval: 11,
  /** Separación entre puestas de una ráfaga (circuito HSN/VC). */
  layCooldown: 1.4,
  /** Madurez reproductiva tras la muda a adulto (real ≈ 5 h). */
  adultMatureDelay: 6,
  /** Hambre sostenida (s) antes de entrar en dauer (fase L2/L3). */
  dauerStarveT: 5,
  /** Duración máxima de la fase dauer (reservas lipídicas). */
  dauerMax: 320,
} as const

/** Escala metabólica por fase (las larvas gastan menos que el adulto). */
export const WORM_STAGE_DRAIN: Record<WormStage, number> = {
  l1: 0.35,
  l2: 0.5,
  l3: 0.65,
  l4: 0.85,
  adult: 1,
  dauer: 0.05,
}

/** Escala visual de las larvas (el gusano crece con cada muda). */
export const WORM_STAGE_SCALE: Record<WormStage, number> = {
  l1: 0.45,
  l2: 0.6,
  l3: 0.72,
  l4: 0.86,
  adult: 1,
  dauer: 0.55,
}

// Máscaras de dieta para las consultas espaciales.
export const MASK = { fruit: 1, detritus: 2, sugar: 4, poison: 8, bitter: 16 } as const

export interface EnvParams {
  /** °C objetivo del clima (la temperatura real oscila con el día/noche). */
  temperature: number
  /** % de humedad (por encima de 70 llueve). */
  humidity: number
  /** Segundos de simulación por ciclo día/noche. */
  dayLength: number
  /** Multiplicador de abundancia de comida. */
  foodRate: number
  /** Multiplicador de veneno en el mapa. */
  poisonRate: number
}

export const DEFAULT_ENV: EnvParams = {
  temperature: 24,
  humidity: 55,
  dayLength: 60,
  foodRate: 1,
  poisonRate: 0.4,
}

export interface SpeciesConfig {
  label: string
  maxEnergy: number
  startEnergy: number
  baseSpeed: number // px/s
  baseVision: number // px
  turnRate: number // rad/s
  baseDrain: number // energía/s en reposo
  moveDrain: number // energía/s adicionales a máxima velocidad
  maxAge: number // s de simulación
  radius: number // px de colisión
  optimalTemp: number // °C
  diet: number // máscara de alimentos comestibles
  popCap: number
  reproMinEnergy: number
  reproCost: number
  reproChildEnergy: number
}

export const SPECIES_CONFIG: Record<Species, SpeciesConfig> = {
  fly: {
    label: 'Moscón',
    maxEnergy: 100,
    startEnergy: 55,
    baseSpeed: 145,
    baseVision: 160,
    turnRate: 4.0,
    baseDrain: 1.05,
    moveDrain: 0.95,
    maxAge: 110,
    radius: 5,
    optimalTemp: 26,
    diet: MASK.fruit | MASK.sugar,
    popCap: 220,
    reproMinEnergy: 62,
    reproCost: 34,
    reproChildEnergy: 28,
  },
  worm: {
    label: 'Gusano',
    maxEnergy: 100,
    startEnergy: 60,
    baseSpeed: 55,
    baseVision: 125,
    turnRate: 2.2,
    baseDrain: 0.55,
    moveDrain: 0.35,
    maxAge: 180,
    radius: 4.5,
    optimalTemp: 20,
    diet: MASK.detritus | MASK.sugar,
    popCap: 220,
    reproMinEnergy: 62,
    reproCost: 34,
    reproChildEnergy: 28,
  },
}

export const FOOD_INFO: Record<
  FoodKind,
  { energy: number; radius: number; ttl: number; mask: number }
> = {
  fruit: { energy: 42, radius: 7, ttl: 70, mask: MASK.fruit },
  detritus: { energy: 34, radius: 5.5, ttl: 100, mask: MASK.detritus },
  sugar: { energy: 26, radius: 4.5, ttl: 50, mask: MASK.sugar },
  poison: { energy: -32, radius: 6, ttl: 45, mask: MASK.poison },
  // Cebos amargos del experimento de aprendizaje (quinina/denatonio):
  // huelen como comida (atraen a los ingenuos) pero castigan al probarlos.
  // NO son letales (a diferencia del veneno): sirven para observar la
  // transición de la atracción ingenua a la aversión aprendida.
  bitter: { energy: -6, radius: 6, ttl: 300, mask: MASK.bitter },
}

export interface StatPoint {
  t: number
  flies: number
  worms: number
  eggs: number
  fruit: number
  detritus: number
  sugar: number
  poison: number
  bitter: number
  flySpeed: number
  wormSpeed: number
  flyGen: number
  wormGen: number
  flyEnergy: number
  wormEnergy: number
}

export interface CreatureView {
  id: number
  species: Species
  generation: number
  parentGen: number
  energy: number
  maxEnergy: number
  age: number
  maxAge: number
  speed: number
  maxSpeed: number
  vision: number
  effVision: number
  bodyTemp: number
  foodEaten: number
  children: number
  fitness: number
  /** Fase del ciclo de vida (solo gusanos; las moscas son siempre adultas). */
  stage?: WormStage
  /** Progreso dentro de la fase actual [0, 1]. */
  stagePct?: number
  /** Edad como adulto en s (senescencia). */
  adultAge?: number
  /** Huevos puestos en el mundo (solo gusanos). */
  eggsLaid?: number
  /** Huevos maduros listos en el útero. */
  matureEggs?: number
  /** Esperma restante del hermafrodita. */
  spermLeft?: number
  /** Feromona de conglomerado percibida [0, 1]. */
  pheromone?: number
  /**
   * Aprendizaje alimentario por valor (experimento del modo 3D):
   * good = refuerzo acumulado por comida buena, bad = aversión
   * aprendida por cebos amargos, bites/bitterBites = contador de
   * comilonas y pruebas. Circuito real de referencia: NSM (serotonina,
   * recompensa) y RIM (tiramina, castigo) en C. elegans; DAN→MBON
   * (dopamina/octopamina, valencia) en Drosophila.
   */
  learn?: { good: number; bad: number; bites: number; bitterBites: number }
  x: number
  y: number
  inputs: number[]
  hidden: number[]
  outputs: number[]
  weights: number[]
  /** Arquitectura cerebral: 'ann' (red evolutiva) o 'elegans' (conectoma). */
  brainKind: BrainKind
  /** Actividad del conectoma (solo cerebros biológicos). */
  connectome?: { v: number[]; s: number[] }
}

export interface WorldView {
  time: number
  day: number
  light: number
  ambientTemp: number
  humidity: number
  env: EnvParams
  mode: SimMode
  /** Paredes de la arena (Modo Retos). */
  walls: Wall[]
  /** Meta de la arena. */
  goal: ArenaGoal | null
  /** Cronómetro del ensayo de arena. */
  runT: number
  /** true con el ensayo en marcha. */
  arenaRunning: boolean
  /** Resultados de participantes de arena. */
  arenaResults: ArenaResult[]
  /** Trazas del cerebro seleccionado (Laboratorio). */
  traces: TracePoint[]
  counts: {
    flies: number
    worms: number
    eggs: number
    fruit: number
    detritus: number
    sugar: number
    poison: number
  }
  maxGen: number
  births: number
  deaths: number
  stats: StatPoint[]
  selected: CreatureView | null
  extinctFly: boolean
  extinctWorm: boolean
}

/** Cerebro serializado para el Museo de la Evolución (API + Prisma). */
export interface StoredBrain {
  weights: number[]
  traits: { maxSpeed: number; vision: number }
  /** Arquitectura ('ann' | 'elegans'); ausente en registros antiguos. */
  kind?: BrainKind
}

export interface EliteRecord {
  species: Species
  generation: number
  fitness: number
  brain: StoredBrain
  env: EnvParams & { time?: number; day?: number }
}

export interface EvolutionRecordDTO extends EliteRecord {
  id: string
  name: string
  createdAt: string
}

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v
