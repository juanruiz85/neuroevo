'use client'

// Escena 3D del modo «cuerpo y cerebro»: terrario (plato de agar 128×84
// mapeado 1:1 con el mundo simulado), cuerpos voxelares del sujeto,
// holograma cerebral en vivo sobre el plato, comida colocable con clic,
// silueta de depredador (looming) y ondas de los estímulos.

import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { World } from '@/lib/sim/world'
import type { SimApi } from '@/components/sim/use-simulation'
import { FlyBody } from './fly-body'
import { WormBody } from './worm-body'
import { FlyHologram, WormHologram } from './brain-hologram'
import { FLY_PALETTE } from './vox'
import { PX2U, WORLD_H, WORLD_W, sceneToWorld, worldToScene } from './data'
import { useNeuro3D, type Tool3D } from './store'

// ────────────────────────── terrario ────────────────────────────────────────

function agarTexture(): THREE.CanvasTexture {
  const W = 1024, H = 672
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')!
  // agar pálido con vetas
  const grad = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.62)
  grad.addColorStop(0, '#e7dfc6')
  grad.addColorStop(0.75, '#ddd3b4')
  grad.addColorStop(1, '#cfc39e')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // rejilla sutil (unidades del mundo: 64 px = 6.4 unidades)
  g.strokeStyle = 'rgba(120, 100, 60, 0.14)'
  g.lineWidth = 1
  for (let x = 0; x <= W; x += W / 20) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke()
  }
  for (let y = 0; y <= H; y += H / 13) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke()
  }
  // motas
  g.fillStyle = 'rgba(110, 92, 55, 0.10)'
  for (let i = 0; i < 380; i++) {
    const r = 1 + Math.random() * 2.6
    g.beginPath()
    g.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2)
    g.fill()
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.anisotropy = 4
  return tex
}

function Terrarium() {
  const tex = useMemo(() => agarTexture(), [])
  const W = WORLD_W * PX2U
  const H = WORLD_H * PX2U
  return (
    <group>
      {/* agar */}
      <mesh position={[0, -0.9, 0]} receiveShadow>
        <boxGeometry args={[W, 1.8, H]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      {/* paredes de cristal */}
      {[
        { p: [0, 1.6, -H / 2 - 0.25] as const, s: [W + 1, 3.4, 0.5] as const },
        { p: [0, 1.6, H / 2 + 0.25] as const, s: [W + 1, 3.4, 0.5] as const },
        { p: [-W / 2 - 0.25, 1.6, 0] as const, s: [0.5, 3.4, H + 1] as const },
        { p: [W / 2 + 0.25, 1.6, 0] as const, s: [0.5, 3.4, H + 1] as const },
      ].map((w, i) => (
        <mesh key={i} position={w.p as unknown as [number, number, number]}>
          <boxGeometry args={w.s as unknown as [number, number, number]} />
          <meshLambertMaterial color="#a3a3a3" transparent opacity={0.16} />
        </mesh>
      ))}
      {/* mesa oscura */}
      <mesh position={[0, -2.6, 0]}>
        <boxGeometry args={[W + 90, 1.6, H + 90]} />
        <meshLambertMaterial color="#191919" />
      </mesh>
    </group>
  )
}

// ────────────────────────── comida (pools instanciados) ─────────────────────

const FOOD_STYLE: Record<
  string,
  { color: string; size: number; emissive?: string; ei?: number }
> = {
  fruit: { color: '#dc2626', size: 1.5, emissive: '#7f1d1d', ei: 0.35 },
  sugar: { color: '#f5f5f4', size: 0.95, emissive: '#fef3c7', ei: 0.25 },
  detritus: { color: '#78716c', size: 1.1 },
  poison: { color: '#7c3aed', size: 1.35, emissive: '#5b21b6', ei: 0.55 },
  bitter: { color: '#3f6212', size: 1.45, emissive: '#1a2e05', ei: 0.4 },
}

function FoodPool({
  kind,
  pool,
  getWorld,
}: {
  kind: keyof typeof FOOD_STYLE
  pool: number
  getWorld: () => World | null
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }),
    [],
  )
  useFrame((state) => {
    const im = mesh.current
    const w = getWorld()
    if (!im || !w) return
    const st = FOOD_STYLE[kind]
    let n = 0
    for (const f of w.foods) {
      if (f.kind !== kind || n >= pool) continue
      const [x, z] = worldToScene(f.x, f.y)
      const bob = Math.sin(state.clock.elapsedTime * 2 + f.wobble) * 0.08
      tmp.v.set(x, st.size / 2 + 0.05 + bob, z)
      tmp.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.wobble)
      tmp.s.setScalar(st.size)
      tmp.m.compose(tmp.v, tmp.q, tmp.s)
      im.setMatrixAt(n++, tmp.m)
    }
    im.count = n
    im.instanceMatrix.needsUpdate = true
  })
  const st = FOOD_STYLE[kind]
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, pool]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial
        color={st.color}
        emissive={st.emissive ?? '#000000'}
        emissiveIntensity={st.ei ?? 0}
      />
    </instancedMesh>
  )
}

function EggPool({ getWorld }: { getWorld: () => World | null }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }),
    [],
  )
  useFrame((_, dt) => {
    const im = mesh.current
    const w = getWorld()
    if (!im || !w) return
    let n = 0
    const grow = 1 + Math.min(0.4, (dt * 0) || 0)
    for (const e of w.eggs) {
      if (n >= 40) break
      const [x, z] = worldToScene(e.x, e.y)
      tmp.v.set(x, 0.28, z)
      tmp.q.identity()
      tmp.s.setScalar(0.52 * grow)
      tmp.m.compose(tmp.v, tmp.q, tmp.s)
      im.setMatrixAt(n++, tmp.m)
    }
    im.count = n
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 40]} frustumCulled={false}>
      <boxGeometry args={[1, 1.35, 1]} />
      <meshLambertMaterial color="#faf5e6" emissive="#f5f0dc" emissiveIntensity={0.18} />
    </instancedMesh>
  )
}

/** Criaturas que NO son el sujeto: marcadores simples. */
function OthersPool({ getWorld, species }: { getWorld: () => World | null; species: 'fly' | 'worm' }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const sub = useRef<number>(-1)
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), ax: new THREE.Vector3(0, 1, 0) }),
    [],
  )
  useFrame(() => {
    const im = mesh.current
    const w = getWorld()
    if (!im || !w) return
    const sel = w.getSelected()
    if (sub.current !== (sel?.id ?? -1)) {
      sub.current = sel?.id ?? -1
    }
    let n = 0
    for (const c of w.creatures) {
      if (c.species !== species || c.id === sub.current || n >= 90) continue
      const [x, z] = worldToScene(c.x, c.y)
      tmp.v.set(x, species === 'fly' ? 0.62 : 0.3, z)
      tmp.q.setFromAxisAngle(tmp.ax, -c.heading)
      tmp.s.set(species === 'fly' ? 1.15 : 0.55, species === 'fly' ? 0.85 : 0.5, species === 'fly' ? 0.85 : 0.55)
      tmp.m.compose(tmp.v, tmp.q, tmp.s)
      im.setMatrixAt(n++, tmp.m)
    }
    im.count = n
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 90]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshLambertMaterial
        color={species === 'fly' ? FLY_PALETTE.THORAX : '#34d399'}
        transparent
        opacity={0.85}
      />
    </instancedMesh>
  )
}

// ────────────────────────── silueta + ondas de estímulos ────────────────────

/** Silueta de depredador (looming) durante el estímulo «shadow» real. */
function PredatorSilhouette({ getWorld }: { getWorld: () => World | null }) {
  const g = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const w = getWorld()
    const gr = g.current
    const sh = shadow.current
    if (!gr || !sh || !w) return
    const s = w.stimuli.find((x) => x.kind === 'shadow')
    if (!s) {
      gr.visible = false
      sh.visible = false
      return
    }
    const frac = Math.min(1, s.t / s.dur)
    const [x, z] = worldToScene(s.x, s.y)
    // El pájaro se cierne y CRECE (angular size ↑): 0.35 → 1.0
    gr.visible = true
    gr.position.set(x, 24, z)
    const k = 0.35 + 0.9 * frac
    gr.scale.setScalar(k * 7)
    gr.rotation.y = frac * 1.5
    // Sombra proyectada sobre el agar (radio del estímulo real 30→200 px)
    const r = (30 + 170 * frac) * PX2U
    sh.visible = true
    sh.position.set(x, 0.06, z)
    sh.scale.setScalar(r)
    const mat = sh.material as THREE.MeshBasicMaterial
    mat.opacity = 0.14 + 0.34 * frac
  })
  return (
    <>
      <group ref={g} visible={false}>
        {/* silueta de ave estilo voxel: cuerpo + cabeza + alas desplegadas */}
        <mesh>
          <boxGeometry args={[2.4, 0.9, 1]} />
          <meshBasicMaterial color="#0c0a09" />
        </mesh>
        <mesh position={[1.6, 0.25, 0]}>
          <boxGeometry args={[0.9, 0.7, 0.7]} />
          <meshBasicMaterial color="#0c0a09" />
        </mesh>
        <mesh position={[-0.35, 0.25, 2.6]} rotation={[0.22, 0, 0]}>
          <boxGeometry args={[1.4, 0.14, 4.4]} />
          <meshBasicMaterial color="#0c0a09" />
        </mesh>
        <mesh position={[-0.35, 0.25, -2.6]} rotation={[-0.22, 0, 0]}>
          <boxGeometry args={[1.4, 0.14, 4.4]} />
          <meshBasicMaterial color="#0c0a09" />
        </mesh>
        <mesh position={[-1.5, 0.1, 0]}>
          <boxGeometry args={[1.3, 0.16, 0.5]} />
          <meshBasicMaterial color="#0c0a09" />
        </mesh>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} />
      </mesh>
    </>
  )
}

/** Ondas expansivas de tap / chorro / calor / flash. */
function StimRipples({ getWorld }: { getWorld: () => World | null }) {
  const ripples = useRef<THREE.Mesh[]>([])
  const COLORS: Record<string, string> = {
    tap: '#e5e7eb',
    airPuff: '#67e8f9',
    heat: '#fb923c',
    flash: '#fef08a',
  }
  useFrame(() => {
    const w = getWorld()
    if (!w) return
    const act = w.stimuli.filter((s) => s.kind !== 'shadow')
    ripples.current.forEach((m, i) => {
      const s = act[i]
      if (!m) return
      if (!s) {
        m.visible = false
        return
      }
      const frac = Math.min(1, s.t / s.dur)
      m.visible = true
      const [x, z] = worldToScene(s.x, s.y)
      m.position.set(x, 0.08, z)
      m.scale.setScalar(0.5 + frac * (s.kind === 'tap' ? 26 : 14))
      const mat = m.material as THREE.MeshBasicMaterial
      mat.color.set(COLORS[s.kind] ?? '#e5e7eb')
      mat.opacity = 0.5 * (1 - frac)
    })
  })
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => { ripples.current[i] = m! }}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <ringGeometry args={[0.82, 1, 48]} />
          <meshBasicMaterial color="#e5e7eb" transparent opacity={0.4} />
        </mesh>
      ))}
    </>
  )
}

// ────────────────────────── colocación con clic ─────────────────────────────

function Ground({
  getWorld,
}: {
  getWorld: () => World | null
}) {
  const tool = useNeuro3D((s) => s.tool)
  const down = useRef<{ x: number; y: number } | null>(null)
  const [hover, setHover] = useState(false)
  const W = WORLD_W * PX2U
  const H = WORLD_H * PX2U

  const place = (e: ThreeEvent<PointerEvent>) => {
    if (tool === 'none') return
    const d = down.current
    down.current = null
    if (!d) return
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
    if (moved > 7) return // fue arrastre de órbita, no clic
    const [wx, wy] = sceneToWorld(e.point.x, e.point.z)
    const w = getWorld()
    if (!w) return
    if (tool === 'sugar' || tool === 'fruit' || tool === 'bitter') {
      w.addFoodAt(tool, wx, wy)
    } else if (tool === 'shadow' || tool === 'tap' || tool === 'airPuff') {
      w.stimulate(tool, wx, wy)
    }
  }

  return (
    <mesh
      position={[0, 0.02, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY } }}
      onPointerUp={place}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <planeGeometry args={[W, H]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={hover && tool !== 'none' ? 0.07 : 0}
      />
    </mesh>
  )
}

// ────────────────────────── haz sujeto→holograma ────────────────────────────

function Beam({ getWorld }: { getWorld: () => World | null }) {
  const m = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    const w = getWorld()
    const mesh = m.current
    const r = ring.current
    if (!w || !mesh || !r) return
    const c = w.getSelected()
    if (!c) {
      mesh.visible = false
      r.visible = false
      return
    }
    const [x, z] = worldToScene(c.x, c.y)
    mesh.visible = true
    const topY = 26
    const h = topY - 0.5
    mesh.position.set(x, h / 2, z)
    mesh.scale.set(1, h, 1)
    // Anillo de selección sobre el agar, girando despacio.
    r.visible = true
    r.position.set(x, 0.09, z)
    r.rotation.set(-Math.PI / 2, 0, state.clock.elapsedTime * 0.7)
  })
  return (
    <>
      <mesh ref={m} visible={false}>
        <cylinderGeometry args={[0.1, 0.24, 1, 6, 1, true]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.16} />
      </mesh>
      {/* Anillo de sujeto (quién está siendo observado) */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[2.5, 2.9, 40, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.65} side={THREE.DoubleSide} />
      </mesh>
    </>
  )
}

// ────────────────────────── escena ──────────────────────────────────────────

function SceneContent({ sim }: { sim: SimApi }) {
  const getWorld = sim.getWorld
  const getSubject = () => getWorld()?.getSelected() ?? null
  const subject = getWorld()?.getSelected() ?? null
  const isWorm = subject?.species === 'worm'

  return (
    <>
      <color attach="background" args={['#0b0f0e']} />
      <fog attach="fog" args={['#0b0f0e', 190, 420]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[36, 90, 26]} intensity={1.05} color="#fff7e0" />
      <directionalLight position={[-40, 50, -30]} intensity={0.28} color="#9ef0d8" />
      <pointLight position={[0, 40, 0]} intensity={140} distance={90} color="#fbbf24" />

      <Terrarium />
      <Ground getWorld={getWorld} />

      <FoodPool kind="fruit" pool={64} getWorld={getWorld} />
      <FoodPool kind="sugar" pool={40} getWorld={getWorld} />
      <FoodPool kind="detritus" pool={64} getWorld={getWorld} />
      <FoodPool kind="poison" pool={40} getWorld={getWorld} />
      <FoodPool kind="bitter" pool={44} getWorld={getWorld} />
      <EggPool getWorld={getWorld} />
      <OthersPool getWorld={getWorld} species="fly" />
      <OthersPool getWorld={getWorld} species="worm" />

      <FlyBody getSubject={getSubject} />
      <WormBody getSubject={getSubject} />

      <PredatorSilhouette getWorld={getWorld} />
      <StimRipples getWorld={getWorld} />
      <Beam getWorld={getWorld} />

      {/* Holograma flotando sobre el plato, desplazado al fondo.
          El del gusano se inclina ~34° (rotation.y) para que el anillo
          nervioso —⊥ al eje A-P— se vea en escorzo y no de canto. */}
      <group position={[0, 34, 14]} scale={1.12}>
        {isWorm ? (
          <group rotation={[0, 0.6, 0]}>
            <WormHologram getSubject={getSubject} />
          </group>
        ) : (
          <FlyHologram getSubject={getSubject} />
        )}
      </group>

      <OrbitControls
        target={[0, 16, 0]}
        maxPolarAngle={1.42}
        minDistance={26}
        maxDistance={330}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}

export function Neuro3DScene({ sim }: { sim: SimApi }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 78, 108], fov: 42, near: 0.5, far: 900 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      aria-label="Vista 3D del terrario con el cerebro en vivo"
    >
      <SceneContent sim={sim} />
    </Canvas>
  )
}

export type { Tool3D }
