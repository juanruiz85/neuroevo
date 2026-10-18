// Criatura: sentidos → cerebro (adaptador: ANN o conectoma biológico)
// → movimiento, metabolismo, ciclo de vida y reproducción.
//
// GUSANOS (C. elegans, biología real — ver docs/SENSORES-CICLO-REPRODUCCION.md):
//   · 17 canales sensoriales mapeados a neuronas reales (sensors.ts).
//   · Ciclo de vida L1→L2→L3→L4→Adulto con Q10 térmica; larvas más lentas
//     y baratas; senescencia adulta con longevidad heredable por azar.
//   · Dauer: hambre sostenida en L2/L3 → fase de resistencia (boca sellada,
//     metabolismo ~5%, sin envejecer) hasta volver a oler comida.
//   · Reproducción: hermafrodita con autofecundación y esperma limitado;
//     los huevos maduran gastando energía (más lento con feromona de
//     conglomerado) y SOLO se ponen cuando el circuito neural real
//     HSN+VC dispara la salida "Reproducir". Los huevos son objetos del
//     mundo que eclosionan como L1 (world.ts).
//
// MOSCAS (Fase 2): conectoma real del cerebro larvario de Drosophila
// (Winding 2023) con 18 canales sensoriales mapeados a grupos reales
// (fly-sensors.ts); puesta de huevos por el circuito DN-SEZ; la ANN de
// control se conserva para experimentos comparativos.

import { createBrain, type IBrainAdapter } from './connectome/adapter'
import { CH, NN_CHANNELS } from './connectome/sensors'
import { DCH } from './connectome/fly-sensors'
import {
  MASK,
  SPECIES_CONFIG,
  WORM_LIFE,
  WORM_STAGE_DRAIN,
  WORM_STAGE_SCALE,
  clamp,
  type Species,
  type WormStage,
} from './types'
import type { Food, World } from './world'

const POISON_MASK = 8

/** Velocidad de desarrollo con la temperatura (Q10 ≈ 2, óptimo 20 °C). */
export function wormDevRate(temp: number): number {
  return clamp(Math.pow(2, (temp - 20) / 10), 0.3, 2.6)
}

/** Desarrollo embrionario de Drosophila (Q10 ≈ 2, óptimo 25 °C). */
export function flyDevRate(temp: number): number {
  return clamp(Math.pow(2, (temp - 25) / 10), 0.3, 2.6)
}

/** Duración de una fase larvaria a 20 °C (s). */
export function wormStageDuration(stage: WormStage): number {
  if (stage === 'adult') return WORM_LIFE.adultMedian
  if (stage === 'dauer') return WORM_LIFE.dauerMax
  return WORM_LIFE.stages[stage]
}

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
  /** Fase inicial del ciclo de vida (gusanos; por defecto adulto). */
  stage?: WormStage
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
  /** Rango sensorial efectivo tras aplicar clima y fase vital. */
  effVision: number
  bodyTemp: number
  foodEaten = 0
  children = 0
  alive = true
  wingPhase: number
  readonly trailX: number[] = []
  readonly trailY: number[] = []
  readonly segs: { x: number; y: number }[] = []

  // ——— Ciclo de vida (gusanos) ———
  stage: WormStage = 'adult'
  /** Tiempo dentro de la fase actual (escalado por Q10 en larvas). */
  stageT = 0
  /** Tiempo como adulto (senescencia). */
  adultT = 0
  /** Longevidad adulta sorteada al nacer (genética + azar). */
  lifespan: number = WORM_LIFE.adultMedian
  matureEggs = 0
  spermLeft = WORM_LIFE.spermCap
  eggsLaid = 0
  private eggTimer = 0
  private layCd = 0
  private starveT = 0
  /** Tiempo en fase dauer (visible para el inspector). */
  dauerT = 0
  private dauerExitT = 0

  // ——— Arena / Laboratorio (Fase 2) ————————————————————————————————————
  /** true al tocar la meta o registrarse su desenlace. */
  arenaDone = false
  /** Desenlace del ensayo ('goal' al llegar). */
  arenaOutcome?: 'goal'
  /** true si comió veneno (causa de muerte para el registro). */
  poisoned = false

  // ——— Sensores de fase (decaen, como receptores fáscicos reales) ———
  /** Destello de tacto cefálico (para el canal ASH/FLP/OLQ y el render). */
  touchF = 0
  /** Destello de tacto caudal (PLM). */
  touchB = 0
  /** Anillo dorado de puesta (render). */
  laidFlash = 0
  /** Ráfaga de gusto faríngeo al ingerir (GNP de la mosca). */
  gutFlash = 0
  /** Ráfaga de sabor amargo al probar un cebo (GRN amargas). */
  bitterFlash = 0
  /** Refractario de degustación del cebo amargo (s). */
  bitterCd = 0
  /** Aprendizaje alimentario por valor: refuerzo por comida buena. */
  learnGood = 0
  /** Aprendizaje alimentario por valor: aversión aprendida a lo amargo. */
  learnBad = 0
  /** nº de comilonas buenas (recompensa). */
  bitesGood = 0
  /** nº de pruebas del cebo amargo (castigo). */
  bitesBitter = 0
  private prevHeading = 0
  private proprioSm = 0
  private foodNearSm = 0
  private foodPrevSm = 0
  private foodDeltaSm = 0
  // ——— Adaptación sensorial (fotorreceptores e higrosensación reales:
  // responden a CAMBIOS, no a niveles constantes; τ ≈ 3 s) ————————
  private lightSm = 0.5
  private humSm = 0.55
  // AFD es un detector de RAMPAS (responde a dT/dt con adaptación):
  private tempSm = 24

  private readonly inputs: number[] = new Array<number>(NN_CHANNELS).fill(0)

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
      this.stage = opts.stage ?? 'adult'
      // Longevidad adulta con varianza individual (±20 %).
      this.lifespan = WORM_LIFE.adultMedian * (0.8 + Math.random() * 0.4)
      for (let i = 0; i < 8; i++) this.segs.push({ x: this.x, y: this.y })
    }
  }

  /** Aptitud total: se usa para elegir las élites del Museo. */
  get fitness(): number {
    return this.foodEaten * 2 + this.children * 4 + this.age * 0.05
  }

  /** Escala locomotora según la fase (las larvas son más pequeñas/lentas). */
  private get stageScale(): number {
    return this.species === 'worm' ? WORM_STAGE_SCALE[this.stage] : 1
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
      // Quimiorreceptores: la humedad afina el olfato; las larvas huelen menos lejos.
      vision *= (0.9 + (env.humidity / 100) * 0.3) * (0.55 + 0.45 * this.stageScale)
    }
    this.effVision = vision

    // — Sensores —
    // El cebo amargo HUELE como comida (los cebos reales de los ensayos
    // de aprendizaje llevan azúcar: atraen a los ingenuos); la aversión
    // aprendida luego apaga ese canal y enciende el nociceptivo.
    const smellMask = cfg.diet | MASK.bitter
    const food = world.nearestFood(this.x, this.y, vision, smellMask)
    const poison = world.nearestFood(this.x, this.y, vision, POISON_MASK)
    const crowd = world.countNeighbors(this.x, this.y, 42, this.species, this)

    const inp = this.inputs
    inp.fill(0) // reset de todos los canales cada tick
    inp[0] = 1 // sesgo
    inp[CH.ENERGY] = this.energy / cfg.maxEnergy
    inp[CH.LIGHT] = light // nivel crudo (la ANN de control ve el nivel)
    inp[CH.THERMO] = clamp((temp - cfg.optimalTemp) / 9, -1, 1) // idem ANN
    inp[CH.HUMIDITY] = env.humidity / 100
    if (poison) {
      setDirection(inp, CH.POISON_X, this, poison.x, poison.y, vision)
    }
    if (food) {
      setDirection(inp, CH.FOOD_X, this, food.x, food.y, vision)
      if (food.kind === 'bitter' && this.learnBad > 0.02) {
        // Aprendizaje por valor: la aversión aprendida (RIM/DAN) reescribe
        // la valencia del cebo — el olor "rico" se apaga y el mismo cebo
        // pasa a excitar la vía nociceptiva (lo aprendido huele "mal").
        const keep = 1 - 0.9 * this.learnBad
        inp[CH.FOOD_X] *= keep
        inp[CH.FOOD_Y] *= keep
        inp[CH.FOOD_NEAR] *= keep
        if (!poison) {
          const pb = 0.85 * this.learnBad
          setDirection(inp, CH.POISON_X, this, food.x, food.y, vision)
          inp[CH.POISON_X] *= pb
          inp[CH.POISON_Y] *= pb
          inp[CH.POISON_NEAR] *= pb
        }
      }
    }
    inp[CH.CROWD] = Math.min(1, crowd / 5)

    if (this.species === 'worm') {
      this.senseWorm(world, inp, food, dt)
    } else if (this.brain.kind !== 'ann') {
      // Los 6 sentidos exclusivos de la mosca biológica (la ANN de control
      // solo lee los 12 primeros canales del contrato común).
      this.senseFly(world, inp, food, dt)
    }

    // — Estímulos del Laboratorio: el mundo los inyecta por encima de
    //   las señales ambientales (tap, sombra, flash, chorro de aire).
    world.stimToInputs(this, inp)

    // — Piensa —
    this.brain.forward(inp, coldVoltage)

    // — Se mueve —
    const dauer = this.stage === 'dauer'
    const locoScale = this.species === 'worm' ? this.stageScale * (dauer ? 0.14 : 1) : 1
    this.heading += this.brain.oA[0] * cfg.turnRate * locoScale * dt
    const thrust = Math.max(0, this.brain.oA[1])
    this.speed =
      thrust * this.maxSpeed * locoScale *
      (this.species === 'fly' ? 1 - 0.2 * rain : 1)
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

    // Paredes de la arena: colisión círculo-segmento con rebote.
    if (world.walls.length) this.collideWalls(world)

    // — Animación —
    this.wingPhase += dt * (14 + this.speed * 0.18)
    if (this.species === 'worm') {
      // La larva crece: la separación de segmentos escala con la fase.
      const want = 3.4 * (0.6 + 0.4 * this.stageScale)
      this.segs[0].x = this.x
      this.segs[0].y = this.y
      for (let i = 1; i < this.segs.length; i++) {
        const prev = this.segs[i - 1]
        const seg = this.segs[i]
        const dx = seg.x - prev.x
        const dy = seg.y - prev.y
        const d = Math.hypot(dx, dy) || 1
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
    const stageDrain = this.species === 'worm' ? WORM_STAGE_DRAIN[this.stage] : 1
    let drain = (cfg.baseDrain + (this.speed / cfg.baseSpeed) * cfg.moveDrain) * stageDrain
    if (temp > 33) {
      // Calor extremo: metabolismo acelerado y desgaste (puede ser fatal).
      drain += (temp - 33) * (this.species === 'fly' ? 0.12 : 0.06) * stageDrain
    }
    if (temp < 8) drain *= 0.7 // letargo: se gastan menos energías
    if (this.species === 'worm') {
      // Los gusanos se desecan bajo el sol caluroso y seco (la dauer resiste).
      const dry = light * Math.max(0, temp - 24) * (1 - env.humidity / 100) * 0.16
      drain += dauer ? dry * 0.25 : dry * stageDrain
      if (env.humidity > 80) drain *= 0.85
      if (dauer) drain += 0.03 // mantenimiento mínimo de la dauer
    }
    this.energy -= drain * dt
    this.age += dt

    // — Come (o se envenena) — La dauer tiene la boca sellada: no come.
    const eatenBefore = this.foodEaten
    if (!dauer) world.eatFoodAt(this)
    // Ráfaga de gusto faríngeo: los GRNs faríngeos responden al ingerir.
    if (this.foodEaten > eatenBefore) this.gutFlash = 1
    this.gutFlash = Math.max(0, this.gutFlash - dt * 2.2)
    // Aprendizaje alimentario: extinción lenta de la memoria (Rankin et
    // al. 1990: la habituación se recupera en ~decenas de minutos; aquí
    // la aversión decae en ~15 min de simulación) y refractario del cebo.
    this.learnGood = Math.max(0, this.learnGood - dt / 600)
    this.learnBad = Math.max(0, this.learnBad - dt / 900)
    this.bitterCd = Math.max(0, this.bitterCd - dt)
    this.bitterFlash = Math.max(0, this.bitterFlash - dt * 2)

    // — Ciclo de vida y reproducción —
    if (this.species === 'worm') {
      this.tickWormLife(world, food, dt)
    } else if (this.brain.kind === 'drosophila') {
      // Mosca biológica: puesta de huevos SOLO cuando el pool DN-SEZ
      // (descendentes viscerales/oviposición) dispara la salida motora.
      // El coste energético se paga SOLO si el huevo se puso de verdad
      // (en arena/lab/3D no hay reproducción y el circuito no gasta).
      this.layCd -= dt
      if (
        this.energy > cfg.reproMinEnergy - 8 &&
        this.brain.oA[2] > 0.55 &&
        this.layCd <= 0
      ) {
        if (world.layEgg(this)) {
          this.energy -= cfg.reproCost
          this.children++
          this.laidFlash = 1
        }
        this.layCd = 2
      }
      if (this.age > cfg.maxAge) this.alive = false
    } else {
      const wantsChild =
        this.brain.oA[2] > 0.55 || this.energy > cfg.reproMinEnergy + 26
      if (this.energy > cfg.reproMinEnergy && wantsChild) {
        world.spawnChild(this)
      }
      if (this.age > cfg.maxAge) this.alive = false
    }

    // — Muere —
    if (this.energy <= 0) this.alive = false
  }

  /**
   * Colisión con las paredes de la arena: proyecta el cuerpo fuera del
   * segmento, refleja el rumbo sobre la normal y dispara el canal de tacto
   * (los mecanorreceptores reales responden al golpe).
   */
  private collideWalls(world: World): void {
    const r = SPECIES_CONFIG[this.species].radius + 2.5
    for (const w of world.walls) {
      const dx = w.x2 - w.x1
      const dy = w.y2 - w.y1
      const len2 = dx * dx + dy * dy || 1
      let t = ((this.x - w.x1) * dx + (this.y - w.y1) * dy) / len2
      t = clamp(t, 0, 1)
      const px = w.x1 + t * dx
      const py = w.y1 + t * dy
      let nx = this.x - px
      let ny = this.y - py
      const d = Math.hypot(nx, ny)
      if (d >= r || d < 0.001) continue
      nx /= d
      ny /= d
      this.x = px + nx * r
      this.y = py + ny * r
      const vx = Math.cos(this.heading)
      const vy = Math.sin(this.heading)
      const dot = vx * nx + vy * ny
      if (dot < 0) {
        // Reflexión especular del rumbo sobre la normal de la pared.
        const rx = vx - 2 * dot * nx
        const ry = vy - 2 * dot * ny
        this.heading = Math.atan2(ry, rx)
      }
      this.touchF = 1
    }
  }

  /**
   * Sentidos propios del gusano: tacto cefálico/caudal (circuitos reales
   * ASH→AVA→reversa y PLM→PVC→avance), propiocepción del ondular,
   * deriva del gradiente de comida (klinotaxis) y feromona de conglomerado.
   */
  private senseWorm(
    world: World,
    inp: number[],
    food: Food | null,
    dt: number,
  ): void {
    const decay = Math.exp(-dt * 6)

    // Adaptación sensorial: los fotorreceptores (LITE-1 en ASH), los
    // higrosensibles (BAG) y el termosensor AFD (detector de rampas,
    // Goodman & Sengupta) responden al CAMBIO, no al nivel — con luz y
    // temperatura constantes el fondo neural calla y solo los transitorios
    // (amanecer, estímulos del laboratorio) disparan.
    this.lightSm += (world.light - this.lightSm) * Math.min(1, dt / 3)
    this.humSm += (world.env.humidity / 100 - this.humSm) * Math.min(1, dt / 3)
    this.tempSm += (world.ambientTemp - this.tempSm) * Math.min(1, dt / 4)
    inp[CH.LIGHT] = clamp((world.light - this.lightSm) * 2.4, 0, 1)
    inp[CH.HUMIDITY] = clamp((world.env.humidity / 100 - this.humSm) * 2.4, 0, 1)
    const thermo = clamp((world.ambientTemp - this.tempSm) / 9, -1, 1)
    inp[CH.THERMO] = clamp(thermo * 2.4, -1, 1)

    // Tacto: nariz y cola contra bordes u otros cuerpos (receptores fáscicos).
    // Sin auto-contarse: uno no se toca la nariz a sí mismo.
    const reach = 9
    const nx = this.x + Math.cos(this.heading) * 9
    const ny = this.y + Math.sin(this.heading) * 9
    const tx = this.x - Math.cos(this.heading) * 9
    const ty = this.y - Math.sin(this.heading) * 9
    const hitN =
      nx < 13 || nx > world.width - 13 || ny < 13 || ny > world.height - 13 ||
      world.countNeighbors(nx, ny, reach, 'any', this) > 0
    const hitB =
      tx < 13 || tx > world.width - 13 || ty < 13 || ty > world.height - 13 ||
      world.countNeighbors(tx, ty, reach, 'any', this) > 0
    this.touchF = hitN ? 1 : this.touchF * decay
    this.touchB = hitB ? 1 : this.touchB * decay
    inp[CH.TOUCH_FRONT] = this.touchF
    inp[CH.TOUCH_BACK] = this.touchB

    // Propiocepción: firma con signo de la curvatura del último giro
    // (DVA/SMDD sienten el estiramiento del cuerpo al ondular).
    const turn = (this.heading - this.prevHeading) / Math.max(dt, 1e-4)
    this.prevHeading = this.heading
    this.proprioSm += (turn - this.proprioSm) * Math.min(1, dt * 8)
    inp[CH.PROPRIO] = clamp(this.proprioSm / 2.2, -1, 1)

    // Deriva del gradiente (klinotaxis): ASE dispara al CAMBIO, no al nivel.
    // La aversión aprendida también apaga esta vía (cebo amargo).
    const near = food
      ? (1 - Math.min(1, Math.hypot(food.x - this.x, food.y - this.y) / Math.max(1, this.effVision))) *
        (food.kind === 'bitter' ? 1 - 0.9 * this.learnBad : 1)
      : 0
    this.foodNearSm += (near - this.foodNearSm) * Math.min(1, dt * 3)
    const d = (this.foodNearSm - this.foodPrevSm) / Math.max(dt, 1e-4)
    this.foodPrevSm = this.foodNearSm
    this.foodDeltaSm += (clamp(d * 0.9, -1, 1) - this.foodDeltaSm) * Math.min(1, dt * 10)
    inp[CH.FOOD_DELTA] = this.foodDeltaSm

    // Feromona de conglomerado (ascarósidos): densidad local de gusanos.
    inp[CH.PHEROMONE] = world.wormPheromone(this.x, this.y, this)
  }

  /**
   * Sentidos propios de la mosca biológica (paralelo a senseWorm): choques
   * contra paredes/cuerpos (MEC), propiocepción de vuelo con signo (PRO),
   * klinotaxis olfativa (ORN) y la ráfaga faríngea al ingerir (GNP).
   */
  private senseFly(
    world: World,
    inp: number[],
    food: Food | null,
    dt: number,
  ): void {
    const decay = Math.exp(-dt * 6)

    // Adaptación sensorial de los fotorreceptores e higrosensibles (igual
    // que el gusano: los PRs larvarios responden con adaptación; los
    // termosensores THc/THw también son detectores de cambio).
    this.lightSm += (world.light - this.lightSm) * Math.min(1, dt / 3)
    this.humSm += (world.env.humidity / 100 - this.humSm) * Math.min(1, dt / 3)
    this.tempSm += (world.ambientTemp - this.tempSm) * Math.min(1, dt / 4)
    inp[DCH.LIGHT] = clamp((world.light - this.lightSm) * 2.4, 0, 1)
    inp[DCH.HUMIDITY] = clamp((world.env.humidity / 100 - this.humSm) * 2.4, 0, 1)
    const thermoF = clamp((world.ambientTemp - this.tempSm) / 9, -1, 1)
    inp[DCH.THERMO] = clamp(thermoF * 2.4, -1, 1)

    // Tacto: cabeza contra bordes u otros cuerpos (mecanosensores MEC).
    const nx = this.x + Math.cos(this.heading) * 9
    const ny = this.y + Math.sin(this.heading) * 9
    const tx = this.x - Math.cos(this.heading) * 9
    const ty = this.y - Math.sin(this.heading) * 9
    const hitN =
      nx < 13 || nx > world.width - 13 || ny < 13 || ny > world.height - 13 ||
      world.countNeighbors(nx, ny, 9, 'any', this) > 0
    const hitB =
      tx < 13 || tx > world.width - 13 || ty < 13 || ty > world.height - 13 ||
      world.countNeighbors(tx, ty, 9, 'any', this) > 0
    this.touchF = hitN ? 1 : this.touchF * decay
    this.touchB = hitB ? 1 : this.touchB * decay
    inp[DCH.TOUCH_FRONT] = this.touchF
    inp[DCH.TOUCH_BACK] = this.touchB

    // Propiocepción de vuelo: firma con signo del giro + carga alar
    // (fase de aleteo ~ velocidad). Las sensillas campaniformes del adulto.
    const turn = (this.heading - this.prevHeading) / Math.max(dt, 1e-4)
    this.prevHeading = this.heading
    this.proprioSm += (turn - this.proprioSm) * Math.min(1, dt * 8)
    inp[DCH.PROPRIO] = clamp(this.proprioSm / 3.5, -1, 1)

    // Klinotaxis olfativa: las ORNs se adaptan → disparan al CAMBIO.
    // La aversión aprendida también apaga esta vía (cebo amargo).
    const near = food
      ? (1 - Math.min(1, Math.hypot(food.x - this.x, food.y - this.y) / Math.max(1, this.effVision))) *
        (food.kind === 'bitter' ? 1 - 0.9 * this.learnBad : 1)
      : 0
    this.foodNearSm += (near - this.foodNearSm) * Math.min(1, dt * 3)
    const d = (this.foodNearSm - this.foodPrevSm) / Math.max(dt, 1e-4)
    this.foodPrevSm = this.foodNearSm
    this.foodDeltaSm += (clamp(d * 0.9, -1, 1) - this.foodDeltaSm) * Math.min(1, dt * 10)
    inp[DCH.FOOD_DELTA] = this.foodDeltaSm

    // Feromona: sin receptor anotado en el dataset (canal a 0, documentado).
    inp[DCH.PHEROMONE] = 0
    // Gusto faríngeo: la ráfaga al ingerir (actualizada en tick()).
    inp[DCH.FPHARYNX] = this.gutFlash
  }

  /** Fases larvarias, dauer, senescencia y puesta de huevos. */
  private tickWormLife(
    world: World,
    food: { x: number; y: number } | null,
    dt: number,
  ): void {
    this.laidFlash = this.laidFlash > 0 ? this.laidFlash - dt * 1.6 : 0

    if (this.stage === 'dauer') {
      // DauER: sin envejecer, sin comer, esperando comida (sale como L4).
      this.dauerT += dt
      if (food) this.dauerExitT += dt
      else this.dauerExitT = Math.max(0, this.dauerExitT - dt * 0.5)
      if (this.dauerExitT > 2.5) {
        this.stage = 'l4'
        this.stageT = 0
        this.energy = Math.max(this.energy, 22)
      } else if (this.dauerT > WORM_LIFE.dauerMax) {
        this.alive = false
      }
      return
    }

    if (this.stage === 'adult') {
      this.adultT += dt * (1 + Math.max(0, this.bodyTemp - 26) * 0.05)
      // Autofecundación: maduración de huevos internos con esperma limitado.
      const pher = world.wormPheromone(this.x, this.y, this)
      if (
        this.adultT > WORM_LIFE.adultMatureDelay &&
        this.energy > WORM_LIFE.eggMinEnergy &&
        this.spermLeft > 0 &&
        this.matureEggs < WORM_LIFE.matureCap
      ) {
        this.eggTimer += (dt / WORM_LIFE.eggInterval) * (1 - 0.75 * pher)
        if (this.eggTimer >= 1) {
          this.eggTimer = 0
          this.matureEggs++
          this.spermLeft--
          this.energy -= WORM_LIFE.eggEnergy
        }
      } else if (this.energy <= WORM_LIFE.eggMinEnergy) {
        this.eggTimer = Math.max(0, this.eggTimer - dt * 0.2)
      }
      // Puesta SOLO cuando el circuito HSN+VC dispara la salida motora.
      this.layCd -= dt
      if (
        this.matureEggs > 0 &&
        this.brain.oA[2] > 0.5 &&
        this.layCd <= 0
      ) {
        world.layEgg(this)
        this.layCd = WORM_LIFE.layCooldown
      }
      // Senescencia.
      if (this.adultT > this.lifespan) this.alive = false
      return
    }

    // Fase larvaria: el desarrollo avanza con la temperatura (Q10).
    this.stageT += dt * wormDevRate(this.bodyTemp)
    const dur = WORM_LIFE.stages[this.stage as 'l1' | 'l2' | 'l3' | 'l4']
    // Entrada en dauer: hambre sostenida en L2/L3 (decision real L2d).
    if (this.stage === 'l2' || this.stage === 'l3') {
      this.starveT = this.energy < 18 ? this.starveT + dt : 0
      if (this.starveT > WORM_LIFE.dauerStarveT) {
        this.stage = 'dauer'
        this.dauerT = 0
        this.dauerExitT = 0
        return
      }
    }
    if (this.stageT >= dur) {
      if (this.stage === 'l4') {
        this.stage = 'adult'
        this.adultT = 0
        this.matureEggs = 0
        this.eggTimer = 0
      } else {
        const next: Record<'l1' | 'l2' | 'l3', 'l2' | 'l3' | 'l4'> = {
          l1: 'l2',
          l2: 'l3',
          l3: 'l4',
        }
        this.stage = next[this.stage as 'l1' | 'l2' | 'l3']
        this.stageT = 0
        this.energy -= 3 // coste de la muda
      }
    }
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
