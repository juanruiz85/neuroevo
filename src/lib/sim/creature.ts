// Criatura: sentidos -> cerebro (adaptador: ANN o conectoma biológico)
// -> movimiento, metabolismo y reproducción.

import { NN_IN } from './nn'
import { createBrain, type IBrainAdapter } from './connectome/adapter'
import { SPECIES_CONFIG, clamp, type Species } from './types'
import type { World } from './world'

const POISON_MASK = 8

export interface CreatureOpts {
  species: Species
  x: number
  y: number
  brain?: IBrainAdapter
  generation?: number
  parentGen?: number
  maxSpeed?: number
  vision?: number
  energy?: number
}

export class Creature {
  static nextId = 1
  readonly id: number
  readonly species: Species
  x: number
  y: number
  heading: number
  speed = 0
  energy: number
  age = 0
  generation: number
  parentGen: number
  readonly brain: IBrainAdapter
  /** Velocidad máxima heredada (px/s), sujeta a evolución. */
  maxSpeed: number
  /** Rango sensorial base heredado (px), sujeto a evolución. */
  vision: number
  /** Rango sensorial efectivo tras aplicar clima. */
  effVision: number
  bodyTemp: number
  foodEaten = 0
  children = 0
  alive = true
  wingPhase: number
  readonly trailX: number[] = []
  readonly trailY: number[] = []
  readonly segs: { x: number; y: number }[] = []
  private readonly inputs: number[] = new Array<number>(NN_IN).fill(0)

  constructor(opts: CreatureOpts) {
    const cfg = SPECIES_CONFIG[opts.species]
    this.id = Creature.nextId++
    this.species = opts.species
    this.x = opts.x
    this.y = opts.y
    this.heading = Math.random() * Math.PI * 2
    // Gusanos → conectoma real de C. elegans (LIF); moscas → ANN evolutiva.
    this.brain = opts.brain ?? createBrain(opts.species)
    this.generation = opts.generation ?? 0
    this.parentGen = opts.parentGen ?? -1
    this.maxSpeed =
      opts.maxSpeed ?? cfg.baseSpeed * (0.85 + Math.random() * 0.3)
    this.vision = opts.vision ?? cfg.baseVision * (0.9 + Math.random() * 0.2)
    this.energy = opts.energy ?? cfg.startEnergy
    this.effVision = this.vision
    this.bodyTemp = 22
    this.wingPhase = Math.random() * 10
    if (this.species === 'worm') {
      for (let i = 0; i < 8; i++) this.segs.push({ x: this.x, y: this.y })
    }
  }

  /** Aptitud total: se usa para elegir las élites del Museo. */
  get fitness(): number {
    return this.foodEaten * 2 + this.children * 4 + this.age * 0.05
  }

  tick(world: World, dt: number): void {
    const cfg = SPECIES_CONFIG[this.species]
    const env = world.env
    const temp = world.ambientTemp
    const light = world.light

    this.bodyTemp += (temp - this.bodyTemp) * Math.min(1, dt * 0.6)

    // — Clima —
    // Frío extremo: baja el "voltaje" de las neuronas (señales motoras débiles).
    const coldVoltage =
      temp < 10 ? clamp(0.25 + 0.75 * ((temp - 2) / 8), 0.25, 1) : 1
    const rain = Math.max(0, (env.humidity - 70) / 30)

    let vision = this.vision
    if (this.species === 'fly') {
      // Visión dependiente de la luz + la lluvia la entorpece.
      vision *= (0.25 + 0.75 * light) * (1 - 0.35 * rain)
    } else {
      // Quimiorreceptores: la humedad afina el olfato.
      vision *= 0.9 + (env.humidity / 100) * 0.3
    }
    this.effVision = vision

    // — Sensores —
    const food = world.nearestFood(this.x, this.y, vision, cfg.diet)
    const poison = world.nearestFood(this.x, this.y, vision, POISON_MASK)
    const crowd = world.countNeighbors(this.x, this.y, 42, this.species)

    const inp = this.inputs
    inp[0] = 1 // sesgo
    inp[1] = this.energy / cfg.maxEnergy
    inp[2] = clamp((temp - cfg.optimalTemp) / 9, -1, 1) // confort térmico
    inp[3] = light
    inp[4] = env.humidity / 100
    if (poison) {
      setDirection(inp, 8, this, poison.x, poison.y, vision)
    } else {
      inp[8] = 0
      inp[9] = 0
      inp[10] = 0
    }
    if (food) {
      setDirection(inp, 5, this, food.x, food.y, vision)
    } else {
      inp[5] = 0
      inp[6] = 0
      inp[7] = 0
    }
    inp[11] = Math.min(1, crowd / 5)

    // — Piensa —
    this.brain.forward(inp, coldVoltage)

    // — Se mueve —
    this.heading += this.brain.oA[0] * cfg.turnRate * dt
    const thrust = Math.max(0, this.brain.oA[1])
    this.speed =
      thrust * this.maxSpeed * (this.species === 'fly' ? 1 - 0.2 * rain : 1)
    this.x += Math.cos(this.heading) * this.speed * dt
    this.y += Math.sin(this.heading) * this.speed * dt

    // Rebote en los bordes del mundo.
    const m = 12
    if (this.x < m) {
      this.x = m
      this.heading = Math.PI - this.heading
    } else if (this.x > world.width - m) {
      this.x = world.width - m
      this.heading = Math.PI - this.heading
    }
    if (this.y < m) {
      this.y = m
      this.heading = -this.heading
    } else if (this.y > world.height - m) {
      this.y = world.height - m
      this.heading = -this.heading
    }

    // — Animación —
    this.wingPhase += dt * (14 + this.speed * 0.18)
    if (this.species === 'worm') {
      this.segs[0].x = this.x
      this.segs[0].y = this.y
      for (let i = 1; i < this.segs.length; i++) {
        const prev = this.segs[i - 1]
        const seg = this.segs[i]
        const dx = seg.x - prev.x
        const dy = seg.y - prev.y
        const d = Math.hypot(dx, dy) || 1
        const want = 3.4
        if (d > want) {
          seg.x = prev.x + (dx / d) * want
          seg.y = prev.y + (dy / d) * want
        }
      }
    } else {
      this.trailX.push(this.x)
      this.trailY.push(this.y)
      if (this.trailX.length > 9) {
        this.trailX.shift()
        this.trailY.shift()
      }
    }

    // — Metabolismo —
    let drain = cfg.baseDrain + (this.speed / cfg.baseSpeed) * cfg.moveDrain
    if (temp > 33) {
      // Calor extremo: metabolismo acelerado y desgaste (puede ser fatal).
      drain += (temp - 33) * (this.species === 'fly' ? 0.12 : 0.06)
    }
    if (temp < 8) drain *= 0.7 // letargo: se gastan menos energías
    if (this.species === 'worm') {
      // Los gusanos se desecan bajo el sol caluroso y seco.
      drain += light * Math.max(0, temp - 24) * (1 - env.humidity / 100) * 0.16
      if (env.humidity > 80) drain *= 0.85
    }
    this.energy -= drain * dt
    this.age += dt

    // — Come (o se envenena) —
    world.eatFoodAt(this)

    // — Se reproduce —
    const wantsChild =
      this.brain.oA[2] > 0.55 || this.energy > cfg.reproMinEnergy + 26
    if (this.energy > cfg.reproMinEnergy && wantsChild) {
      world.spawnChild(this)
    }

    // — Muere —
    if (this.energy <= 0 || this.age > cfg.maxAge) this.alive = false
  }
}

function setDirection(
  inp: number[],
  base: number,
  c: Creature,
  tx: number,
  ty: number,
  range: number,
): void {
  const dx = tx - c.x
  const dy = ty - c.y
  const d = Math.hypot(dx, dy) || 1
  const rel = Math.atan2(dy, dx) - c.heading
  inp[base] = Math.cos(rel)
  inp[base + 1] = Math.sin(rel)
  inp[base + 2] = 1 - Math.min(1, d / range)
}
