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
import connectomeJson from '@/lib/sim/data/c_elegans_connectome.json'
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

/** Escala del holograma del gusano (recto, horizontal, cabeza a la izquierda). */
export const WORM_HOLO_W = 46
export const WORM_HOLO_S = WORM_HOLO_W / WORM_3D.lengthUm
/** La sección transversal real (~135 µm) se ve a escala natural. */
export function wormHoloPos(yUm: number, xUm: number, zUm: number): [number, number, number] {
  return [
    -(yUm * WORM_HOLO_S) + WORM_HOLO_W / 2, // cabeza (−y) a la izquierda
    (zUm - 4) * WORM_HOLO_S, // dorsal (z+) arriba
    xUm * WORM_HOLO_S, // L-R como profundidad
  ]
}

// ──────────────────── aristas del gusano (holograma) ────────────────────────

const cj = connectomeJson as unknown as {
  chem: { s: number[]; t: number[] }
  gap: { p: number[] }
}

/** Todas las sinapsis del conectoma (químicas + gap) como pares de índices. */
export const WORM_EDGES: [number, number][] = [
  ...cj.chem.s.map((s, i) => [s, cj.chem.t[i]] as [number, number]),
  ...Array.from(
    { length: cj.gap.p.length / 2 },
    (_, i) => [cj.gap.p[i * 2], cj.gap.p[i * 2 + 1]] as [number, number],
  ),
]

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
