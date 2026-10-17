// ─────────────────────────────────────────────────────────────────────────────
// Cerebro biológico de Drosophila — modelo LIF sobre el conectoma REAL del
// cerebro de la larva (Winding et al. 2023, Science 379:eadd9330).
//
// DATOS (src/lib/sim/data/drosophila_connectome.json, 684 KB, generado por
// scripts/build_drosophila.py — 100 % reproducible desde el crudo):
//   · 2.956 neuronas del cerebro larvario completo.
//   · 41.977 aristas químicas reales (257.414 sinapsis, 73,0 % del total;
//     umbral ≥3 contactos, EXCEPTO toda salida de sensor de primer orden,
//     siempre conservada). Sin gap junctions: la fuente no los reporta.
//   · 462 sensores de primer orden con modalidad REAL anotada:
//     olf 42 · gus 132 · gnp 110 · vis 29 · noc 6 · thc 6 · thw 4 ·
//     mec 14 · pro 8 · rsp 26 · gut 85.
//   · 346 neuronas descendentes de salida (DN-VNC 182 + DN-SEZ 164).
//
// MAPEO SENSORIAL (18 canales; ver fly-sensors.ts): cada canal excita el
// GRUPO anotado con esa modalidad exacta — ningún sensor inventado:
//   Hambre→GUT · Termo±→THc/THw · Luz→PR · Aire→RSP · OlfatoX/Y→ORN L/R ·
//   Gusto→GRN · Noci X/Y/int→NOC · Multitud/Tacto→MEC · Propio→PRO ·
//   ΔGradiente→ORN · Faríngeo→GNP · Feromona→(sin receptor anotado; canal
//   leído pero no inyectado, simplificación declarada).
//
// MAPEO MOTOR (pools reales → 3 salidas del Canvas):
//   Avanzar ← tasa de los DN-VNC (descendentes de locomoción, 182)
//   Girar   ← asimetría L/R de TODAS las DNs (la larva gira contrayendo un
//             lado; hemisphere real del dataset) AMPLIFICADA por el sesgo
//             lateral innato del genoma durante la klinotaxis (la larva
//             re-orienta con cabeceo cuando el gradiente cae — Luo 2010 —;
//             paralelo a la asimetría quimiosensorial L/R de AWC en C. elegans)
//   Poner   ← tasa de los DN-SEZ (descendentes viscerales/oviposición, 164)
//
// NEUROTRANSMISORES (derivados por tipo celular, literatura — el dataset no
// los incluye): ACh 2.364 excitador · GABA 218 y Glu 346 inhibitorios ·
// DA 28 modulador. DNs glutamatérgicas como la vía motora real de insecto.
//
// PLASTICIDAD — habituación por depresión homosináptica por uso (Rankin
// 1990): las aristas que SALEN de los mecanosensores (tap) y de los
// fotorreceptores (sombra repetida) se deprimen al disparar en un tren y se
// recuperan con τ≈60 s. Es POR SINAPSIS y POR INDIVIDUO (el grafo es
// compartido; las escalas no).
//
// RENDIMIENTO — tick-stepping 1:2 (calibrado en /home/z/calib, plan §2):
// un mundo con ~50 moscas exige <8 ms/tick y el bucle LIF completo pesa
// ~10 ms. Cada cerebro alterna por tick: (a) INTEGRACIÓN barata — solo la
// inyección sensorial se acumula en V, sin recorrer las 2.956 neuronas — y
// (b) DISPARO completo — fuga con leak² (τ equivalente de dos ticks),
// umbral, entrega sináptica y pools. Resolución efectiva 15 Hz: suficiente
// para conductas de segundos (documentado en CONECTOMA-DROSOPHILA.md).
//
// GENOMA (27 genes — el GA evoluciona neuromodulación, nunca la estructura):
//   [0..17] ganancia sensorial por canal (18) · [18..21] escalas de
//   transmisión ACh/Glu/GABA/monoaminas · [22] τ de fuga · [23] umbral ·
//   [24] refractario · [25] impulso tónico · [26] sesgo lateral de giro.
// —───────────────────────────────────────────────────────────────────────────

import rawConnectome from '../data/drosophila_connectome.json'
import { Rng } from '../rng'
import { clamp } from '../types'
import { DCH } from './fly-sensors'
import type {
  BrainKind,
  ConnectomeActivity,
  IBrainAdapter,
} from './adapter'

// ——— Tipos del dataset ———————————————————————————————————————————————————————

type Tx = 'ACh' | 'GABA' | 'Glu' | 'DA'

interface DrosophilaJson {
  meta: {
    species: string
    paper: string
    counts: {
      neurons: number
      chemical: number
      synapseContacts: number
      synapsesKept: number
      sensory: number
      inter: number
      motor: number
      sensorFirstOrder: number
      reachableFromSensors: number
      reachableDNs: number
      isolated: number
    }
    tx: Record<string, number>
  }
  neurons: { n: string; c: 0 | 1 | 2; t: Tx; h: 'L' | 'R' | 'M'; a: string }[]
  chem: { s: number[]; t: number[]; w: number[]; et: number[] }
}

const DATA = rawConnectome as unknown as DrosophilaJson

export const DROSOPHILA_INFO = {
  species: 'Drosophila melanogaster (larva)',
  paper: DATA.meta.paper,
  neurons: DATA.meta.counts.neurons,
  edges: DATA.meta.counts.chemical,
  synapsesKept: DATA.meta.counts.synapsesKept,
  synapsesTotal: DATA.meta.counts.synapseContacts,
  sensory: DATA.meta.counts.sensorFirstOrder,
  motor: DATA.meta.counts.motor,
  inter: DATA.meta.counts.inter,
} as const

export const DROSOPHILA_NAMES: string[] = DATA.neurons.map((x) => x.n)
export const DROSOPHILA_CLASSES: (0 | 1 | 2)[] = DATA.neurons.map((x) => x.c)

// ——— Grafo compartido (CSR) ———————————————————————————————————————————————
// La estructura sináptica es idéntica para todas las moscas (es biología);
// cada individuo solo posee su estado de membrana, su genoma de
// neuromodulación y sus escalas de habituación.

const TX_GROUP: Record<Tx, 0 | 1 | 2 | 3> = {
  ACh: 0,
  Glu: 1,
  GABA: 2,
  DA: 3,
}

interface FlyGraph {
  n: number
  srcOff: Uint32Array // CSR: offsets por neurona presináptica
  dst: Uint32Array // índice postsináptico
  w: Float32Array // peso con signo (GABA/Glu < 0), ya escalado
  txIdx: Uint8Array // grupo de transmisor de la neurona PRESINÁPTICA
  // ——— Habituación (Rankin 1990) ————————————————————————————————
  habMask: Uint8Array // 1 si la arista e es deprimible por uso
  habIdx: Int32Array // e → posición en la lista de escalas del individuo
  nHabit: number
  /** Sensores mecano/luz (para la depresión por uso). */
  habSensors: Int32Array
  // ——— Inyección sensorial en typed arrays planos (hot path) ————————
  smLen: number
  smCh: Int16Array
  smIdx: Int32Array
  smGain: Float32Array
  smSign: Float32Array
  /** Drive tónico directo al pool de locomoción (DN-VNC). */
  tonicPool: Int32Array
  pool: {
    forward: number[] // DN-VNC
    turnL: number[] // DNs hemisferio izquierdo
    turnR: number[] // DNs hemisferio derecho
    egg: number[] // DN-SEZ
  }
}

let GRAPH: FlyGraph | null = null

function buildGraph(): FlyGraph {
  const neurons = DATA.neurons
  const n = neurons.length
  const chem = DATA.chem
  const E = chem.s.length

  // Sinapsis químicas → CSR ordenado por fuente.
  const order = Array.from({ length: E }, (_, i) => i).sort(
    (a, b) => chem.s[a] - chem.s[b],
  )
  const srcOff = new Uint32Array(n + 1)
  const dst = new Uint32Array(E)
  const w = new Float32Array(E)
  const txIdx = new Uint8Array(n)
  neurons.forEach((neu, i) => {
    txIdx[i] = TX_GROUP[neu.t] ?? 0
  })
  // Peso: log2 de los contactos con signo por transmisor presináptico
  // (GABA y Glu inhibitorios — la glutamatergia motora de insecto es
  // inhibitoria en el VNC). Escala más baja que C. elegans: el grafo es
  // 9× más grande y recurrente; así la actividad queda dispersa.
  for (let k = 0; k < E; k++) {
    const e = order[k]
    const src = chem.s[e]
    const t = neurons[src].t
    const sign = t === 'GABA' || t === 'Glu' ? -1 : 1
    const pre = t === 'DA' ? 0.6 : 1 // monoaminas: modulación lenta
    const mod = chem.et[e] ? 0.5 : 1 // aa/da: modulación pre-sináptica
    dst[k] = chem.t[e]
    w[k] = sign * pre * mod * Math.min(1.05, 0.075 * Math.log2(1 + chem.w[e]))
    srcOff[src + 1]++
  }
  for (let i = 0; i < n; i++) srcOff[i + 1] += srcOff[i]

  // ——— Habituación: aristas salientes de MEC (tap) y PR (sombra) ————————
  const habMask = new Uint8Array(E)
  const habIdx = new Int32Array(E).fill(-1)
  const habSensors: number[] = []
  let nHabit = 0
  for (let i = 0; i < n; i++) {
    const a = neurons[i].a
    if (a !== 'mec' && a !== 'vis') continue
    habSensors.push(i)
    for (let e = srcOff[i]; e < srcOff[i + 1]; e++) {
      habMask[e] = 1
      habIdx[e] = nHabit++
    }
  }

  // ——— Inyección sensorial: canal → (grupo anotado, ganancia, signo) ——————
  // Los direccionales contrastan L/R (hemisphere real del dataset); los de
  // intensidad excitan todo el grupo (poblaciones coactivas, como el animal).
  const byModality: Record<string, number[]> = {}
  for (let i = 0; i < n; i++) {
    const a = neurons[i].a
    if (!a) continue
    ;(byModality[a] ??= []).push(i)
  }
  const smChArr: number[] = []
  const smIdxArr: number[] = []
  const smGainArr: number[] = []
  const smSignArr: number[] = []
  const injectGroup = (
    ch: number,
    group: number[],
    gain: number,
    sign?: (i: number, k: number) => number,
  ) => {
    for (let k = 0; k < group.length; k++) {
      smChArr.push(ch)
      smIdxArr.push(group[k])
      smGainArr.push(gain)
      smSignArr.push(sign ? sign(group[k], k) : 1)
    }
  }
  const byHem = (g: number[]) => {
    const L = g.filter((i) => neurons[i].h === 'L')
    const R = g.filter((i) => neurons[i].h === 'R')
    return { L, R, rest: g.filter((i) => neurons[i].h === 'M') }
  }

  const ORN = byModality['olf'] ?? []
  const GRN = byModality['gus'] ?? []
  const GNP = byModality['gnp'] ?? []
  const PR = byModality['vis'] ?? []
  const NOC = byModality['noc'] ?? []
  const THc = byModality['thc'] ?? []
  const THw = byModality['thw'] ?? []
  const MEC = byModality['mec'] ?? []
  const PRO = byModality['pro'] ?? []
  const RSP = byModality['rsp'] ?? []
  const GUT = byModality['gut'] ?? []
  const { L: ORNL, R: ORNR, rest: ORNM } = byHem(ORN)
  const { L: NOCL, R: NOCR, rest: NOCM } = byHem(NOC)

  // ——— Pools de salida (clases reales del dataset) — se construyen ANTES
  // de las inyecciones porque la modulación faríngea los necesita. ————————
  const pool = {
    forward: [] as number[],
    turnL: [] as number[],
    turnR: [] as number[],
    egg: [] as number[],
  }
  for (let i = 0; i < n; i++) {
    const neu = neurons[i]
    if (neu.c !== 2) continue
    if (neu.n.startsWith('DNV')) pool.forward.push(i)
    if (neu.h === 'L') pool.turnL.push(i)
    else if (neu.h === 'R') pool.turnR.push(i)
    if (neu.n.startsWith('DNS')) pool.egg.push(i)
  }

  // [1] Hambre → GUT (el adapter invierte: drive = 1 − saciedad).
  injectGroup(DCH.ENERGY, GUT, 0.5)
  // [2] Termo con signo: frío excita THc (signo −), calor THw (signo +).
  injectGroup(DCH.THERMO, THw, 1.15)
  injectGroup(DCH.THERMO, THc, 1.15, () => -1)
  // [3] Luz → fotorreceptores (fotofobia real de la larva).
  injectGroup(DCH.LIGHT, PR, 0.85)
  // [4] Aire/humedad → respiratorias.
  injectGroup(DCH.HUMIDITY, RSP, 0.7)
  // [5] Olfato X: contraste contralateral L/R de ORNs — ganancia alta:
  //     calibrado para que la asimetría L/R de los pools dirija el vuelo.
  injectGroup(DCH.FOOD_X, ORNL, 1.6, () => 1)
  injectGroup(DCH.FOOD_X, ORNR, 1.6, () => -1)
  injectGroup(DCH.FOOD_X, ORNM, 0.8, () => 1)
  // [6] Olfato Y: segundo eje repartido por ordinales (simplificación
  //     declarada: la larva resuelve Y con klinotaxis, canal [15]).
  injectGroup(DCH.FOOD_Y, ORN, 1.35, (_i, k) => (k % 2 ? 1 : -1))
  // [7] Gusto externo → GRNs (cercanía de comida).
  injectGroup(DCH.FOOD_NEAR, GRN, 0.34)
  // [8..10] Veneno/nocicepción → NOC (vía real de escape md-IV), con
  //     contraste L/R fuerte para el reflejo de giro de escape.
  injectGroup(DCH.POISON_X, NOCL, 1.3, () => 1)
  injectGroup(DCH.POISON_X, NOCR, 1.3, () => -1)
  injectGroup(DCH.POISON_X, NOCM, 0.6, () => 1)
  injectGroup(DCH.POISON_Y, NOC, 1.2, (_i, k) => (k % 2 ? 1 : -1))
  injectGroup(DCH.POISON_NEAR, NOC, 1.6)
  // [11] Multitud → MEC suave.
  injectGroup(DCH.CROWD, MEC, 0.45)
  // [12] Tacto frontal (choque/pared) → MEC fuerte.
  injectGroup(DCH.TOUCH_FRONT, MEC, 1.5)
  // [13] Tacto posterior → MEC medio (no separado en el dataset).
  injectGroup(DCH.TOUCH_BACK, MEC, 0.8)
  // [14] Propiocepción de vuelo → PRO con signo.
  injectGroup(DCH.PROPRIO, PRO, 1.1, (_i, k) => (k % 2 ? 1 : -1))
  // [15] Deriva del gradiente (klinotaxis) → ORNs (adaptación al cambio).
  injectGroup(DCH.FOOD_DELTA, ORN, 1.05)
  // [16] Feromona → SIN mapeo (el dataset no anota receptor feromonal).
  // [17] Gusto faríngeo → GNP (ráfaga al ingerir) Y — como la saciedad
  //     excita HSN en el gusano (análogo 5HT/NSM) — una modulación débil
  //     de los DN-SEZ: la oviposición real depende del estado nutricional
  //     (la mosca bien alimentada pone; la hambrienta cesa).
  injectGroup(DCH.FPHARYNX, GNP, 0.32)
  injectGroup(DCH.FPHARYNX, pool.egg, 0.42)

  return {
    n,
    srcOff,
    dst,
    w,
    txIdx,
    habMask,
    habIdx,
    nHabit,
    habSensors: new Int32Array(habSensors),
    smLen: smChArr.length,
    smCh: new Int16Array(smChArr),
    smIdx: new Int32Array(smIdxArr),
    smGain: new Float32Array(smGainArr),
    smSign: new Float32Array(smSignArr),
    tonicPool: new Int32Array(pool.forward),
    pool,
  }
}

function getGraph(): FlyGraph {
  if (!GRAPH) GRAPH = buildGraph()
  return GRAPH
}

// ——— Genoma ———————————————————————————————————————————————————————————————————

export const DROSOPHILA_GENES = 27

const N_GAINS = 18 // [0..17] ganancias por canal
const G_ACH = 18
const G_GLU = 19
const G_GABA = 20
const G_MONO = 21
const G_TAU = 22
const G_VTH = 23
const G_REFR = 24
const G_TONIC = 25
const G_BIAS = 26 // sesgo lateral de giro (klinotaxis)

const GENE_BOUNDS: [number, number][] = [
  ...Array.from({ length: N_GAINS }, () => [0.15, 2.4] as [number, number]),
  [0.45, 1.9], [0.45, 1.9], [0.45, 1.9], [0.45, 1.9], // escalas tx
  [3.5, 14], // τ
  [1.0, 1.8], // umbral
  [1, 5], // refractario
  [0.05, 0.9], // tónico
  [-0.85, 0.85], // sesgo lateral
]

/** Genomas de otra longitud → neutro (los registros ANN nunca llegan aquí). */
function migrateGenome(old: Float32Array): Float32Array {
  if (old.length === DROSOPHILA_GENES) return old
  const g = new Float32Array(DROSOPHILA_GENES).fill(1)
  const m = Math.min(old.length, N_GAINS)
  for (let i = 0; i < m; i++) g[i] = old[i] || 1
  g[G_TAU] = 7.5
  g[G_VTH] = 1.35
  g[G_REFR] = 3
  g[G_TONIC] = 0.55
  g[G_BIAS] = 0
  return g
}

function randomGenome(rng: Rng): Float32Array {
  const g = new Float32Array(DROSOPHILA_GENES)
  for (let i = 0; i < N_GAINS; i++) g[i] = clamp(1 + rng.gauss(0.12), 0.4, 1.6)
  g[0] = clamp(1.25 + rng.gauss(0.1), 0.85, 1.6) // tónico alto: sin él no vuela
  g[G_ACH] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_GLU] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_GABA] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_MONO] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_TAU] = clamp(7.5 + rng.gauss(1.2), 4.5, 11)
  g[G_VTH] = clamp(1.35 + rng.gauss(0.07), 1.15, 1.55)
  g[G_REFR] = 3
  g[G_TONIC] = clamp(0.6 + rng.gauss(0.08), 0.4, 0.8)
  // Sesgo lateral innato (asimetría individual, como la de AWC en el gusano).
  g[G_BIAS] = clamp(0.3 + rng.gauss(0.18), -0.7, 0.7)
  return g
}

// ——— Cerebro LIF ———————————————————————————————————————————————————————————————

const V_RESET = 0.12
const SMOOTH = 0.28 // suavizado exponencial de los pools
// Habituación: depresión por uso de las aristas mecano/visuales.
const HAB_RATE = 0.0015 // depresión sináptica leve: la habituación la lleva la fatiga
const HAB_TAU_TICKS = 60 * 15 // τ = 60 s (el disparo va cada 2 ticks)

export class DrosophilaBrain implements IBrainAdapter {
  readonly kind: BrainKind = 'drosophila'
  readonly w: Float32Array
  readonly inA = new Float32Array(N_GAINS)
  readonly hA = new Float32Array(8)
  readonly oA = new Float32Array(3)

  private readonly V: Float32Array
  private readonly spike: Uint8Array
  private readonly refr: Int8Array
  /** Escalas de habituación por arista deprimible (por individuo). */
  private readonly habScale: Float32Array
  /** true solo si hay depresión activa (evita el bucle de recuperación). */
  private habDirty = false
  /** Neuronas silenciadas (knockout experimental): V≡0. */
  private silenced: Set<number> | null = null
  /** Amplitud del último tren del electrodo (para la depresión por uso). */
  private stimDrive = 0
  /** Fase del tick-stepping 1:2 (0 = integración, 1 = disparo). */
  private phase = 0
  private fwdRate = 0
  private turnLRate = 0
  private turnRRate = 0
  private eggRate = 0

  constructor(genome?: Float32Array, rng?: Rng) {
    this.w =
      genome == null ? randomGenome(rng ?? new Rng()) : migrateGenome(genome)
    const g = getGraph()
    this.V = new Float32Array(g.n)
    this.spike = new Uint8Array(g.n)
    this.refr = new Int8Array(g.n)
    this.habScale = new Float32Array(g.nHabit).fill(1)
  }

  /** Knockout experimental: silencia neuronas por índice global. */
  setSilenced(ids: Set<number> | null): void {
    this.silenced = ids
  }

  /** Electrodo virtual: corriente inyectada en el próximo tick. */
  stimulate(ids: number[], amp: number): void {
    const V = this.V
    for (const i of ids) {
      if (this.silenced !== null && this.silenced.has(i)) continue
      if (i >= 0 && i < V.length) V[i] += amp
    }
    this.stimDrive = Math.max(this.stimDrive, amp)
  }

  forward(
    inputs: readonly number[] | Float32Array,
    voltage = 1,
  ): void {
    const g = getGraph()
    const { w } = this
    const V = this.V

    this.phase ^= 1
    const gainMul = voltage

    // ——— Inyección sensorial (ambas fases: acumula en V) ——————————————
    // El entorno carga los grupos sensoriales anotados con la modalidad
    // real (GUT ← hambre, PR ← luz, ORN ← olfato, ...). Typed arrays planos.
    const { smCh, smIdx, smGain, smSign, smLen } = g
    const sil = this.silenced
    for (let k = 0; k < smLen; k++) {
      const idx = smIdx[k]
      if (sil !== null && sil.has(idx)) continue // sensor ablacionado
      let drive = inputs[smCh[k]] ?? 0
      if (smCh[k] === 0) drive = w[G_TONIC] // sesgo → impulso del CPG
      else if (smCh[k] === 1) drive = 1 - drive // hambre, no saciedad
      V[idx] += drive * smGain[k] * smSign[k] * w[smCh[k]] * gainMul
    }
    // El tónico alimenta directamente el pool de locomoción (DN-VNC): el
    // latido basal del "vuelo" de la mosca.
    {
      const t = w[G_TONIC] * 0.5 * w[0] * gainMul
      const tp = g.tonicPool
      for (let k = 0; k < tp.length; k++) {
        if (sil === null || !sil.has(tp[k])) V[tp[k]] += t
      }
    }

    // ——— Fase de INTEGRACIÓN (barata): fin del tick ————————————————————
    if (this.phase === 0) {
      for (let i = 0; i < N_GAINS; i++) this.inA[i] = inputs[i] ?? 0
      return
    }

    // ——— Fase de DISPARO (completa, cada 2 ticks) ——————————————————————
    const spike = this.spike
    const refr = this.refr

    // 1) Fuga con leak² (τ equivalente de dos ticks) y refractario.
    const leak2 = Math.exp(-2 / w[G_TAU])
    if (sil === null) {
      for (let i = 0; i < g.n; i++) {
        V[i] *= leak2
        if (refr[i] > 0) refr[i] -= 2
        spike[i] = 0
      }
    } else {
      for (let i = 0; i < g.n; i++) {
        V[i] = sil.has(i) ? 0 : V[i] * leak2 // knockout: ablación virtual
        if (refr[i] > 0) refr[i] -= 2
        spike[i] = 0
      }
    }

    // 1b) Recuperación espontánea de la habituación (τ = 60 s), solo si
    //     hay depresión activa.
    if (this.habDirty) {
      const rec = 1 / HAB_TAU_TICKS
      const hs = this.habScale
      let allAlive = true
      for (let k = 0; k < hs.length; k++) {
        hs[k] += (1 - hs[k]) * rec
        if (hs[k] < 0.999) allAlive = false
      }
      if (allAlive) this.habDirty = false
    }

    // 1c) Depresión por uso (habituación): SOLO estímulos del Laboratorio
    //     (electrodo mecano o transitorios luminosos).
    const tapAmp = this.stimDrive
    const shadowAmp = inputs[DCH.LIGHT] ?? 0
    this.stimDrive *= 0.5
    if (tapAmp > 0.55 || shadowAmp > 0.55) {
      const dTap = HAB_RATE * Math.max(0, (tapAmp - 0.55) / 0.45)
      const dVis = HAB_RATE * Math.max(0, (shadowAmp - 0.55) / 0.45)
      const sensors = g.habSensors
      for (let s = 0; s < sensors.length; s++) {
        const i = sensors[s]
        const isVis = DATA.neurons[i].a === 'vis'
        const d = isVis ? dVis : dTap
        if (d <= 0) continue
        for (let e = g.srcOff[i]; e < g.srcOff[i + 1]; e++) {
          const h = g.habIdx[e]
          if (h >= 0) {
            this.habScale[h] = Math.max(0.06, this.habScale[h] - d)
            this.habDirty = true
          }
        }
      }
    }

    // 2) Escalas de transmisión (neuromodulación evolucionable).
    const txScale0 = w[G_ACH]
    const txScale1 = w[G_GLU]
    const txScale2 = w[G_GABA]
    const txScale3 = w[G_MONO]

    // 3) Umbral, disparo y entrega sináptica (con escala de habituación
    //    en las aristas mecano/visuales deprimidas).
    const vth = w[G_VTH]
    const refractory = Math.round(w[G_REFR])
    const { srcOff, dst, w: gw, txIdx, habMask, habIdx } = g
    const habScale = this.habScale
    let spiked = 0
    for (let i = 0; i < g.n; i++) {
      if (refr[i] > 0 || V[i] < vth) continue
      spike[i] = 1
      spiked++
      V[i] = V_RESET
      refr[i] = refractory
      const scale =
        txIdx[i] === 0 ? txScale0 : txIdx[i] === 1 ? txScale1
          : txIdx[i] === 2 ? txScale2 : txScale3
      for (let e = srcOff[i]; e < srcOff[i + 1]; e++) {
        const j = dst[e]
        const hs = habMask[e] === 1 ? habScale[habIdx[e]] : 1
        V[j] += gw[e] * hs * scale * voltage
      }
    }

    // 4) Pools de salida → 3 motores del Canvas.
    const rate = (pool: number[]): number => {
      let hits = 0
      for (const i of pool) hits += spike[i]
      return pool.length ? hits / pool.length : 0
    }
    this.fwdRate += (rate(g.pool.forward) - this.fwdRate) * SMOOTH
    this.turnLRate += (rate(g.pool.turnL) - this.turnLRate) * SMOOTH
    this.turnRRate += (rate(g.pool.turnR) - this.turnRRate) * SMOOTH
    this.eggRate += (rate(g.pool.egg) - this.eggRate) * SMOOTH

    // Giro: asimetría L/R de las DNs (la larva contrae un lado para girar;
    // dominio derecho → heading positivo = giro horario) MÁS la klinotaxis
    // innata (Luo 2010): cuando el gradiente olfativo CAE, la mosca
    // re-orienta con su sesgo lateral genético; cuando sube, persiste recta.
    const asym = this.turnRRate - this.turnLRate
    const delta = inputs[DCH.FOOD_DELTA] ?? 0
    const reorient = Math.max(0, -delta) * w[G_BIAS] * 1.6
    this.oA[0] = clamp(asym * 6.0 + reorient, -1, 1)
    this.oA[1] = clamp(this.fwdRate * 1.9 + 0.08, 0, 1)
    // Puesta: el pool DN-SEZ (visceral/oviposición) calla en reposo y se
    // excita tras comer (modulación faríngea, ver arriba).
    this.oA[2] = 1 / (1 + Math.exp(-(this.eggRate - 0.05) * 16))

    // 5) Espejos para el inspector (18 canales + resumen de 8).
    for (let i = 0; i < N_GAINS; i++) this.inA[i] = inputs[i] ?? 0
    this.hA[0] = meanClass(g, V, 0)
    this.hA[1] = meanClass(g, V, 1)
    this.hA[2] = meanClass(g, V, 2)
    this.hA[3] = this.fwdRate
    this.hA[4] = asym
    this.hA[5] = this.eggRate
    this.hA[6] = spiked / g.n
    this.hA[7] = spiked
  }

  connectomeView(): ConnectomeActivity {
    return {
      v: Array.from(this.V, (x) => Math.round(Math.min(x, 2) * 100) / 100),
      s: Array.from(this.spike),
    }
  }

  clone(): DrosophilaBrain {
    return new DrosophilaBrain(new Float32Array(this.w))
  }

  /** El GA evoluciona la neuromodulación, no la estructura del conectoma. */
  mutate(rng: Rng, rate = 0.22, sigma = 0.16): void {
    const w = this.w
    for (let i = 0; i < w.length; i++) {
      if (rng.next() < rate) {
        const [lo, hi] = GENE_BOUNDS[i]
        w[i] = clamp(w[i] + rng.gauss(sigma), lo, hi)
      }
    }
  }
}

function meanClass(g: FlyGraph, V: Float32Array, cls: 0 | 1 | 2): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < g.n; i++) {
    if (DROSOPHILA_CLASSES[i] === cls) {
      sum += V[i]
      n++
    }
  }
  return n ? Math.round((sum / n) * 100) / 100 : 0
}

// ——— Subgrafo del circuito sensoriomotor (vista "Circuito vivo") ——————————
// Selección representativa de nodos por modalidad/capa con las aristas
// REALES que los conectan (para no dibujar 2.956 nodos).

export interface FlyCircuitNodeDef {
  i: number
  n: string
  c: 0 | 1 | 2
  lane: 0 | 1 | 2
  role: string
}

export interface FlyCircuitEdgeDef {
  a: number
  b: number
  w: number
}

export interface FlyCircuitBundleDef {
  from: number
  pool: 'forward' | 'turnL' | 'turnR' | 'egg'
  w: number
}

export interface FlyCircuitViewDef {
  nodes: FlyCircuitNodeDef[]
  edges: FlyCircuitEdgeDef[]
  bundles: FlyCircuitBundleDef[]
  pools: Record<'forward' | 'turnL' | 'turnR' | 'egg', number[]>
}

const ROLES: Record<string, string> = {
  olf: 'Olfato (ORN)',
  gus: 'Gusto externo (GRN)',
  gnp: 'Gusto faríngeo (GNP)',
  vis: 'Visión (PR)',
  noc: 'Nocicepción → escape (NOC)',
  thc: 'Termo frío (THc)',
  thw: 'Termo calor (THw)',
  mec: 'Mecanosenso (MEC)',
  pro: 'Propiocepción (PRO)',
  rsp: 'Respiración (RSP)',
  gut: 'Víscera / hambre (GUT)',
}

let CIRCUIT: FlyCircuitViewDef | null = null

export function getDrosophilaCircuit(): FlyCircuitViewDef {
  if (CIRCUIT) return CIRCUIT
  const g = getGraph()
  const neurons = DATA.neurons

  // Top-K por out-degree dentro de cada grupo.
  const byModality: Record<string, number[]> = {}
  for (let i = 0; i < g.n; i++) {
    const a = neurons[i].a
    if (!a) continue
    ;(byModality[a] ??= []).push(i)
  }
  const outDeg = (i: number) => g.srcOff[i + 1] - g.srcOff[i]
  const topK = (arr: number[], k: number) =>
    arr
      .slice()
      .sort((a, b) => outDeg(b) - outDeg(a))
      .slice(0, k)

  const nodes: FlyCircuitNodeDef[] = []
  const idx2node = new Map<number, number>()
  const push = (i: number, lane: 0 | 1 | 2, role: string) => {
    if (idx2node.has(i)) return
    idx2node.set(i, nodes.length)
    nodes.push({ i, n: neurons[i].n, c: neurons[i].c, lane, role })
  }

  // Carril 0: hasta 3 sensores por modalidad.
  for (const [a, list] of Object.entries(byModality)) {
    for (const i of topK(list, 3)) push(i, 0, ROLES[a] ?? 'Sensor')
  }
  // Carril 1: integración — top PNs/LHNs/CNs/pDNs por out-degree.
  const interIdx: number[] = []
  for (let i = 0; i < g.n; i++) {
    const nm = neurons[i].n
    if (
      neurons[i].c === 1 &&
      (nm.startsWith('PN') || nm.startsWith('mPN') ||
        nm.startsWith('LHN') || nm.startsWith('pDNV') || nm.startsWith('pDNS') ||
        nm.startsWith('CN') || nm.startsWith('MBON'))
    ) {
      interIdx.push(i)
    }
  }
  for (const i of topK(interIdx, 18)) {
    const nm = neurons[i].n
    push(
      i, 1,
      nm.startsWith('pDNV') ? 'Premotora → DN-VNC'
        : nm.startsWith('pDNS') ? 'Premotora → DN-SEZ'
          : nm.startsWith('MBON') ? 'Salida del cuerpo fungiforme (MBON)'
            : 'Integración / proyección',
    )
  }
  // Carril 2: eferentes — DNs top por out-degree (los que más inervan).
  const efferents: number[] = []
  for (let i = 0; i < g.n; i++) if (neurons[i].c === 2) efferents.push(i)
  for (const i of topK(efferents, 14)) {
    const nm = neurons[i].n
    push(
      i, 2,
      nm.startsWith('DNV') ? 'Descendente de locomoción (DN-VNC)'
        : 'Descendente visceral / puesta (DN-SEZ)',
    )
  }

  // Aristas reales entre los nodos elegidos.
  const edges: FlyCircuitEdgeDef[] = []
  const seen = new Set<string>()
  for (let src = 0; src < g.n; src++) {
    const na = idx2node.get(src)
    if (na === undefined) continue
    for (let e = g.srcOff[src]; e < g.srcOff[src + 1]; e++) {
      const nb = idx2node.get(g.dst[e])
      if (nb === undefined) continue
      const key = `${src}>${g.dst[e]}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ a: na, b: nb, w: g.w[e] })
    }
  }

  // Haces desde integradores (lane 1) hacia los pools de salida.
  const poolMembers: Record<string, Set<number>> = {
    forward: new Set(g.pool.forward),
    turnL: new Set(g.pool.turnL),
    turnR: new Set(g.pool.turnR),
    egg: new Set(g.pool.egg),
  }
  const bundles: FlyCircuitBundleDef[] = []
  for (const node of nodes) {
    if (node.lane !== 1) continue
    for (const pkey of ['forward', 'turnL', 'turnR', 'egg'] as const) {
      let wsum = 0
      for (let e = g.srcOff[node.i]; e < g.srcOff[node.i + 1]; e++) {
        if (poolMembers[pkey].has(g.dst[e])) wsum += Math.abs(g.w[e])
      }
      if (wsum > 0.15) {
        bundles.push({ from: idx2node.get(node.i)!, pool: pkey, w: Math.min(2.4, wsum) })
      }
    }
  }

  CIRCUIT = { nodes, edges, bundles, pools: g.pool }
  return CIRCUIT
}

/** Índices de neuronas de Drosophila por grupo (knockouts del Laboratorio). */
export function getDrosophilaIndicesByGroup(
  group:
    | 'olf' | 'gus' | 'gnp' | 'vis' | 'noc' | 'thc' | 'thw'
    | 'mec' | 'pro' | 'rsp' | 'gut' | 'dnv' | 'dns',
): number[] {
  const g = getGraph()
  const neurons = DATA.neurons
  const out: number[] = []
  if (group === 'dnv' || group === 'dns') {
    for (let i = 0; i < g.n; i++) {
      if (neurons[i].c === 2 && neurons[i].n.startsWith(group === 'dnv' ? 'DNV' : 'DNS')) {
        out.push(i)
      }
    }
    return out
  }
  for (let i = 0; i < g.n; i++) {
    if (neurons[i].a === group) out.push(i)
  }
  return out
}

/**
 * Genoma estándar del Laboratorio: la mosca real del experimento está
 * posada (tónico de vuelo bajo) y sensible (ACh alta, umbral bajo): el
 * fondo neural calla y el escape visual (looming) produce la respuesta
 * nítida del circuito PR→DNs.
 */
export function drosophilaLabGenome(rng?: Rng): Float32Array {
  const g = randomGenome(rng ?? new Rng())
  g[G_TONIC] = 0.3
  g[0] = 0.8
  g[G_ACH] = 1.6
  g[G_VTH] = 1.18
  return g
}
