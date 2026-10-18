'use client'

// Helpers de voxel del modo 3D.
//
// FLY_PALETTE: paleta PROPIA de NeuroEvo, elegida a partir de la
// pigmentación real de Drosophila melanogaster (cutícula ocre-amarillenta,
// ojos compuestos rojo ladrillo, bandas tergales oscuras, punta abdominal
// negra del macho, quetas casi negras). No se reutilizan la paleta ni el
// modelo del mod de Minecraft.

import { forwardRef } from 'react'
import * as THREE from 'three'

/** Paleta propia del diseño voxelar de la mosca (D. melanogaster real). */
export const FLY_PALETTE = {
  // cutícula
  THORAX: '#c2a066', // escudo torácico ocre
  PRONOTUM: '#b08e56', // lóbulo pronotal anterior
  NECK: '#a3855a', // cérvix
  HEAD: '#b99a63', // cápsula cefálica
  STRIPE: '#5d4423', // franjas dorsales del tórax
  BRISTLE: '#1e1409', // quetas (macroquetas dorsocentrales/escutelares)
  // abdomen
  ABDOMEN: '#ab8a52', // tergitos
  BAND: '#3a2a16', // banda posterior de cada tergito
  MALE_TIP: '#171008', // pigmentación negra del extremo del macho
  // cabeza
  EYE: '#b23227', // ojos compuestos rojo ladrillo
  EYE_HI: '#d95b3a', // brillo pseudopupila
  OCELLUS: '#3a2417', // triángulo ocelar
  ANTENNA: '#6d5233', // antenas
  ARISTA: '#2e2113', // arista plumosa
  PROBOSCIS: '#8a6a44', // probóscide
  // alas + halterios
  WING_MEMBRANE: '#efe8da', // membrana alar translúcida
  WING_VEIN: '#7a6238', // borde costal + venas
  WING_CROSS: '#8d7448', // venas transversales
  HALTERE: '#c8ad7a', // halterios (pedúnculo + maza)
  // patas
  COXA: '#7a5f3c',
  FEMUR: '#6d5433',
  TIBIA: '#584128',
  TARSUS: '#33251a',
} as const

/**
 * Caja voxel con esquinas duras (sombreado plano estilo Minecraft).
 * pos = centro; size = dimensiones completas.
 */
export const VoxBox = forwardRef<
  THREE.Mesh,
  {
    pos: [number, number, number]
    size: [number, number, number]
    color: string
    opacity?: number
    emissive?: string
    emissiveIntensity?: number
  }
>(function VoxBox(
  { pos, size, color, opacity = 1, emissive, emissiveIntensity = 0 },
  ref,
) {
  return (
    <mesh ref={ref} position={pos}>
      <boxGeometry args={size} />
      <meshLambertMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={emissive ?? '#000000'}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
})

/** Color por clase de neurona (gusano: sensorial/inter/motora). */
export const CLASS_COLORS = ['#2dd4bf', '#fbbf24', '#fb7185'] as const

/**
 * Rampa de actividad LIF [0..~2] → color: reposo gris-azulado → activa
 * ámbar → pico blanco. Última parte del rango se reserva para el destello
 * de pico (s=1).
 */
const RAMP_STOPS: [number, THREE.Color][] = [
  [0.0, new THREE.Color('#374151')],
  [0.25, new THREE.Color('#0d9488')],
  [0.55, new THREE.Color('#f59e0b')],
  [0.85, new THREE.Color('#fde68a')],
  [1.0, new THREE.Color('#ffffff')],
]
const RAMP_LEN = RAMP_STOPS.length - 1

export function activityColor(t: number, out: THREE.Color): THREE.Color {
  const x = Math.min(1, Math.max(0, t))
  const seg = Math.min(RAMP_LEN - 1, Math.floor(x * RAMP_LEN))
  const f = x * RAMP_LEN - seg
  return out.copy(RAMP_STOPS[seg][1]).lerp(RAMP_STOPS[seg + 1][1], f)
}

/** RNG determinista barato para jitter reproducible de los anclajes. */
export function seededJitter(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    // mulberry32 (misma familia que el RNG del motor)
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Normaliza V del conectoma a [0,1] (los voltajes LIF viven en [0, ~2]). */
export const normV = (v: number) => Math.min(1, Math.max(0, v / 1.35))
