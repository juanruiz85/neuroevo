'use client'

// Canvas del ecosistema: se ajusta a su contenedor con letterbox, registra un
// renderer en el loop de simulación y tradice los clics a coordenadas del mundo.

import { useEffect, useRef } from 'react'
import { renderWorld, screenToWorld, type Viewport } from '@/lib/sim/render'
import type { SimApi } from '@/components/sim/use-simulation'

interface Props {
  sim: SimApi
  onSelect?: () => void
}

export function SimCanvas({ sim, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vpRef = useRef<Viewport>({ w: 0, h: 0, dpr: 1 })

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
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

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = sim.getWorld()
    const canvas = canvasRef.current
    if (!world || !canvas) return
    const r = canvas.getBoundingClientRect()
    const { x, y } = screenToWorld(
      vpRef.current,
      world,
      e.clientX - r.left,
      e.clientY - r.top,
    )
    const hit = sim.selectAt(x, y)
    if (hit) onSelect?.()
  }

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="block h-full w-full cursor-crosshair"
        aria-label="Mapa del ecosistema: haz clic en una criatura para inspeccionar su red neuronal"
      />
    </div>
  )
}
