'use client'

// Helpers de voxel (estética Minecraft del cuerpo de la mosca, tomada del
// modelo fly-brain-minecraft con su paleta original de gen_fly_texture.py).

import { forwardRef } from 'react'
import * as THREE from 'three'

/** Paleta original del mod (gen_fly_texture.py). */
export const FLY_PALETTE = {
  TAN: '#c8a165',
  SHADE: '#8b5a2b',
  THORAX: '#b8905a',
  HEAD: '#c39a62',
  BAND: '#2a1e14',
  TIP: '#1a1410',
  EYE: '#b22222',
  EYE_HI: '#e04a2c',
  PROBOSCIS: '#a98555',
  ANTENNA: '#a67f4e',
  HALTERE: '#c9a26b',
  FEMUR: '#6e5236',
  TIBIA: '#553e2a',
  TARSUS: '#423020',
  MEMBRANE: '#dce8f0',
  VEIN: '#6e5a3c',
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
