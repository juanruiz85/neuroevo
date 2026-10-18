'use client'

// Cuerpo voxelar de la mosca — DISEÑO PROPIO de NeuroEvo.
//
// Proporciones y paleta originales de este proyecto, construidas a partir de
// la morfología real de Drosophila melanogaster:
//   · Cabeza dominada por los dos ojos compuestos rojos + triángulo ocelar,
//     antenas con arista y probóscide ventral, unida por un cérvix estrecho.
//   · Tórax ocre con franjas dorsales, quetas (macroquetas dorsocentrales y
//     escutelares) y escutelo elevado trasero.
//   · Abdomen de tergitos que se estrechan hacia la punta negra del macho.
//   · Alas largas que se PLEGAN sobre el abdomen en reposo y baten al volar,
//     con borde costal y venas transversales.
//   · Halterios con pedúnculo y maza; patas de fémur engrosado, tibia y dos
//     tarsones oscuros, con ciclo de caminado.
// No se reutilizan el modelo ni la paleta del mod de Minecraft.
//
// El cuerpo sigue al sujeto vivo del mundo: posición, rumbo y aleteo según
// su velocidad; salta cuando el circuito de escape dispara.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Creature } from '@/lib/sim/creature'
import { VoxBox, FLY_PALETTE } from './vox'
import { worldToScene } from './data'

/** Escala propia del diseño: 1 unidad voxel → 0.27 unidades de escena. */
const U = 0.27

/** Vuelo/escape = velocidad alta; en reposo las alas se pliegan. */
const liftOf = (c: Creature | null) =>
  c ? Math.min(1, Math.max(0, (c.speed - 26) / 50)) : 0

function Wing({ side, getSubject }: { side: 1 | -1; getSubject: () => Creature | null }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const lift = liftOf(getSubject())
    const t = state.clock.elapsedTime
    // batido rápido al volar; en reposo cae plegada sobre el abdomen
    const beat = Math.sin(t * 46) * (0.16 + lift * 0.74)
    g.rotation.x = side * (0.12 + Math.abs(beat) * 0.9)
    g.rotation.y = side * (-0.52 + lift * 0.36) // plegada → extendida
  })
  return (
    <group ref={ref} position={[-1.05 * U, 4.6 * U, side * 1.35 * U]}>
      {/* membrana alar: estrecha y larga, barrida hacia atrás */}
      <VoxBox
        pos={[-2.7 * U, 0, side * 4.7 * U]}
        size={[3.1 * U, 0.06, 9.6 * U]}
        color={FLY_PALETTE.WING_MEMBRANE}
        opacity={0.36}
      />
      {/* borde costal grueso (vena anterior) */}
      <VoxBox
        pos={[-1.32 * U, 0, side * 4.7 * U]}
        size={[0.32 * U, 0.12, 9.6 * U]}
        color={FLY_PALETTE.WING_VEIN}
        opacity={0.82}
      />
      {/* vena transversal (r-m) cerca del ápice */}
      <VoxBox
        pos={[-2.7 * U, 0, side * 9.0 * U]}
        size={[3.1 * U, 0.1, 0.3 * U]}
        color={FLY_PALETTE.WING_CROSS}
        opacity={0.7}
      />
    </group>
  )
}

function Leg({
  side,
  row,
  getSubject,
}: {
  side: 1 | -1
  row: 0 | 1 | 2
  getSubject: () => Creature | null
}) {
  const ref = useRef<THREE.Group>(null)
  // barrido base: par anterior hacia delante, posterior hacia atrás
  const sweep = 0.46 + (row - 1) * 0.52
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const c = getSubject()
    const walk = c ? Math.min(1, c.speed / 42) : 0
    const ph =
      state.clock.elapsedTime * (7 + walk * 9) + row * 1.9 + (side > 0 ? 0 : Math.PI)
    // caminado: vaivén lateral + pequeño realce del paso
    g.rotation.y = side * sweep + Math.sin(ph) * 0.17 * walk
    g.rotation.x = -Math.max(0, Math.sin(ph + Math.PI / 2)) * 0.14 * walk
  })
  return (
    <group ref={ref} position={[(2.2 - row * 2.35) * U, 1.7 * U, side * 1.95 * U]}>
      {/* coxa */}
      <VoxBox pos={[0, 0, side * 0.5 * U]} size={[0.9 * U, 0.9 * U, 1.05 * U]} color={FLY_PALETTE.COXA} />
      {/* fémur engrosado, lateral y hacia abajo */}
      <VoxBox
        pos={[0, -0.55 * U, side * 1.95 * U]}
        size={[0.95 * U, 0.95 * U, 2.7 * U]}
        color={FLY_PALETTE.FEMUR}
      />
      {/* tibia con ligera flexión */}
      <VoxBox
        pos={[0, -1.9 * U, side * 3.05 * U]}
        size={[0.66 * U, 2.5 * U, 0.66 * U]}
        color={FLY_PALETTE.TIBIA}
      />
      {/* tarsones (2) oscuros + pulvilos */}
      <VoxBox pos={[0, -3.25 * U, side * 3.2 * U]} size={[0.5 * U, 1.15 * U, 0.5 * U]} color={FLY_PALETTE.TARSUS} />
      <VoxBox pos={[0, -4.2 * U, side * 3.35 * U]} size={[0.42 * U, 0.8 * U, 0.42 * U]} color={FLY_PALETTE.TARSUS} />
    </group>
  )
}

/**
 * La mosca (diseño propio): cabeza con ojos compuestos dominantes y triángulo
 * ocelar, cérvix, tórax con quetas y escutelo, abdomen taper con punta negra
 * del macho, alas plegables, halterios pedunculados y 6 patas caminantes.
 */
export function FlyBody({
  getSubject,
}: {
  /** Sujeto vivo (o null mientras no hay selección). */
  getSubject: () => Creature | null
}) {
  const group = useRef<THREE.Group>(null)
  const hop = useRef<THREE.Group>(null)

  useFrame((state) => {
    const c = getSubject()
    if (!group.current) return
    // Solo se dibuja sobre una MOSCA: con un gusano (u otro sujeto)
    // seleccionado el cuerpo voxelar debe permanecer oculto (fix: antes
    // se pegaba al gusano y parecía que el gusano tuviera la textura
    // de la mosca).
    if (!c || c.species !== 'fly') {
      group.current.visible = false
      return
    }
    const [x, z] = worldToScene(c.x, c.y)
    group.current.visible = true
    group.current.position.set(x, 0, z)
    group.current.rotation.y = -c.heading
    // Brinco del escape: la mosca se eleva cuando corre a fondo.
    if (hop.current) {
      const lift = Math.max(0, (c.speed - 46) / 60)
      const bob = Math.abs(Math.sin(state.clock.elapsedTime * 22)) * lift
      hop.current.position.y = 0.9 + lift * 1.5 + bob
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={hop}>
        {/* ——————— cabeza (ligeramente inclinada hacia el suelo) ——————— */}
        <group rotation={[0, 0, -0.07]}>
          {/* cápsula cefálica */}
          <VoxBox pos={[6.3 * U, 3.6 * U, 0]} size={[3.2 * U, 3.0 * U, 3.1 * U]} color={FLY_PALETTE.HEAD} />
          {/* ojos compuestos rojos (dominan la cabeza) */}
          <VoxBox
            pos={[7.15 * U, 3.65 * U, 1.52 * U]}
            size={[1.5 * U, 2.5 * U, 2.35 * U]}
            color={FLY_PALETTE.EYE}
            emissive={FLY_PALETTE.EYE}
            emissiveIntensity={0.26}
          />
          <VoxBox
            pos={[7.15 * U, 3.65 * U, -1.52 * U]}
            size={[1.5 * U, 2.5 * U, 2.35 * U]}
            color={FLY_PALETTE.EYE}
            emissive={FLY_PALETTE.EYE}
            emissiveIntensity={0.26}
          />
          {/* brillo de pseudopupila */}
          <VoxBox pos={[7.95 * U, 3.9 * U, 1.75 * U]} size={[0.14 * U, 0.5 * U, 0.5 * U]} color={FLY_PALETTE.EYE_HI} />
          <VoxBox pos={[7.95 * U, 3.9 * U, -1.75 * U]} size={[0.14 * U, 0.5 * U, 0.5 * U]} color={FLY_PALETTE.EYE_HI} />
          {/* triángulo ocelar (3 ocelos dorsales) */}
          <VoxBox pos={[6.1 * U, 5.2 * U, 0]} size={[0.34 * U, 0.2 * U, 0.34 * U]} color={FLY_PALETTE.OCELLUS} />
          <VoxBox pos={[5.8 * U, 5.2 * U, 0.42 * U]} size={[0.34 * U, 0.2 * U, 0.34 * U]} color={FLY_PALETTE.OCELLUS} />
          <VoxBox pos={[5.8 * U, 5.2 * U, -0.42 * U]} size={[0.34 * U, 0.2 * U, 0.34 * U]} color={FLY_PALETTE.OCELLUS} />
          {/* antenas + arista plumosa */}
          <VoxBox pos={[7.6 * U, 2.75 * U, 0.58 * U]} size={[0.62 * U, 0.62 * U, 0.62 * U]} color={FLY_PALETTE.ANTENNA} />
          <VoxBox pos={[7.6 * U, 2.75 * U, -0.58 * U]} size={[0.62 * U, 0.62 * U, 0.62 * U]} color={FLY_PALETTE.ANTENNA} />
          <VoxBox pos={[7.95 * U, 3.5 * U, 0.3 * U]} size={[0.16 * U, 1.0 * U, 0.16 * U]} color={FLY_PALETTE.ARISTA} />
          <VoxBox pos={[7.95 * U, 3.5 * U, -0.3 * U]} size={[0.16 * U, 1.0 * U, 0.16 * U]} color={FLY_PALETTE.ARISTA} />
          {/* probóscide (rostro + haustelo) */}
          <VoxBox pos={[7.45 * U, 1.95 * U, 0]} size={[0.95 * U, 1.35 * U, 1.0 * U]} color={FLY_PALETTE.PROBOSCIS} />
          <VoxBox pos={[7.15 * U, 1.25 * U, 0]} size={[0.7 * U, 0.8 * U, 0.75 * U]} color={FLY_PALETTE.PROBOSCIS} />
        </group>

        {/* ——————— cérvix (cuello) ——————— */}
        <VoxBox pos={[4.75 * U, 3.3 * U, 0]} size={[0.95 * U, 1.35 * U, 1.45 * U]} color={FLY_PALETTE.NECK} />

        {/* ——————— tórax ——————— */}
        {/* pronoto (hombros) */}
        <VoxBox pos={[3.9 * U, 3.4 * U, 0]} size={[1.35 * U, 3.1 * U, 3.2 * U]} color={FLY_PALETTE.PRONOTUM} />
        {/* escudo (escutum) */}
        <VoxBox pos={[1.5 * U, 3.5 * U, 0]} size={[4.6 * U, 3.5 * U, 3.85 * U]} color={FLY_PALETTE.THORAX} />
        {/* franjas dorsales oscuras */}
        <VoxBox pos={[1.5 * U, 5.32 * U, 0.55 * U]} size={[3.4 * U, 0.1 * U, 0.24 * U]} color={FLY_PALETTE.STRIPE} />
        <VoxBox pos={[1.5 * U, 5.32 * U, -0.55 * U]} size={[3.4 * U, 0.1 * U, 0.24 * U]} color={FLY_PALETTE.STRIPE} />
        {/* escutelo (lóbulo trasero elevado) */}
        <VoxBox pos={[-1.15 * U, 3.8 * U, 0]} size={[1.5 * U, 1.05 * U, 2.35 * U]} color={FLY_PALETTE.THORAX} />
        {/* macroquetas dorsocentrales (4) */}
        <VoxBox pos={[2.5 * U, 5.3 * U, 0.85 * U]} size={[0.24 * U, 1.4 * U, 0.24 * U]} color={FLY_PALETTE.BRISTLE} />
        <VoxBox pos={[2.5 * U, 5.3 * U, -0.85 * U]} size={[0.24 * U, 1.4 * U, 0.24 * U]} color={FLY_PALETTE.BRISTLE} />
        <VoxBox pos={[0.6 * U, 5.35 * U, 0.85 * U]} size={[0.24 * U, 1.5 * U, 0.24 * U]} color={FLY_PALETTE.BRISTLE} />
        <VoxBox pos={[0.6 * U, 5.35 * U, -0.85 * U]} size={[0.24 * U, 1.5 * U, 0.24 * U]} color={FLY_PALETTE.BRISTLE} />
        {/* macroquetas escutelares (2) */}
        <VoxBox pos={[-1.55 * U, 4.45 * U, 0.72 * U]} size={[0.22 * U, 1.1 * U, 0.22 * U]} color={FLY_PALETTE.BRISTLE} />
        <VoxBox pos={[-1.55 * U, 4.45 * U, -0.72 * U]} size={[0.22 * U, 1.1 * U, 0.22 * U]} color={FLY_PALETTE.BRISTLE} />

        {/* ——————— abdomen: 4 tergitos decrecientes + punta del macho ——————— */}
        <VoxBox pos={[-2.75 * U, 3.35 * U, 0]} size={[2.2 * U, 3.0 * U, 3.6 * U]} color={FLY_PALETTE.ABDOMEN} />
        <VoxBox pos={[-4.45 * U, 3.3 * U, 0]} size={[2.05 * U, 2.75 * U, 3.3 * U]} color={FLY_PALETTE.ABDOMEN} />
        <VoxBox pos={[-4.45 * U, 3.3 * U, 0]} size={[0.26 * U, 2.45 * U, 2.95 * U]} color={FLY_PALETTE.BAND} />
        <VoxBox pos={[-6.15 * U, 3.2 * U, 0]} size={[1.85 * U, 2.45 * U, 2.95 * U]} color={FLY_PALETTE.ABDOMEN} />
        <VoxBox pos={[-6.15 * U, 3.2 * U, 0]} size={[0.24 * U, 2.15 * U, 2.6 * U]} color={FLY_PALETTE.BAND} />
        <VoxBox pos={[-7.85 * U, 3.05 * U, 0]} size={[1.65 * U, 2.1 * U, 2.55 * U]} color={FLY_PALETTE.ABDOMEN} />
        {/* pigmentación negra del macho (tergitos 5-6 + genitales) */}
        <VoxBox pos={[-9.5 * U, 2.95 * U, 0]} size={[2.0 * U, 1.75 * U, 2.15 * U]} color={FLY_PALETTE.MALE_TIP} />
        <VoxBox pos={[-9.9 * U, 2.0 * U, 0]} size={[1.2 * U, 0.8 * U, 1.3 * U]} color={FLY_PALETTE.MALE_TIP} />

        {/* ——————— halterios: pedúnculo + maza ——————— */}
        <VoxBox pos={[-1.7 * U, 2.95 * U, 2.35 * U]} size={[0.95 * U, 0.26 * U, 0.26 * U]} color={FLY_PALETTE.HALTERE} />
        <VoxBox pos={[-1.7 * U, 2.95 * U, -2.35 * U]} size={[0.95 * U, 0.26 * U, 0.26 * U]} color={FLY_PALETTE.HALTERE} />
        <VoxBox pos={[-2.3 * U, 2.95 * U, 2.35 * U]} size={[0.6 * U, 0.6 * U, 0.6 * U]} color={FLY_PALETTE.HALTERE} />
        <VoxBox pos={[-2.3 * U, 2.95 * U, -2.35 * U]} size={[0.6 * U, 0.6 * U, 0.6 * U]} color={FLY_PALETTE.HALTERE} />

        {/* ——————— alas (plegadas en reposo, baten al volar) ——————— */}
        <Wing side={1} getSubject={getSubject} />
        <Wing side={-1} getSubject={getSubject} />

        {/* ——————— 6 patas caminantes ——————— */}
        <Leg side={1} row={0} getSubject={getSubject} />
        <Leg side={-1} row={0} getSubject={getSubject} />
        <Leg side={1} row={1} getSubject={getSubject} />
        <Leg side={-1} row={1} getSubject={getSubject} />
        <Leg side={1} row={2} getSubject={getSubject} />
        <Leg side={-1} row={2} getSubject={getSubject} />
      </group>
    </group>
  )
}
