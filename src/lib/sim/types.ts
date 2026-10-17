// Tipos y constantes compartidas del ecosistema.

export type Species = 'fly' | 'worm'
export type FoodKind = 'fruit' | 'detritus' | 'sugar' | 'poison'

// Máscaras de dieta para las consultas espaciales.
export const MASK = { fruit: 1, detritus: 2, sugar: 4, poison: 8 } as const

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
}

export interface StatPoint {
  t: number
  flies: number
  worms: number
  fruit: number
  detritus: number
  sugar: number
  poison: number
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
  x: number
  y: number
  inputs: number[]
  hidden: number[]
  outputs: number[]
  weights: number[]
}

export interface WorldView {
  time: number
  day: number
  light: number
  ambientTemp: number
  humidity: number
  env: EnvParams
  counts: {
    flies: number
    worms: number
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
