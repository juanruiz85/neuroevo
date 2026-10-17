// El mundo: criaturas, alimentos, clima, grilla espacial, evolución y estadísticas.

import type { IBrainAdapter } from './connectome/adapter'
import { Creature, flyDevRate, wormDevRate, wormStageDuration } from './creature'
import { Brain } from './nn'
import { ElegansBrain, ELEGANS_GENES } from './connectome/elegans'
import { DrosophilaBrain, DROSOPHILA_GENES } from './connectome/drosophila'
import { knockoutIndices } from './connectome/knockouts'
import { Rng } from './rng'
import {
  DEFAULT_ENV,
  FOOD_INFO,
  MASK,
  SPECIES_CONFIG,
  WORM_LIFE,
  clamp,
  type ActiveStimulus,
  type ArenaGoal,
  type ArenaResult,
  type CreatureView,
  type EliteRecord,
  type EnvParams,
  type FoodKind,
  type StimKind,
  type SimMode,
  type Species,
  type StatPoint,
  type TracePoint,
  type Wall,
  type WorldView,
} from './types'
import type { BrainKind } from './connectome/adapter'

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

/**
 * Huevo de C. elegans o Drosophila: depositado por el circuito neural
 * de puesta de la madre (HSN+VC / DN-SEZ), incuba con la temperatura
 * (Q10, óptimo distinto por especie) y eclosiona con el cerebro
 * clonado+mutado (la meiosis ocurrió en la puesta).
 */
export class Egg {
  static nextId = 1
  readonly id: number
  readonly species: Species
  x: number
  y: number
  /** Cerebro clonado+mutado de la madre (autofecundación). */
  readonly brain: IBrainAdapter
  readonly generation: number
  readonly parentGen: number
  readonly maxSpeed: number
  readonly vision: number
  /** Cuenta atrás de embriogénesis (s, a la temperatura óptima). */
  embryoT: number
  /** Duración total de la incubación (para el render del retorcido). */
  readonly embryoTotal: number
  /** Edad total del huevo (para los no eclosionados). */
  age = 0
  hatched = false
  dead = false

  constructor(
    species: Species,
    x: number,
    y: number,
    brain: IBrainAdapter,
    generation: number,
    parentGen: number,
    maxSpeed: number,
    vision: number,
  ) {
    this.id = Egg.nextId++
    this.species = species
    this.x = x
    this.y = y
    this.brain = brain
    this.generation = generation
    this.parentGen = parentGen
    this.maxSpeed = maxSpeed
    this.vision = vision
    // Gusano: ~10 h reales a 20 °C. Mosca: ~24 h a 25 °C (escala 1 s ≈ 1 h).
    this.embryoTotal =
      species === 'worm' ? WORM_LIFE.eggEmbryo : FLY_EGG_EMBRYO
    this.embryoT = this.embryoTotal
  }
}

/** Embriogénesis de Drosophila a 25 °C (≈ 24 h reales; escala del mundo). */
export const FLY_EGG_EMBRYO = 18

export class World {
  readonly width: number
  readonly height: number
  env: EnvParams
  /** Modo de simulación (ecosistema por defecto). */
  mode: SimMode = 'ecosystem'
  time = 0
  ticks = 0
  readonly rng = new Rng()
  creatures: Creature[] = []
  /** Huevos en incubación (depositados por circuitos neurales reales). */
  eggs: Egg[] = []
  foods: Food[] = []
  light = 0.5
  ambientTemp = 24
  selectedId: number | null = null
  maxGen = 0
  births = 0
  deaths = 0
  readonly stats: StatPoint[] = []

  // ——— Arena / Retos (Fase 2) ————————————————————————————————————————
  /** Paredes colocadas por el editor. */
  walls: Wall[] = []
  /** Meta de llegada. */
  goal: ArenaGoal | null = null
  /** Cronómetro del ensayo en marcha. */
  runT = 0
  /** true entre arenaStart() y el final del ensayo. */
  arenaRunning = false
  /** Resultados de participantes (llegadas y muertes). */
  arenaResults: ArenaResult[] = []

  // ——— Laboratorio (Fase 2) ——————————————————————————————————————————
  /** Estímulos activos (tap, sombra, flash, calor, chorro de aire). */
  stimuli: ActiveStimulus[] = []
  /** Sobrecarga térmica activa de los pulsos de calor (°C). */
  stimTemp = 0
  /** Knockouts activos por especie (índices reales del conectoma). */
  private knockouts: Partial<Record<Species, Set<number>>> = {}
  /** Trazas del cerebro seleccionado (Laboratorio). */
  traces: TracePoint[] = []
  private traceTimer = 0

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
    if (this.mode === 'ecosystem') this.populate()
  }

  reset(): void {
    this.creatures = []
    this.eggs = []
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
    this.runT = 0
    this.arenaRunning = false
    this.arenaResults = []
    this.stimuli = []
    this.stimTemp = 0
    this.traces = []
    this.traceTimer = 0
    for (const k of Object.keys(this.spawnTimers) as FoodKind[]) {
      this.spawnTimers[k] = 0
    }
    if (this.mode === 'ecosystem') this.populate()
  }

  /**
   * Cambia el modo de simulación: ecosistema (población inicial + clima),
   * arena (mundo vacío para construir un reto) o laboratorio (un plato
   * limpio con estímulos y knockouts). Conserva paredes/meta entre sesiones
   * de arena.
   */
  setMode(mode: SimMode): void {
    const keepWalls = mode === 'arena'
    this.mode = mode
    if (mode !== 'arena') {
      this.walls = []
      this.goal = null
    }
    this.knockouts = {}
    this.reset()
    if (mode === 'lab') {
      // Plato de agar estándar: 20 °C (temperatura de mantenimiento de
      // C. elegans), luz y humedad estables. El experimentalista trae sus
      // propios organismos, comida y estímulos.
      this.env.temperature = 20
      this.env.dayLength = 600 // luz estable durante el ensayo
      this.addFoodAt('sugar', this.width / 2, this.height / 2 + 140)
    }
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
    this.ambientTemp = this.env.temperature + (this.light - 0.5) * 7 + this.stimTemp

    // ——— Estímulos del Laboratorio: vida y decaimiento ————————————————————
    for (const s of this.stimuli) s.t += dt
    this.stimuli = this.stimuli.filter((s) => s.t < s.dur)
    // El pulso de calor se apaga al caducar su estímulo.
    if (this.stimTemp > 0 && !this.stimuli.some((s) => s.kind === 'heat')) {
      this.stimTemp = Math.max(0, this.stimTemp - dt * 6)
    }

    if (this.arenaRunning) this.runT += dt

    this.rebuildGrids()

    for (const c of this.creatures) {
      if (c.alive) c.tick(this, dt)
    }

    // ——— Arena: llegada a la meta y registro de desenlaces ————————————————
    if (this.mode === 'arena') {
      for (const c of this.creatures) {
        if (c.arenaDone || !c.alive) continue
        if (this.goal) {
          const g = this.goal
          const d2 = (c.x - g.x) ** 2 + (c.y - g.y) ** 2
          if (d2 <= g.r * g.r) {
            c.arenaDone = true
            c.arenaOutcome = 'goal'
            c.alive = false // se retira al tocar la meta
            this.arenaResults.push({
              id: c.id,
              species: c.species,
              brainKind: c.brain.kind,
              time: Math.round(this.runT * 100) / 100,
              success: true,
              cause: 'goal',
            })
          }
        }
      }
      // Muertes registradas con su causa.
      for (const c of this.creatures) {
        if (c.arenaDone || c.alive) continue
        c.arenaDone = true
        this.arenaResults.push({
          id: c.id,
          species: c.species,
          brainKind: c.brain.kind,
          time: Math.round(this.runT * 100) / 100,
          success: false,
          cause: c.poisoned ? 'poison' : c.age > SPECIES_CONFIG[c.species].maxAge ? 'age' : 'starve',
        })
      }
      if (this.arenaRunning && this.creatures.every((c) => !c.alive)) {
        this.arenaRunning = false
      }
    }

    // Huevos: la embriogénesis avanza con la temperatura (Q10 propia de
    // cada especie) y el huevo eclosiona con su cerebro listo. Con el
    // mundo saturado (popCap) el huevo espera; si envejece, se pierde.
    const caps: Record<Species, number> = {
      fly: SPECIES_CONFIG.fly.popCap,
      worm: SPECIES_CONFIG.worm.popCap,
    }
    for (const e of this.eggs) {
      e.age += dt
      if (!e.hatched && e.embryoT > 0) {
        const devRate =
          e.species === 'worm'
            ? wormDevRate(this.ambientTemp)
            : flyDevRate(this.ambientTemp)
        e.embryoT -= dt * devRate
      }
      if (!e.hatched && e.embryoT <= 0 && this.counts[e.species] < caps[e.species]) {
        e.hatched = true
        const baby =
          e.species === 'worm'
            ? // Eclosión como L1 con reserva de vitelo.
              new Creature({
                species: 'worm',
                x: clamp(e.x, 15, this.width - 15),
                y: clamp(e.y, 15, this.height - 15),
                brain: e.brain,
                generation: e.generation,
                parentGen: e.parentGen,
                maxSpeed: e.maxSpeed,
                vision: e.vision,
                energy: WORM_LIFE.yolkEnergy,
                stage: 'l1',
              })
            : // Mosca: nace adulta joven (no simulamos la pupa, documentado);
              // vitelo rico del huevo real de Drosophila.
              new Creature({
                species: 'fly',
                x: clamp(e.x, 15, this.width - 15),
                y: clamp(e.y, 15, this.height - 15),
                brain: e.brain,
                generation: e.generation,
                parentGen: e.parentGen,
                maxSpeed: e.maxSpeed,
                vision: e.vision,
                energy: 40,
              })
        this.creatures.push(baby)
        this.applyKnockouts(baby) // knockout vigente → también al nacer
        this.counts[e.species]++
        this.births++
        if (e.generation > this.maxGen) this.maxGen = e.generation
      }
      if (e.age > (e.species === 'worm' ? 48 : 40)) e.dead = true
    }
    if (this.ticks % 15 === 0) {
      this.eggs = this.eggs.filter((e) => !e.dead && !e.hatched)
    }

    // Los cadáveres se reciclan como detritos (ciclo de energía), solo en
    // el ecosistema abierto (en arena/lab no hay lluvia de materia).
    if (this.mode === 'ecosystem') {
      for (const c of this.creatures) {
        if (
          !c.alive &&
          this.rng.next() < 0.6 &&
          this.foodCounts.detritus < this.detritusCap() + 20
        ) {
          this.addFood(new Food('detritus', c.x, c.y, 18, 4, 60))
        }
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

    if (this.mode === 'ecosystem') this.spawnFoodTimers(dt)

    this.statTimer += dt
    if (this.statTimer >= 0.5) {
      this.statTimer -= 0.5
      this.pushStatPoint()
    }

    // ——— Trazas del cerebro seleccionado (Laboratorio, 10 Hz) ————————————
    this.traceTimer += dt
    if (this.traceTimer >= 0.1) {
      this.traceTimer -= 0.1
      const sel = this.getSelected()
      if (sel && sel.brain.connectomeView) {
        const h = sel.brain.hA
        const isWorm = sel.brain.kind === 'elegans'
        this.traces.push({
          t: Math.round(this.time * 10) / 10,
          fwd: r2(h[3]),
          rev: r2(h[4]),
          egg: r2(isWorm ? h[6] : h[5]),
          spike: r2(h[7] ?? h[6]),
        })
        if (this.traces.length > 900) this.traces.shift()
      }
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

  countNeighbors(
    x: number,
    y: number,
    range: number,
    species: Species | 'any',
    exclude?: import('./creature').Creature,
  ): number {
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
          if (!c.alive) continue
          if (c === exclude) continue // uno no se toca a sí mismo
          if (species !== 'any' && c.species !== species) continue
          const ddx = c.x - x
          const ddy = c.y - y
          if (ddx * ddx + ddy * ddy < r2) n++
        }
      }
    }
    return n
  }

  /**
   * Feromona de conglomerado (ascarósidos): la densidad local de gusanos
   * como proxy del nivel de feromona secretada al medio (sin auto-contarse:
   * un gusano solitario no huele su propia feromona). Alta densidad frena
   * la maduración de huevos y (con hambre) provoca la dauer.
   */
  wormPheromone(x: number, y: number, exclude?: import('./creature').Creature): number {
    return Math.min(1, this.countNeighbors(x, y, 70, 'worm', exclude) / 5)
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
            c.poisoned = true
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

  /**
   * Puesta de un huevo (gusano o mosca): la dispara ÚNICAMENTE el circuito
   * neural real de puesta (HSN+VC del gusano; DN-SEZ de la mosca). El
   * huevo sale por la vulva (segmento medio del cuerpo del gusano) o tras
   * el abdomen de la mosca, ya contiene el cerebro clonado+mutado
   * (autofecundación) y eclosionará según su especie.
   */
  layEgg(parent: Creature): void {
    // En arena/laboratorio no hay reproducción: protocolo limpio.
    if (this.mode !== 'ecosystem') return
    const cfg = SPECIES_CONFIG[parent.species]
    if (this.counts[parent.species] + this.eggs.length >= cfg.popCap) return
    const rng = this.rng
    const brain = parent.brain.clone()
    brain.mutate(rng, 0.1, 0.42)
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
    // La vulva real del gusano está a mitad del cuerpo; la mosca pone
    // con el abdomen.
    const origin = parent.species === 'worm'
      ? parent.segs[3] ?? parent
      : { x: parent.x - Math.cos(parent.heading) * 6, y: parent.y - Math.sin(parent.heading) * 6 }
    this.eggs.push(
      new Egg(
        parent.species,
        clamp(origin.x + rng.gauss(4), 12, this.width - 12),
        clamp(origin.y + rng.gauss(4), 12, this.height - 12),
        brain,
        parent.generation + 1,
        parent.generation,
        maxSpeed,
        vision,
      ),
    )
    if (parent.species === 'worm') {
      // El gusano gestiona su útero (huevos maduros + esperma limitado).
      parent.matureEggs--
    }
    parent.eggsLaid++
    parent.children++
    parent.laidFlash = 1
  }

  spawnChild(parent: Creature): void {
    // Solo las moscas ANN (especie de control) se reproducen por brotes
    // directos; los gusanos y las moscas biológicas ponen huevos a través
    // de su circuito neural. En arena/lab no hay reproducción.
    if (parent.species !== 'fly' || parent.brain.kind !== 'ann') return
    if (this.mode !== 'ecosystem') return
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
      eggs: this.eggs.length,
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
      mode: this.mode,
      walls: this.walls.slice(),
      goal: this.goal ? { ...this.goal } : null,
      runT: Math.round(this.runT * 100) / 100,
      arenaRunning: this.arenaRunning,
      arenaResults: this.arenaResults.slice(),
      traces: this.traces.slice(-240),
      counts: {
        flies: this.counts.fly,
        worms: this.counts.worm,
        eggs: this.eggs.length,
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
    const con = c.brain.connectomeView?.() ?? null
    const base = {
      id: c.id,
      species: c.species,
      generation: c.generation,
      parentGen: c.parentGen,
      energy: c.energy,
      maxEnergy: SPECIES_CONFIG[c.species].maxEnergy,
      age: c.age,
      maxAge: c.species === 'worm' ? Math.round(c.lifespan) : SPECIES_CONFIG[c.species].maxAge,
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
      brainKind: c.brain.kind,
    }
    let worm: Partial<CreatureView> = {}
    if (c.species === 'worm') {
      const dur = wormStageDuration(c.stage)
      worm = {
        stage: c.stage,
        stagePct:
          c.stage === 'adult'
            ? clamp(c.adultT / c.lifespan, 0, 1)
            : c.stage === 'dauer'
              ? clamp(c.dauerT / WORM_LIFE.dauerMax, 0, 1)
              : clamp(c.stageT / dur, 0, 1),
        adultAge: Math.round(c.adultT * 10) / 10,
        eggsLaid: c.eggsLaid,
        matureEggs: c.matureEggs,
        spermLeft: c.spermLeft,
        pheromone: Math.round(this.wormPheromone(c.x, c.y) * 100) / 100,
      }
    }
    return {
      ...base,
      ...worm,
      ...(con ? { connectome: { v: con.v as number[], s: con.s as number[] } } : {}),
    }
  }

  // ——— Laboratorio: estímulos y knockouts ————————————————————————————

  /**
   * Aplica un estímulo del Laboratorio en (x, y). Los estímulos activos se
   * traducen a corriente en los canales sensoriales correctos de cada
   * criatura (ver stimToInputs) y algunos tienen efecto físico inmediato.
   */
  stimulate(kind: StimKind, x: number, y: number): void {
    const mk = (dur: number, amp = 1): ActiveStimulus => ({
      kind, x, y, t: 0, dur, amp,
    })
    switch (kind) {
      case 'tap':
        // El golpe al plato del experimento de Rankin: vibración global y
        // ráfaga aferente con cola de adaptación (~0.8 s, como el tren
        // real de los mecanorreceptores del cuerpo).
        this.stimuli.push(mk(0.8))
        break
      case 'shadow': {
        // Sombra que crece (looming): disco oscuro expandiéndose 1.2 s.
        this.stimuli.push(mk(1.2))
        break
      }
      case 'flash':
        this.stimuli.push(mk(0.2))
        break
      case 'heat':
        this.stimuli.push(mk(3))
        this.stimTemp = 9
        break
      case 'foodDrop': {
        this.stimuli.push(mk(0.6, 0.4))
        this.addFoodAt('fruit', x, y)
        break
      }
      case 'airPuff': {
        // Chorro de aire: empuje radial real + ráfaga mecano.
        this.stimuli.push(mk(0.25))
        for (const c of this.creatures) {
          const dx = c.x - x
          const dy = c.y - y
          const d = Math.hypot(dx, dy)
          if (d < 150 && d > 1) {
            const k = (1 - d / 150) * 46
            c.x = clamp(c.x + (dx / d) * k, 12, this.width - 12)
            c.y = clamp(c.y + (dy / d) * k, 12, this.height - 12)
          }
        }
        break
      }
    }
  }

  /**
   * Traduce los estímulos activos a corriente: el TAP excita directamente
   * los mecanorreceptores del cuerpo (electrodo virtual — el circuito real
   * del tap-withdrawal: ALM/AVM/PLM → AVA/PVC), la sombra y el flash van a
   * los fotorreceptores por el canal de luz, y el chorro de aire a los
   * mecanosensores de la mosca.
   */
  stimToInputs(c: Creature, inp: number[]): void {
    if (!this.stimuli.length) return
    let lightMax = 0
    let tapAmp = 0
    let puffAmp = 0
    for (const s of this.stimuli) {
      switch (s.kind) {
        case 'tap': {
          // Golpe al plato: vibración mecánica global del cuerpo. La ráfaga
          // aferente DECAE (adaptación del mecanorreceptor real).
          const decayAmp = s.amp * Math.max(0.25, 1 - s.t / s.dur)
          tapAmp = Math.max(tapAmp, decayAmp)
          break
        }
        case 'shadow': {
          // Disco que crece sobre (x,y): la criatura lo "ve" cuando el radio
          // creciente la alcanza; la intensidad sube con la aproximación.
          const frac = s.t / s.dur
          const r = 30 + 170 * frac
          const d = Math.hypot(c.x - s.x, c.y - s.y)
          if (d < r) lightMax = Math.max(lightMax, 0.35 + 0.65 * frac)
          break
        }
        case 'flash':
          lightMax = Math.max(lightMax, 1)
          break
        case 'airPuff': {
          const d = Math.hypot(c.x - s.x, c.y - s.y)
          if (d < 140) {
            const amp = (1 - d / 140) * (1 - s.t / s.dur)
            puffAmp = Math.max(puffAmp, amp)
          }
          break
        }
        default:
          break
      }
    }
    // El estímulo domina sobre la señal ambiental de fondo.
    if (lightMax > 0) inp[3] = Math.max(inp[3] ?? 0, lightMax)
    // La ANN de control no tiene electrodo: recibe el tap por canal.
    if (tapAmp > 0 && c.brain.kind === 'ann') {
      inp[12] = Math.max(inp[12] ?? 0, tapAmp)
      inp[13] = Math.max(inp[13] ?? 0, tapAmp * 0.8)
    }
    // TAP y CHORRO: electrodo directo sobre el circuito mecanorreceptor real
    // de la especie (gusano: ALM/AVM/PLM — Wicks & Rankin 1997; mosca: MEC).
    // Amplitud de tren: los mecanorreceptores del animal responden al golpe
    // con ráfagas de picos, no con disparos aislados.
    const mech = tapAmp * 1.25 + puffAmp * 0.6
    if (mech > 0 && c.brain.stimulate) {
      c.brain.stimulate(this.mechIds(c.species), mech)
    }
  }

  /** Índices del circuito mecanorreceptor por especie (cacheado). */
  private mechCache: Partial<Record<Species, number[]>> = {}
  private mechIds(species: Species): number[] {
    if (!this.mechCache[species]) {
      this.mechCache[species] =
        species === 'worm'
          ? knockoutIndices(species, 'alm')
              .concat(knockoutIndices(species, 'plm'))
          : knockoutIndices(species, 'mec')
    }
    return this.mechCache[species]!
  }

  /** Activa/desactiva un knockout por grupo (ablación virtual). */
  setKnockout(species: Species, key: string, on: boolean): void {
    const cur =
      this.knockouts[species] ??
      (this.knockouts[species] = new Set<number>())
    const ids = knockoutIndices(species, key)
    if (on) ids.forEach((i) => cur.add(i))
    else ids.forEach((i) => cur.delete(i))
    const active = cur.size ? cur : null
    for (const c of this.creatures) {
      if (c.species === species && c.brain.setSilenced) {
        c.brain.setSilenced(active)
      }
    }
  }

  /** Lista de grupos de knockout encendidos (para la UI). */
  knockoutOn(species: Species, key: string): boolean {
    const cur = this.knockouts[species]
    if (!cur) return false
    const ids = knockoutIndices(species, key)
    return ids.length > 0 && ids.every((i) => cur.has(i))
  }

  /** Aplica el knockout vigente a un recién nacido (llamado al eclosionar). */
  private applyKnockouts(c: Creature): void {
    const cur = this.knockouts[c.species]
    if (cur && cur.size && c.brain.setSilenced) c.brain.setSilenced(cur)
  }

  // ——— Arena / Retos: editor y cronómetro ————————————————————————————

  addFoodAt(kind: FoodKind, x: number, y: number): Food {
    return this.addFood(new Food(kind, x, y))
  }

  arenaAddWall(w: Wall): void {
    this.walls.push(w)
  }

  arenaUndoWall(): Wall | null {
    return this.walls.pop() ?? null
  }

  arenaSetGoal(goal: ArenaGoal | null): void {
    this.goal = goal
  }

  /** Limpia paredes, meta, comida y participantes (no el clima). */
  arenaClear(): void {
    this.walls = []
    this.goal = null
    this.foods = []
    this.creatures = []
    this.eggs = []
    this.arenaResults = []
    this.arenaRunning = false
    this.runT = 0
    this.selectedId = null
  }

  /**
   * Suelta un organismo en la arena con la arquitectura cerebral elegida
   * ('ann' = control experimental, 'elegans'/'drosophila' = conectoma real).
   */
  spawnAt(
    species: Species,
    kind: BrainKind,
    x: number,
    y: number,
    genome?: Float32Array,
  ): Creature {
    const brain: IBrainAdapter =
      kind === 'ann'
        ? genome ? new Brain(genome) : new Brain()
        : kind === 'elegans'
          ? genome ? new ElegansBrain(genome) : new ElegansBrain()
          : genome
            ? new DrosophilaBrain(genome)
            : new DrosophilaBrain()
    const c = new Creature({
      species,
      x: clamp(x, 20, this.width - 20),
      y: clamp(y, 20, this.height - 20),
      brain,
      energy: SPECIES_CONFIG[species].maxEnergy,
    })
    this.creatures.push(c)
    this.applyKnockouts(c)
    return c
  }

  /** Inicia el ensayo: cronómetro a cero y resultados limpios. */
  arenaStart(): void {
    this.arenaResults = []
    this.runT = 0
    this.arenaRunning = this.creatures.length > 0
    for (const c of this.creatures) {
      c.arenaDone = false
      c.arenaOutcome = undefined
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
    // Reconstruye la arquitectura correcta por kind (los registros viejos
    // de moscas eran ANN; los de gusanos viejos sin kind se detectan por
    // longitud de genoma).
    const makeBrain = (): IBrainAdapter => {
      if (rec.brain.kind === 'drosophila' ||
        (rec.species === 'fly' && rec.brain.weights.length === DROSOPHILA_GENES)) {
        return new DrosophilaBrain(new Float32Array(rec.brain.weights))
      }
      if (rec.brain.kind === 'ann') return new Brain(new Float32Array(rec.brain.weights))
      if (rec.species === 'worm') {
        const isElegans =
          rec.brain.weights.length === ELEGANS_GENES ||
          rec.brain.weights.length === 20
        return isElegans
          ? new ElegansBrain(new Float32Array(rec.brain.weights))
          : new Brain(new Float32Array(rec.brain.weights))
      }
      // Mosca sin kind (registro antiguo): ANN clásica de 131 pesos.
      return new Brain(new Float32Array(rec.brain.weights))
    }
    for (let i = 0; i < n; i++) {
      const brain = makeBrain()
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
        kind: c.brain.kind,
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

function r2(x: number): number {
  return Math.round(x * 1000) / 1000
}
