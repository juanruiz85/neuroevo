// ─────────────────────────────────────────────────────────────────────────────
// Cerebro biológico de C. elegans — modelo Integración y Disparo con Fugas
// (Leaky Integrate-and-Fire, LIF) sobre el conectoma real del nemátodo.
//
// DATOS (src/lib/sim/data/c_elegans_connectome.json, 55 KB):
//   · 300 de las 302 neuronas del hermafrodita (CANL/R no tienen sinapsis
//     y no figuran en el dataset). Incluye las 20 faríngeas.
//   · 3.638 sinapsis químicas + 1.093 uniones en gap (≈25.000 contactos).
//   · Clasificación: 86 sensoriales / 50 motoras / 164 interneuronas.
//   · Procedencia: OpenWorm (herm_full_edgelist.csv + CElegansNeuronTables.xls).
//
// MAPEO SENSORIAL (17 canales del mundo → neuronas reales; ver sensors.ts):
//   Sesgo/tonico  → AVB (comando de avance) + RMDD (oscilador cefálico)
//   Energía       → ADF (hambre = 1−energía) + HSN (tono reproductivo 5HT-like)
//   Térmico       → AFD (termosensor primario) + AWC (secundario) — con signo
//   Luz           → ASH (LITE-1: fotofobia; C. elegans no tiene ojos)
//   Humedad       → BAG (sensor ambiental)
//   Comida X/Y/c. → AWC/AWA (olfato, asimetría L/R) + ASE (gusto)
//   Veneno X/Y/c. → PHA/PHB (fásmidos aversivos) + ASH (nocicepción)
//   Multitud      → PVD (tacto brusco) + ALM (tacto suave)
//   Tacto nariz   → ASH+FLP+OLQ (circuito real de choque frontal → reversa)
//   Tacto cola    → PLM (circuito real PLM→PVC→VB/DB → acelerón de avance)
//   Propiocepción → DVA (TRP-4, estiramiento corporal) + SMDD — con signo
//   Δ Gradiente   → ASE L/R (klinotaxis: responde al cambio, no al nivel)
//   Feromona      → ADL (ascarósidos de conglomerado)
//
// MAPEO MOTOR (pools reales → 3 salidas del Canvas):
//   Avanzar  ← VB01-11, DB01-07, AVB, PVC  (comando B de avance)
//   Girar    ← asimetría dorso-ventral de los pools cefálicos (RMD/SM/SMB;
//   el vaivén real del nemátodo) AMPLIFICADA durante las reversas
//   (VA/DA + AVA/AVD/AVE, comando A: al retroceder re-orienta, como el animal)
//   Poner    ← VC01-06 + HSN (circuito real de puesta de huevos)
//
// GENOMA EVOLUTIVO (25 genes — el GA no toca la estructura del conectoma,
// evoluciona la neuromodulación y la excitabilidad, como en el animal):
//   [0..16] ganancia sensorial por canal (17 sentidos)
//   [17..20] escalas de transmisión: ACh / GABA (inhibitoria) / Glu /
//            monoaminas+neuropéptidos (5HT, DA, OCT, TA, FMRF)
//   [21] constante de fuga τ   [22] umbral de disparo
//   [23] periodo refractario    [24] impulso tónico
// —───────────────────────────────────────────────────────────────────────────

import rawConnectome from '../data/c_elegans_connectome.json'
import { Rng } from '../rng'
import { clamp } from '../types'
import { CH } from './sensors'
import type {
  BrainKind,
  ConnectomeActivity,
  IBrainAdapter,
} from './adapter'

// ——— Tipos del dataset ———————————————————————————————————————————————————————

type Tx = 'ACh' | 'GABA' | 'Glu' | '5HT' | 'DA' | 'OCT' | 'TA' | 'FMRF'

interface ConnectomeJson {
  meta: {
    species: string
    neurons: number
    note: string
    provenance: string[]
    counts: {
      chemical: number
      gapJunctions: number
      synapseContacts: number
      sensory: number
      motor: number
      inter: number
    }
    txFilled: number
  }
  neurons: { n: string; c: 0 | 1 | 2; t: Tx }[]
  sensoryFunctions: Record<string, string>
  chem: { s: number[]; t: number[]; w: number[] }
  gap: { p: number[]; w: number[] }
}

const DATA = rawConnectome as unknown as ConnectomeJson

export const ELEGANS_INFO = {
  species: 'Caenorhabditis elegans',
  neurons: DATA.meta.counts.sensory + DATA.meta.counts.motor + DATA.meta.counts.inter,
  synapses: DATA.meta.counts.chemical + DATA.meta.counts.gapJunctions,
  chemical: DATA.meta.counts.chemical,
  gapJunctions: DATA.meta.counts.gapJunctions,
  sensory: DATA.meta.counts.sensory,
  motor: DATA.meta.counts.motor,
  inter: DATA.meta.counts.inter,
  provenance: DATA.meta.provenance,
} as const

export const ELEGANS_NAMES: string[] = DATA.neurons.map((x) => x.n)
export const ELEGANS_CLASSES: (0 | 1 | 2)[] = DATA.neurons.map((x) => x.c)
export const ELEGANS_SENSORY_FUNCTIONS = DATA.sensoryFunctions

// ——— Grafo compartido (CSR) ———————————————————————————————————————————————————
// La estructura sináptica es idéntica para todos los gusanos (es biología);
// cada individuo solo posee su estado de membrana y su genoma de
// neuromodulación. Se construye una única vez (perezosamente) al primer uso.

const TX_GROUP: Record<Tx, 0 | 1 | 2 | 3> = {
  ACh: 0,
  Glu: 1,
  GABA: 2,
  '5HT': 3,
  DA: 3,
  OCT: 3,
  TA: 3,
  FMRF: 3,
}

interface ElegansGraph {
  n: number
  srcOff: Uint32Array // CSR: offsets por neurona presináptica
  dst: Uint32Array // índice postsináptico
  w: Float32Array // peso con signo (GABA < 0)
  txIdx: Uint8Array // grupo de transmisor de la neurona PRESINÁPTICA
  gapA: Uint32Array
  gapB: Uint32Array
  gapW: Float32Array
  sensoryMap: { ch: number; idx: number; gain: number; sign: number }[]
  // Habituación (Rankin 1990): aristas que salen del circuito del tap
  // (ALM/AVM/PLM, mecano) y de ASH (fotofobia) — deprimibles por uso.
  habMask: Uint8Array
  habIdx: Int32Array
  nHabit: number
  pool: {
    forward: number[]
    backward: number[]
    headDorsal: number[]
    headVentral: number[]
    egg: number[]
  }
}

let GRAPH: ElegansGraph | null = null

function idxOf(name: string): number {
  return ELEGANS_NAMES.indexOf(name)
}

function buildGraph(): ElegansGraph {
  const n = ELEGANS_NAMES.length
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
  DATA.neurons.forEach((neu, i) => {
    txIdx[i] = TX_GROUP[neu.t] ?? 0
  })
  // Peso sináptico: log2 de los contactos, con signo según transmisor
  // presináptico (GABA inhibitorio; Glu modelado como excitador, ver docs).
  // Escala débil: el conectoma real es recurrente y con pesos fuertes entra
  // en epilepsia; así la actividad queda dispersa y modulable por los
  // sentidos (como en el animal: silencio con ráfagas puntuales).
  for (let k = 0; k < E; k++) {
    const e = order[k]
    const src = chem.s[e]
    const sign = DATA.neurons[src].t === 'GABA' ? -1 : 1
    dst[k] = chem.t[e]
    w[k] = sign * Math.min(1.1, 0.085 * Math.log2(1 + chem.w[e]))
    srcOff[src + 1]++
  }
  for (let i = 0; i < n; i++) srcOff[i + 1] += srcOff[i]

  // Uniones en gap: acoplamiento difusivo bidireccional.
  const G = DATA.gap.w.length
  const gapA = new Uint32Array(G)
  const gapB = new Uint32Array(G)
  const gapW = new Float32Array(G)
  for (let k = 0; k < G; k++) {
    gapA[k] = DATA.gap.p[k * 2]
    gapB[k] = DATA.gap.p[k * 2 + 1]
    gapW[k] = Math.min(0.18, 0.04 * Math.log2(1 + DATA.gap.w[k]))
  }

  // Habituación: marcas sobre las aristas del circuito del tap
  // (ALM/AVM/PLM → AVA/PVC, Wicks & Rankin 1997) y de ASH (luz/noci).
  const HAB_SOURCES = new Set(['ALML', 'ALMR', 'AVM', 'PLML', 'PLMR', 'ASHL', 'ASHR'])
  const habMask = new Uint8Array(E)
  const habIdx = new Int32Array(E).fill(-1)
  let nHabit = 0
  for (let i = 0; i < n; i++) {
    if (!HAB_SOURCES.has(ELEGANS_NAMES[i])) continue
    for (let e = srcOff[i]; e < srcOff[i + 1]; e++) {
      habMask[e] = 1
      habIdx[e] = nHabit++
    }
  }

  // Inyección sensorial: canal del mundo → (neurona, ganancia, signo).
  // En los canales direccionales el signo contrasta las parejas L/R
  // (AWCL/−AWCR, PHAL/−PHAR...): el gusano real compara señales
  // contralaterales para orientarse (asimetría quimiosensorial).
  const S = (ch: number, name: string, gain: number, sign = 1) => {
    const i = idxOf(name)
    return i >= 0 ? { ch, idx: i, gain, sign } : null
  }
  const sensoryMap: { ch: number; idx: number; gain: number; sign: number }[] = []
  const add = (entries: ({ ch: number; idx: number; gain: number; sign: number } | null)[]) => {
    for (const e of entries) if (e) sensoryMap.push(e)
  }
  // [0] Sesgo/tonico — impulso endógeno (osciladores/CPG del animal).
  //   Conducción motora equilibrada dorso-ventral (RMDD+RMDV) para que
  //   la asimetría la decida la propia red del conectoma.
  add([
    S(0, 'AVBL', 0.55), S(0, 'AVBR', 0.55),
    S(0, 'RMDDL', 0.3), S(0, 'RMDDR', 0.3),
    S(0, 'RMDVL', 0.3), S(0, 'RMDVR', 0.3),
  ])
  // [1] Energía → ADF (hambre = 1 − energía) + HSN (tono reproductivo:
  //   con comida el circuito de puesta se excita, como la serotonina de NSM).
  add([
    S(1, 'ADFL', 0.9), S(1, 'ADFR', 0.9),
    S(1, 'ASEL', 0.25), S(1, 'ASER', 0.25),
    S(1, 'HSNL', 0.5), S(1, 'HSNR', 0.5),
  ])
  // [2] Térmico → AFD (primario, con signo) + AWC (secundario).
  add([
    S(2, 'AFDL', 1.15), S(2, 'AFDR', 1.15),
    S(2, 'AWCL', 0.45), S(2, 'AWCR', 0.45),
  ])
  // [3] Luz → ASH (fotofobia/nocicepción).
  add([S(3, 'ASHL', 0.8), S(3, 'ASHR', 0.8)])
  // [4] Humedad → BAG.
  add([S(4, 'BAGL', 0.9), S(4, 'BAGR', 0.9)])
  // [5..7] Comida: asimetría L/R (AWC/AWA, olfato) + cercanía (ASE, gusto).
  add([S(5, 'AWCL', 0.9, 1), S(5, 'AWCR', 0.9, -1)])
  add([S(6, 'AWAL', 0.9, 1), S(6, 'AWAR', 0.9, -1)])
  add([
    S(7, 'ASEL', 1.2), S(7, 'ASER', 1.2),
    S(7, 'AWCL', 0.5), S(7, 'AWCR', 0.5),
  ])
  // [8..10] Veneno: fásmidos PHA/PHB (aversivos) + ASH (nocicepción).
  add([S(8, 'PHAL', 0.9, 1), S(8, 'PHAR', 0.9, -1)])
  add([S(9, 'PHBL', 0.9, 1), S(9, 'PHBR', 0.9, -1)])
  add([S(10, 'ASHL', 1.3), S(10, 'ASHR', 1.3)])
  // [11] Multitud → PVD (tacto brusco) + ALM (tacto suave).
  add([S(11, 'PVDL', 1.0), S(11, 'PVDR', 1.0), S(11, 'ALML', 0.5), S(11, 'ALMR', 0.5)])
  // [12] Tacto cefálico (nariz) → circuito REAL de choque frontal:
  //   ASH (mecanonocicepción) + FLP/OLQ (mecanorreceptores de la nariz);
  //   ASH→AVA→VA/DA desencadena la reversa en el animal.
  add([
    S(CH.TOUCH_FRONT, 'ASHL', 1.5), S(CH.TOUCH_FRONT, 'ASHR', 1.5),
    S(CH.TOUCH_FRONT, 'FLPL', 0.6), S(CH.TOUCH_FRONT, 'FLPR', 0.6),
    S(CH.TOUCH_FRONT, 'OLQDL', 0.5), S(CH.TOUCH_FRONT, 'OLQDR', 0.5),
  ])
  // [13] Tacto caudal → PLM (tacto suave posterior): PLM→PVC→VB/DB
  //   acelera el avance — el reflejo real de "tocar la cola".
  add([S(CH.TOUCH_BACK, 'PLML', 1.4), S(CH.TOUCH_BACK, 'PLMR', 1.4)])
  // [14] Propiocepción → DVA (TRP-4, estiramiento de todo el cuerpo) +
  //   SMDD (curvatura cefálica). Señal con signo (ondulación izq/der).
  add([
    S(CH.PROPRIO, 'DVA', 1.1),
    S(CH.PROPRIO, 'SMDDL', 0.35), S(CH.PROPRIO, 'SMDVL', 0.35),
  ])
  // [15] Deriva del gradiente (klinotaxis) → ASE se adapta y dispara
  //   al CAMBIO de concentración (borde de subida/bajada del gradiente).
  add([S(CH.FOOD_DELTA, 'ASEL', 1.1), S(CH.FOOD_DELTA, 'ASER', 1.1)])
  // [16] Feromona de conglomerado → ADL (los ascarósidos reales frenan
  //   la puesta y provocan dauer combinados con hambre).
  add([S(CH.PHEROMONE, 'ADLL', 1.0), S(CH.PHEROMONE, 'ADLR', 1.0)])

  const pool = (names: string[]): number[] => {
    const out: number[] = []
    for (const nm of names) {
      const i = idxOf(nm)
      if (i >= 0) out.push(i)
    }
    return out
  }

  return {
    n,
    srcOff,
    dst,
    w,
    txIdx,
    gapA,
    gapB,
    gapW,
    habMask,
    habIdx,
    nHabit,
    sensoryMap,
    pool: {
      forward: pool([
        'AVBL', 'AVBR', 'PVCL', 'PVCR',
        ...rangeNames('VB', 1, 11), ...rangeNames('DB', 1, 7),
      ]),
      backward: pool([
        'AVAL', 'AVAR', 'AVDL', 'AVDR', 'AVEL', 'AVER',
        ...rangeNames('VA', 1, 12), ...rangeNames('DA', 1, 9),
      ]),
      // Antagonismo dorso-ventral de la cabeza: motoneuronas dorsales (RMD*D,
      // SM*D, SMB*D) frente a ventrales (RMD*V, SM*V, SMB*V, RME*).
      headDorsal: pool([
        'RMDDL', 'RMDDR', 'SMDDL', 'SMDDR', 'SMBDL', 'SMBDR',
      ]),
      headVentral: pool([
        'RMDVL', 'RMDVR', 'RMEL', 'RMER', 'SMDVL', 'SMDVR',
        'SMBVL', 'SMBVR',
      ]),
      egg: pool([...rangeNames('VC', 1, 6), 'HSNL', 'HSNR']),
    },
  }
}

function rangeNames(pre: string, from: number, to: number): string[] {
  const out: string[] = []
  for (let i = from; i <= to; i++) out.push(pre + String(i).padStart(2, '0'))
  return out
}

function getGraph(): ElegansGraph {
  if (!GRAPH) GRAPH = buildGraph()
  return GRAPH
}

// ——— Genoma ———————————————————————————————————————————————————————————————————

export const ELEGANS_GENES = 26

const G_GAINS = 17 // [0..16] ganancias sensoriales
const G_ACH = 17
const G_GABA = 18
const G_GLU = 19
const G_MONO = 20
const G_TAU = 21
const G_VTH = 22
const G_REFR = 23
const G_TONIC = 24
/** [25] Adaptación de tasa (fatiga K⁺ dependiente de actividad): sube el
 * umbral de cada neurona con cada pico y decae (τ≈2.7 s). 0 en el
 * ecosistema (vaivén CPG intacto); la línea de laboratorio la activa para
 * que el comando responda en ráfagas y NUNCA en oscilación perpetua. */
const G_ADAPT = 25

/** Rangos de cada gen (la mutación respeta límites fisiológicos). */
const GENE_BOUNDS: [number, number][] = [
  ...Array.from({ length: G_GAINS }, () => [0.15, 2.4] as [number, number]),
  [0.45, 1.9], [0.45, 1.9], [0.45, 1.9], [0.45, 1.9], // escalas tx
  [3.5, 14], // τ
  [1.0, 1.8], // umbral
  [1, 5], // refractario
  [0.05, 0.9], // tónico
  [0, 0.9], // adaptación de tasa
]

/**
 * Migra genomas v1.1 (20 genes) al formato v1.2 (25): inserta las ganancias
 * de los 5 sentidos nuevos con valor neutro y desplaza los genes de
 * dinámica LIF. Los registros antiguos del Museo siguen siendo sembrables.
 */
function migrateGenome(old: Float32Array): Float32Array {
  if (old.length >= ELEGANS_GENES) return old
  const g = new Float32Array(ELEGANS_GENES)
  for (let i = 0; i < 12; i++) g[i] = old[i] ?? 1
  for (let i = 12; i < G_GAINS; i++) g[i] = 1
  for (let i = 0; i < 4; i++) g[G_ACH + i] = old[12 + i] ?? 1
  g[G_TAU] = old[16] ?? 7.5
  g[G_VTH] = old[17] ?? 1.35
  g[G_REFR] = old[18] ?? 3
  g[G_TONIC] = old[19] ?? 0.55
  return g
}

function randomGenome(rng: Rng): Float32Array {
  const g = new Float32Array(ELEGANS_GENES)
  for (let i = 0; i < G_GAINS; i++) g[i] = clamp(1 + rng.gauss(0.12), 0.4, 1.6)
  // El gen del canal tónico arranca alto: sin impulso locomotor el gusano
  // no explora y muere de hambre (la selección natural puede afinarlo luego).
  g[0] = clamp(1.25 + rng.gauss(0.1), 0.85, 1.6)
  g[G_ACH] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_GABA] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_GLU] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_MONO] = clamp(1 + rng.gauss(0.08), 0.7, 1.3)
  g[G_TAU] = clamp(7.5 + rng.gauss(1.2), 4.5, 11)
  g[G_VTH] = clamp(1.35 + rng.gauss(0.07), 1.15, 1.55)
  g[G_REFR] = 3
  g[G_TONIC] = clamp(0.55 + rng.gauss(0.08), 0.35, 0.75)
  return g
}

// ——— Cerebro LIF ———————————————————————————————————————————————————————————————

const V_RESET = 0.12
const SMOOTH = 0.28 // suavizado exponencial de los pools motores
// Habituación al tap (Rankin 1990): depresión por uso de las sinapsis que
// salen del circuito mecano (ALM/AVM/PLM) y de ASH (fotofobia), con
// recuperación espontánea en ~1 min de simulación (como el animal).
const HAB_RATE = 0.0015 // depresión sináptica leve: la habituación la lleva la fatiga
const HAB_TAU_TICKS = 60 * 30 // τ = 60 s a 30 ticks/s

export class ElegansBrain implements IBrainAdapter {
  readonly kind: BrainKind = 'elegans'
  readonly w: Float32Array
  readonly inA = new Float32Array(G_GAINS)
  readonly hA = new Float32Array(8)
  readonly oA = new Float32Array(3)

  private readonly V: Float32Array
  private readonly spike: Uint8Array
  private readonly refr: Int8Array
  /** Fatiga por disparo (adaptación de tasa, gen [25]). */
  private readonly adapt: Float32Array
  /** Escalas de habituación por arista deprimible (por individuo). */
  private readonly habScale: Float32Array
  /** Neuronas silenciadas (knockout experimental): V≡0. */
  private silenced: Set<number> | null = null
  /** Amplitud del último tren del electrodo (para la depresión por uso). */
  private stimDrive = 0
  private fwdRate = 0
  private bwdRate = 0
  private dorRate = 0
  private venRate = 0
  private eggRate = 0

  constructor(genome?: Float32Array, rng?: Rng) {
    this.w =
      genome == null ? randomGenome(rng ?? new Rng()) : migrateGenome(genome)
    const g = getGraph()
    this.V = new Float32Array(g.n)
    this.spike = new Uint8Array(g.n)
    this.refr = new Int8Array(g.n)
    this.adapt = new Float32Array(g.n)
    this.habScale = new Float32Array(g.nHabit).fill(1)
  }

  /** Knockout experimental: silencia neuronas por índice global. */
  setSilenced(ids: Set<number> | null): void {
    this.silenced = ids
  }

  /** Electrodo virtual: corriente inyectada en el próximo tick. */
  stimulate(ids: number[], amp: number): void {
    for (const i of ids) {
      if (this.silenced?.has(i)) continue
      this.V[i] += amp
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
    const spike = this.spike
    const refr = this.refr

    // 1) Fuga (τ del genoma), periodo refractario y decaimiento de la
    //    fatiga de disparo (adaptación de tasa, τ ≈ 2.7 s).
    const leak = Math.exp(-1 / w[G_TAU])
    const adaptK = w[G_ADAPT]
    for (let i = 0; i < g.n; i++) {
      V[i] *= leak
      if (refr[i] > 0) refr[i]--
      spike[i] = 0
      this.adapt[i] *= 0.9955 // τ ≈ 3.7 s: fatiga que se recupera en el reposo
      if (this.silenced?.has(i)) V[i] = 0 // knockout: ablación virtual
    }

    // 1b) Recuperación espontánea de la habituación (τ = 60 s).
    if (g.nHabit > 0) {
      const rec = 1 / HAB_TAU_TICKS
      for (let k = 0; k < this.habScale.length; k++) {
        this.habScale[k] += (1 - this.habScale[k]) * rec
      }
    }

    // 1c) Depresión por uso (habituación, Rankin 1990): SOLO los estímulos
    //     del LABORATORIO (el tren del electrodo sobre el circuito mecano
    //     o los transitorios luminosos) deprimen las sinapsis que salen de
    //     esos sensores. La exploración normal (choques con paredes) no
    //     cuenta: el animal se habitúa al estímulo del experimento repetido.
    const tapAmp = this.stimDrive
    const lux = inputs[CH.LIGHT] ?? 0
    this.stimDrive *= 0.5 // el drive del electrodo vive un tick
    if (tapAmp > 0.55 || lux > 0.55) {
      const amp = Math.max(tapAmp, lux)
      const d = HAB_RATE * Math.max(0, (amp - 0.55) / 0.45)
      if (d > 0) {
        for (let i = 0; i < g.n; i++) {
          const nm = ELEGANS_NAMES[i]
          if (
            nm === 'ALML' || nm === 'ALMR' || nm === 'AVM' ||
            nm === 'PLML' || nm === 'PLMR' || nm === 'ASHL' || nm === 'ASHR'
          ) {
            this.depress(i, d)
          }
        }
      }
    }

    // 2) Escalas de transmisión (neuromodulación evolucionable).
    const txScale = [w[G_ACH], w[G_GLU], w[G_GABA], w[G_MONO]]

    // 3) Inyección sensorial: el entorno carga directamente las neuronas
    //    sensoriales del conectoma (AFD ← temperatura, ASE ← comida, ...).
    for (const s of g.sensoryMap) {
      if (this.silenced?.has(s.idx)) continue // sensor ablacionado
      let drive = inputs[s.ch] ?? 0
      if (s.ch === 0) drive = w[G_TONIC] // sesgo → impulso tónico del genoma
      else if (s.ch === 1) drive = 1 - drive // hambre, no saciedad
      V[s.idx] += drive * s.gain * s.sign * w[s.ch]
    }

    // 4) Umbral (con fatiga de disparo), disparo y entrega sináptica
    //    inmediata (una pasada por tick: las cascadas continúan en el
    //    siguiente tick, evitando espirales).
    const vth = w[G_VTH]
    const refractory = Math.round(w[G_REFR])
    let spiked = 0
    for (let i = 0; i < g.n; i++) {
      if (refr[i] > 0 || V[i] < vth + adaptK * this.adapt[i]) continue
      spike[i] = 1
      spiked++
      V[i] = V_RESET
      refr[i] = refractory
      if (this.adapt[i] < 6) this.adapt[i] += 0.22
      // Entrega a los postsinápticos (voltage < 1 = frío: señales débiles)
      // con la escala de habituación si la arista está deprimida.
      for (let e = g.srcOff[i]; e < g.srcOff[i + 1]; e++) {
        const j = g.dst[e]
        const hs = g.habMask[e] ? this.habScale[g.habIdx[e]] : 1
        V[j] += g.w[e] * hs * txScale[g.txIdx[i]] * voltage
      }
    }

    // 5) Uniones en gap: acoplamiento difusivo de potenciales MÁS
    //    transmisión de picos (las sinapsis eléctricas pasan transitorios
    //    despolarizantes: así comandan AVA/AVB a los pools motores A/B,
    //    como en el animal real).
    for (let k = 0; k < g.gapA.length; k++) {
      const a = g.gapA[k]
      const b = g.gapB[k]
      const d = (V[b] - V[a]) * g.gapW[k] * 0.5 * voltage
      V[a] += d
      V[b] -= d
      if (spike[a]) V[b] += g.gapW[k] * 2.4 * voltage
      if (spike[b]) V[a] += g.gapW[k] * 2.4 * voltage
    }

    // 6) Pools motores → salidas del Canvas (suavizado exponencial).
    const rate = (pool: number[]): number => {
      let hits = 0
      for (const i of pool) hits += spike[i]
      return pool.length ? hits / pool.length : 0
    }
    this.fwdRate += (rate(g.pool.forward) - this.fwdRate) * SMOOTH
    this.bwdRate += (rate(g.pool.backward) - this.bwdRate) * SMOOTH
    this.dorRate += (rate(g.pool.headDorsal) - this.dorRate) * SMOOTH
    this.venRate += (rate(g.pool.headVentral) - this.venRate) * SMOOTH
    this.eggRate += (rate(g.pool.egg) - this.eggRate) * SMOOTH

    // Dirección de giro: asimetría dorso-ventral de los pools cefálicos
    // (el vaivén exploratorio del nemátodo). Durante una reversa
    // (comando A dominante) el giro se amplifica: el animal re-orienta,
    // exactamente el comportamiento descrito en C. elegans.
    const dv = this.dorRate - this.venRate
    const reversal = Math.max(0, this.bwdRate - this.fwdRate)
    this.oA[0] = clamp(dv * (0.9 + reversal * 2.2), -1, 1)
    this.oA[1] = clamp(this.fwdRate * 1.5 + 0.06, 0, 1)
    // Circuito real de puesta (VC + HSN): silencioso en reposo, se activa
    // en ráfagas cuando la red lo impulsa.
    this.oA[2] = 1 / (1 + Math.exp(-(this.eggRate - 0.14) * 11))

    // 7) Espejos para el inspector (17 canales sensoriales).
    for (let i = 0; i < G_GAINS; i++) this.inA[i] = inputs[i] ?? 0
    this.hA[0] = meanClass(g, V, 0)
    this.hA[1] = meanClass(g, V, 1)
    this.hA[2] = meanClass(g, V, 2)
    this.hA[3] = this.fwdRate
    this.hA[4] = this.bwdRate
    this.hA[5] = dv
    this.hA[6] = this.eggRate
    this.hA[7] = spiked / g.n
  }

  connectomeView(): ConnectomeActivity {
    return {
      v: Array.from(this.V, (x) => Math.round(Math.min(x, 2) * 100) / 100),
      s: Array.from(this.spike),
    }
  }

  clone(): ElegansBrain {
    return new ElegansBrain(new Float32Array(this.w))
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

  private depress(neuronIdx: number, delta: number): void {
    const g = getGraph()
    for (let e = g.srcOff[neuronIdx]; e < g.srcOff[neuronIdx + 1]; e++) {
      const h = g.habIdx[e]
      if (h >= 0) this.habScale[h] = Math.max(0.06, this.habScale[h] - delta)
    }
  }
}

/** Índices de neuronas por nombre exacto (knockouts del Laboratorio). */
export function getElegansIndicesByNames(names: string[]): number[] {
  return names.map((n) => idxOf(n)).filter((i) => i >= 0)
}

/**
 * Línea de laboratorio ISOGÉNICA (como la N2 real de los laboratorios de
 * C. elegans: clones idénticos): animal en reposo (CPG bajo el umbral) y
 * con el reflejo tap→comando nítido — la ráfaga aferente larga (0.8 s con
 * adaptación) integra en PVC/AVD por la transmisión glutamatérgica alta
 * (ALM/AVM/PLM→PVC/AVD, Wicks & Rankin 1997). Calibrada en
 * /home/z/calib (grid-lab2 + smoke-final).
 */
export function elegansLabGenome(_rng?: Rng): Float32Array {
  const g = new Float32Array(ELEGANS_GENES).fill(1)
  g[0] = 0.9 // ganancia del canal tónico
  g[G_ACH] = 1.0
  g[G_GLU] = 1.55 // reflejo mecanosensorial glutamatérgico presente
  g[G_GABA] = 1.0
  g[G_MONO] = 1.0
  g[G_TAU] = 6.0
  g[G_VTH] = 1.2
  g[G_REFR] = 3
  g[G_TONIC] = 0.26 // V_ss ≈ 1.0 < umbral: animal en reposo
  g[G_ADAPT] = 0.3 // fatiga de disparo: ráfagas sí, epilepsia jamás
  return g
}

function meanClass(g: ElegansGraph, V: Float32Array, cls: 0 | 1 | 2): number {
  let sum = 0
  let n = 0
  for (let i = 0; i < g.n; i++) {
    if (ELEGANS_CLASSES[i] === cls) {
      sum += V[i]
      n++
    }
  }
  return n ? Math.round((sum / n) * 100) / 100 : 0
}

// ——— Subgrafo del circuito sensoriomotor (vista "Circuito vivo") ————————————
// Las neuronas protagonistas de los 17 sentidos y de los circuitos de
// comando, con las aristas REALES (químicas + gap) del dataset que las
// conectan entre sí. Se calcula una única vez de forma perezosa.

export interface CircuitNodeDef {
  /** Índice global en ELEGANS_NAMES. */
  i: number
  /** Nombre (p. ej. 'ASHL'). */
  n: string
  /** Clase: 0 sensorial / 1 interneurona / 2 motoneurona. */
  c: 0 | 1 | 2
  /** Carril de dibujo: 0 sensorial, 1 comando, 2 premotora. */
  lane: 0 | 1 | 2
  /** Función resumida en español. */
  role: string
}

export interface CircuitEdgeDef {
  a: number
  b: number
  w: number
  kind: 'chem' | 'gap'
}

export interface CircuitBundleDef {
  from: number
  pool: 'forward' | 'backward' | 'head' | 'egg'
  /** Suma de |pesos| de las aristas reales hacia el pool. */
  w: number
}

export interface CircuitViewDef {
  nodes: CircuitNodeDef[]
  edges: CircuitEdgeDef[]
  bundles: CircuitBundleDef[]
  pools: Record<
    'forward' | 'backward' | 'headDorsal' | 'headVentral' | 'egg',
    number[]
  >
}

const CIRCUIT_NODE_DEFS: [string, 0 | 1 | 2, string][] = [
  // Sensoriales (carril 0)
  ['AFDL', 0, 'Termosensor (AFD)'], ['AFDR', 0, 'Termosensor (AFD)'],
  ['ASHL', 0, 'Nocicepción: luz, veneno, nariz (ASH)'], ['ASHR', 0, 'Nocicepción: luz, veneno, nariz (ASH)'],
  ['ASEL', 0, 'Gusto y Δ gradiente (ASE)'], ['ASER', 0, 'Gusto y Δ gradiente (ASE)'],
  ['AWCL', 0, 'Olfato direccional (AWC)'], ['AWCR', 0, 'Olfato direccional (AWC)'],
  ['AWAL', 0, 'Olfato (AWA)'], ['AWAR', 0, 'Olfato (AWA)'],
  ['BAGL', 0, 'Humedad (BAG)'], ['BAGR', 0, 'Humedad (BAG)'],
  ['PHAL', 0, 'Fásmido aversivo (PHA)'], ['PHAR', 0, 'Fásmido aversivo (PHA)'],
  ['PHBL', 0, 'Fásmido aversivo (PHB)'], ['PHBR', 0, 'Fásmido aversivo (PHB)'],
  ['PVDL', 0, 'Tacto brusco (PVD)'], ['PVDR', 0, 'Tacto brusco (PVD)'],
  ['ALML', 0, 'Tacto suave anterior (ALM)'], ['ALMR', 0, 'Tacto suave anterior (ALM)'],
  ['PLML', 0, 'Tacto caudal (PLM)'], ['PLMR', 0, 'Tacto caudal (PLM)'],
  ['ADFL', 0, 'Hambre interna (ADF)'], ['ADFR', 0, 'Hambre interna (ADF)'],
  ['ADLL', 0, 'Feromona (ADL)'], ['ADLR', 0, 'Feromona (ADL)'],
  ['FLPL', 0, 'Mecanorreceptor nasal (FLP)'], ['FLPR', 0, 'Mecanorreceptor nasal (FLP)'],
  ['OLQDL', 0, 'Mecanorreceptor nasal (OLQ)'], ['OLQDR', 0, 'Mecanorreceptor nasal (OLQ)'],
  // Comando / integración (carril 1)
  ['AVAL', 1, 'Comando A: reversa'], ['AVAR', 1, 'Comando A: reversa'],
  ['AVBL', 1, 'Comando B: avance'], ['AVBR', 1, 'Comando B: avance'],
  ['AVDL', 1, 'Comando A: reversa'], ['AVDR', 1, 'Comando A: reversa'],
  ['AVEL', 1, 'Comando A: reversa'], ['AVER', 1, 'Comando A: reversa'],
  ['PVCL', 1, 'Comando B: avance'], ['PVCR', 1, 'Comando B: avance'],
  ['AIBL', 1, 'Puente quimiotaxis→motor'], ['AIBR', 1, 'Puente quimiotaxis→motor'],
  ['RIML', 1, 'Estado de excitación'], ['RIMR', 1, 'Estado de excitación'],
  ['RIAL', 1, 'Puente sensoriomotor (klinotaxis)'], ['RIAR', 1, 'Puente sensoriomotor (klinotaxis)'],
  // Premotoras (carril 2)
  ['DVA', 2, 'Propiocepción corporal (TRP-4)'],
  ['HSNL', 2, 'Puesta de huevos (HSN)'], ['HSNR', 2, 'Puesta de huevos (HSN)'],
  ['RMDDL', 2, 'Cabeza dorsal (RMD)'], ['RMDDR', 2, 'Cabeza dorsal (RMD)'],
  ['RMDVL', 2, 'Cabeza ventral (RMD)'], ['RMDVR', 2, 'Cabeza ventral (RMD)'],
]

let CIRCUIT: CircuitViewDef | null = null

/** Subgrafo sensoriomotor para la vista "Circuito vivo" del inspector. */
export function getElegansCircuit(): CircuitViewDef {
  if (CIRCUIT) return CIRCUIT
  const g = getGraph()
  const nodes: CircuitNodeDef[] = []
  const idx2node = new Map<number, number>() // índice global → posición en nodes
  for (const [name, lane, role] of CIRCUIT_NODE_DEFS) {
    const i = idxOf(name)
    if (i < 0) continue
    idx2node.set(i, nodes.length)
    nodes.push({ i, n: name, c: ELEGANS_CLASSES[i], lane, role })
  }
  // Aristas químicas reales entre nodos seleccionados: srcOff marca el
  // rango de cada fuente; recorremos por fuente.
  const seen = new Set<string>()
  const edges: CircuitEdgeDef[] = []
  for (let src = 0; src < g.n; src++) {
    const na = idx2node.get(src)
    if (na === undefined) continue
    for (let e = g.srcOff[src]; e < g.srcOff[src + 1]; e++) {
      const nb = idx2node.get(g.dst[e])
      if (nb === undefined) continue
      const key = `${src}>${g.dst[e]}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ a: na, b: nb, w: g.w[e], kind: 'chem' })
    }
  }
  for (let k = 0; k < g.gapA.length; k++) {
    const na = idx2node.get(g.gapA[k])
    const nb = idx2node.get(g.gapB[k])
    if (na === undefined || nb === undefined) continue
    const key = `g${g.gapA[k]}-${g.gapB[k]}`
    if (seen.has(key)) continue
    seen.add(key)
    edges.push({ a: na, b: nb, w: g.gapW[k], kind: 'gap' })
  }
  // Haces comando → pool motor (peso agregado de aristas reales).
  const POOL_KEYS = ['forward', 'backward', 'head', 'egg'] as const
  const poolMembers: Record<string, Set<number>> = {}
  for (const key of ['forward', 'backward', 'headDorsal', 'headVentral', 'egg']) {
    poolMembers[key] = new Set<number>()
    for (const m of g.pool[key as keyof typeof g.pool]) poolMembers[key].add(m)
  }
  const bundles: CircuitBundleDef[] = []
  for (const node of nodes) {
    if (node.lane !== 1) continue
    for (const pkey of POOL_KEYS) {
      const members = pkey === 'head'
        ? new Set([...poolMembers.headDorsal, ...poolMembers.headVentral])
        : poolMembers[pkey]
      let w = 0
      for (let e = g.srcOff[node.i]; e < g.srcOff[node.i + 1]; e++) {
        if (members.has(g.dst[e])) w += Math.abs(g.w[e])
      }
      if (w > 0.12) bundles.push({ from: idx2node.get(node.i)!, pool: pkey, w: Math.min(2.4, w) })
    }
  }
  CIRCUIT = { nodes, edges, bundles, pools: g.pool }
  return CIRCUIT
}
