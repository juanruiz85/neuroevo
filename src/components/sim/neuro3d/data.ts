// Capa de datos del modo 3D: decodifica los datasets anatómicos reales y
// expone las conversiones mundo↔escena y las geometrías de los cerebros.
//
// FUENTES (ver docs/MODO-3D.md):
// · C. elegans: 302 somas reales (µm) — WormBase Virtual Worm (dominio
//   público) vía OpenWorm c302 (MIT), extraído de c302_C_Full.net.nml.
// · Drosophila: nube voxel del CNS adulto masculino (141.781 somas,
//   neuPrint male-cns:v1.0, Berg et al. 2026, datos CC BY 4.0) vía el
//   binario FLYB de github.com/blendi-remade/fly-brain-minecraft (MIT);
//   la actividad en vivo viene del conectoma LARVARIO (Winding 2023)
//   anclado a las familias adultas homólogas (simplificación declarada).

import wormJson from '@/lib/sim/data/c_elegans_3d.json'
import flyJson from '@/lib/sim/data/fly_cns_3d.json'
import { ELEGANS_NAMES } from '@/lib/sim/connectome/elegans'
import { DROSOPHILA_NAMES } from '@/lib/sim/connectome/drosophila'

// ────────────────────────── mundo ↔ escena ──────────────────────────────────

/** Tamaño del mundo simulado (px) — 1280×840. */
export const WORLD_W = 1280
export const WORLD_H = 840
/** Escala px → unidades 3D (el plato mide 128×84). */
export const PX2U = 0.1

export const worldToScene = (wx: number, wy: number): [number, number] => [
  (wx - WORLD_W / 2) * PX2U,
  (wy - WORLD_H / 2) * PX2U,
]
export const sceneToWorld = (x: number, z: number): [number, number] => [
  x / PX2U + WORLD_W / 2,
  z / PX2U + WORLD_H / 2,
]

// ────────────────────────── gusano: 302 somas ───────────────────────────────

export interface Worm3D {
  /** Coordenadas µm por neurona (nombres del conectoma + CANL/CANR). */
  soma: Record<string, [number, number, number]>
  /** bbox [min, max] en µm. */
  bbox: [[number, number, number], [number, number, number]]
  /** Longitud A-P (µm). */
  lengthUm: number
}

const wormSoma = wormJson.soma as Record<string, number[]>
const wormXs = Object.values(wormSoma).map((p) => p[0])
const wormYs = Object.values(wormSoma).map((p) => p[1])
const wormZs = Object.values(wormSoma).map((p) => p[2])
export const WORM_3D: Worm3D = {
  soma: wormSoma as Record<string, [number, number, number]>,
  bbox: [
    [Math.min(...wormXs), Math.min(...wormYs), Math.min(...wormZs)],
    [Math.max(...wormXs), Math.max(...wormYs), Math.max(...wormZs)],
  ],
  lengthUm: Math.max(...wormYs) - Math.min(...wormYs),
}

/** Eje A-P: y µm (−312 cabeza … +410 cola) → fracción [0,1]. */
export const wormAP = (yUm: number) => (yUm - (-312)) / (410 - (-312))

/**
 * Posición local (unidades del cuerpo, cabeza en x=0) de una neurona dentro
 * del cuerpo del gusano: t = fracción A-P, lateral = x µm, dorsal = z µm.
 * El radio real del cuerpo ~40 µm; los somas forman una banda bajo la piel.
 */
export function wormLocalPos(
  yUm: number,
  xUm: number,
  zUm: number,
  bodyLen: number,
  bodyR: number,
): [number, number, number] {
  const t = wormAP(yUm) // 0 cabeza → 1 cola
  // Grosor real del cuerpo a lo largo de A-P (fusiforme: fino en extremos).
  const taper = Math.sin(Math.min(0.92, Math.max(0.08, t)) * Math.PI) ** 0.6
  const k = (0.82 * bodyR) / 80 // banda somática ±80 µm → ±0.82·R
  return [
    t * bodyLen,
    xUm * k * taper,
    zUm * k * taper,
  ]
}

// ──────────────────── mosca: nube del CNS adulto + anclajes ─────────────────

export interface Fly3D {
  n: number
  /** Posiciones normalizadas [0,32767] (Uint16 ×3) decodificadas. */
  pos: Uint16Array
  /** Clase de color por punto (0-8, mismo código que el build de Minecraft). */
  cls: Uint8Array
  classes: { key: string; label: string; color: string; n: number }[]
  anchors: Record<
    string,
    {
      posN: [number, number, number]
      rN: number
      n: number
      nSoma: number
      family: string
      note: string
      fallback: boolean
    }
  >
  bboxRaw: [[number, number, number], [number, number, number]]
}

function decodeFly(): Fly3D {
  const c = flyJson.cloud as { n: number; pos: string; cls: string }
  const posBin = Uint8Array.from(atob(c.pos), (ch) => ch.charCodeAt(0))
  const pos = new Uint16Array(posBin.buffer, posBin.byteOffset, (posBin.length / 2) | 0)
  const cls = Uint8Array.from(atob(c.cls), (ch) => ch.charCodeAt(0))
  return {
    n: c.n,
    pos,
    cls,
    classes: flyJson.classes as Fly3D['classes'],
    anchors: flyJson.anchors as unknown as Fly3D['anchors'],
    bboxRaw: flyJson.meta.bboxRaw as Fly3D['bboxRaw'],
  }
}

export const FLY_3D = decodeFly()

/**
 * Ejes del male-cns (verificados sobre la nube): x = izquierda-derecha
 * (lóbulos ópticos a ambos extremos), z = eje largo cerebro→cordón
 * (descendentes en z bajo, cordón en z alto), y = dorso-ventral.
 * El holograma se pone DE PIE: cerebro arriba, cordón colgando —
 * como el build de bloques de Minecraft del que provienen los datos.
 */
const SPAN = [91200, 64238, 124377] as const
const HOLO_H = 40 // unidades de alto del holograma
const S = HOLO_H / SPAN[2]

export function flyHoloPos(xn: number, yn: number, zn: number): [number, number, number] {
  // posN llega normalizado a [0, 32767] → fracción [0,1] → tamaño real.
  const fx = (xn / 32767) * SPAN[0] * S
  const fy = (yn / 32767) * SPAN[1] * S
  const fz = (zn / 32767) * SPAN[2] * S
  return [
    fx - (SPAN[0] * S) / 2, // x: L-R centrado
    (SPAN[2] * S) / 2 - fz, // y: cerebro (z bajo) arriba, centrado en 0
    fy - (SPAN[1] * S) / 2, // z: D-V como profundidad
  ]
}

// ──────────────── actividad por grupo (mosca) para el holograma ─────────────

/** Nombre de grupo de una neurona larvaria (p.ej. 'ORN-L03' → 'ORN'). */
export function groupOf(name: string): string {
  const m = /^(.*?)-(?:L|R|M)\d+$/.exec(name)
  return m ? m[1] : name
}

/** Índices de las 2.956 neuronas agrupados por los 29 grupos reales. */
export const FLY_GROUP_INDICES: Map<string, number[]> = (() => {
  const map = new Map<string, number[]>()
  DROSOPHILA_NAMES.forEach((name, i) => {
    const g = groupOf(name)
    const arr = map.get(g)
    if (arr) arr.push(i)
    else map.set(g, [i])
  })
  return map
})()

/** Índices del conectoma del gusano → posición (para el holograma recto). */
export const WORM_NEURON_POS: { name: string; pos: [number, number, number] }[] =
  ELEGANS_NAMES.map((name) => ({
    name,
    pos: WORM_3D.soma[name] ?? [0, 0, 0],
  }))

/**
 * Los 302 somas reales del hermafrodita: los 300 del conectoma (con
 * actividad LIF en vivo, índice `act`) + CANL/CANR (sin sinapsis, solo
 * anatomía — `act` = −1).
 */
export const WORM_ALL_SOMAS: { name: string; pos: [number, number, number]; act: number }[] = [
  ...WORM_NEURON_POS.map((n, i) => ({ ...n, act: i })),
  { name: 'CANL', pos: WORM_3D.soma.CANL ?? [0, 0, 0], act: -1 },
  { name: 'CANR', pos: WORM_3D.soma.CANR ?? [0, 0, 0], act: -1 },
]

/** Escala del holograma del gusano (recto, horizontal, cabeza a la izquierda). */
export const WORM_HOLO_W = 46
export const WORM_HOLO_S = WORM_HOLO_W / WORM_3D.lengthUm
/** La sección transversal real (~135 µm) se ve a escala natural. */
export function wormHoloPos(yUm: number, xUm: number, zUm: number): [number, number, number] {
  return [
    // y mínimo (cabeza, −312 µm) → x = −W/2 (izquierda); cola → +W/2.
    (yUm - WORM_3D.bbox[0][1]) * WORM_HOLO_S - WORM_HOLO_W / 2,
    (zUm - 4) * WORM_HOLO_S, // dorsal (z+) arriba
    xUm * WORM_HOLO_S, // L-R como profundidad
  ]
}

// ───────── andamio del sistema nervioso (gusano, holograma) ─────────────────
//
// Al dejar de dibujar las 4.731 sinapsis («las rayas»), la estructura del
// sistema nervioso se representa con su neuroanatomía canónica (WormAtlas,
// neuronalwiring.html): el anillo nervioso circunfaríngeo, el cordón ventral
// y el cordón dorsal. Cada tramo se ilumina con la actividad media REAL de
// las neuronas que forman ese tracto.

/**
 * Anillo nervioso circunfaríngeo. Centro y orientación DERIVADOS de los
 * somas reales: la banda A-P −232…−186 µm (somas que flanquean el istmo de
 * la faringe: ganglios lateral y ventral, n=14) tiene centro
 * (x −1.4, y −211, z −4.4) µm. El eje de la faringe se deduce del arco
 * cefálico de los ganglios (de dorso-anterior a ventro-posterior — la
 * cabeza está inclinada en el modelo Virtual Worm), dando una normal de
 * anillo (y, z) = (0.91, −0.41). El radio real del anillo (~15 µm en el
 * istmo) se dibuja levemente magnificado (20 µm) para legibilidad —
 * simplificación declarada en docs/MODO-3D.md §5.
 */
export const WORM_RING = {
  /** Centro del anillo en µm (x, y, z). */
  center: [-1.4, -211, -4.4] as [number, number, number],
  /** Radio dibujado (µm). */
  radiusUm: 20,
  /** Normal del anillo ≈ eje faríngeo: componentes (y, z) normalizadas. */
  normalYZ: [0.91, -0.41] as [number, number],
}

/** Borde ventral / dorsal del anillo (µm) — arranque de los cordones.
 * El radio vive en el plano del anillo: componente x = cos θ, y las
 * componentes (y, z) del círculo usan la base ⊥ a la normal faríngea
 * (0.41, 0.91) en el plano A-P/dorsal-ventral. */
const ringRim = (dorsal: boolean): [number, number, number] => {
  const s = dorsal ? 1 : -1
  return [
    WORM_RING.center[0],
    WORM_RING.center[1] + s * WORM_RING.radiusUm * 0.41,
    WORM_RING.center[2] + s * WORM_RING.radiusUm * 0.91,
  ]
}

/** Clases motoras con soma en el cordón ventral (WormAtlas: AS, DA, DB, DD, VA, VB, VC, VD). */
const VNC_MOTOR = /^(AS|DA|DB|DD|VA|VB|VC|VD)\d+$/

/**
 * Cordón ventral: trazado a partir de los somas motores REALES, agrupados
 * en medias locales de 40 µm A-P (de cabeza a cola) desde el borde ventral
 * del anillo hasta la región preanal. La media local sigue la postura real
 * del modelo Virtual Worm (arco ventral −66 µm en el RVG → +4 a mitad del
 * cuerpo → −13 en la cola) sin tejer entre somas individuales.
 */
const WORM_VNC_CTRL: [number, number, number][] = (() => {
  const BIN = 40 // µm de A-P por tramo
  const motor = WORM_ALL_SOMAS.filter(
    (n) => VNC_MOTOR.test(n.name) && n.pos[1] > -240,
  )
  const bins = new Map<number, { x: number; y: number; z: number; n: number }>()
  for (const m of motor) {
    const b = Math.floor((m.pos[1] + 240) / BIN)
    const acc = bins.get(b) ?? { x: 0, y: 0, z: 0, n: 0 }
    acc.x += m.pos[0]
    acc.y += m.pos[1]
    acc.z += m.pos[2]
    acc.n++
    bins.set(b, acc)
  }
  const ctrl: [number, number, number][] = [ringRim(false)]
  for (const b of [...bins.keys()].sort((a, c) => a - c)) {
    const acc = bins.get(b)!
    ctrl.push([acc.x / acc.n, acc.y / acc.n, acc.z / acc.n])
  }
  return ctrl
})()

/**
 * Cordón dorsal: tracto real SIN somas propios (lo forman los axones
 * dorsales de las motoras DA/DB/DD, cuyos somas están en el ventral). Al no
 * poder trazarse desde el dataset, su ruta es una aproximación declarada:
 * línea media dorsal desde el borde dorsal del anillo hasta la región
 * preanal, siguiendo el estrechamiento real del cuerpo (radio somático
 * medido en PVD/PDE/PVM: z ≈ +25–35 µm a mitad del cuerpo).
 */
const WORM_DCC_CTRL: [number, number, number][] = [
  ringRim(true),
  [0, -160, 24],
  [0, -80, 32],
  [0, 0, 34],
  [0, 120, 33],
  [0, 240, 27],
  [0, 330, 17],
  [0, 378, 8],
]

/** Muestreo Catmull-Rom uniforme (en µm) de una polilínea de control. */
function sampleSpline(ctrl: readonly [number, number, number][], n: number): [number, number, number][] {
  const P = (i: number) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))]
  const pts: [number, number, number][] = []
  const segs = ctrl.length - 1
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * segs
    const k = Math.min(segs - 1, Math.floor(u))
    const t = u - k
    const p0 = P(k - 1), p1 = P(k), p2 = P(k + 1), p3 = P(k + 2)
    const cr = (a: number, b: number, c: number, d: number) =>
      0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t)
    pts.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1]), cr(p0[2], p1[2], p2[2], p3[2])])
  }
  return pts
}

export interface WormTract {
  /** Puntos muestreados en µm (para buscar vecinos por A-P). */
  ptsUm: [number, number, number][]
  /** Puntos en coordenadas del holograma. */
  pts: [number, number, number][]
  /** Índices (en WORM_ALL_SOMAS, con act ≥ 0) cuyo voltaje ilumina cada punto. */
  neighbors: number[][]
}

/** Índices de somas (en WORM_ALL_SOMAS) con y en [a, b] y conectoma vivo. */
const somasBetween = (a: number, b: number, filter?: (name: string) => boolean): number[] =>
  WORM_ALL_SOMAS.flatMap((n, i) =>
    n.act >= 0 && n.pos[1] >= a && n.pos[1] <= b && (!filter || filter(n.name)) ? [i] : [],
  )

/** Radio de vecindad por punto para promediar actividad sobre el tracto. */
function tractNeighbors(ptsUm: [number, number, number][], rUm: number, filter?: (name: string) => boolean): number[][] {
  return ptsUm.map((p) => somasBetween(p[1] - rUm, p[1] + rUm, filter))
}

/** Anillo: 64 puntos (µm → holograma) + vecinos = somas cefálicos (y < −150). */
export const WORM_RING_TRACT: WormTract = (() => {
  const n = 64
  const ptsUm: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2
    const ex = Math.cos(th)
    const ez = Math.sin(th)
    ptsUm.push([
      WORM_RING.center[0] + ex * WORM_RING.radiusUm,
      WORM_RING.center[1] + ez * WORM_RING.radiusUm * 0.41,
      WORM_RING.center[2] + ez * WORM_RING.radiusUm * 0.91,
    ])
  }
  const head = somasBetween(-Infinity, -150)
  return {
    ptsUm,
    pts: ptsUm.map((p) => wormHoloPos(p[1], p[0], p[2])),
    neighbors: ptsUm.map(() => head),
  }
})()

/**
 * Cordón ventral: vecinos = motoras ventrales (AS/DA/DB/DD/VA/VB/VC/VD) en
 * ±45 µm del punto — son las neuronas cuyos axones forman el tracto.
 */
export const WORM_VNC_TRACT: WormTract = (() => {
  const ptsUm = sampleSpline(WORM_VNC_CTRL, 110)
  return {
    ptsUm,
    pts: ptsUm.map((p) => wormHoloPos(p[1], p[0], p[2])),
    neighbors: tractNeighbors(ptsUm, 45, (name) => VNC_MOTOR.test(name)),
  }
})()

/**
 * Cordón dorsal: vecinos = DA/DB/DD en ±60 µm (sus axones dorsales SON el
 * cordón dorsal: excitan/inhiben los músculos dorsales).
 */
export const WORM_DCC_TRACT: WormTract = (() => {
  const ptsUm = sampleSpline(WORM_DCC_CTRL, 90)
  return {
    ptsUm,
    pts: ptsUm.map((p) => wormHoloPos(p[1], p[0], p[2])),
    neighbors: tractNeighbors(ptsUm, 60, (name) => /^(DA|DB|DD)\d+$/.test(name)),
  }
})()

/** Índice de una neurona por nombre (para etiquetas). */
export const wormIdx = (name: string) => ELEGANS_NAMES.indexOf(name)

/** Grupos larvarios de Drosophila con etiqueta en el holograma. */
export const FLY_LABEL_GROUPS = [
  'ORN', 'GRN', 'PR', 'KC', 'MBON', 'MBIN', 'DNV', 'ASC', 'LHN', 'CN',
] as const

/** Neuronas célebres de C. elegans con etiqueta en el holograma. */
export const WORM_LABELS: { name: string; desc: string }[] = [
  { name: 'AVA', desc: 'reversa (escape)' },
  { name: 'ASE', desc: 'quimiotaxis gustativa' },
  { name: 'AFD', desc: 'termosensor' },
  { name: 'ASH', desc: 'nocicepción (lo harms)' },
  { name: 'ALM', desc: 'tacto anterior (tap)' },
  { name: 'HSN', desc: 'puesta de huevos' },
  { name: 'AVB', desc: 'avance' },
  { name: 'DVA', desc: 'propiocepción' },
]
