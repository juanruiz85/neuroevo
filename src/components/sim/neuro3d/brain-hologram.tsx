'use client'

// Holograma cerebral en vivo (flotando sobre el plato):
//
// · GUSANO: el sistema nervioso completo en su disposición anatómica real
//   (WormBase Virtual Worm). Igual que en el cerebro de la mosca: una capa
//   de anatomía tenue (los 302 somas reales, tenidos por clase) y encima
//   los PUNTOS DE ACTIVIDAD que se encienden con cada voltaje LIF del tick.
//   Las 4.731 sinapsis («las rayas») se sustituyen por el andamio
//   neuroanatómico canónico — anillo nervioso circunfaríngeo + cordón
//   ventral (trazado por los somas motores reales) + cordón dorsal — y
//   cada tracto BRILLA con la actividad media real de las neuronas que lo
//   forman (anillo = ganglios cefálicos; ventral = motoras VA/VB/VD/AS…;
//   dorsal = axones de DA/DB/DD).
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
  WORM_ALL_SOMAS,
  WORM_RING,
  WORM_RING_TRACT,
  WORM_VNC_TRACT,
  WORM_DCC_TRACT,
  wormHoloPos,
  WORM_HOLO_S,
  FLY_LABEL_GROUPS,
  WORM_LABELS,
} from './data'
import { activityColor, seededJitter, CLASS_COLORS } from './vox'
import { useNeuro3D } from './store'
import { ELEGANS_CLASSES } from '@/lib/sim/connectome/elegans'

const tmpColor = new THREE.Color()
const WHITE = new THREE.Color('#ffffff')

// ──── gusano: geometrías de módulo (posiciones estáticas, colores por frame)

const WN = WORM_ALL_SOMAS.length // 302 somas reales

/** Color tenue por clase (sensorial/inter/motora + CAN en gris pizarra). */
const SOMA_TINT: THREE.Color[] = WORM_ALL_SOMAS.map((n) =>
  n.act >= 0
    ? new THREE.Color(CLASS_COLORS[ELEGANS_CLASSES[n.act] ?? 0])
    : new THREE.Color('#94a3b8'), // CANL/CANR: sin sinapsis, solo anatomía
)

const { WORM_PTS_GEO, WORM_ACT_GEO, WORM_ANAT_COL, WORM_ACT_COL } = (() => {
  const pos = new Float32Array(WN * 3)
  const anat = new Float32Array(WN * 3)
  const act = new Float32Array(WN * 3)
  WORM_ALL_SOMAS.forEach((n, i) => {
    const [x, y, z] = wormHoloPos(n.pos[1], n.pos[0], n.pos[2])
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z
  })
  const mk = (col: Float32Array) => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }
  return {
    WORM_PTS_GEO: mk(anat), // capa anatomía
    WORM_ACT_GEO: mk(act), // capa actividad (misma posición, brillo aditivo)
    WORM_ANAT_COL: anat,
    WORM_ACT_COL: act,
  }
})()

/** Geometría de un tracto como pares de segmentos (lineSegments). */
function tractGeo(
  pts: [number, number, number][],
  closed: boolean,
): { geo: THREE.BufferGeometry; col: Float32Array; segs: number } {
  const n = closed ? pts.length : pts.length - 1
  const pos = new Float32Array(n * 6)
  const col = new Float32Array(n * 6)
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const k = i * 6
    pos[k] = a[0]; pos[k + 1] = a[1]; pos[k + 2] = a[2]
    pos[k + 3] = b[0]; pos[k + 4] = b[1]; pos[k + 5] = b[2]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return { geo, col, segs: n }
}

const VNC_GEO = tractGeo(WORM_VNC_TRACT.pts, false)
const DCC_GEO = tractGeo(WORM_DCC_TRACT.pts, false)

// Anillo nervioso: torus fino (las líneas de 1 px se perdían entre la nube
// de somas cefálicos) — un aro 3D con brillo aditivo, en el plano real del
// anillo (⊥ al eje faríngeo inclinado).
const RING_QUAT = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(-0.91, 0.41, 0).normalize(),
)
const RING_CENTER = new THREE.Vector3(
  ...wormHoloPos(WORM_RING.center[1], WORM_RING.center[0], WORM_RING.center[2]),
)
const RING_R = WORM_RING.radiusUm * WORM_HOLO_S

/** Media de voltaje normalizado + fracción de picos de un grupo de índices. */
function groupActivity(
  con: { v: Float32Array | number[]; s: Float32Array | number[] },
  neighbors: number[],
): number {
  if (!neighbors.length) return 0
  let sum = 0
  let spk = 0
  for (const i of neighbors) {
    const a = WORM_ALL_SOMAS[i].act
    if (a < 0) continue
    sum += Math.min(1, (con.v[a] ?? 0) / 1.35)
    if (con.s[a]) spk++
  }
  const mean = sum / neighbors.length
  const frac = spk / neighbors.length
  return Math.min(1, mean * 0.75 + frac * 1.2)
}

/**
 * Gamma de visualización para tractos: la media de un grupo grande (el
 * anillo promedia ~200 neuronas) rara vez supera 0,3 aunque haya actividad
 * real — √t levanta las dinámicas de baja frecuencia para que el tracto
 * sea legible (misma práctica que la ganancia 1,2 de la fracción de picos).
 */
const tractGamma = (t: number) => Math.sqrt(t)

// Etiquetas del gusano con líneas guía: el ganglio cefálico concentra 6
// de las 8 neuronas célebres → se abren en abanico sobre el holograma
// (cabeza a la izquierda).
const WORM_CALLOUTS: { name: string; desc: string; from: [number, number, number]; to: [number, number, number] }[] =
  (() => {
    // offsets en abanico (dx, dy) por índice de etiqueta — hacia arriba y
    // ligeramente hacia la izquierda (donde está la cabeza)
    const FAN: [number, number][] = [
      [-1.0, 3.4], [4.4, 5.2], [-6.0, 5.8], [6.2, 7.6],
      [-7.8, 8.4], [2.2, 9.6], [-3.6, 10.6], [7.6, 11.6],
    ]
    return WORM_LABELS.map(({ name, desc }, i) => {
      const n = WORM_ALL_SOMAS.find((s) => s.name === name)
      const p = n?.pos ?? [0, 0, 0]
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
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const geoPts = WORM_PTS_GEO
  const geoAct = WORM_ACT_GEO

  useFrame(() => {
    const c = getSubject()
    const con = c && c.species === 'worm' ? c.brain.connectomeView?.() ?? null : null
    const anat = WORM_ANAT_COL
    const act = WORM_ACT_COL

    // — capa anatomía: somas tenues (más tenues sin sujeto) —
    const dim = con ? 0.3 : 0.12
    for (let i = 0; i < WN; i++) {
      const t = SOMA_TINT[i]
      anat[i * 3] = t.r * dim
      anat[i * 3 + 1] = t.g * dim
      anat[i * 3 + 2] = t.b * dim
    }
    geoPts.attributes.color.needsUpdate = true

    // — capa actividad: SOLO los puntos que se activan brillan (umbral
    //   por encima del reposo LIF; el resto queda negro/invisible con el
    //   blend aditivo) — igual que el cerebro de la mosca.
    if (!con) {
      act.fill(0)
      geoAct.attributes.color.needsUpdate = true
    } else {
      for (let i = 0; i < WN; i++) {
        const a = WORM_ALL_SOMAS[i].act
        if (a < 0) {
          act[i * 3] = 0; act[i * 3 + 1] = 0; act[i * 3 + 2] = 0
          continue
        }
        const t = Math.min(1, (con.v[a] ?? 0) / 1.35)
        const flash = con.s[a] ? 1 : 0
        const g = Math.min(1, Math.max(0, (t - 0.26) / 0.5))
        if (g <= 0 && !flash) {
          act[i * 3] = 0; act[i * 3 + 1] = 0; act[i * 3 + 2] = 0
          continue
        }
        activityColor(Math.min(1, g * 0.9 + flash * 0.25), tmpColor)
        const b = Math.min(1, g * 0.85 + flash * 0.5)
        act[i * 3] = tmpColor.r * b
        act[i * 3 + 1] = tmpColor.g * b
        act[i * 3 + 2] = tmpColor.b * b
      }
      geoAct.attributes.color.needsUpdate = true
    }

    // — andamio: cada tracto brilla con la actividad media real de las
    //   neuronas que lo forman (anillo = ganglios cefálicos; ventral =
    //   motoras; dorsal = axones DA/DB/DD).
    const paint = (geo: { geo: THREE.BufferGeometry; col: Float32Array; segs: number }, t: number) => {
      const td = tractGamma(t)
      activityColor(td, tmpColor)
      const b = 0.2 + td * 0.85
      const r = tmpColor.r * b, g2 = tmpColor.g * b, b2 = tmpColor.b * b
      const col = geo.col
      for (let k = 0; k < geo.segs; k++) {
        const j = k * 6
        col[j] = r; col[j + 1] = g2; col[j + 2] = b2
        col[j + 3] = r; col[j + 4] = g2; col[j + 5] = b2
      }
      geo.geo.attributes.color.needsUpdate = true
    }
    if (!con) {
      if (ringMat.current) {
        // reposo: aro pálido siempre perceptible (marcador estructural)
        ringMat.current.color.setRGB(0.85, 0.95, 0.92)
      }
      paint(VNC_GEO, 0)
      paint(DCC_GEO, 0)
    } else {
      // anillo: vecinos compartidos → una sola media para todo el aro.
      // Lenguaje visual: la ESTRUCTURA (anillo) es blanquecina y siempre
      // brillante; la ACTIVIDAD de los somas usa la rampa pura.
      if (ringMat.current) {
        const t = tractGamma(groupActivity(con, WORM_RING_TRACT.neighbors[0] ?? []))
        activityColor(t, tmpColor)
        tmpColor.lerp(WHITE, 0.75)
        const b = 0.9 + t * 0.35
        ringMat.current.color.setRGB(tmpColor.r * b, tmpColor.g * b, tmpColor.b * b)
      }
      // cordones: media local por segmento
      for (let k = 0; k < VNC_GEO.segs; k++) {
        const t = tractGamma(groupActivity(con, WORM_VNC_TRACT.neighbors[k] ?? []))
        activityColor(t, tmpColor)
        const b = 0.2 + t * 0.85
        const j = k * 6
        VNC_GEO.col[j] = VNC_GEO.col[j + 3] = tmpColor.r * b
        VNC_GEO.col[j + 1] = VNC_GEO.col[j + 4] = tmpColor.g * b
        VNC_GEO.col[j + 2] = VNC_GEO.col[j + 5] = tmpColor.b * b
      }
      VNC_GEO.geo.attributes.color.needsUpdate = true
      for (let k = 0; k < DCC_GEO.segs; k++) {
        const t = tractGamma(groupActivity(con, WORM_DCC_TRACT.neighbors[k] ?? []))
        activityColor(t, tmpColor)
        const b = 0.2 + t * 0.85
        const j = k * 6
        DCC_GEO.col[j] = DCC_GEO.col[j + 3] = tmpColor.r * b
        DCC_GEO.col[j + 1] = DCC_GEO.col[j + 4] = tmpColor.g * b
        DCC_GEO.col[j + 2] = DCC_GEO.col[j + 5] = tmpColor.b * b
      }
      DCC_GEO.geo.attributes.color.needsUpdate = true
    }
  })

  return (
    <group>
      {/* — anatomía: 302 somas reales, tenues, tenidos por clase — */}
      <points geometry={geoPts} frustumCulled={false}>
        <pointsMaterial size={0.72} vertexColors sizeAttenuation transparent opacity={0.6} depthWrite={false} />
      </points>
      {/* — actividad: los puntos que se encienden brillan (aditivo) — */}
      <points geometry={geoAct} frustumCulled={false}>
        <pointsMaterial
          size={1.45}
          vertexColors
          sizeAttenuation
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
      {/* — andamio neuroanatómico: anillo (torus) + cordones (brillan por tracto) — */}
      <mesh position={RING_CENTER} quaternion={RING_QUAT}>
        <torusGeometry args={[RING_R, 0.17, 10, 84]} />
        <meshBasicMaterial
          ref={ringMat}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <lineSegments geometry={VNC_GEO.geo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={DCC_GEO.geo} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
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
