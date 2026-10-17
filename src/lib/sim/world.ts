// El mundo: criaturas, alimentos, clima, grilla espacial, evolución y estadísticas.

import { Creature } from './creature'
import { Brain } from './nn'
import { Rng } from './rng'
import {
  DEFAULT_ENV,
  FOOD_INFO,
  MASK,
  SPECIES_CONFIG,
  clamp,
  type CreatureView,
  type EliteRecord,
  type EnvParams,
  type FoodKind,
  type Species,
  type StatPoint,
  type WorldView,
} from './types'

const GRID = 130 // tamaño de celda de la grilla espacial

export class Food {
  static nextId = 1
  readonly id: number
  readonly kind: FoodKind
  readonly mask: number
  x: number
  y: number
  readonly r: number
  readonly energy: number
  ttl: number
  dead = false
  readonly wobble: number

  constructor(
    kind: FoodKind,
    x: number,
    y: number,
    energy?: number,
    r?: number,
    ttl?: number,
  ) {
    const info = FOOD_INFO[kind]
    this.id = Food.nextId++
    this.kind = kind
    this.mask = info.mask
    this.x = x
    this.y = y
    this.r = r ?? info.radius
    this.energy = energy ?? info.energy
    this.ttl = ttl ?? info.ttl
    this.wobble = Math.random() * 10
  }
}

export class World {
  readonly width: number
  readonly height: number
  env: EnvParams
  time = 0
  ticks = 0
  readonly rng = new Rng()
  creatures: Creature[] = []
  foods: Food[] = []
  light = 0.5
  ambientTemp = 24
  selectedId: number | null = null
  maxGen = 0
  births = 0
  deaths = 0
  readonly stats: StatPoint[] = []

  private readonly counts: Record<Species, number> = { fly: 0, worm: 0 }
  private readonly foodCounts: Record<FoodKind, number> = {
    fruit: 0,
    detritus: 0,
    sugar: 0,
    poison: 0,
  }
  private readonly foodGrid: Food[][] = []
  private readonly creatureGrid: Creature[][] = []
  private readonly cols: number
  private readonly rows: number
  private statTimer = 0
  private readonly spawnTimers: Record<FoodKind, number> = {
    fruit: 0,
    detritus: 0,
    sugar: 0,
    poison: 0,
  }

  constructor(width = 1280, height = 840, env: EnvParams = DEFAULT_ENV) {
    this.width = width
    this.height = height
    this.env = { ...env }
    this.cols = Math.ceil(width / GRID)
    this.rows = Math.ceil(height / GRID)
    for (let i = 0; i < this.cols * this.rows; i++) {
      this.foodGrid.push([])
      this.creatureGrid.push([])
    }
    this.populate()
  }

  reset(): void {
    this.creatures = []
    this.foods = []
    this.time = 0
    this.ticks = 0
    this.light = 0.5
    this.ambientTemp = this.env.temperature
    this.selectedId = null
    this.maxGen = 0
    this.births = 0
    this.deaths = 0
    this.stats.length = 0
    this.statTimer = 0
    for (const k of Object.keys(this.spawnTimers) as FoodKind[]) {
      this.spawnTimers[k] = 0
    }
    this.populate()
  }

  private populate(): void {
    for (let i = 0; i < 42; i++) {
      this.creatures.push(
        new Creature({
          species: 'fly',
          x: this.rand(30, this.width - 30),
          y: this.rand(30, this.height - 30),
        }),
      )
    }
    for (let i = 0; i < 38; i++) {
      this.creatures.push(
        new Creature({
          species: 'worm',
          x: this.rand(30, this.width - 30),
          y: this.rand(30, this.height - 30),
        }),
      )
    }
    for (let i = 0; i < 26; i++) this.spawnFood('fruit')
    for (let i = 0; i < 34; i++) this.spawnFood('detritus')
    for (let i = 0; i < 5; i++) this.spawnFood('sugar')
    if (this.env.poisonRate > 0) {
      for (let i = 0; i < 2; i++) this.spawnFood('poison')
    }
  }

  private rand(a: number, b: number): number {
    return a + this.rng.next() * (b - a)
  }

  step(dt: number): void {
    this.ticks++
    this.time += dt

    const phase = (this.time / this.env.dayLength) % 1
    this.light = clamp(0.5 + 0.5 * Math.sin(phase * Math.PI * 2), 0, 1)
    this.ambientTemp = this.env.temperature + (this.light - 0.5) * 7

    this.rebuildGrids()

    for (const c of this.creatures) {
      if (c.alive) c.tick(this, dt)
    }

    // Los cadáveres se reciclan como detritos (ciclo de energía).
    for (const c of this.creatures) {
      if (
        !c.alive &&
        this.rng.next() < 0.6 &&
        this.foodCounts.detritus < this.detritusCap() + 20
      ) {
        this.addFood(new Food('detritus', c.x, c.y, 18, 4, 60))
      }
    }

    const before = this.creatures.length
    this.creatures = this.creatures.filter((c) => c.alive)
    this.deaths += before - this.creatures.length

    // Vida útil de los alimentos y limpieza periódica.
    for (const f of this.foods) {
      f.ttl -= dt
      if (f.ttl <= 0) f.dead = true
    }
    if (this.ticks % 15 === 0) this.foods = this.foods.filter((f) => !f.dead)

    this.spawnFoodTimers(dt)

    this.statTimer += dt
    if (this.statTimer >= 0.5) {
      this.statTimer -= 0.5
      this.pushStatPoint()
    }
  }

  // ——— Consultas espaciales ———

  private cellIdx(x: number, y: number): number {
    const cx = clamp((x / GRID) | 0, 0, this.cols - 1)
    const cy = clamp((y / GRID) | 0, 0, this.rows - 1)
    return cy * this.cols + cx
  }

  private rebuildGrids(): void {
    for (const cell of this.foodGrid) cell.length = 0
    this.foodCounts.fruit = 0
    this.foodCounts.detritus = 0
    this.foodCounts.sugar = 0
    this.foodCounts.poison = 0
    for (const f of this.foods) {
      this.foodGrid[this.cellIdx(f.x, f.y)].push(f)
      this.foodCounts[f.kind]++
    }
    for (const cell of this.creatureGrid) cell.length = 0
    this.counts.fly = 0
    this.counts.worm = 0
    for (const c of this.creatures) {
      this.creatureGrid[this.cellIdx(c.x, c.y)].push(c)
      this.counts[c.species]++
    }
  }

  nearestFood(x: number, y: number, range: number, mask: number): Food | null {
    const cx = clamp((x / GRID) | 0, 0, this.cols - 1)
    const cy = clamp((y / GRID) | 0, 0, this.rows - 1)
    let best: Food | null = null
    let bd = range * range
    for (let dy = -1; dy <= 1; dy++) {
      const yy = cy + dy
      if (yy < 0 || yy >= this.rows) continue
      for (let dx = -1; dx <= 1; dx++) {
        const xx = cx + dx
        if (xx < 0 || xx >= this.cols) continue
        for (const f of this.foodGrid[yy * this.cols + xx]) {
          if ((f.mask & mask) === 0) continue
          const ddx = f.x - x
          const ddy = f.y - y
          const d2 = ddx * ddx + ddy * ddy
          if (d2 < bd) {
            bd = d2
            best = f
          }
        }
      }
    }
    return best
  }

  countNeighbors(x: number, y: number, range: number, species: Species): number {
    const cx = clamp((x / GRID) | 0, 0, this.cols - 1)
    const cy = clamp((y / GRID) | 0, 0, this.rows - 1)
    let n = 0
    const r2 = range * range
    for (let dy = -1; dy <= 1; dy++) {
      const yy = cy + dy
      if (yy < 0 || yy >= this.rows) continue
      for (let dx = -1; dx <= 1; dx++) {
        const xx = cx + dx
        if (xx < 0 || xx >= this.cols) continue
        for (const c of this.creatureGrid[yy * this.cols + xx]) {
          if (!c.alive || c.species !== species) continue
          const ddx = c.x - x
          const ddy = c.y - y
          if (ddx * ddx + ddy * ddy < r2) n++
        }
      }
    }
    return n
  }

  eatFoodAt(c: Creature): void {
    const cfg = SPECIES_CONFIG[c.species]
    const cx = clamp((c.x / GRID) | 0, 0, this.cols - 1)
    const cy = clamp((c.y / GRID) | 0, 0, this.rows - 1)
    for (let dy = -1; dy <= 1; dy++) {
      const yy = cy + dy
      if (yy < 0 || yy >= this.rows) continue
      for (let dx = -1; dx <= 1; dx++) {
        const xx = cx + dx
        if (xx < 0 || xx >= this.cols) continue
        for (const f of this.foodGrid[yy * this.cols + xx]) {
          if (f.dead) continue
          const rr = cfg.radius + f.r
          const ddx = f.x - c.x
          const ddy = f.y - c.y
          if (ddx * ddx + ddy * ddy > rr * rr) continue
          if (f.kind === 'poison') {
            c.energy += FOOD_INFO.poison.energy // negativo: daño
            f.dead = true
            this.foodCounts.poison--
            return
          }
          if ((f.mask & cfg.diet) !== 0) {
            c.energy = Math.min(cfg.maxEnergy, c.energy + f.energy)
            c.foodEaten++
            f.dead = true
            this.foodCounts[f.kind]--
            return
          }
          return // toca algo no comestible para ella
        }
      }
    }
  }

  // ——— Reproducción y evolución ———

  spawnChild(parent: Creature): void {
    const cfg = SPECIES_CONFIG[parent.species]
    if (this.counts[parent.species] >= cfg.popCap) return
    const rng = this.rng

    const brain = parent.brain.clone()
    brain.mutate(rng, 0.1, 0.42)

    // Rasgos heredables con mutación: velocidad máxima y rango sensorial.
    const maxSpeed = clamp(
      parent.maxSpeed * (1 + rng.gauss(0.06)),
      cfg.baseSpeed * 0.7,
      cfg.baseSpeed * 1.7,
    )
    const vision = clamp(
      parent.vision * (1 + rng.gauss(0.05)),
      cfg.baseVision * 0.7,
      cfg.baseVision * 1.4,
    )

    const child = new Creature({
      species: parent.species,
      x: clamp(parent.x + rng.gauss(9), 15, this.width - 15),
      y: clamp(parent.y + rng.gauss(9), 15, this.height - 15),
      brain,
      generation: parent.generation + 1,
      parentGen: parent.generation,
      maxSpeed,
      vision,
      energy: cfg.reproChildEnergy,
    })
    parent.energy -= cfg.reproCost
    parent.children++
    this.creatures.push(child)
    this.counts[parent.species]++
    this.births++
    if (child.generation > this.maxGen) this.maxGen = child.generation
  }

  // ——— Alimentos ———

  private fruitCap(): number {
    return Math.round(60 * this.env.foodRate) + 10
  }

  private detritusCap(): number {
    return Math.round(55 * this.env.foodRate) + 12
  }

  private spawnFood(kind: FoodKind): Food {
    const y =
      kind === 'detritus'
        ? this.rand(this.height * 0.45, this.height - 14)
        : this.rand(14, this.height - 14)
    const f = new Food(kind, this.rand(14, this.width - 14), y)
    return this.addFood(f)
  }

  private addFood(f: Food): Food {
    this.foods.push(f)
    this.foodCounts[f.kind]++
    return f
  }

  private spawnFoodTimers(dt: number): void {
    const e = this.env
    const rates: Record<FoodKind, number> = {
      fruit: 0.8 * e.foodRate,
      // La humedad/lluvia favorece la materia orgánica del suelo.
      detritus: 0.9 * e.foodRate * (0.55 + (e.humidity / 100) * 1.1),
      sugar: 0.16 * e.foodRate,
      poison: 0.07 * e.poisonRate,
    }
    const caps: Record<FoodKind, number> = {
      fruit: this.fruitCap(),
      detritus: this.detritusCap(),
      sugar: 14,
      poison: Math.round(8 + 18 * e.poisonRate),
    }
    for (const kind of ['fruit', 'detritus', 'sugar', 'poison'] as FoodKind[]) {
      this.spawnTimers[kind] += dt * rates[kind]
      while (this.spawnTimers[kind] >= 1) {
        this.spawnTimers[kind] -= 1
        if (this.foodCounts[kind] < caps[kind]) this.spawnFood(kind)
      }
    }
  }

  private pushStatPoint(): void {
    let flySpeed = 0
    let wormSpeed = 0
    let flyGen = 0
    let wormGen = 0
    let flyE = 0
    let wormE = 0
    const { fly, worm } = this.counts
    for (const c of this.creatures) {
      if (c.species === 'fly') {
        flySpeed += c.speed
        flyGen += c.generation
        flyE += c.energy
      } else {
        wormSpeed += c.speed
        wormGen += c.generation
        wormE += c.energy
      }
    }
    this.stats.push({
      t: Math.round(this.time * 10) / 10,
      flies: fly,
      worms: worm,
      fruit: this.foodCounts.fruit,
      detritus: this.foodCounts.detritus,
      sugar: this.foodCounts.sugar,
      poison: this.foodCounts.poison,
      flySpeed: fly ? flySpeed / fly : 0,
      wormSpeed: worm ? wormSpeed / worm : 0,
      flyGen: fly ? flyGen / fly : 0,
      wormGen: worm ? wormGen / worm : 0,
      flyEnergy: fly ? flyE / fly : 0,
      wormEnergy: worm ? wormE / worm : 0,
    })
    if (this.stats.length > 480) this.stats.shift()
  }

  // ——— Interacción desde la UI ———

  snapshot(): WorldView {
    const selected = this.selectedView()
    if (this.selectedId !== null && !selected) this.selectedId = null
    return {
      time: this.time,
      day: Math.floor(this.time / this.env.dayLength) + 1,
      light: this.light,
      ambientTemp: this.ambientTemp,
      humidity: this.env.humidity,
      env: { ...this.env },
      counts: {
        flies: this.counts.fly,
        worms: this.counts.worm,
        fruit: this.foodCounts.fruit,
        detritus: this.foodCounts.detritus,
        sugar: this.foodCounts.sugar,
        poison: this.foodCounts.poison,
      },
      maxGen: this.maxGen,
      births: this.births,
      deaths: this.deaths,
      stats: this.stats.slice(),
      selected,
      extinctFly: this.counts.fly === 0,
      extinctWorm: this.counts.worm === 0,
    }
  }

  getSelected(): Creature | null {
    if (this.selectedId === null) return null
    return (
      this.creatures.find((c) => c.id === this.selectedId && c.alive) ?? null
    )
  }

  private selectedView(): CreatureView | null {
    const c = this.getSelected()
    if (!c) return null
    return {
      id: c.id,
      species: c.species,
      generation: c.generation,
      parentGen: c.parentGen,
      energy: c.energy,
      maxEnergy: SPECIES_CONFIG[c.species].maxEnergy,
      age: c.age,
      maxAge: SPECIES_CONFIG[c.species].maxAge,
      speed: c.speed,
      maxSpeed: c.maxSpeed,
      vision: c.vision,
      effVision: c.effVision,
      bodyTemp: c.bodyTemp,
      foodEaten: c.foodEaten,
      children: c.children,
      fitness: Math.round(c.fitness * 10) / 10,
      x: Math.round(c.x),
      y: Math.round(c.y),
      inputs: Array.from(c.brain.inA),
      hidden: Array.from(c.brain.hA),
      outputs: Array.from(c.brain.oA),
      weights: Array.from(c.brain.w),
    }
  }

  selectAt(x: number, y: number): boolean {
    let best: Creature | null = null
    let bd = 18 * 18
    for (const c of this.creatures) {
      if (!c.alive) continue
      const d2 = (c.x - x) * (c.x - x) + (c.y - y) * (c.y - y)
      if (d2 < bd) {
        bd = d2
        best = c
      }
    }
    this.selectedId = best ? best.id : null
    return !!best
  }

  deselect(): void {
    this.selectedId = null
  }

  followRandom(species: Species): boolean {
    const pool = this.creatures.filter(
      (c) => c.species === species && c.alive,
    )
    if (!pool.length) return false
    this.selectedId = pool[this.rng.int(pool.length)].id
    return true
  }

  reintroduce(species: Species): number {
    const n = 15
    for (let i = 0; i < n; i++) {
      this.creatures.push(
        new Creature({
          species,
          x: this.rand(30, this.width - 30),
          y: this.rand(30, this.height - 30),
        }),
      )
      this.births++
    }
    return n
  }

  /** Siembra 8 individuos a partir de un cerebro guardado en el Museo. */
  seedFromRecord(rec: EliteRecord): number {
    const n = 8
    const cfg = SPECIES_CONFIG[rec.species]
    for (let i = 0; i < n; i++) {
      const brain = new Brain(new Float32Array(rec.brain.weights))
      brain.mutate(this.rng, 0.05, 0.2)
      this.creatures.push(
        new Creature({
          species: rec.species,
          x: this.rand(30, this.width - 30),
          y: this.rand(30, this.height - 30),
          brain,
          generation: rec.generation,
          parentGen: rec.generation,
          maxSpeed: clamp(
            rec.brain.traits.maxSpeed,
            cfg.baseSpeed * 0.6,
            cfg.baseSpeed * 1.8,
          ),
          vision: clamp(
            rec.brain.traits.vision,
            cfg.baseVision * 0.6,
            cfg.baseVision * 1.5,
          ),
          energy: cfg.startEnergy + 10,
        }),
      )
      this.births++
    }
    if (rec.generation > this.maxGen) this.maxGen = rec.generation
    return n
  }

  /** Las 2 mejores criaturas de cada especie, listas para el Museo. */
  getElite(): EliteRecord[] {
    const pick = (species: Species): Creature[] =>
      this.creatures
        .filter((c) => c.species === species)
        .sort((a, b) => b.fitness - a.fitness)
        .slice(0, 2)
    const toRecord = (c: Creature): EliteRecord => ({
      species: c.species,
      generation: c.generation,
      fitness: Math.round(c.fitness * 10) / 10,
      brain: {
        weights: Array.from(c.brain.w).map((v) => Math.round(v * 1000) / 1000),
        traits: {
          maxSpeed: Math.round(c.maxSpeed),
          vision: Math.round(c.vision),
        },
      },
      env: {
        ...this.env,
        time: Math.round(this.time),
        day: Math.floor(this.time / this.env.dayLength) + 1,
      },
    })
    return [...pick('fly'), ...pick('worm')].map(toRecord)
  }
}

export { MASK }
