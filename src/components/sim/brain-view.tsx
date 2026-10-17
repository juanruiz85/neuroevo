'use client'

// Visualización en vivo del cerebro de la criatura seleccionada.
//  · Moscas ANN (control): 12 sensores → 8 ocultas → 3 motores.
//  · Gusanos (C. elegans): conectoma real — "Circuito vivo" y "Anillo".
//  · Moscas (Drosophila, Fase 2): conectoma real del cerebro larvario
//    (2.956 neuronas, Winding 2023) — "Anillo" con sus 41.977 sinapsis.

import { useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CircuitView } from '@/components/sim/circuit-view'
import {
  ELEGANS_CLASSES,
  ELEGANS_INFO,
  ELEGANS_NAMES,
  INPUT_LABELS,
  NN_H,
  NN_IN,
  NN_OUT,
  OUTPUT_LABELS,
} from '@/lib/sim'
import {
  DROSOPHILA_CLASSES,
  DROSOPHILA_NAMES,
} from '@/lib/sim/connectome/drosophila'
import type { CreatureView } from '@/lib/sim/types'

export function BrainView({ creature }: { creature: CreatureView }) {
  const [view, setView] = useState('circuito')
  const isElegans = creature.brainKind === 'elegans' && creature.connectome != null
  const isDrosophila = creature.brainKind === 'drosophila' && creature.connectome != null

  // Las moscas ANN mantienen su vista clásica; los gusanos ganan dos
  // vistas; las moscas Drosophila (conectoma real de 2.956) muestran su
  // anillo propio.
  if (!isElegans && !isDrosophila) return <AnnCanvas creature={creature} />
  if (isDrosophila) {
    return (
      <FlyRingCanvas creature={creature} />
    )
  }

  return (
    <Tabs value={view} onValueChange={setView} className="w-full">
      <TabsList className="grid h-8 w-full grid-cols-2">
        <TabsTrigger value="circuito" className="text-[11px]">
          Circuito vivo
        </TabsTrigger>
        <TabsTrigger value="anillo" className="text-[11px]">
          Anillo
        </TabsTrigger>
      </TabsList>
      <TabsContent value="circuito" className="mt-2">
        <CircuitView creature={creature} />
      </TabsContent>
      <TabsContent value="anillo" className="mt-2">
        <RingCanvas creature={creature} />
      </TabsContent>
    </Tabs>
  )
}

// Canvas de la ANN 12→8→3 (moscas). Redibuja en cada snapshot (~220 ms).
function AnnCanvas({ creature }: { creature: CreatureView }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(200, Math.round(parent.clientWidth))
    const h = 340
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawAnn(ctx, w, h, dpr, creature)
  })

  return (
    <canvas
      ref={ref}
      className="block h-[340px] w-full"
      aria-label="Actividad neuronal de la criatura en tiempo real"
    />
  )
}

// Canvas del anillo del conectoma DROSOPHILA (2.956 neuronas, Fase 2).
function FlyRingCanvas({ creature }: { creature: CreatureView }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(200, Math.round(parent.clientWidth))
    const h = 340
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawConnectomeRing(ctx, w, h, dpr, creature, 'drosophila')
  })

  return (
    <canvas
      ref={ref}
      className="block h-[340px] w-full"
      aria-label="Conectoma de Drosophila en tiempo real"
    />
  )
}

// Canvas del anillo del conectoma (vista clásica de los gusanos).
function RingCanvas({ creature }: { creature: CreatureView }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(200, Math.round(parent.clientWidth))
    const h = 340
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawConnectomeRing(ctx, w, h, dpr, creature, 'elegans')
  })

  return (
    <canvas
      ref={ref}
      className="block h-[340px] w-full"
      aria-label="Conectoma de C. elegans en tiempo real"
    />
  )
}

// ─── Vista ANN (moscas) ───────────────────────────────────────────────────────

function drawAnn(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  c: CreatureView,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const padX = 88
  const padY = 12
  const colX = [padX, w / 2, w - padX]
  const nodeY = (i: number, n: number) =>
    padY + ((i + 0.5) * (h - 2 * padY)) / n

  const wt = c.weights
  const off2 = NN_IN * NN_H + NN_H

  // Aristas sensores -> ocultas
  for (let i = 0; i < NN_IN; i++) {
    for (let hh = 0; hh < NN_H; hh++) {
      const wgt = wt[i * NN_H + hh] ?? 0
      const act = c.inputs[i] ?? 0
      const a = Math.min(0.75, Math.abs(wgt * act) * 0.7 + 0.02)
      if (a < 0.03) continue
      ctx.strokeStyle =
        wgt > 0
          ? `rgba(52, 211, 153, ${a.toFixed(3)})`
          : `rgba(251, 113, 133, ${a.toFixed(3)})`
      ctx.lineWidth = Math.min(2.6, 0.35 + Math.abs(wgt) * 0.5)
      ctx.beginPath()
      ctx.moveTo(colX[0], nodeY(i, NN_IN))
      ctx.lineTo(colX[1], nodeY(hh, NN_H))
      ctx.stroke()
    }
  }

  // Aristas ocultas -> motores
  for (let hh = 0; hh < NN_H; hh++) {
    for (let o = 0; o < NN_OUT; o++) {
      const wgt = wt[off2 + hh * NN_OUT + o] ?? 0
      const act = c.hidden[hh] ?? 0
      const a = Math.min(0.8, Math.abs(wgt * act) * 0.75 + 0.025)
      if (a < 0.03) continue
      ctx.strokeStyle =
        wgt > 0
          ? `rgba(52, 211, 153, ${a.toFixed(3)})`
          : `rgba(251, 113, 133, ${a.toFixed(3)})`
      ctx.lineWidth = Math.min(2.8, 0.4 + Math.abs(wgt) * 0.5)
      ctx.beginPath()
      ctx.moveTo(colX[1], nodeY(hh, NN_H))
      ctx.lineTo(colX[2], nodeY(o, NN_OUT))
      ctx.stroke()
    }
  }

  // Etiquetas de sensores
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
  for (let i = 0; i < NN_IN; i++) {
    ctx.fillText(INPUT_LABELS[i], colX[0] - 9, nodeY(i, NN_IN))
  }

  // Nodos sensores
  for (let i = 0; i < NN_IN; i++) {
    drawNode(ctx, colX[0], nodeY(i, NN_IN), 4, c.inputs[i] ?? 0, false)
  }

  // Nodos ocultos
  for (let hh = 0; hh < NN_H; hh++) {
    drawNode(ctx, colX[1], nodeY(hh, NN_H), 5.5, c.hidden[hh] ?? 0, false)
  }

  // Nodos de salida + etiquetas con valor
  ctx.textAlign = 'left'
  for (let o = 0; o < NN_OUT; o++) {
    const v = c.outputs[o] ?? 0
    const reproducing = o === 2 && v > 0.55
    drawNode(ctx, colX[2], nodeY(o, NN_OUT), 7, v, reproducing)
    ctx.fillStyle = reproducing
      ? 'rgba(251, 191, 36, 1)'
      : 'rgba(148, 163, 184, 0.95)'
    ctx.fillText(
      `${OUTPUT_LABELS[o]} ${v.toFixed(2)}`,
      colX[2] + 11,
      nodeY(o, NN_OUT),
    )
  }
}

function drawNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  act: number,
  ring: boolean,
): void {
  const mag = Math.min(1, Math.abs(act))
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle =
    act >= 0
      ? `rgba(52, 211, 153, ${(0.14 + mag * 0.86).toFixed(3)})`
      : `rgba(251, 113, 133, ${(0.14 + mag * 0.86).toFixed(3)})`
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
  ctx.stroke()
  if (ring) {
    ctx.beginPath()
    ctx.arc(x, y, r + 3.5, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)'
    ctx.stroke()
  }
}

// ─── Vista conectoma (gusanos · C. elegans) ───────────────────────────────────

// Colores por clase: sensorial ámbar, interneurona pizarra, motoneurona esmeralda.
const CLASS_COLOR = [
  [251, 191, 36], // 0 sensorial — ámbar
  [148, 163, 184], // 1 interneurona — pizarra
  [52, 211, 153], // 2 motoneurona — esmeralda
] as const

const CLASS_LABEL = ['Sensoriales', 'Interneuronas', 'Motoras'] as const

// Neuronas etiquetadas por su papel en el mapeo sensorial/motor.
const KEY_NEURONS = new Set([
  'AFDL', 'AFDR', 'ASEL', 'ASER', 'ASHL', 'ASHR', 'AWCL', 'AWCR', 'AWAL',
  'AWAR', 'BAGL', 'BAGR', 'PVDL', 'PVDR', 'PHAL', 'PHAR', 'ADFL', 'ADFR',
  'AVBL', 'AVBR', 'AVAL', 'AVAR', 'VB01', 'VB06', 'VA01', 'VA06', 'VC03',
  'HSNL', 'RMDDL', 'RMDVL',
])

// ─── Anillo parametrizado por conectoma (elegans | drosophila) ─────────────
// El mismo algoritmo de sectores por clase para los dos cerebros reales.

interface RingDataset {
  names: string[]
  classes: (0 | 1 | 2)[]
  keyNeurons: Set<string>
  credit: string
  /** Radio del punto (los cerebros grandes usan puntos menores). */
  dot: number
}

/** Claves Drosophila: el primer nombre de cada familia funcional. */
const FLY_KEY_NEURONS: Set<string> = (() => {
  const prefixes = [
    'ORN', 'GRN', 'GNP', 'PR-', 'NOC', 'THc', 'THw', 'MEC', 'PRO', 'RSP',
    'GUT', 'DNV', 'DNS', 'PN-', 'MBON',
  ]
  const out = new Set<string>()
  for (const pre of prefixes) {
    const found = DROSOPHILA_NAMES.find((n) => n.startsWith(pre))
    if (found) out.add(found)
  }
  return out
})()

const RING_DATASETS: Record<'elegans' | 'drosophila', RingDataset> = {
  elegans: {
    names: ELEGANS_NAMES,
    classes: ELEGANS_CLASSES,
    keyNeurons: KEY_NEURONS,
    credit: `${ELEGANS_INFO.chemical + ELEGANS_INFO.gapJunctions} sinapsis · OpenWorm`,
    dot: 2.5,
  },
  drosophila: {
    names: DROSOPHILA_NAMES,
    classes: DROSOPHILA_CLASSES,
    keyNeurons: FLY_KEY_NEURONS,
    credit: '41.977 sinapsis · Winding 2023',
    dot: 1.5,
  },
}

// Ángulo de cada neurona: tres sectores contiguos por clase (rad), por kind.
const NEURON_ANGLES = new Map<'elegans' | 'drosophila', number[]>()
function neuronAngles(kind: 'elegans' | 'drosophila'): number[] {
  let angles = NEURON_ANGLES.get(kind)
  if (angles) return angles
  const { names, classes } = RING_DATASETS[kind]
  const byClass: number[][] = [[], [], []]
  names.forEach((_, i) => byClass[classes[i]].push(i))
  const sectorStart = [-Math.PI * (165 / 180), -Math.PI * (25 / 180), Math.PI * (100 / 180)]
  const sectorWidth = [Math.PI * (150 / 180), Math.PI * (110 / 180), Math.PI * (100 / 180)]
  angles = new Array<number>(names.length)
  for (let cls = 0; cls < 3; cls++) {
    const list = byClass[cls]
    list.forEach((neuronIdx, k) => {
      const t = list.length === 1 ? 0.5 : k / (list.length - 1)
      angles[neuronIdx] = sectorStart[cls] + t * sectorWidth[cls]
    })
  }
  NEURON_ANGLES.set(kind, angles)
  return angles
}

function drawConnectomeRing(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  c: CreatureView,
  kind: 'elegans' | 'drosophila',
): void {
  const DATA = RING_DATASETS[kind]
  const NAMES = DATA.names
  const CLASSES = DATA.classes
  const ANGLES = neuronAngles(kind)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const con = c.connectome!
  const v = con.v
  const s = con.s
  const n = NAMES.length

  // Composición: anillo de neuronas a la izquierda, salidas motoras a la derecha.
  // outX deja ~92 px a la derecha para la etiqueta más ancha ("Reproducir 1.00").
  const outX = w - 92
  const cx = Math.max(70, (w - 118) / 2)
  const cy = h / 2 - 6
  const R = Math.max(46, Math.min(cx - 24, h / 2 - 40))

  // Neuronas
  const dot = DATA.dot
  for (let i = 0; i < n; i++) {
    const ang = ANGLES[i] ?? 0
    const x = cx + Math.cos(ang) * R
    const y = cy + Math.sin(ang) * R
    const [r, g, b] = CLASS_COLOR[CLASSES[i]]
    const pot = Math.min(1, (v[i] ?? 0) / 1.4) // potencial normalizado
    // Brillo base alto: en reposo la mayoría de neuronas están sub-umbral
    // y con alfa bajo serían invisibles; el potencial añade el brillo extra.
    const alpha = 0.45 + pot * 0.55
    if (s[i]) {
      // Pico: destello blanco + halo del color de su clase.
      ctx.beginPath()
      ctx.arc(x, y, dot + 4, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.32)`
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, Math.max(2.4, dot), 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, dot, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`
      ctx.fill()
    }
  }

  // Etiquetas de sectores y de neuronas clave.
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  const sectorAnchor: Record<number, number> = { 0: -Math.PI / 2, 1: Math.PI * (30 / 180), 2: Math.PI * (150 / 180) }
  for (let cls = 0; cls < 3; cls++) {
    const ang = sectorAnchor[cls]
    const x = cx + Math.cos(ang) * (R + 20)
    const y = cy + Math.sin(ang) * (R + 20)
    const [r, g, b] = CLASS_COLOR[cls]
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.92)`
    ctx.textAlign = 'center'
    ctx.fillText(CLASS_LABEL[cls], x, y)
  }
  ctx.font = '8px ui-monospace, monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(203, 213, 225, 0.75)'
  for (let i = 0; i < n; i++) {
    const name = NAMES[i]
    if (!DATA.keyNeurons.has(name)) continue
    const ang = ANGLES[i] ?? 0
    const x = cx + Math.cos(ang) * (R - 13)
    const y = cy + Math.sin(ang) * (R - 13)
    if (s[i]) {
      const [r, g, b] = CLASS_COLOR[CLASSES[i]]
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 1)`
    }
    ctx.fillText(name, x, y)
    if (s[i]) ctx.fillStyle = 'rgba(203, 213, 225, 0.75)'
  }

  // Picos por tick + resumen de sinapsis.
  const spikes = s.reduce((a, x) => a + (x === 1 ? 1 : 0), 0)
  ctx.textAlign = 'left'
  ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
  ctx.fillStyle = 'rgba(148, 163, 184, 0.9)'
  ctx.fillText(`picos ${spikes}/${n}`, 10, h - 12)
  ctx.textAlign = 'right'
  ctx.fillText(DATA.credit, w - 10, h - 12)

  // Salidas motoras (misma convención que la vista ANN).
  const nodeY = (o: number) => h / 2 - 46 + o * 46
  for (let o = 0; o < NN_OUT; o++) {
    const val = c.outputs[o] ?? 0
    const reproducing = o === 2 && val > 0.55
    drawNode(ctx, outX, nodeY(o), 7, val, reproducing)
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillStyle = reproducing ? 'rgba(251, 191, 36, 1)' : 'rgba(148, 163, 184, 0.95)'
    ctx.fillText(
      `${OUTPUT_LABELS[o]} ${val.toFixed(2)}`,
      outX + 11,
      nodeY(o),
    )
    // Conector visual desde el anillo hacia el motor de salida.
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(cx + R - 6, cy)
    ctx.quadraticCurveTo((cx + R + outX) / 2, cy + (o - 1) * 34, outX - 10, nodeY(o))
    ctx.stroke()
  }
}

