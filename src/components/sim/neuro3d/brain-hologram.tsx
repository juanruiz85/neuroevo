'use client'

// Holograma cerebral en vivo (flotando sobre el plato):
//
// · GUSANO: las 302 neuronas en su disposición anatómica real (cabeza a la
//   izquierda) con TODAS sus sinapsis (químicas + gap) como líneas — cada
//   neurona brilla con su voltaje LIF y cada sinapsis presináptica activa
//   destella. Es el «Circuito vivo» del inspector, en 3D y con anatomía.
// · MOSCA: la nube voxelar del CNS ADULTO masculino (141.781 somas reales,
//   Berg 2026, vía fly-brain-minecraft — 15.001 celdas) coloreada por
//   región como el build de bloques; la actividad de los 29 grupos del
//   conectoma LARVARIO (Winding 2023) que simula el motor se proyecta
//   sobre las familias adultas homólogas en sus posiciones reales.

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Creature } from '@/lib/sim/creature'
import { Label3D } from './labels'
import {
  FLY_3D,
  flyHoloPos,
  FLY_GROUP_INDICES,
  WORM_NEURON_POS,
  WORM_EDGES,
  wormHoloPos,
  wormIdx,
  FLY_LABEL_GROUPS,
  WORM_LABELS,
} from './data'
import { activityColor, seededJitter } from './vox'
import { useNeuro3D } from './store'

const tmpColor = new THREE.Color()

// ──── gusano: geometrías de módulo (posiciones estáticas, colores por frame)

const WN = WORM_NEURON_POS.length

const { WORM_PTS_GEO, WORM_LINES_GEO, WORM_PTS_COL, WORM_LINES_COL } = (() => {
  const pos = new Float32Array(WN * 3)
  const pcol = new Float32Array(WN * 3)
  WORM_NEURON_POS.forEach((n, i) => {
    const [x, y, z] = wormHoloPos(n.pos[1], n.pos[0], n.pos[2])
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z
  })
  const gPts = new THREE.BufferGeometry()
  gPts.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  gPts.setAttribute('color', new THREE.BufferAttribute(pcol, 3))

  const lp = new Float32Array(WORM_EDGES.length * 6)
  const lc = new Float32Array(WORM_EDGES.length * 6)
  WORM_EDGES.forEach(([a, b], i) => {
    const pa = WORM_NEURON_POS[a]
    const pb = WORM_NEURON_POS[b]
    const [ax, ay, az] = wormHoloPos(pa.pos[1], pa.pos[0], pa.pos[2])
    const [bx, by, bz] = wormHoloPos(pb.pos[1], pb.pos[0], pb.pos[2])
    lp[i * 6] = ax; lp[i * 6 + 1] = ay; lp[i * 6 + 2] = az
    lp[i * 6 + 3] = bx; lp[i * 6 + 4] = by; lp[i * 6 + 5] = bz
  })
  const gLines = new THREE.BufferGeometry()
  gLines.setAttribute('position', new THREE.BufferAttribute(lp, 3))
  gLines.setAttribute('color', new THREE.BufferAttribute(lc, 3))
  return {
    WORM_PTS_GEO: gPts,
    WORM_LINES_GEO: gLines,
    WORM_PTS_COL: pcol,
    WORM_LINES_COL: lc,
  }
})()

// Etiquetas del gusano con líneas guía: el ganglio cefálico concentra 6
// de las 8 neuronas célebres → se abren en abanico sobre el holograma.
const WORM_CALLOUTS: { name: string; desc: string; from: [number, number, number]; to: [number, number, number] }[] =
  (() => {
    // offsets en abanico (dx, dy) por índice de etiqueta
    const FAN: [number, number][] = [
      [0, 3.4], [4.2, 5.2], [-4.2, 5.8], [6.2, 7.6],
      [-6.2, 8.4], [2.6, 9.6], [-2.4, 10.6], [7.4, 11.6],
    ]
    return WORM_LABELS.map(({ name, desc }, i) => {
      const idx = wormIdx(name)
      const p = idx >= 0 ? WORM_NEURON_POS[idx].pos : [0, 0, 0]
      const from = wormHoloPos(p[1], p[0], p[2])
      const [dx, dy] = FAN[i % FAN.length]
      return {
        name,
        desc,
        from,
        to: [from[0] + dx, from[1] + dy, from[2]] as [number, number, number],
      }
    })
  })()

// Geometría de las líneas guía (una por etiqueta).
const CALLOUT_GEO = (() => {
  const arr = new Float32Array(WORM_CALLOUTS.length * 6)
  WORM_CALLOUTS.forEach((c, i) => {
    arr[i * 6] = c.from[0]; arr[i * 6 + 1] = c.from[1]; arr[i * 6 + 2] = c.from[2]
    arr[i * 6 + 3] = c.to[0]; arr[i * 6 + 4] = c.to[1]; arr[i * 6 + 5] = c.to[2]
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  return g
})()

export function WormHologram({ getSubject }: { getSubject: () => Creature | null }) {
  const labels = useNeuro3D((s) => s.labels)
  const points = useRef<THREE.Points>(null)
  const lines = useRef<THREE.LineSegments>(null)
  const geoPts = WORM_PTS_GEO
  const geoLines = WORM_LINES_GEO

  useFrame(() => {
    const c = getSubject()
    const con = c && c.species === 'worm' ? c.brain.connectomeView?.() ?? null : null
    const pcol = WORM_PTS_COL
    const lcol = WORM_LINES_COL
    if (!con) {
      pcol.fill(0.12)
      lcol.fill(0.02)
      geoPts.attributes.color.needsUpdate = true
      geoLines.attributes.color.needsUpdate = true
      return
    }
    const { v, s } = con
    for (let i = 0; i < WN; i++) {
      const t = Math.min(1, (v[i] ?? 0) / 1.35)
      activityColor(t * 0.9 + (s[i] ? 0.1 : 0), tmpColor)
      pcol[i * 3] = tmpColor.r
      pcol[i * 3 + 1] = tmpColor.g
      pcol[i * 3 + 2] = tmpColor.b
    }
    // Sinapsis activas: la arista brilla cuando la presináptica disparó.
    for (let i = 0; i < WORM_EDGES.length; i++) {
      const [a, b] = WORM_EDGES[i]
      const fire = (s[a] ? 0.9 : 0) + (s[b] ? 0.35 : 0)
      const va = Math.min(1, (v[a] ?? 0) / 1.35)
      const vb = Math.min(1, (v[b] ?? 0) / 1.35)
      const g = Math.min(0.55, fire * 0.5 + va * vb * 0.12)
      lcol[i * 6] = g * 0.55
      lcol[i * 6 + 1] = g
      lcol[i * 6 + 2] = g * 0.6
      lcol[i * 6 + 3] = g * 0.35
      lcol[i * 6 + 4] = g * 0.7
      lcol[i * 6 + 5] = g * 0.45
    }
    geoPts.attributes.color.needsUpdate = true
    geoLines.attributes.color.needsUpdate = true
  })

  return (
    <group>
      <points ref={points} geometry={geoPts} frustumCulled={false}>
        <pointsMaterial size={1.28} vertexColors sizeAttenuation transparent opacity={0.95} />
      </points>
      <lineSegments ref={lines} geometry={geoLines} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.8} />
      </lineSegments>
      {labels && (
        <lineSegments geometry={CALLOUT_GEO}>
          <lineBasicMaterial color="#34d399" transparent opacity={0.28} />
        </lineSegments>
      )}
      {labels &&
        WORM_CALLOUTS.map((c) => (
          <Label3D
            key={c.name}
            position={c.to}
            title={c.name}
            sub={c.desc}
            accent="#6ee7b7"
            width={10.5}
          />
        ))}
    </group>
  )
}

// ────────────────────────── mosca ───────────────────────────────────────────

/** Cuántos puntos de brillo por grupo (proporcional a su tamaño). */
const groupDots = (group: string) => {
  const n = FLY_GROUP_INDICES.get(group)?.length ?? 0
  return Math.max(5, Math.min(22, Math.round(n / 7)))
}

const ANCHOR_DOTS: { group: string; base: [number, number, number]; pts: [number, number, number][] }[] =
  Object.keys(FLY_3D.anchors).map((group, gi) => {
    const a = FLY_3D.anchors[group]
    const [cx, cy, cz] = flyHoloPos(a.posN[0], a.posN[1], a.posN[2])
    const r = Math.max(1.1, (a.rN / 32767) * 29)
    const rnd = seededJitter(77 + gi * 131)
    const k = groupDots(group)
    const pts: [number, number, number][] = []
    for (let i = 0; i < k; i++) {
      // esfera uniforme (Marsaglia)
      let x = 0, y = 0, z = 0, d2 = 2
      while (d2 > 1 || d2 < 1e-4) {
        x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1
        d2 = x * x + y * y + z * z
      }
      const f = r * Math.cbrt(rnd())
      const inv = f / Math.sqrt(d2)
      pts.push([cx + x * inv, cy + y * inv * 0.75, cz + z * inv])
    }
    return { group, base: [cx, cy, cz] as [number, number, number], pts }
  })

const TOTAL_DOTS = ANCHOR_DOTS.reduce((s, g) => s + g.pts.length, 0)

// Geometría de los puntos de actividad por grupo (módulo).
const FLY_DOTS_GEO = (() => {
  const col = new Float32Array(TOTAL_DOTS * 3)
  const pos = new Float32Array(TOTAL_DOTS * 3)
  let k = 0
  for (const g of ANCHOR_DOTS) {
    for (const p of g.pts) {
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = p[2]
      k++
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
})()
const FLY_DOTS_COL = FLY_DOTS_GEO.attributes.color.array as Float32Array

// Rellena la nube voxel estática del CNS adulto (una vez por mesh).
function setCloudColors(mesh: THREE.InstancedMesh): void {
  const palette = FLY_3D.classes.map((c) => new THREE.Color(c.color))
  const m = new THREE.Matrix4()
  for (let i = 0; i < FLY_3D.n; i++) {
    const xn = FLY_3D.pos[i * 3], yn = FLY_3D.pos[i * 3 + 1], zn = FLY_3D.pos[i * 3 + 2]
    const [x, y, z] = flyHoloPos(xn, yn, zn)
    m.makeTranslation(x, y, z)
    mesh.setMatrixAt(i, m)
    mesh.setColorAt(i, palette[FLY_3D.cls[i]] ?? palette[0])
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

export function FlyHologram({ getSubject }: { getSubject: () => Creature | null }) {
  const labels = useNeuro3D((s) => s.labels)
  const inst = useRef<THREE.InstancedMesh>(null)
  const dots = useRef<THREE.Points>(null)
  const geo = FLY_DOTS_GEO

  useFrame(() => {
    const c = getSubject()
    const con = c && c.species === 'fly' && c.brain.kind === 'drosophila'
      ? c.brain.connectomeView?.() ?? null
      : null
    const col = FLY_DOTS_COL
    if (!con) {
      col.fill(0.07)
      geo.attributes.color.needsUpdate = true
      return
    }
    const { v, s } = con
    let k = 0
    for (const g of ANCHOR_DOTS) {
      const idxs = FLY_GROUP_INDICES.get(g.group) ?? []
      let sum = 0
      let spk = 0
      for (const i of idxs) {
        sum += Math.min(1, (v[i] ?? 0) / 1.35)
        if (s[i]) spk++
      }
      const mean = idxs.length ? sum / idxs.length : 0
      const frac = idxs.length ? spk / idxs.length : 0
      const t = Math.min(1, mean * 0.75 + frac * 1.2)
      activityColor(t, tmpColor)
      for (let j = 0; j < g.pts.length; j++, k++) {
        col[k * 3] = tmpColor.r
        col[k * 3 + 1] = tmpColor.g
        col[k * 3 + 2] = tmpColor.b
      }
    }
    geo.attributes.color.needsUpdate = true
    void dots
  })

  return (
    <group>
      {/* Nube anatómica del CNS adulto (15.001 vóxeles) */}
      <instancedMesh
        ref={inst}
        args={[undefined, undefined, FLY_3D.n]}
        frustumCulled={false}
        onUpdate={(m) => {
          if (!m.userData.cloudReady) {
            setCloudColors(m)
            m.userData.cloudReady = true
          }
        }}
      >
        <boxGeometry args={[0.52, 0.52, 0.52]} />
        <meshLambertMaterial />
      </instancedMesh>
      {/* Actividad de los 29 grupos larvarios proyectada sobre el adulto */}
      <points ref={dots} geometry={geo} frustumCulled={false}>
        <pointsMaterial size={0.78} vertexColors sizeAttenuation transparent opacity={0.9} />
      </points>
      {labels &&
        FLY_LABEL_GROUPS.map((g) => {
          const a = FLY_3D.anchors[g]
          const [x, y, z] = flyHoloPos(a.posN[0], a.posN[1], a.posN[2])
          return (
            <Label3D
              key={g}
              position={[x, y + 3.2, z]}
              title={g}
              sub={a.family.split(' (')[0]}
              accent="#fcd34d"
              width={11}
            />
          )
        })}
    </group>
  )
}
