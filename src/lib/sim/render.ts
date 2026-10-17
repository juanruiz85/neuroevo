// Renderer 2D del ecosistema: terreno, alimentos, criaturas, día/noche, lluvia
// y resaltado de la criatura seleccionada. Funciones puras sobre Canvas.

import type { Creature } from './creature'
import type { World, Food } from './world'
import { SPECIES_CONFIG, clamp } from './types'

export interface Viewport {
  w: number
  h: number
  dpr: number
}

export function computeViewport(vp: Viewport, world: World) {
  const s = Math.min(vp.w / world.width, vp.h / world.height)
  return {
    s,
    ox: (vp.w - world.width * s) / 2,
    oy: (vp.h - world.height * s) / 2,
  }
}

export function screenToWorld(
  vp: Viewport,
  world: World,
  sx: number,
  sy: number,
): { x: number; y: number } {
  const { s, ox, oy } = computeViewport(vp, world)
  return { x: (sx - ox) / s, y: (sy - oy) / s }
}

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  vp: Viewport,
  now: number,
): void {
  if (vp.w <= 0 || vp.h <= 0) return
  const { dpr } = vp
  const { s, ox, oy } = computeViewport(vp, world)

  // Fondo del letterbox
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#080b09'
  ctx.fillRect(0, 0, vp.w, vp.h)

  // Transformación al espacio del mundo
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy)

  // Terreno
  const g = ctx.createLinearGradient(0, 0, 0, world.height)
  g.addColorStop(0, '#101713')
  g.addColorStop(0.45, '#131b14')
  g.addColorStop(1, '#192114')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, world.width, world.height)

  // Zona de suelo (donde aparece la materia orgánica)
  const soilY = world.height * 0.45
  ctx.fillStyle = 'rgba(30, 24, 14, 0.28)'
  ctx.fillRect(0, soilY, world.width, world.height - soilY)
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'
  ctx.setLineDash([5, 9])
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, soilY)
  ctx.lineTo(world.width, soilY)
  ctx.stroke()
  ctx.setLineDash([])

  // Alimentos
  for (const f of world.foods) {
    if (!f.dead) drawFood(ctx, f, now)
  }

  // Criaturas
  for (const c of world.creatures) {
    if (c.alive) drawCreature(ctx, c)
  }

  // Tinte de noche + amanecer/atardecer cálido
  const light = world.light
  const nightAlpha = (1 - light) * 0.52
  if (nightAlpha > 0.01) {
    ctx.fillStyle = `rgba(7, 11, 20, ${nightAlpha.toFixed(3)})`
    ctx.fillRect(0, 0, world.width, world.height)
  }
  const warm = 4 * light * (1 - light)
  if (warm > 0.05) {
    ctx.fillStyle = `rgba(255, 150, 60, ${(warm * warm * 0.09).toFixed(3)})`
    ctx.fillRect(0, 0, world.width, world.height)
  }

  // Lluvia
  const rain = Math.max(0, (world.env.humidity - 70) / 30)
  if (rain > 0) drawRain(ctx, world, rain, now)

  // Selección
  const sel = world.getSelected()
  if (sel) drawSelection(ctx, sel, now)
}

function drawFood(ctx: CanvasRenderingContext2D, f: Food, now: number): void {
  const bob = Math.sin(now / 700 + f.wobble) * 0.8
  switch (f.kind) {
    case 'fruit': {
      const y = f.y + bob
      ctx.fillStyle = '#dc2626'
      ctx.beginPath()
      ctx.arc(f.x, y, f.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.30)'
      ctx.beginPath()
      ctx.arc(f.x - 2.2, y - 2.2, 1.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#a16207'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(f.x, y - f.r + 1)
      ctx.lineTo(f.x + 1.5, y - f.r - 2.5)
      ctx.stroke()
      ctx.fillStyle = '#4d7c0f'
      ctx.beginPath()
      ctx.ellipse(f.x + 3.5, y - f.r + 0.5, 3.2, 1.6, -0.6, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'detritus': {
      ctx.fillStyle = '#6b5d4f'
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.arc(f.x + f.r * 0.7, f.y + f.r * 0.35, f.r * 0.7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#4a4038'
      ctx.beginPath()
      ctx.arc(f.x - f.r * 0.3, f.y + f.r * 0.2, 1.2, 0, Math.PI * 2)
      ctx.arc(f.x + f.r * 0.9, f.y - f.r * 0.2, 1, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'sugar': {
      const tw = 0.7 + 0.3 * Math.sin(now / 300 + f.wobble)
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(Math.PI / 4)
      ctx.globalAlpha = tw
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(-3.2, -3.2, 6.4, 6.4)
      ctx.globalAlpha = tw * 0.5
      ctx.strokeStyle = '#e2e8f0'
      ctx.lineWidth = 1
      ctx.strokeRect(-5, -5, 10, 10)
      ctx.restore()
      break
    }
    case 'poison': {
      ctx.save()
      ctx.shadowColor = '#a855f7'
      ctx.shadowBlur = 9
      ctx.fillStyle = '#7c3aed'
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = '#c084fc'
      ctx.beginPath()
      ctx.arc(f.x - f.r * 0.25, f.y - f.r * 0.25, f.r * 0.35, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }
}

function drawCreature(ctx: CanvasRenderingContext2D, c: Creature): void {
  if (c.species === 'fly') drawFly(ctx, c)
  else drawWorm(ctx, c)
}

function drawFly(ctx: CanvasRenderingContext2D, c: Creature): void {
  // Estela
  if (c.trailX.length > 1) {
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.14)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(c.trailX[0], c.trailY[0])
    for (let i = 1; i < c.trailX.length; i++) {
      ctx.lineTo(c.trailX[i], c.trailY[i])
    }
    ctx.stroke()
  }

  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.heading)

  const flap = Math.sin(c.wingPhase)
  ctx.fillStyle = 'rgba(228, 228, 231, 0.38)'
  for (const side of [-1, 1] as const) {
    ctx.save()
    ctx.rotate(side * (0.9 + flap * 0.45))
    ctx.beginPath()
    ctx.ellipse(-2.5, side * 3.6, 5.2, 2.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  ctx.fillStyle = '#3f3f46'
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 0.8
  ctx.beginPath()
  ctx.ellipse(0, 0, 5.4, 3.4, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#71717a'
  ctx.beginPath()
  ctx.arc(4.4, 0, 1.9, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ef4444'
  ctx.beginPath()
  ctx.arc(5.2, -0.9, 0.6, 0, Math.PI * 2)
  ctx.arc(5.2, 0.9, 0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

const WORM_COLORS = [
  '#6ee7b7',
  '#4ade80',
  '#34d399',
  '#22c55e',
  '#10b981',
  '#059669',
  '#047857',
  '#065f46',
]

function drawWorm(ctx: CanvasRenderingContext2D, c: Creature): void {
  const n = c.segs.length
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1)
    const r = 4.8 - t * 2.4
    ctx.fillStyle = WORM_COLORS[Math.min(WORM_COLORS.length - 1, i)]
    ctx.beginPath()
    ctx.arc(c.segs[i].x, c.segs[i].y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Antenas
  const head = c.segs[0]
  const next = c.segs[1] ?? head
  const hx = head.x - next.x
  const hy = head.y - next.y
  const hd = Math.hypot(hx, hy) || 1
  const px = -hy / hd
  const py = hx / hd
  ctx.strokeStyle = 'rgba(110, 231, 183, 0.65)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(head.x + (hx / hd) * 4, head.y + (hy / hd) * 4)
  ctx.lineTo(head.x + (hx / hd) * 7 + px * 2, head.y + (hy / hd) * 7 + py * 2)
  ctx.moveTo(head.x + (hx / hd) * 4, head.y + (hy / hd) * 4)
  ctx.lineTo(head.x + (hx / hd) * 7 - px * 2, head.y + (hy / hd) * 7 - py * 2)
  ctx.stroke()
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  c: Creature,
  now: number,
): void {
  // Rango sensorial efectivo
  ctx.setLineDash([3, 7])
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(c.x, c.y, c.effVision, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Anillo pulsante
  const pulse = 12 + Math.sin(now / 180) * 1.8
  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = 1.8
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.arc(c.x, c.y, pulse, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // Barra de energía
  const cfg = SPECIES_CONFIG[c.species]
  const pct = clamp(c.energy / cfg.maxEnergy, 0, 1)
  const w = 30
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(c.x - w / 2, c.y - 21, w, 4)
  ctx.fillStyle = pct > 0.5 ? '#34d399' : pct > 0.25 ? '#fbbf24' : '#fb7185'
  ctx.fillRect(c.x - w / 2, c.y - 21, w * pct, 4)
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  world: World,
  rain: number,
  now: number,
): void {
  const n = Math.floor(30 + rain * 100)
  ctx.strokeStyle = 'rgba(186, 210, 230, 0.30)'
  ctx.lineWidth = 1
  ctx.beginPath()
  const t = now / 1000
  for (let i = 0; i < n; i++) {
    const r1 = fract(Math.sin(i * 127.1) * 43758.5453)
    const r2 = fract(Math.sin(i * 311.7) * 12543.21)
    const speed = 320 + r2 * 260
    const x = r1 * world.width
    const y = (r2 * world.height + t * speed) % world.height
    ctx.moveTo(x, y)
    ctx.lineTo(x - 2.5, y + 10)
  }
  ctx.stroke()
}

function fract(v: number): number {
  return v - Math.floor(v)
}
