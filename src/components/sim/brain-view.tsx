'use client'

// Visualización en vivo del cerebro de la criatura seleccionada.
//  · Moscas (ANN): 12 sensores → 8 ocultas → 3 motores; el brillo de cada
//    nodo es su activación y el color/grosor de cada arista, el peso.
//  · Gusanos (C. elegans): conectoma biológico real — 300 neuronas en tres
//    sectores por clase (sensoriales / interneuronas / motoras), brillo por
//    potencial de membrana y destello blanco al disparar (LIF).

import { useEffect, useRef } from 'react'
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
import type { CreatureView } from '@/lib/sim/types'

export function BrainView({ creature }: { creature: CreatureView }) {
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
    if (creature.brainKind === 'elegans' && creature.connectome) {
      drawConnectome(ctx, w, h, dpr, creature)
    } else {
      drawAnn(ctx, w, h, dpr, creature)
    }
  })

  return (
    <canvas
      ref={ref}
      className="block h-[340px] w-full"
      aria-label="Actividad neuronal de la criatura en tiempo real"
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

// Ángulo de cada neurona: tres sectores contiguos por clase (rad).
const NEURON_ANGLE: number[] = (() => {
  const byClass: number[][] = [[], [], []]
  ELEGANS_NAMES.forEach((_, i) => byClass[ELEGANS_CLASSES[i]].push(i))
  const sectorStart = [-Math.PI * (165 / 180), -Math.PI * (25 / 180), Math.PI * (100 / 180)]
  const sectorWidth = [Math.PI * (150 / 180), Math.PI * (110 / 180), Math.PI * (100 / 180)]
  const angles = new Array<number>(ELEGANS_NAMES.length)
  for (let cls = 0; cls < 3; cls++) {
    const list = byClass[cls]
    list.forEach((neuronIdx, k) => {
      const t = list.length === 1 ? 0.5 : k / (list.length - 1)
      angles[neuronIdx] = sectorStart[cls] + t * sectorWidth[cls]
    })
  }
  return angles
})()

function drawConnectome(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  c: CreatureView,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const con = c.connectome!
  const v = con.v
  const s = con.s
  const n = ELEGANS_NAMES.length

  // Composición: anillo de neuronas a la izquierda, salidas motoras a la derecha.
  const outX = w - 64
  const cx = Math.max(70, (w - 118) / 2)
  const cy = h / 2 - 6
  const R = Math.max(46, Math.min(cx - 24, h / 2 - 40))

  // Neuronas
  for (let i = 0; i < n; i++) {
    const ang = angleOf(i)
    const x = cx + Math.cos(ang) * R
    const y = cy + Math.sin(ang) * R
    const [r, g, b] = CLASS_COLOR[ELEGANS_CLASSES[i]]
    const pot = Math.min(1, (v[i] ?? 0) / 1.4) // potencial normalizado
    // Brillo base alto: en reposo la mayoría de neuronas están sub-umbral
    // y con alfa bajo serían invisibles; el potencial añade el brillo extra.
    const alpha = 0.45 + pot * 0.55
    if (s[i]) {
      // Pico: destello blanco + halo del color de su clase.
      ctx.beginPath()
      ctx.arc(x, y, 6.5, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.32)`
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, 2.5, 0, Math.PI * 2)
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
    const name = ELEGANS_NAMES[i]
    if (!KEY_NEURONS.has(name)) continue
    const ang = NEURON_ANGLE[i]
    const x = cx + Math.cos(ang) * (R - 13)
    const y = cy + Math.sin(ang) * (R - 13)
    if (s[i]) {
      const [r, g, b] = CLASS_COLOR[ELEGANS_CLASSES[i]]
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
  ctx.fillText(`${ELEGANS_INFO.chemical + ELEGANS_INFO.gapJunctions} sinapsis · OpenWorm`, w - 10, h - 12)

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

function angleOf(i: number): number {
  return NEURON_ANGLE[i] ?? 0
}
