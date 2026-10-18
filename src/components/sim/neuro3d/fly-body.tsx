'use client'

// Cuerpo voxelar de la mosca (estilo Minecraft): proporciones y paleta
// tomadas del modelo FlyModel.java / gen_fly_texture.py de
// github.com/blendi-remade/fly-brain-minecraft (MIT) — «la mosca de
// Minecraft», reconstruida con cajas Three.js.
//
// El cuerpo sigue al sujeto vivo del mundo: posición, rumbo y aleteo
// según su velocidad; salta cuando el circuito de escape dispara.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Creature } from '@/lib/sim/creature'
import { VoxBox, FLY_PALETTE } from './vox'
import { worldToScene } from './data'

/** Escala: 1 unidad Minecraft → 0.26 unidades de escena. */
const U = 0.26

function Wing({ side }: { side: 1 | -1 }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (!ref.current) return
    const g = ref.current
    // Aleteo: fase rápida cuando vuela/escapa, reposo caído al andar.
    const t = state.clock.elapsedTime
    const flap = Math.sin(t * 46) * 0.85
    g.rotation.x = side * (0.32 + flap * 0.55)
    g.rotation.z = side * -0.12
  })
  return (
    <group
      ref={ref}
      position={[-0.6 * U, 3.2 * U, side * 1.4 * U]}
    >
      {/* Membrana alar (4×14 MC) + vena del borde */}
      <VoxBox
        pos={[0, 0, side * 7 * U]}
        size={[4.2 * U, 0.06, 14 * U]}
        color={FLY_PALETTE.MEMBRANE}
        opacity={0.42}
      />
      <VoxBox
        pos={[1.9 * U, 0, side * 7 * U]}
        size={[0.16, 0.1, 14 * U]}
        color={FLY_PALETTE.VEIN}
        opacity={0.75}
      />
    </group>
  )
}

function Leg({ side, back }: { side: 1 | -1; back: number }) {
  return (
    <group
      position={[(0.8 - back * 2.1) * U, -2.6 * U, side * 2.6 * U]}
      rotation={[0, side * (0.5 + back * 0.32), 0]}
    >
      <VoxBox
        pos={[0, -0.4 * U, side * 2 * U]}
        size={[0.9 * U, 0.9 * U, 4 * U]}
        color={FLY_PALETTE.FEMUR}
      />
      <VoxBox
        pos={[0, -1.7 * U, side * 3.4 * U]}
        size={[0.7 * U, 2 * U, 0.7 * U]}
        color={FLY_PALETTE.TIBIA}
      />
      <VoxBox
        pos={[0, -2.8 * U, side * 3.4 * U]}
        size={[0.55 * U, 1.4 * U, 0.55 * U]}
        color={FLY_PALETTE.TARSUS}
      />
    </group>
  )
}

/**
 * La mosca: tórax 6×6×6, cabeza 4×4×4 con ojos rojos 1×3×3, abdomen
 * 5×5×8 con bandas oscuras + punta negra del macho, 2 alas de membrana,
 * 2 halterios, 6 patas de 3 segmentos y antenas — todas piezas del
 * FlyModel original.
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
    if (!c) {
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
      hop.current.position.y = 0.55 + lift * 1.6 + bob
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={hop}>
        {/* — Tórax (6×6×6) — */}
        <VoxBox pos={[0, 2.4 * U, 0]} size={[6 * U, 6 * U, 6 * U]} color={FLY_PALETTE.THORAX} />
        {/* Franja dorsal del tórax */}
        <VoxBox
          pos={[0, 5.5 * U, 0]}
          size={[6 * U, 0.5 * U, 6 * U]}
          color={FLY_PALETTE.SHADE}
        />
        {/* — Cabeza (4×4×4) + ojos (1×3×3) — */}
        <VoxBox pos={[4.4 * U, 2.9 * U, 0]} size={[4 * U, 4 * U, 4 * U]} color={FLY_PALETTE.HEAD} />
        <VoxBox
          pos={[5.5 * U, 3.1 * U, 2.1 * U]}
          size={[1.4 * U, 3 * U, 3 * U]}
          color={FLY_PALETTE.EYE}
          emissive={FLY_PALETTE.EYE}
          emissiveIntensity={0.25}
        />
        <VoxBox
          pos={[5.5 * U, 3.1 * U, -2.1 * U]}
          size={[1.4 * U, 3 * U, 3 * U]}
          color={FLY_PALETTE.EYE}
          emissive={FLY_PALETTE.EYE}
          emissiveIntensity={0.25}
        />
        {/* Probóscide bajo la cabeza */}
        <VoxBox
          pos={[6.2 * U, 1.4 * U, 0]}
          size={[1 * U, 1.6 * U, 1 * U]}
          color={FLY_PALETTE.PROBOSCIS}
        />
        {/* Antenas + arista */}
        <VoxBox
          pos={[6.5 * U, 4.4 * U, 0.7 * U]}
          size={[1 * U, 1 * U, 1 * U]}
          color={FLY_PALETTE.ANTENNA}
        />
        <VoxBox
          pos={[6.5 * U, 4.4 * U, -0.7 * U]}
          size={[1 * U, 1 * U, 1 * U]}
          color={FLY_PALETTE.ANTENNA}
        />
        <VoxBox
          pos={[7.1 * U, 5.2 * U, 0]}
          size={[0.2 * U, 1.6 * U, 0.2 * U]}
          color={FLY_PALETTE.SHADE}
        />
        {/* — Abdomen (5×5×8) con bandas + punta del macho — */}
        <VoxBox
          pos={[-6.4 * U, 2.5 * U, 0]}
          size={[8 * U, 5 * U, 5 * U]}
          color={FLY_PALETTE.TAN}
        />
        <VoxBox pos={[-4.2 * U, 3.1 * U, 0]} size={[1 * U, 4 * U, 4.6 * U]} color={FLY_PALETTE.BAND} />
        <VoxBox pos={[-6.6 * U, 3.1 * U, 0]} size={[1 * U, 4 * U, 4.6 * U]} color={FLY_PALETTE.BAND} />
        <VoxBox pos={[-9 * U, 3.1 * U, 0]} size={[1 * U, 4 * U, 4.6 * U]} color={FLY_PALETTE.BAND} />
        <VoxBox
          pos={[-11.2 * U, 2.5 * U, 0]}
          size={[2 * U, 3 * U, 3 * U]}
          color={FLY_PALETTE.TIP}
        />
        {/* — Halterios (2×1×1) — */}
        <VoxBox
          pos={[-1.6 * U, 2.2 * U, 2.6 * U]}
          size={[1.6 * U, 0.9 * U, 0.9 * U]}
          color={FLY_PALETTE.HALTERE}
        />
        <VoxBox
          pos={[-1.6 * U, 2.2 * U, -2.6 * U]}
          size={[1.6 * U, 0.9 * U, 0.9 * U]}
          color={FLY_PALETTE.HALTERE}
        />
        {/* — Alas — */}
        <Wing side={1} />
        <Wing side={-1} />
        {/* — 6 patas (3 por lado) — */}
        <Leg side={1} back={0} />
        <Leg side={-1} back={0} />
        <Leg side={1} back={1} />
        <Leg side={-1} back={1} />
        <Leg side={1} back={2} />
        <Leg side={-1} back={2} />
      </group>
    </group>
  )
}
