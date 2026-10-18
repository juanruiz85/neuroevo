// Capa de datos del CERBRO LARVARIO de Drosophila (holograma del modo 3D).
//
// El motor simula el conectoma larvario REAL (Winding et al. 2023, Science
// 379:eadd9330 — 2.956 neuronas, 41.977 aristas). Esta capa le da su
// ANATOMÍA larvaria: cada una de las 2.956 neuronas se coloca en su región
// neuroanatómica canónica y su punto brilla con su voltaje LIF real — el
// mismo lenguaje visual que el holograma del gusano (302 somas + puntos que
// se encienden + andamio canónico).
//
// NEUROANATOMÍA DE REFERENCIA (larva L1–L3, ~500 µm de CNS):
//   · Dos hemisferios cerebrales con: lóbulo antenal (AL, anteroventral),
//     cuerpo fungiforme (MB: cálice posterodorsal → pedúnculo → lóbulo
//     vertical α'/β' + lóbulo medial α/β), cuerno lateral (LH, posterior),
//     neuropilo óptico larvario (LON, posteroventral — recibe el nervio de
//     Bolwig) y zona subesofágica (SEZ, ventral, gusto/enterico).
//     Fuentes: Berck et al. 2016; Eichler et al. 2017; Eschbach et al.
//     2020/2021; Winding et al. 2023 (supl.).
//   · Cordón nervioso ventral (VNC) con 11 neuromeros: T1–T3 + A1–A8.
//   · Órganos sensoriales de la cápsula cefálica (periféricos, REALES):
//     órgano dorsal (olfato: ORN; termo: THc/THw; higró: RSP), órganos de
//     Bolwig (fotorreceptores PR), órgano terminal/ventral (gusto GRN) y
//     órgano faríngeo (GNP); sensores de la pared corporal por segmento
//     (MEC/M23/NOC/PRO) que entran por nervios segmentarios.
//   · Glándula del anillo (RGN) dorsal al cerebro.
//
// DECLARACIÓN: las coordenadas por neurona son un LAYOUT CANÓNICO derivado
// de la literatura (el dataset Winding no publica somas en µm): posición
// determinista dentro de la región real de su grupo. La ACTIVIDAD es 100 %
// real (voltaje LIF por neurona, índice del conectoma).

import { DROSOPHILA_NAMES } from '@/lib/sim/connectome/drosophila'
import { seededJitter } from './vox'
import { WORM_HOLO_S } from './data'

/** Misma escala µm→unidades que el holograma del gusano (comparables). */
export const LARVA_S = WORM_HOLO_S
/** Centro A-P del layout (µm) para centrar el holograma. */
const CX = 177

/** µm (A-P x, D-V y, L-R z) → coordenadas del holograma (cabeza a la izquierda). */
export function larvaPos(x: number, y: number, z: number): [number, number, number] {
  return [(x - CX) * LARVA_S, y * LARVA_S, z * LARVA_S]
}

// ───────────────────────── regiones (µm) ────────────────────────────────────

/** Elipsoide de región: centro + radios (µm). */
interface Region {
  c: [number, number, number]
  r: [number, number, number]
}

/** Lado de una neurona por su nombre: 'pDNV-R01' → −1 (derecha). */
function sideOf(name: string): 1 | 0 | -1 {
  const m = /^.+-([LRM])\d+$/.exec(name)
  if (!m) return 0
  return m[1] === 'L' ? 1 : m[1] === 'R' ? -1 : 0
}

/** Nombre de grupo (mismo criterio que data.ts). */
function groupOfL(name: string): string {
  const m = /^(.*?)-(?:L|R|M)\d+$/.exec(name)
  return m ? m[1] : name
}

/** Neuromeros del VNC: x del centro (µm) y semiancho (µm). */
const NEUROMERES: { x: number; w: number }[] = [
  { x: 106, w: 18 }, { x: 136, w: 18 }, { x: 166, w: 17 }, // T1–T3
  { x: 196, w: 16 }, { x: 224, w: 15 }, { x: 252, w: 14 }, { x: 280, w: 13 }, // A1–A4
  { x: 308, w: 12 }, { x: 336, w: 11 }, { x: 364, w: 10 }, { x: 392, w: 10 }, // A5–A8
]

/** Región canónica de cada grupo (µm); s = lado (1 izq, −1 der, 0 medio). */
function regionOf(group: string, s: number, i: number, n: number): Region | null {
  const sig = s === 0 ? 0 : s > 0 ? 1 : -1
  switch (group) {
    // — sensoriales periféricos de la cabeza —
    case 'ORN': case 'THc': case 'THw': case 'RSP':
      return { c: [-26, 22, 0], r: [13, 9, 9] } // órgano dorsal
    case 'PR':
      return { c: [-20, 10, sig * 16], r: [7, 5, 6] } // órgano de Bolwig
    case 'GRN':
      return { c: [-24, -16, sig * 9], r: [11, 8, 8] } // órgano terminal/ventral
    case 'GNP':
      return { c: [-6, -24, 0], r: [10, 7, 11] } // órgano faríngeo
    // — cuerpo del cerebro (hemisferios) —
    case 'PN': case 'mPN': case 'LN':
      return { c: [12, 0, sig * 30], r: [15, 9, 13] } // lóbulo antenal
    case 'KC':
      return { c: [56, 28, sig * 22], r: [12, 9, 10] } // cálices del MB
    case 'MBON': case 'MBIN': case 'MBF': case 'MBFF': {
      // lóbulos del MB: mitad vertical, mitad medial (por índice)
      const k = i / Math.max(1, n - 1)
      if (k < 0.5) {
        const t = k * 2 // pedúnculo → lóbulo vertical
        return { c: [44 - 12 * t, 8 + 16 * t, sig * (20 - 8 * t)], r: [5, 4, 4] }
      }
      const t = (k - 0.5) * 2 // pedúnculo → lóbulo medial
      return { c: [44 - 10 * t, 8 - 4 * t, sig * (20 - 15 * t)], r: [5, 4, 4] }
    }
    case 'LHN':
      return { c: [38, 12, sig * 34], r: [11, 8, 9] } // cuerno lateral
    case 'DNV': case 'DNS': case 'pDNV': case 'pDNS':
      return { c: [44, 4, sig * 20], r: [18, 13, 14] } // cerebro posterior-ventral
    case 'CN': case 'UNK':
      return { c: [36, 12, sig * 24], r: [24, 19, 15] } // núcleo cerebral
    case 'RGN':
      return { c: [42, 44, 0], r: [6, 5, 6] } // glándula del anillo
    case 'ASC': {
      // ascendentes: somas repartidos por los neuromeros del VNC
      const nm = NEUROMERES[i % NEUROMERES.length]
      return { c: [nm.x, -5, sig * 8], r: [12, 5, 7] }
    }
    // — pared del cuerpo (segmentos) —
    case 'MEC': case 'M23': case 'NOC': case 'PRO': {
      const k = i / Math.max(1, n - 1)
      const x = 70 + k * 315
      const dy = i % 2 === 0 ? 18 : -18 // ramas dorsal/ventral alternas
      return { c: [x, dy, sig * 42], r: [14, 8, 7] }
    }
    default:
      return null
  }
}

/** Posición (holograma) de las 2.956 neuronas, en el orden del conectoma. */
export const LARVA_POS: Float32Array = (() => {
  const n = DROSOPHILA_NAMES.length
  const out = new Float32Array(n * 3)
  const counts = new Map<string, number>()
  const idx = new Map<string, number>()
  for (const name of DROSOPHILA_NAMES) {
    const g = groupOfL(name)
    counts.set(g, (counts.get(g) ?? 0) + 1)
  }
  DROSOPHILA_NAMES.forEach((name, i) => {
    const g = groupOfL(name)
    const s = sideOf(name)
    const k = idx.get(g) ?? 0
    idx.set(g, k + 1)
    const reg = regionOf(g, s, k, counts.get(g) ?? 1)
    const rnd = seededJitter(0x9e37 + i * 2654435761)
    let x = 0, y = 0, z = 0
    if (g === 'GUT') {
      // sistema nervioso entérico: a lo largo del intestino anterior (ventral)
      const t = k / Math.max(1, (counts.get('GUT') ?? 1) - 1)
      x = -2 + t * 77
      y = -32 + (rnd() - 0.5) * 7
      z = (rnd() - 0.5) * 14
    } else if (reg) {
      // punto uniforme en el elipsoide (Marsaglia)
      let px = 0, py = 0, pz = 0, d2 = 2
      while (d2 > 1 || d2 < 1e-4) {
        px = rnd() * 2 - 1; py = rnd() * 2 - 1; pz = rnd() * 2 - 1
        d2 = px * px + py * py + pz * pz
      }
      const f = Math.cbrt(rnd()) / Math.sqrt(d2)
      x = reg.c[0] + px * f * reg.r[0]
      y = reg.c[1] + py * f * reg.r[1]
      z = reg.c[2] + pz * f * reg.r[2]
    }
    const [hx, hy, hz] = larvaPos(x, y, z)
    out[i * 3] = hx
    out[i * 3 + 1] = hy
    out[i * 3 + 2] = hz
  })
  return out
})()

/** Tinte por grupo (capa de anatomía tenue). */
export const LARVA_GROUP_TINT: Record<string, string> = {
  ORN: '#38bdf8', THc: '#f472b6', THw: '#f472b6', RSP: '#fb7185',
  PR: '#e879f9', GRN: '#fb923c', GNP: '#f59e0b', GUT: '#a78bfa',
  PN: '#22d3ee', mPN: '#0ea5e9', LN: '#67e8f9',
  KC: '#bef264', MBON: '#fde047', MBIN: '#f59e0b', MBF: '#d9f99d', MBFF: '#d9f99d',
  LHN: '#fbbf24', CN: '#e5e7eb', UNK: '#94a3b8',
  DNV: '#f87171', DNS: '#f87171', pDNV: '#fb7185', pDNS: '#fb7185',
  ASC: '#7dd3fc', RGN: '#c084fc',
  MEC: '#a3e635', M23: '#84cc16', PRO: '#4ade80', NOC: '#ef4444',
}

// ───────────────────── andamio neuroanatómico larvario ──────────────────────

/** Tracto/nervio: polilínea en µm + grupos cuya media real lo ilumina. */
export interface LarvaNerve {
  key: string
  ptsUm: [number, number, number][]
  groups: string[]
}

/** Marcador de región/órgano: elipsoide en µm + grupos. */
export interface LarvaMarker {
  key: string
  cUm: [number, number, number]
  rUm: [number, number, number]
  groups: string[]
}

/** Nervios sensoriales cefálicos (órgano → centro). */
export const LARVA_NERVES: LarvaNerve[] = [
  // nervio antenal: órgano dorsal → lóbulo antenal (×2)
  { key: 'antL', ptsUm: [[-24, 23, 6], [0, 8, 22], [12, 0, 26]], groups: ['ORN'] },
  { key: 'antR', ptsUm: [[-24, 23, -6], [0, 8, -22], [12, 0, -26]], groups: ['ORN'] },
  // nervio de Bolwig: órgano de Bolwig → neuropilo óptico larvario (×2)
  { key: 'bolL', ptsUm: [[-20, 10, 16], [16, 2, 24], [50, -6, 27]], groups: ['PR'] },
  { key: 'bolR', ptsUm: [[-20, 10, -16], [16, 2, -24], [50, -6, -27]], groups: ['PR'] },
  // nervio terminal (gusto): órgano terminal → SEZ (×2)
  { key: 'terL', ptsUm: [[-24, -16, 9], [0, -17, 8], [18, -16, 7]], groups: ['GRN'] },
  { key: 'terR', ptsUm: [[-24, -16, -9], [0, -17, -8], [18, -16, -7]], groups: ['GRN'] },
  // nervio faríngeo: órgano faríngeo → SEZ
  { key: 'pha', ptsUm: [[-6, -24, 0], [8, -20, 0], [18, -16, 0]], groups: ['GNP', 'GUT'] },
  // conectivo cervical: cerebro → VNC
  { key: 'cc', ptsUm: [[70, -2, 0], [88, -3, 0], [102, -5, 0]], groups: ['DNV', 'DNS', 'pDNV', 'pDNS'] },
  // pedúnculos del cuerpo fungiforme (×2): cálice → lóbulo vertical / medial
  { key: 'pedL', ptsUm: [[56, 28, 22], [50, 18, 21], [44, 8, 20]], groups: ['KC'] },
  { key: 'pedR', ptsUm: [[56, 28, -22], [50, 18, -21], [44, 8, -20]], groups: ['KC'] },
  { key: 'vlobeL', ptsUm: [[44, 8, 20], [38, 16, 16], [32, 24, 12]], groups: ['MBON', 'MBIN'] },
  { key: 'vlobeR', ptsUm: [[44, 8, -20], [38, 16, -16], [32, 24, -12]], groups: ['MBON', 'MBIN'] },
  { key: 'mlobeL', ptsUm: [[44, 8, 20], [39, 6, 12], [34, 4, 5]], groups: ['MBON', 'MBIN'] },
  { key: 'mlobeR', ptsUm: [[44, 8, -20], [39, 6, -12], [34, 4, -5]], groups: ['MBON', 'MBIN'] },
]

/** Eje del cordón nervioso ventral (neuromeros T1–A8). */
export const LARVA_VNC_AXIS: LarvaNerve = {
  key: 'vnc',
  ptsUm: NEUROMERES.map((nm, i) => [nm.x, -5 - Math.floor(i / 4), 0] as [number, number, number]),
  groups: ['ASC', 'DNV', 'DNS', 'pDNV', 'pDNS'],
}

/** Nervios segmentarios (pared del cuerpo → neuromero), cada 2 neuromeros. */
export const LARVA_SEGMENTALS: LarvaNerve[] = NEUROMERES.filter((_, i) => i % 2 === 0).flatMap((nm) => {
  const seg = nm.x - 6
  return [
    { key: `sgL${seg}`, ptsUm: [[seg, -5, 14], [seg, -12, 28], [seg, -19, 40]] as [number, number, number][], groups: ['MEC', 'M23', 'NOC', 'PRO'] },
    { key: `sgR${seg}`, ptsUm: [[seg, -5, -14], [seg, -12, -28], [seg, -19, -40]] as [number, number, number][], groups: ['MEC', 'M23', 'NOC', 'PRO'] },
  ]
})

/** Marcadores de regiones cerebrales + órganos sensoriales. */
export const LARVA_MARKERS: LarvaMarker[] = [
  // órganos periféricos
  { key: 'do', cUm: [-26, 22, 0], rUm: [12, 8, 8], groups: ['ORN', 'THc', 'THw', 'RSP'] },
  { key: 'boL', cUm: [-20, 10, 16], rUm: [6, 5, 6], groups: ['PR'] },
  { key: 'boR', cUm: [-20, 10, -16], rUm: [6, 5, 6], groups: ['PR'] },
  { key: 'toL', cUm: [-24, -16, 9], rUm: [9, 7, 7], groups: ['GRN'] },
  { key: 'toR', cUm: [-24, -16, -9], rUm: [9, 7, 7], groups: ['GRN'] },
  { key: 'pso', cUm: [-6, -24, 0], rUm: [8, 6, 9], groups: ['GNP', 'GUT'] },
  { key: 'rgn', cUm: [42, 44, 0], rUm: [6, 5, 6], groups: ['RGN'] },
  // neuropilos centrales
  { key: 'alL', cUm: [12, 0, 30], rUm: [14, 8, 12], groups: ['ORN', 'PN', 'mPN', 'LN'] },
  { key: 'alR', cUm: [12, 0, -30], rUm: [14, 8, 12], groups: ['ORN', 'PN', 'mPN', 'LN'] },
  { key: 'calL', cUm: [56, 28, 22], rUm: [11, 8, 9], groups: ['KC'] },
  { key: 'calR', cUm: [56, 28, -22], rUm: [11, 8, 9], groups: ['KC'] },
  { key: 'lhL', cUm: [38, 12, 34], rUm: [10, 7, 8], groups: ['LHN'] },
  { key: 'lhR', cUm: [38, 12, -34], rUm: [10, 7, 8], groups: ['LHN'] },
  { key: 'lonL', cUm: [50, -6, 30], rUm: [9, 6, 7], groups: ['PR'] },
  { key: 'lonR', cUm: [50, -6, -30], rUm: [9, 6, 7], groups: ['PR'] },
  { key: 'sez', cUm: [18, -16, 0], rUm: [14, 8, 17], groups: ['GRN', 'GNP', 'GUT'] },
]

/** Marcadores de neuromeros (elipsoides transversales pequeños). */
export const LARVA_NEUROMERE_MARKERS: LarvaMarker[] = NEUROMERES.map((nm, i) => ({
  key: `nm${i}`,
  cUm: [nm.x, -5 - Math.floor(i / 4), 0],
  rUm: [8, 6, nm.w],
  groups: ['ASC'],
}))

/** Título del holograma larvario. */
export const LARVA_TITLE = 'D. melanogaster · larva'
export const LARVA_SUB = 'conectoma real · 2.956 neuronas (Winding 2023)'

/** Etiquetas con líneas guía (abanico sobre el holograma, como el gusano). */
export const LARVA_CALLOUTS: {
  title: string
  desc: string
  fromUm: [number, number, number]
  toUm: [number, number, number]
}[] = [
  { title: 'ORN', desc: 'olfato (órgano dorsal)', fromUm: [-26, 22, 0], toUm: [-30, 42, 0] },
  { title: 'PR', desc: 'luz (órgano de Bolwig)', fromUm: [-20, 10, 16], toUm: [-40, 28, 16] },
  { title: 'GRN', desc: 'gusto (órgano terminal)', fromUm: [-24, -16, 9], toUm: [-42, -30, 9] },
  { title: 'KC', desc: 'memoria (cálices del MB)', fromUm: [56, 28, 22], toUm: [64, 48, 22] },
  { title: 'MBON', desc: 'salidas del MB', fromUm: [34, 4, 5], toUm: [30, 26, 20] },
  { title: 'LHN', desc: 'innato (cuerno lateral)', fromUm: [38, 12, -34], toUm: [52, -8, -44] },
  { title: 'DNV', desc: 'descendentes', fromUm: [85, -3, 0], toUm: [85, 20, 0] },
  { title: 'ASC', desc: 'ascendentes (VNC)', fromUm: [250, -6, 0], toUm: [250, 16, 0] },
]
