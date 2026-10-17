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
// MAPEO SENSORIAL (12 canales del mundo → neuronas reales):
//   Sesgo/tonico  → AVB (comando de avance) + RMDD (oscilador cefálico)
//   Energía       → ADF (integración del estado interno; hambre = 1−energía)
//   Térmico       → AFD (termosensor primario, respuesta ON/OFF a gradientes)
//                   + AWC (termosensor secundario) — señal con signo
//   Luz           → ASH (nociceptor polimodal; C. elegans es fotofóbico)
//   Humedad       → BAG (sensor ambiental)
//   Comida X/Y/c. → AWC/AWA (olfato, asimetría L/R) + ASE (gusto)
//   Veneno X/Y/c. → PHA/PHB (fásmidos aversivos) + ASH (nocicepción)
//   Multitud      → PVD (tacto brusco/nocicepción mecánica) + ALM (tacto suave)
//
// MAPEO MOTOR (pools reales → 3 salidas del Canvas):
//   Avanzar  ← VB01-11, DB01-07, AVB, PVC  (comando B de avance)
//   Girar    ← asimetría dorso-ventral de los pools cefálicos (RMD/SM/SMB;
//   el vaivén real del nemátodo) AMPLIFICADA durante las reversas
//   (VA/DA + AVA/AVD/AVE, comando A: al retroceder re-orienta, como el animal)
//   Poner    ← VC01-06 + HSN (circuito real de puesta de huevos)
//
// GENOMA EVOLUTIVO (20 genes — el GA no toca la estructura del conectoma,
// evoluciona la neuromodulación y la excitabilidad, como en el animal):
//   [0..11] ganancia sensorial por canal
//   [12..15] escalas de transmisión: ACh / GABA (inhibitoria) / Glu /
//            monoaminas+neuropéptidos (5HT, DA, OCT, TA, FMRF)
//   [16] constante de fuga τ   [17] umbral de disparo
//   [18] periodo refractario    [19] impulso tónico
// —───────────────────────────────────────────────────────────────────────────

import rawConnectome from '../data/c_elegans_connectome.json'
import { Rng } from '../rng'
import { clamp } from '../types'
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
  // [1] Energía → ADF (hambre = 1 − energía).
  add([S(1, 'ADFL', 0.9), S(1, 'ADFR', 0.9), S(1, 'ASEL', 0.25), S(1, 'ASER', 0.25)])
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

export const ELEGANS_GENES = 20

const G_GAIN0 = 0
const G_ACH = 12
const G_GABA = 13
const G_GLU = 14
const G_MONO = 15
const G_TAU = 16
const G_VTH = 17
const G_REFR = 18
const G_TONIC = 19

/** Rangos de cada gen (la mutación respeta límites fisiológicos). */
const GENE_BOUNDS: [number, number][] = [
  ...Array.from({ length: 12 }, () => [0.15, 2.4] as [number, number]),
  [0.45, 1.9], [0.45, 1.9], [0.45, 1.9], [0.45, 1.9], // escalas tx
  [3.5, 14], // τ
  [1.0, 1.8], // umbral
  [1, 5], // refractario
  [0.05, 0.9], // tónico
]

function randomGenome(rng: Rng): Float32Array {
  const g = new Float32Array(ELEGANS_GENES)
  for (let i = 0; i < 12; i++) g[i] = clamp(1 + rng.gauss(0.12), 0.4, 1.6)
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

export class ElegansBrain implements IBrainAdapter {
  readonly kind: BrainKind = 'elegans'
  readonly w: Float32Array
  readonly inA = new Float32Array(12)
  readonly hA = new Float32Array(8)
  readonly oA = new Float32Array(3)

  private readonly V: Float32Array
  private readonly spike: Uint8Array
  private readonly refr: Int8Array
  private fwdRate = 0
  private bwdRate = 0
  private dorRate = 0
  private venRate = 0
  private eggRate = 0

  constructor(genome?: Float32Array, rng?: Rng) {
    this.w = genome ?? randomGenome(rng ?? new Rng())
    const g = getGraph()
    this.V = new Float32Array(g.n)
    this.spike = new Uint8Array(g.n)
    this.refr = new Int8Array(g.n)
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

    // 1) Fuga (τ del genoma) y periodo refractario.
    const leak = Math.exp(-1 / w[G_TAU])
    for (let i = 0; i < g.n; i++) {
      V[i] *= leak
      if (refr[i] > 0) refr[i]--
      spike[i] = 0
    }

    // 2) Escalas de transmisión (neuromodulación evolucionable).
    const txScale = [w[G_ACH], w[G_GLU], w[G_GABA], w[G_MONO]]

    // 3) Inyección sensorial: el entorno carga directamente las neuronas
    //    sensoriales del conectoma (AFD ← temperatura, ASE ← comida, ...).
    for (const s of g.sensoryMap) {
      let drive = inputs[s.ch] ?? 0
      if (s.ch === 0) drive = w[G_TONIC] // sesgo → impulso tónico del genoma
      else if (s.ch === 1) drive = 1 - drive // hambre, no saciedad
      V[s.idx] += drive * s.gain * s.sign * w[s.ch]
    }

    // 4) Umbral, disparo y entrega sináptica inmediata (una pasada por tick:
    //    las cascadas continúan en el siguiente tick, evitando espirales).
    const vth = w[G_VTH]
    const refractory = Math.round(w[G_REFR])
    let spiked = 0
    for (let i = 0; i < g.n; i++) {
      if (refr[i] > 0 || V[i] < vth) continue
      spike[i] = 1
      spiked++
      V[i] = V_RESET
      refr[i] = refractory
      // Entrega a los postsinápticos (voltage < 1 = frío: señales débiles).
      for (let e = g.srcOff[i]; e < g.srcOff[i + 1]; e++) {
        const j = g.dst[e]
        V[j] += g.w[e] * txScale[g.txIdx[i]] * voltage
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

    // 7) Espejos para el inspector.
    for (let i = 0; i < 12; i++) this.inA[i] = inputs[i] ?? 0
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
