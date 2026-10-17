'use client'

// "Circuito vivo": el flujo sensorial → comando → motor del gusano con el
// conectoma real de C. elegans. Complementa a la vista "Anillo" de
// brain-view.tsx: aquí se ve QUÉ redes se activan al ejecutar una acción.
//
//   Riel de sensores   16 barras en vivo a la izquierda (el canal 0 es
//   (margen izq.)      tónico, de referencia, y no se dibuja aquí)
//   Col A  Sensoriales  30 neuronas reales del subgrafo (ámbar)
//   Col B  Comando      AVA/AVB/PVC/AIB/RIM/RIA con etiqueta (pizarra)
//   Col C  Premotoras   DVA/HSN/RMD con etiqueta (esmeralda)
//   Col D  Pools motor  chips VB/DB · VA/DA · RMD/SM · VC/HSN con tasa
//   Col E  Salidas      Girar · Avanzar · Reproducir
//
// Las aristas son las sinapsis REALES del subgrafo (rosa = inhibitoria,
// verde = excitatoria, punteada = unión en gap). Cuando una neurona
// dispara (s[node.i] === 1 en el último snapshot) sus aristas se iluminan
// y emiten partículas. Los snapshots llegan cada ~220 ms por props; un
// bucle requestAnimationFrame interno interpola destellos, potenciales y
// partículas para lograr una animación fluida entre snapshot y snapshot.

import { useEffect, useMemo, useRef } from 'react'
import {
  CH,
  SENSOR_CHANNELS,
  SENSOR_GROUP_COLOR,
  getElegansCircuit,
  type CircuitViewDef,
} from '@/lib/sim'
import type { CreatureView } from '@/lib/sim/types'

// ——— Constantes visuales ———————————————————————————————————————————————————————

const CANVAS_H = 400
const FLASH_MS = 420 // duración del destello de disparo
const PARTICLE_MS = 420 // viaje de una partícula de a → b
const MAX_PARTICLES = 140
const POT_FULL = 1.3 // potencial de membrana considerado "saturado"

const AMBER = [251, 191, 36] as const // neuronas sensoriales
const SLATE = [148, 163, 184] as const // interneuronas de comando
const EMERALD = [52, 211, 153] as const // premotoras / excitación
const ROSE = [251, 113, 133] as const // inhibición (GABA)
const GOLD = [251, 191, 36] as const // puesta de huevos

const rgba = (c: readonly number[], a: number): string =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`

const SANS = '9px ui-sans-serif, system-ui, sans-serif'
const SANS8 = '8px ui-sans-serif, system-ui, sans-serif'
const SANS_BOLD = 'bold 10px ui-sans-serif, system-ui, sans-serif'
const MONO = '8px ui-monospace, monospace'
const MONO7 = '7px ui-monospace, monospace'

/** Canales con signo (barra centrada: negativo rosa, positivo esmeralda). */
const SIGNED: ReadonlySet<number> = new Set([
  CH.THERMO,
  CH.FOOD_X,
  CH.FOOD_Y,
  CH.POISON_X,
  CH.POISON_Y,
  CH.PROPRIO,
  CH.FOOD_DELTA,
])

// Pools motores dibujados como chips (orden vertical).
const POOLS = [
  { key: 'forward', neurons: 'VB/DB', label: 'Avance', color: EMERALD },
  { key: 'backward', neurons: 'VA/DA', label: 'Reversa', color: ROSE },
  { key: 'head', neurons: 'RMD/SM', label: 'Cabeza', color: AMBER },
  { key: 'egg', neurons: 'VC/HSN', label: 'Puesta', color: GOLD },
] as const
type PoolKey = (typeof POOLS)[number]['key']
const POOL_INDEX: Record<PoolKey, number> = { forward: 0, backward: 1, head: 2, egg: 3 }

// Conectores chips → salidas: [pool, salida, punteado].
// La reversa amplifica el giro (el animal re-orienta al retroceder).
const CONNECTORS: readonly [number, number, boolean][] = [
  [0, 1, false], // VB/DB (avance) → Avanzar
  [1, 0, true], // VA/DA (reversa) → Girar
  [2, 0, false], // RMD/SM (cabeza) → Girar
  [3, 2, false], // VC/HSN (puesta) → Reproducir
]

const OUT_LABELS = ['Girar', 'Avanzar', 'Reproducir'] as const

// ——— Estado conductual en vivo ————————————————————————————————————————————————

interface Behavior {
  label: string
  color: readonly number[]
  expl: string
}

function behaviorOf(c: CreatureView): Behavior {
  const turn = c.outputs[0] ?? 0
  const thrust = c.outputs[1] ?? 0
  const lay = c.outputs[2] ?? 0
  const fwd = c.hidden[3] ?? 0
  const bwd = c.hidden[4] ?? 0
  if (lay > 0.5) return { label: 'PONIENDO HUEVO', color: GOLD, expl: 'HSN+VC → vulva' }
  if (bwd > fwd) return { label: 'REVERSA', color: ROSE, expl: 'ASH/AVA → VA/DA' }
  if (Math.abs(turn) > 0.25) {
    // heading crece en sentido horario (y hacia abajo del canvas): derecha.
    return {
      label: turn > 0 ? 'GIRANDO A LA DERECHA' : 'GIRANDO A LA IZQUIERDA',
      color: AMBER,
      expl: 'RMD/SM dorso-ventral',
    }
  }
  if (thrust > 0.35) return { label: 'AVANZANDO', color: EMERALD, expl: 'AVB/PVC → VB/DB' }
  return { label: 'QUIETO', color: SLATE, expl: 'sin comando dominante' }
}

// ——— Estado de animación (persiste entre renders, muta el bucle rAF) ————————

interface Particle {
  /** Índice de la arista dentro de circuit.edges. */
  e: number
  /** ms transcurridos desde el nacimiento de la partícula. */
  t: number
}

interface AnimState {
  /** ms de destello restantes por nodo del circuito. */
  flash: Float32Array
  /** Potencial mostrado (suavizado exponencial entre snapshots). */
  pot: Float32Array
  potTarget: Float32Array
  /** Ordinal del nodo dentro de su carril (0 sensorial, 1 comando, 2 premotora). */
  laneIdx: Uint16Array
  laneCount: [number, number, number]
  /** Posiciones de dibujo (se recalculan cada frame). */
  px: Float32Array
  py: Float32Array
  particles: Particle[]
  /** Fase del anillo expansivo de puesta (ms, módulo 900). */
  eggPulse: number
}

function createAnim(circuit: CircuitViewDef): AnimState {
  const n = circuit.nodes.length
  const laneCount = [0, 0, 0]
  const laneIdx = new Uint16Array(n)
  circuit.nodes.forEach((nd, k) => {
    laneIdx[k] = laneCount[nd.lane]++
  })
  return {
    flash: new Float32Array(n),
    pot: new Float32Array(n),
    potTarget: new Float32Array(n),
    laneIdx,
    laneCount: laneCount as [number, number, number],
    px: new Float32Array(n),
    py: new Float32Array(n),
    particles: [],
    eggPulse: 0,
  }
}

// ——— Componente ————————————————————————————————————————————————————————————————

export function CircuitView({ creature }: { creature: CreatureView }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const circuit = useMemo(() => getElegansCircuit(), [])
  const animRef = useRef<AnimState | null>(null)
  const creatureRef = useRef(creature)

  // Cada snapshot (~220 ms) fija objetivos y siembra destellos/partículas.
  useEffect(() => {
    creatureRef.current = creature
    if (!animRef.current) animRef.current = createAnim(circuit)
    const st = animRef.current
    const con = creature.connectome
    if (!con) return
    const { nodes, edges } = circuit
    for (let k = 0; k < nodes.length; k++) {
      st.potTarget[k] = con.v[nodes[k].i] ?? 0
      if (con.s[nodes[k].i] === 1) st.flash[k] = FLASH_MS
    }
    // Partículas por las aristas cuya presináptica disparó; si hay más
    // candidatas que huecos en el pool, entran primero las más fuertes.
    const fired: number[] = []
    for (let e = 0; e < edges.length; e++) {
      if (con.s[nodes[edges[e].a].i] === 1) fired.push(e)
    }
    fired.sort((a, b) => Math.abs(edges[b].w) - Math.abs(edges[a].w))
    for (let i = 0; i < fired.length && st.particles.length < MAX_PARTICLES; i++) {
      const e = fired[i]
      // Desfase determinista por arista para que no nazcan todas a la vez.
      const stagger = (((edges[e].a * 31 + edges[e].b * 17) % 7) / 7) * 150
      st.particles.push({ e, t: -stagger })
    }
  }, [creature, circuit])

  // Bucle rAF interno: interpola entre snapshots y redibuja a 60 fps.
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (!animRef.current) animRef.current = createAnim(circuit)
    const st = animRef.current

    let raf = 0
    let last = performance.now()
    const frame = (ts: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(64, ts - last)
      last = ts
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(280, Math.round(parent.clientWidth))
      const pw = Math.round(w * dpr)
      const ph = Math.round(CANVAS_H * dpr)
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw
        canvas.height = ph
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(ctx, w, CANVAS_H, dt, st, creatureRef.current, circuit)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [circuit])

  return (
    <canvas
      ref={ref}
      className="block h-[400px] w-full"
      role="img"
      aria-label="Circuito sensoriomotor en vivo del gusano: sentidos, neuronas de comando, pools motores y salidas"
    />
  )
}

// ——— Dibujo ————————————————————————————————————————————————————————————————————

/** Puntos de control (bézier cúbica con tangentes horizontales). */
function edgeGeom(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): [number, number, number, number] {
  const dx = bx - ax
  // Aristas dentro de la misma columna: pequeño bucle hacia la derecha.
  const bulge = Math.abs(dx) < 8 ? 12 : 0
  return [ax + dx * 0.25 + bulge, ay, ax + dx * 0.75 + bulge, by]
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dt: number,
  st: AnimState,
  c: CreatureView,
  circuit: CircuitViewDef,
): void {
  ctx.clearRect(0, 0, w, h)
  const { nodes, edges, bundles, pools } = circuit

  if (!c.connectome) {
    ctx.font = SANS
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(148, 163, 184, 0.8)'
    ctx.fillText('Sin actividad del conectoma para esta criatura', w / 2, h / 2)
    return
  }

  // — Actualización de la animación —
  const ease = 1 - Math.exp(-dt / 110)
  for (let k = 0; k < nodes.length; k++) {
    st.pot[k] += (st.potTarget[k] - st.pot[k]) * ease
    if (st.flash[k] > 0) st.flash[k] = Math.max(0, st.flash[k] - dt)
  }
  for (let p = st.particles.length - 1; p >= 0; p--) {
    st.particles[p].t += dt
    if (st.particles[p].t >= PARTICLE_MS) {
      st.particles[p] = st.particles[st.particles.length - 1]
      st.particles.pop()
    }
  }
  const laying = (c.outputs[2] ?? 0) > 0.5
  st.eggPulse = laying ? (st.eggPulse + dt) % 900 : 0
  const lit = (k: number): number => st.flash[k] / FLASH_MS

  // — Geometría —
  const railW = Math.round(Math.min(150, Math.max(84, w * 0.3)))
  const x0 = railW + 6
  const compact = w - x0 < 210
  const xA = x0 + 6
  const xB = xA + (compact ? 18 : 24)
  const xC = xB + (compact ? 30 : 40)
  const chipW = compact ? 40 : 46
  const xD = xC + (compact ? 32 : 44)
  const xE = w - (compact ? 22 : 26)
  const top = 24
  const bottom = h - 36
  const areaH = bottom - top
  const nodeY = (lane: number, k: number): number =>
    top + ((k + 0.5) * areaH) / st.laneCount[lane]
  for (let k = 0; k < nodes.length; k++) {
    const nd = nodes[k]
    st.px[k] = nd.lane === 0 ? xA : nd.lane === 1 ? xB : xC
    st.py[k] = nodeY(nd.lane, st.laneIdx[k])
  }
  const chipCY = (i: number): number => top + ((i + 0.5) * areaH) / POOLS.length
  const outY = (o: number): number => top + areaH / 2 + (o - 1) * 44

  // ─ Riel de sensores (16 canales vivos; el 0 es tónico de referencia) ─
  const railRows = SENSOR_CHANNELS.length - 1
  const barX = 7
  const barW = railW - 8 - barX
  for (let i = 1; i < SENSOR_CHANNELS.length; i++) {
    const ch = SENSOR_CHANNELS[i]
    const cy = top + ((i - 0.5) * areaH) / railRows
    const gcol = SENSOR_GROUP_COLOR[ch.group]
    const val = c.inputs[i] ?? 0
    // Punto de color del grupo + etiqueta corta.
    ctx.fillStyle = gcol
    ctx.beginPath()
    ctx.arc(9, cy - 4, 2.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.font = SANS8
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(226, 232, 240, 0.92)'
    ctx.fillText(ch.short, 15, cy - 4)
    ctx.font = MONO7
    ctx.fillStyle = 'rgba(148, 163, 184, 0.62)'
    ctx.fillText(ch.neurons, 15, cy + 3.5)
    // Pista + barra de valor.
    ctx.fillStyle = 'rgba(148, 163, 184, 0.14)'
    ctx.fillRect(barX, cy + 9, barW, 2.5)
    if (SIGNED.has(i)) {
      const mid = barX + barW / 2
      const half = barW / 2
      const mag = Math.min(1, Math.abs(val))
      ctx.fillStyle = val < 0 ? '#fb7185' : '#34d399'
      if (val < 0) ctx.fillRect(mid - mag * half, cy + 9, mag * half, 2.5)
      else ctx.fillRect(mid, cy + 9, mag * half, 2.5)
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
      ctx.fillRect(mid - 0.5, cy + 7.5, 1, 6)
    } else {
      const mag = Math.min(1, Math.max(0, val))
      ctx.fillStyle = gcol
      ctx.fillRect(barX, cy + 9, mag * barW, 2.5)
    }
  }
  // Separador vertical del riel.
  ctx.fillStyle = 'rgba(148, 163, 184, 0.14)'
  ctx.fillRect(railW, top - 8, 1, areaH + 16)

  // ─ Cabeceras de columnas ─
  const header = (txt: string, x: number, align: CanvasTextAlign): void => {
    ctx.font = SANS8
    ctx.textAlign = align
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = 'rgba(148, 163, 184, 0.66)'
    ctx.fillText(txt, x, 15)
  }
  header('SENTIDOS', 8, 'left')
  header(compact ? 'SENS.' : 'SENSORIALES', xA, 'center')
  header(compact ? 'COM.' : 'COMANDO', xB, 'center')
  header(compact ? 'PREMOT.' : 'PREMOTORAS', xC, 'center')
  header('MOTORES', xD + chipW / 2, 'center')
  header('SALIDAS', xE, 'center')

  // ─ Aristas reales del conectoma (quedan bajo los nodos) ─
  for (let e = 0; e < edges.length; e++) {
    const ed = edges[e]
    const ax = st.px[ed.a]
    const ay = st.py[ed.a]
    const bx = st.px[ed.b]
    const by = st.py[ed.b]
    const l = lit(ed.a)
    const nw = Math.min(1, Math.abs(ed.w) / (ed.kind === 'gap' ? 0.18 : 0.55))
    const alpha = 0.05 + 0.09 * nw + l * 0.42
    ctx.strokeStyle = ed.w < 0 ? rgba(ROSE, alpha) : rgba(EMERALD, alpha)
    ctx.lineWidth = 0.6 + nw * 0.5 + l
    if (ed.kind === 'gap') ctx.setLineDash([2, 3])
    const [c1x, c1y, c2x, c2y] = edgeGeom(ax, ay, bx, by)
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, bx, by)
    ctx.stroke()
    if (ed.kind === 'gap') ctx.setLineDash([])
  }

  // ─ Haces comando → pool motor (grosor por peso, brillo por actividad) ─
  for (const bd of bundles) {
    const ax = st.px[bd.from]
    const ay = st.py[bd.from]
    const cy = chipCY(POOL_INDEX[bd.pool])
    const l = lit(bd.from)
    const pot = Math.min(1, st.pot[bd.from] / POT_FULL)
    ctx.strokeStyle = rgba(EMERALD, 0.08 + 0.14 * pot + l * 0.5)
    ctx.lineWidth = 0.7 + Math.min(2.4, bd.w)
    ctx.beginPath()
    ctx.moveTo(ax + 4, ay)
    ctx.bezierCurveTo(
      ax + (xD - ax) * 0.35,
      ay,
      ax + (xD - ax) * 0.7,
      cy,
      xD - 2,
      cy,
    )
    ctx.stroke()
  }

  // ─ Conectores pool → salida (reversa punteada: re-orienta el giro) ─
  for (const [pi, oi, dashed] of CONNECTORS) {
    const ax = xD + chipW
    const ay = chipCY(pi)
    const bx = xE - 7
    const by = outY(oi)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)'
    ctx.lineWidth = 1
    if (dashed) ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.bezierCurveTo(
      ax + (bx - ax) * 0.4,
      ay,
      ax + (bx - ax) * 0.6,
      by,
      bx,
      by,
    )
    ctx.stroke()
    if (dashed) ctx.setLineDash([])
  }

  // ─ Partículas viajando por las sinapsis activas ─
  for (const p of st.particles) {
    if (p.t < 0) continue // aún en desfase de nacimiento
    const ed = edges[p.e]
    const t = p.t / PARTICLE_MS
    const ax = st.px[ed.a]
    const ay = st.py[ed.a]
    const bx = st.px[ed.b]
    const by = st.py[ed.b]
    const [c1x, c1y, c2x, c2y] = edgeGeom(ax, ay, bx, by)
    const u = 1 - t
    const x = u * u * u * ax + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * bx
    const y = u * u * u * ay + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * by
    const alpha = Math.min(1, t * 6, (1 - t) * 4)
    ctx.beginPath()
    ctx.arc(x, y, 1.4 + Math.min(0.9, Math.abs(ed.w) * 1.6), 0, Math.PI * 2)
    ctx.fillStyle = rgba(ed.w < 0 ? ROSE : EMERALD, 0.85 * alpha)
    ctx.fill()
  }

  // ─ Nodos (A sensoriales, B comando, C premotoras) ─
  for (let k = 0; k < nodes.length; k++) {
    const nd = nodes[k]
    const x = st.px[k]
    const y = st.py[k]
    const pot = Math.min(1, st.pot[k] / POT_FULL)
    const l = lit(k)
    const col = nd.lane === 0 ? AMBER : nd.lane === 1 ? SLATE : EMERALD
    const r = nd.lane === 0 ? 2.4 : nd.lane === 1 ? 3 : 3.5
    if (l > 0) {
      // Destello blanco de disparo + halo del color de su clase.
      ctx.beginPath()
      ctx.arc(x, y, r + 4.5, 0, Math.PI * 2)
      ctx.fillStyle = rgba(col, 0.3 * l)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, r * 0.8 + 1.2, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.35 + 0.65 * l).toFixed(3)})`
      ctx.fill()
    } else {
      // Brillo base proporcional al potencial de membrana.
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = rgba(col, 0.4 + pot * 0.6)
      ctx.fill()
    }
    if (nd.lane > 0) {
      ctx.font = MONO7
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = l > 0 ? 'rgba(241, 245, 249, 1)' : 'rgba(203, 213, 225, 0.78)'
      ctx.fillText(nd.n, x + 6, y)
    }
  }

  // ─ Chips de pool motor con su tasa de disparo en vivo ─
  let headHits = 0
  let headN = 0
  for (const gi of pools.headDorsal) {
    headN++
    if (c.connectome.s[gi] === 1) headHits++
  }
  for (const gi of pools.headVentral) {
    headN++
    if (c.connectome.s[gi] === 1) headHits++
  }
  const rates = [
    c.hidden[3] ?? 0, // forward ← tasa de avance
    c.hidden[4] ?? 0, // backward ← tasa de reversa
    headN ? headHits / headN : 0, // head ← % de disparo en RMD/SM
    c.hidden[6] ?? 0, // egg ← tasa de puesta
  ]
  for (let i = 0; i < POOLS.length; i++) {
    const pool = POOLS[i]
    const cy = chipCY(i)
    const rate = Math.min(1, Math.max(0, rates[i]))
    roundRect(ctx, xD, cy - 15, chipW, 30, 6)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.55)'
    ctx.fill()
    ctx.strokeStyle = rgba(pool.color, 0.35 + rate * 0.65)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = MONO7
    ctx.fillStyle = rgba(pool.color, 0.95)
    ctx.fillText(pool.neurons, xD + chipW / 2, cy - 7)
    ctx.font = SANS8
    ctx.fillStyle = 'rgba(203, 213, 225, 0.85)'
    ctx.fillText(pool.label, xD + chipW / 2, cy + 1.5)
    const bw = chipW - 10
    ctx.fillStyle = 'rgba(148, 163, 184, 0.18)'
    ctx.fillRect(xD + 5, cy + 8, bw, 2.5)
    ctx.fillStyle = rgba(pool.color, 0.9)
    ctx.fillRect(xD + 5, cy + 8, rate * bw, 2.5)
  }

  // Anillo expansivo sobre el chip de puesta mientras pone un huevo.
  if (laying) {
    const ph = st.eggPulse / 900
    ctx.beginPath()
    ctx.arc(xD + chipW / 2, chipCY(3), 20 + ph * 16, 0, Math.PI * 2)
    ctx.strokeStyle = rgba(GOLD, (1 - ph) * 0.7)
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // ─ Salidas motoras (Girar · Avanzar · Reproducir) ─
  for (let o = 0; o < OUT_LABELS.length; o++) {
    const v = c.outputs[o] ?? 0
    const y = outY(o)
    const mag = Math.min(1, Math.abs(v))
    const active = o === 2 && laying
    const col = active ? GOLD : v >= 0 ? EMERALD : ROSE
    ctx.beginPath()
    ctx.arc(xE, y, 5, 0, Math.PI * 2)
    ctx.fillStyle = rgba(col, 0.2 + mag * 0.8)
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
    ctx.stroke()
    if (active) {
      ctx.beginPath()
      ctx.arc(xE, y, 8.5, 0, Math.PI * 2)
      ctx.strokeStyle = rgba(GOLD, 0.85)
      ctx.stroke()
    }
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.font = SANS8
    ctx.fillStyle = active ? rgba(GOLD, 1) : 'rgba(203, 213, 225, 0.9)'
    ctx.fillText(OUT_LABELS[o], xE, y + 14)
    ctx.font = MONO7
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
    ctx.fillText(v.toFixed(2), xE, y + 23)
  }

  // ─ Insignia de estado conductual + circuito responsable ─
  const beh = behaviorOf(c)
  ctx.font = SANS_BOLD
  const tw = ctx.measureText(beh.label).width
  ctx.font = SANS8
  const ew = ctx.measureText(beh.expl).width
  const bw = Math.max(tw, ew) + 20
  const bx = x0 + (w - x0 - bw) / 2
  const by = h - 32
  roundRect(ctx, bx, by, bw, 26, 13)
  ctx.fillStyle = rgba(beh.color, 0.12)
  ctx.fill()
  ctx.strokeStyle = rgba(beh.color, 0.5)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = SANS_BOLD
  ctx.fillStyle = rgba(beh.color, 1)
  ctx.fillText(beh.label, bx + bw / 2, by + 8)
  ctx.font = SANS8
  ctx.fillStyle = 'rgba(148, 163, 184, 0.85)'
  ctx.fillText(beh.expl, bx + bw / 2, by + 18.5)
}
