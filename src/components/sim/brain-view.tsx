'use client'

// Visualización en vivo de la red neuronal de la criatura seleccionada:
// 12 sensores -> 8 ocultas -> 3 motores. El brillo de cada nodo es su
// activación; el color/grosor de cada arista es el peso sináptico.

import { useEffect, useRef } from 'react'
import {
  INPUT_LABELS,
  NN_H,
  NN_IN,
  NN_OUT,
  OUTPUT_LABELS,
} from '@/lib/sim/nn'
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
    draw(ctx, w, h, dpr, creature)
  })

  return (
    <canvas
      ref={ref}
      className="block h-[340px] w-full"
      aria-label="Actividad neuronal de la criatura en tiempo real"
    />
  )
}

function draw(
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
