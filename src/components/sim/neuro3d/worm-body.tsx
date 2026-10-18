'use client'

// Cuerpo 3D de C. elegans: cadena de segmentos del propio motor (c.segs,
// los 8 puntos reales del cuerpo ondulante) renderizada como cápsulas
// fusiformes, con las 302 neuronas DENTRO en sus posiciones somáticas
// reales (WormBase Virtual Worm) mapeadas a lo largo de la curva del
// cuerpo y coloreadas por su voltaje LIF en vivo.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Creature } from '@/lib/sim/creature'
import { ELEGANS_NAMES, ELEGANS_CLASSES } from '@/lib/sim/connectome/elegans'
import { WORM_STAGE_SCALE } from '@/lib/sim/types'
import { WORM_3D, wormLocalPos, worldToScene } from './data'
import { activityColor, CLASS_COLORS } from './vox'

/** Longitud renderizada del cuerpo (magnificado para visualización). */
const BODY_LEN = 5.2
const BODY_R = 0.42

const N = ELEGANS_NAMES.length
const Y_AXIS = new THREE.Vector3(0, 1, 0)
/** Colores de clase como THREE.Color (para teñir la rampa de actividad). */
const CLASS_COL = CLASS_COLORS.map((c) => new THREE.Color(c))

// Posición local (recta) por neurona — se dobla después según la curva.
const LOCAL: [number, number, number][] = ELEGANS_NAMES.map((name) => {
  const p = WORM_3D.soma[name] ?? [0, 0, 0]
  const [x, y, z] = wormLocalPos(p[1], p[0], p[2], BODY_LEN, BODY_R)
  return [x, y, z]
})

// Temporales compartidos (una sola instancia del cuerpo montada a la vez).
const TMP = {
  pos: new Float32Array(N * 3),
  col: new Float32Array(N * 3),
  c: new THREE.Color(),
  dir: new THREE.Vector3(),
  curve: [] as THREE.Vector3[],
}

// Geometría de las 300 neuronas (posiciones/colores viven en TMP y se
// suben por frame; el objeto BufferGeometry es un singleton de módulo).
const NEURON_GEO = new THREE.BufferGeometry()
NEURON_GEO.setAttribute('position', new THREE.BufferAttribute(TMP.pos, 3))
NEURON_GEO.setAttribute('color', new THREE.BufferAttribute(TMP.col, 3))

export function WormBody({
  getSubject,
}: {
  getSubject: () => Creature | null
}) {
  const group = useRef<THREE.Group>(null)
  const segMeshes = useRef<(THREE.Mesh | null)[]>([])
  const points = useRef<THREE.Points>(null)
  const geo = NEURON_GEO

  useFrame(() => {
    const c = getSubject()
    const g = group.current
    if (!g) return
    if (!c || c.species !== 'worm') {
      g.visible = false
      return
    }
    g.visible = true
    const [x, z] = worldToScene(c.x, c.y)
    g.position.set(x, BODY_R + 0.25, z)
    g.rotation.y = 0 // la curva ya está en coordenadas del mundo

    // — Curva del cuerpo: segs del motor (cabeza = segs[0]) → curva 3D.
    const segs = c.segs
    const curve = TMP.curve
    curve.length = 0
    for (let i = 0; i < segs.length; i++) {
      const [sx, sz] = worldToScene(segs[i].x, segs[i].y)
      curve.push(new THREE.Vector3(sx, 0, sz))
    }
    // Los 8 segmentos abarcan ~27 px ≈ 2.7 unidades; el cuerpo renderizado
    // es más largo (magnificado): prolongamos la cola con la dirección del
    // último segmento.
    const tail = curve[curve.length - 1]
    const prev = curve[curve.length - 2] ?? tail
    const dir = new THREE.Vector3().subVectors(tail, prev).normalize()
    const stageLen = BODY_LEN * (0.55 + 0.45 * (WORM_STAGE_SCALE[c.stage] ?? 1))
    const segSpan = curve.length > 1 ? curve[0].distanceTo(curve[curve.length - 1]) : 1
    const extra = Math.max(0, stageLen - segSpan)
    for (let i = 1; i <= 3; i++) {
      curve.push(new THREE.Vector3().copy(tail).addScaledVector(dir, (extra * i) / 3))
    }

    // — Cápsulas por segmento (fusiforme), alineadas de a → b.
    const total = curve.length
    for (let i = 0; i < segMeshes.current.length; i++) {
      const m = segMeshes.current[i]
      if (!m) continue
      if (i >= total - 1) {
        m.visible = false
        continue
      }
      m.visible = true
      const a = curve[i]
      const b = curve[i + 1]
      const t = i / (total - 2)
      m.position.set((a.x + b.x) / 2 - x, 0, (a.z + b.z) / 2 - z)
      const d = Math.max(0.08, a.distanceTo(b))
      m.scale.set(1, d, 1) // la cápsula se estira en su eje Y local
      TMP.dir.set(b.x - a.x, 0, b.z - a.z).normalize()
      m.quaternion.setFromUnitVectors(Y_AXIS, TMP.dir)
      void t
    }

    // — Neuronas: posición local recta → proyectada sobre la curva.
    const con = c.brain.connectomeView?.() ?? null
    const pos = TMP.pos
    const col = TMP.col
    const ccol = TMP.c
    // Longitud real de la curva para el mapeo t→arc.
    let arc = 0
    const arcs: number[] = [0]
    for (let i = 1; i < curve.length; i++) {
      arc += curve[i].distanceTo(curve[i - 1])
      arcs.push(arc)
    }
    const head = curve[0]
    for (let i = 0; i < N; i++) {
      const [lx, ly, lz] = LOCAL[i]
      const t = lx / BODY_LEN
      // punto sobre la curva en la fracción t
      const target = t * arc
      let k = 1
      while (k < arcs.length && arcs[k] < target) k++
      const a = curve[k - 1] ?? head
      const b = curve[k] ?? a
      const segA = arcs[k] - arcs[k - 1] || 1
      const f = (target - arcs[k - 1]) / segA
      const px = a.x + (b.x - a.x) * f - x
      const pz = a.z + (b.z - a.z) * f - z
      // perpendicular local (aprox: y/z del sistema recto)
      pos[i * 3] = px
      pos[i * 3 + 1] = ly
      pos[i * 3 + 2] = pz
      // color por voltaje LIF (+ clase de neurona como tinte base)
      if (con) {
        const v = normOrNull(con.v[i])
        const spike = con.s[i] ? 1 : 0
        activityColor(v * 0.85 + spike * 0.15, ccol)
        // tinte sutil por clase (sensorial/inter/motora)
        ccol.lerp(CLASS_COL[ELEGANS_CLASSES[i]], 0.18)
      } else {
        ccol.copy(CLASS_COL[ELEGANS_CLASSES[i]])
      }
      col[i * 3] = ccol.r
      col[i * 3 + 1] = ccol.g
      col[i * 3 + 2] = ccol.b
    }
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true
    if (points.current) {
      const mat = points.current.material as THREE.PointsMaterial
      mat.size = 0.16
    }
  })

  return (
    <group ref={group} visible={false}>
      {/* Cuerpo: 10 cápsulas fusiformes (adelgazan en los extremos) */}
      {Array.from({ length: 10 }, (_, i) => {
        const t = i / 9
        const taper = Math.sin(Math.min(0.94, Math.max(0.06, t)) * Math.PI) ** 0.55
        return (
          <mesh key={i} ref={(m) => { segMeshes.current[i] = m }} visible={false}>
            <capsuleGeometry args={[BODY_R * (0.35 + 0.65 * taper), 1, 3, 8]} />
            <meshLambertMaterial
              color="#10b981"
              emissive="#065f46"
              emissiveIntensity={0.4}
              transparent
              opacity={0.82}
            />
          </mesh>
        )
      })}
      {/* 300 neuronas dentro del cuerpo */}
      <points ref={points} geometry={geo} frustumCulled={false}>
        <pointsMaterial
          size={0.22}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.98}
        />
      </points>
    </group>
  )
}

const normOrNull = (v: number) => Math.min(1, Math.max(0, (v ?? 0) / 1.35))
