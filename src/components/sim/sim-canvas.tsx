'use client'

// Canvas del ecosistema: se ajusta a su contenedor con letterbox, registra un
// renderer en el loop de simulación y traduce los clics a coordenadas del mundo.
// Fase 2 (Task 16-a): soporte de herramienta activa del editor de Retos —
// pared con clic-arrastre y previsualización en vivo, y acciones puntuales
// (meta, comida, veneno, borrar, soltar) en coordenadas del mundo.

import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import {
  computeViewport,
  renderWorld,
  screenToWorld,
  type Viewport,
} from '@/lib/sim/render'
import type { SimApi } from '@/components/sim/use-simulation'

/** Herramientas del editor de arena. */
export type ArenaTool =
  | 'select'
  | 'wall'
  | 'goal'
  | 'food'
  | 'poison'
  | 'erase'
  | 'drop'

/** Punto en coordenadas del mundo (1280×840). */
export interface ToolPoint {
  x: number
  y: number
}

/**
 * Acción del editor en coordenadas del mundo: `'wall'` arrastra un segmento
 * (inicio a, fin b) y `'click'` es una acción puntual en a — la herramienta
 * activa decide qué significa el clic y la conoce el panel, no el canvas.
 */
export type ToolAction = (
  kind: 'click' | 'wall',
  a: ToolPoint,
  b?: ToolPoint,
) => void

/**
 * Tienda compartida de herramienta activa. page.tsx monta <SimCanvas> sin
 * conocer al panel de Retos, así que el panel publica aquí su herramienta y
 * su callback; el canvas los lee. Los props `tool`/`onToolAction` del canvas
 * (si alguien los pasa) tienen prioridad sobre la tienda.
 */
interface ArenaToolState {
  tool: ArenaTool
  setTool: (t: ArenaTool) => void
  onAction: ToolAction | null
  setOnAction: (fn: ToolAction | null) => void
}

export const useArenaToolStore = create<ArenaToolState>((set) => ({
  tool: 'select',
  setTool: (tool) => set({ tool }),
  onAction: null,
  setOnAction: (onAction) => set({ onAction }),
}))

/** Longitud mínima (px del mundo) para aceptar una pared dibujada. */
const MIN_WALL_LEN = 10

interface Props {
  sim: SimApi
  onSelect?: () => void
  /** Herramienta activa ('select' o undefined mantiene el comportamiento clásico). */
  tool?: string
  /** Callback del editor con coordenadas del mundo. */
  onToolAction?: ToolAction
}

const ARIA_BY_TOOL: Record<string, string> = {
  select:
    'Mapa del ecosistema: haz clic en una criatura para inspeccionar su red neuronal',
  wall: 'Mapa de la arena: arrastra para dibujar una pared',
  goal: 'Mapa de la arena: haz clic para colocar la meta',
  food: 'Mapa de la arena: haz clic para soltar una fruta',
  poison: 'Mapa de la arena: haz clic para soltar veneno',
  erase: 'Mapa de la arena: haz clic sobre una pared para quitarla',
  drop: 'Mapa de la arena: haz clic para soltar el organismo elegido',
}

export function SimCanvas({ sim, onSelect, tool: toolProp, onToolAction }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const vpRef = useRef<Viewport>({ w: 0, h: 0, dpr: 1 })

  // La tienda del panel de Retos es el fallback cuando no llegan props.
  const storeTool = useArenaToolStore((s) => s.tool)
  const storeAction = useArenaToolStore((s) => s.onAction)
  const tool = toolProp ?? storeTool
  // La acción se lee desde refs dentro de los listeners de ventana (que
  // sobreviven a los re-render del arrastre de pared), así que se sincroniza
  // en un efecto, nunca durante el render.
  const actionRef = useRef<ToolAction | null>(onToolAction ?? storeAction)
  useEffect(() => {
    actionRef.current = onToolAction ?? storeAction
  }, [onToolAction, storeAction])

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const apply = () => {
      const r = wrap.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(r.width))
      const h = Math.max(1, Math.round(r.height))
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      if (overlay) {
        overlay.width = Math.round(w * dpr)
        overlay.height = Math.round(h * dpr)
      }
      vpRef.current = { w, h, dpr }
    }
    apply()

    const ro = new ResizeObserver(apply)
    ro.observe(wrap)

    sim.registerRenderer((now) => {
      const world = sim.getWorld()
      if (world) renderWorld(ctx, world, vpRef.current, now)
    })

    return () => {
      ro.disconnect()
      sim.registerRenderer(null)
    }
  }, [sim])

  /** Convierte un evento de ratón (clientX/Y) a coordenadas del mundo. */
  const toWorld = (clientX: number, clientY: number): ToolPoint | null => {
    const world = sim.getWorld()
    const canvas = canvasRef.current
    if (!world || !canvas) return null
    const r = canvas.getBoundingClientRect()
    return screenToWorld(vpRef.current, world, clientX - r.left, clientY - r.top)
  }

  const clearPreview = () => {
    const overlay = overlayRef.current
    if (!overlay) return
    const octx = overlay.getContext('2d')
    if (!octx) return
    octx.setTransform(1, 0, 0, 1, 0, 0)
    octx.clearRect(0, 0, overlay.width, overlay.height)
  }

  /** Previsualización de la pared mientras se arrastra (overlay sin re-render). */
  const drawPreview = (a: ToolPoint, b: ToolPoint) => {
    const overlay = overlayRef.current
    const world = sim.getWorld()
    if (!overlay || !world) return
    const octx = overlay.getContext('2d')
    if (!octx) return
    const vp = vpRef.current
    const { s, ox, oy } = computeViewport(vp, world)
    octx.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0)
    octx.clearRect(0, 0, vp.w, vp.h)
    octx.setTransform(vp.dpr * s, 0, 0, vp.dpr * s, vp.dpr * ox, vp.dpr * oy)
    octx.lineCap = 'round'
    const stroke = (color: string, width: number, dash?: number[]) => {
      octx.strokeStyle = color
      octx.lineWidth = width
      octx.setLineDash(dash ?? [])
      octx.beginPath()
      octx.moveTo(a.x, a.y)
      octx.lineTo(b.x, b.y)
      octx.stroke()
    }
    stroke('rgba(148, 163, 184, 0.18)', 11)
    stroke('rgba(100, 116, 139, 0.7)', 7)
    stroke('rgba(226, 232, 240, 0.9)', 1.4, [9, 6])
    octx.setLineDash([])
    // Extremos de anclaje
    for (const p of [a, b]) {
      octx.fillStyle = 'rgba(226, 232, 240, 0.95)'
      octx.beginPath()
      octx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      octx.fill()
    }
  }

  /** Pared: mousedown fija el inicio, window listeners siguen el arrastre. */
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool !== 'wall') return
    const start = toWorld(e.clientX, e.clientY)
    if (!start) return
    e.preventDefault()
    const onMove = (ev: MouseEvent) => {
      const p = toWorld(ev.clientX, ev.clientY)
      if (p) drawPreview(start, p)
    }
    const finish = (ev: MouseEvent) => {
      cleanup()
      clearPreview()
      const end = toWorld(ev.clientX, ev.clientY)
      if (!end) return
      const len = Math.hypot(end.x - start.x, end.y - start.y)
      if (len >= MIN_WALL_LEN) actionRef.current?.('wall', start, end)
    }
    const cancel = () => {
      cleanup()
      clearPreview()
    }
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cancel()
    }
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', finish)
      window.removeEventListener('keydown', onKey)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', finish)
    window.addEventListener('keydown', onKey)
    drawPreview(start, start)
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const p = toWorld(e.clientX, e.clientY)
    if (!p) return
    if (tool !== 'select') {
      // Herramientas puntuales del editor: un solo tipo de acción ('click');
      // la pared se resuelve al soltar el arrastre, no con un clic corto.
      if (tool !== 'wall') actionRef.current?.('click', p)
      return
    }
    const hit = sim.selectAt(p.x, p.y)
    if (hit) onSelect?.()
  }

  const cursorClass =
    tool === 'select' || tool === 'wall' ? 'cursor-crosshair' : 'cursor-pointer'

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        className={`block h-full w-full select-none ${cursorClass}`}
        style={{ touchAction: tool === 'wall' ? 'none' : 'auto' }}
        aria-label={ARIA_BY_TOOL[tool] ?? ARIA_BY_TOOL.select}
      />
      {/* Overlay de previsualización (pared en construcción) */}
      <canvas
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full"
      />
    </div>
  )
}
