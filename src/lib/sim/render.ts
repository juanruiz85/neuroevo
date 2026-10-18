// Renderer 2D del ecosistema: terreno, alimentos, huevos, criaturas en su
// fase del ciclo de vida, sentidos del gusano seleccionado, día/noche,
// lluvia y resaltado de la criatura seleccionada. Funciones puras sobre Canvas.

import type { Creature } from './creature'
import type { World, Food, Egg } from './world'
import { SPECIES_CONFIG, WORM_LIFE, WORM_STAGE_LABEL, WORM_STAGE_SCALE, clamp } from './types'

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

  // Paredes de la arena y meta (Modo Retos)
  if (world.walls.length) drawWalls(ctx, world)
  if (world.goal) drawGoal(ctx, world, now)

  // Alimentos
  for (const f of world.foods) {
    if (!f.dead) drawFood(ctx, f, now)
  }

  // Huevos de gusano (incubando en el sustrato)
  for (const e of world.eggs) {
    if (!e.hatched && !e.dead) drawEgg(ctx, e, now)
  }

  // Criaturas
  for (const c of world.creatures) {
    if (c.alive) drawCreature(ctx, c, now)
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
  if (sel) drawSelection(ctx, world, sel, now)

  // Estímulos activos del Laboratorio (encima de todo)
  if (world.stimuli.length) drawStimuli(ctx, world, now)
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
    case 'bitter': {
      // Cebo amargo (quinina/denatonio): galleta verdosa-oliva con puntito
      // amargo — se distingue del veneno letal (violeta).
      ctx.save()
      ctx.shadowColor = '#4d7c0f'
      ctx.shadowBlur = 7
      ctx.fillStyle = '#3f6212'
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = '#a3a3a3'
      ctx.beginPath()
      ctx.arc(f.x - f.r * 0.28, f.y - f.r * 0.22, f.r * 0.3, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#d4d4d4'
      ctx.beginPath()
      ctx.arc(f.x + f.r * 0.3, f.y + f.r * 0.25, f.r * 0.18, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }
}

function drawCreature(ctx: CanvasRenderingContext2D, c: Creature, now: number): void {
  if (c.species === 'fly') drawFly(ctx, c)
  else drawWorm(ctx, c, now)
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

function drawWorm(ctx: CanvasRenderingContext2D, c: Creature, now: number): void {
  const n = c.segs.length
  // La larva crece con cada muda; la dauer es un quiste pálido y quieto.
  const scale = WORM_STAGE_SCALE[c.stage] ?? 1
  const dauer = c.stage === 'dauer'
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1)
    const r = (4.8 - t * 2.4) * scale
    ctx.fillStyle = dauer
      ? i < 3
        ? '#94a3b8'
        : '#64748b'
      : WORM_COLORS[Math.min(WORM_COLORS.length - 1, i)]
    ctx.beginPath()
    ctx.arc(c.segs[i].x, c.segs[i].y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Antenas (las larvas pequeñas y la dauer apenas las despliegan)
  const head = c.segs[0]
  const next = c.segs[1] ?? head
  const hx = head.x - next.x
  const hy = head.y - next.y
  const hd = Math.hypot(hx, hy) || 1
  const px = -hy / hd
  const py = hx / hd
  ctx.strokeStyle = dauer
    ? 'rgba(148, 163, 184, 0.35)'
    : 'rgba(110, 231, 183, 0.65)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(head.x + (hx / hd) * 4, head.y + (hy / hd) * 4)
  ctx.lineTo(head.x + (hx / hd) * 7 + px * 2, head.y + (hy / hd) * 7 + py * 2)
  ctx.moveTo(head.x + (hx / hd) * 4, head.y + (hy / hd) * 4)
  ctx.lineTo(head.x + (hx / hd) * 7 - px * 2, head.y + (hy / hd) * 7 - py * 2)
  ctx.stroke()

  // Ráfaga dorada de puesta: el circuito HSN+VC acaba de depositar un huevo.
  if (c.laidFlash > 0) {
    const vulva = c.segs[3] ?? c
    const k = 1 - c.laidFlash
    ctx.strokeStyle = `rgba(251, 191, 36, ${(c.laidFlash * 0.9).toFixed(3)})`
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(vulva.x, vulva.y, 3 + k * 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = `rgba(251, 191, 36, ${(c.laidFlash * 0.45).toFixed(3)})`
    ctx.beginPath()
    ctx.arc(vulva.x, vulva.y, 2 + k * 22, 0, Math.PI * 2)
    ctx.stroke()
  }
  void now
}

// ——— Arena: paredes y meta ——————————————————————————————————————————————

function drawWalls(ctx: CanvasRenderingContext2D, world: World): void {
  ctx.lineCap = 'round'
  for (const w of world.walls) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)'
    ctx.lineWidth = 11
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(w.x1, w.y1)
    ctx.lineTo(w.x2, w.y2)
    ctx.stroke()
  }
  ctx.lineCap = 'butt'
}

function drawGoal(ctx: CanvasRenderingContext2D, world: World, now: number): void {
  const g = world.goal!
  const pulse = (now % 1600) / 1600
  ctx.save()
  // Anillo expansivo de la meta
  ctx.strokeStyle = `rgba(52, 211, 153, ${(0.55 * (1 - pulse)).toFixed(3)})`
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(g.x, g.y, g.r * (0.35 + 0.75 * pulse), 0, Math.PI * 2)
  ctx.stroke()
  // Zona de llegada
  const grad = ctx.createRadialGradient(g.x, g.y, 2, g.x, g.y, g.r)
  grad.addColorStop(0, 'rgba(52, 211, 153, 0.30)')
  grad.addColorStop(1, 'rgba(52, 211, 153, 0.04)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#34d399'
  ctx.lineWidth = 1.6
  ctx.setLineDash([6, 5])
  ctx.beginPath()
  ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  // Bandera central
  ctx.strokeStyle = '#d1fae5'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(g.x, g.y)
  ctx.lineTo(g.x, g.y - 14)
  ctx.stroke()
  ctx.fillStyle = '#34d399'
  ctx.beginPath()
  ctx.moveTo(g.x, g.y - 14)
  ctx.lineTo(g.x + 10, g.y - 10.5)
  ctx.lineTo(g.x, g.y - 7)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ——— Laboratorio: estímulos activos ————————————————————————————————————————

function drawStimuli(ctx: CanvasRenderingContext2D, world: World, now: number): void {
  for (const s of world.stimuli) {
    const frac = Math.min(1, s.t / s.dur)
    switch (s.kind) {
      case 'tap': {
        // Ondas concéntricas del golpe al plato
        ctx.strokeStyle = `rgba(251, 191, 36, ${(0.7 * (1 - frac)).toFixed(3)})`
        ctx.lineWidth = 2.5
        for (let k = 0; k < 3; k++) {
          const r = 24 + (frac * 190 + k * 64) % 210
          ctx.beginPath()
          ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
          ctx.stroke()
        }
        break
      }
      case 'shadow': {
        // Disco oscuro que crece (looming)
        const r = 30 + 170 * frac
        const grad = ctx.createRadialGradient(s.x, s.y, r * 0.2, s.x, s.y, r)
        grad.addColorStop(0, `rgba(2, 6, 12, ${(0.66 * (0.4 + 0.6 * frac)).toFixed(3)})`)
        grad.addColorStop(0.85, `rgba(2, 6, 12, ${(0.5 * (0.4 + 0.6 * frac)).toFixed(3)})`)
        grad.addColorStop(1, 'rgba(2, 6, 12, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = `rgba(148, 163, 184, ${0.25 * frac})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'flash': {
        ctx.fillStyle = `rgba(255, 252, 230, ${(0.5 * (1 - frac)).toFixed(3)})`
        ctx.fillRect(0, 0, world.width, world.height)
        break
      }
      case 'heat': {
        // Ondas térmicas rojas que suben
        ctx.strokeStyle = `rgba(244, 63, 94, ${(0.5 * Math.sin(Math.PI * frac)).toFixed(3)})`
        ctx.lineWidth = 2
        for (let k = 0; k < 4; k++) {
          const y = ((now / 22 + k * 90) % 300) + world.height - 310
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.bezierCurveTo(
            world.width * 0.3, y - 18,
            world.width * 0.7, y + 18,
            world.width, y,
          )
          ctx.stroke()
        }
        break
      }
      case 'foodDrop': {
        const r = 12 + frac * 26
        ctx.strokeStyle = `rgba(250, 204, 21, ${(0.8 * (1 - frac)).toFixed(3)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'airPuff': {
        // Flechas radiales del chorro de aire
        ctx.strokeStyle = `rgba(203, 213, 225, ${(0.85 * (1 - frac)).toFixed(3)})`
        ctx.lineWidth = 2
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + 0.3
          const r0 = 18 + frac * 60
          const r1 = 40 + frac * 90
          ctx.beginPath()
          ctx.moveTo(s.x + Math.cos(a) * r0, s.y + Math.sin(a) * r0)
          ctx.lineTo(s.x + Math.cos(a) * r1, s.y + Math.sin(a) * r1)
          ctx.stroke()
        }
        break
      }
    }
  }
}

// Huevo: gusano → óvalo crema; mosca → alargado blanco-perla (los huevos
// reales de Drosophila). Cerca de eclosionar, el embrión se retuerce.
function drawEgg(ctx: CanvasRenderingContext2D, e: Egg, now: number): void {
  const frac = clamp(e.embryoT / e.embryoTotal, 0, 1)
  const twitch =
    frac < 0.3 ? Math.sin(now / 110 + e.id * 2.7) * (0.3 - frac) * 3.5 : 0
  const isFly = e.species === 'fly'
  ctx.save()
  ctx.translate(e.x, e.y + twitch)
  ctx.rotate(e.id % 7 * 0.9)
  ctx.fillStyle = isFly ? '#f8fafc' : '#fde68a'
  ctx.strokeStyle = isFly ? 'rgba(100, 116, 139, 0.55)' : 'rgba(120, 85, 20, 0.55)'
  ctx.lineWidth = 0.7
  ctx.beginPath()
  ctx.ellipse(0, 0, isFly ? 3.6 : 3.1, isFly ? 1.5 : 2.1, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  // Embrión visible al final de la incubación
  if (frac < 0.35) {
    ctx.fillStyle = isFly ? 'rgba(217, 119, 6, 0.9)' : 'rgba(83, 109, 61, 0.85)'
    ctx.beginPath()
    ctx.arc(0, 0, 1.1, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  world: World,
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

  // Sentidos del gusano seleccionado, visibles sobre el mundo
  if (c.species === 'worm') drawWormSenses(ctx, world, c, now)
}

/**
 * Sentidos en vivo alrededor del gusano seleccionado: el puente visual
 * entre el cerebro de la ficha y el cuerpo en pantalla. Cada indicador
 * corresponde a un canal sensorial real (ver sensors.ts).
 */
function drawWormSenses(
  ctx: CanvasRenderingContext2D,
  world: World,
  c: Creature,
  now: number,
): void {
  const head = c.segs[0] ?? c
  const tail = c.segs[c.segs.length - 1] ?? c
  const hx = head.x
  const hy = head.y

  // — Quimiotaxis: línea punteada hacia la comida olfateada + ondas —
  const food = world.nearestFood(c.x, c.y, c.effVision, cfgDiet(c))
  if (food) {
    const dx = food.x - hx
    const dy = food.y - hy
    const d = Math.hypot(dx, dy) || 1
    const near = 1 - Math.min(1, d / Math.max(1, c.effVision))
    ctx.strokeStyle = `rgba(52, 211, 153, ${(0.18 + near * 0.4).toFixed(3)})`
    ctx.setLineDash([2, 5])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(food.x, food.y)
    ctx.stroke()
    ctx.setLineDash([])
    // Ondas olfativas que respiran hacia el alimento
    const ang = Math.atan2(dy, dx)
    const wave = 0.5 + 0.5 * Math.sin(now / 260)
    for (let i = 0; i < 2; i++) {
      const r = 7 + i * 4.5 + wave * 2.2
      ctx.strokeStyle = `rgba(52, 211, 153, ${(0.42 - i * 0.15).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(hx, hy, r, ang - 0.6, ang + 0.6)
      ctx.stroke()
    }
  }

  // — Fotofobia (LITE-1/ASH): rayos cuando la luz es fuerte —
  if (world.light > 0.62) {
    const a = (world.light - 0.62) / 0.38
    ctx.strokeStyle = `rgba(251, 191, 36, ${(0.25 + a * 0.45).toFixed(3)})`
    ctx.lineWidth = 1
    for (let k = 0; k < 5; k++) {
      const ang = -Math.PI / 2 + (k - 2) * 0.42
      ctx.beginPath()
      ctx.moveTo(hx + Math.cos(ang) * 6, hy + Math.sin(ang) * 6)
      ctx.lineTo(hx + Math.cos(ang) * 10, hy + Math.sin(ang) * 10)
      ctx.stroke()
    }
  }

  // — Tacto cefálico (ASH/FLP/OLQ): chispa en la nariz —
  if (c.touchF > 0.06) drawSpark(ctx, hx, hy, c.touchF, '#fb7185')
  // — Tacto caudal (PLM): chispa en la cola —
  if (c.touchB > 0.06) drawSpark(ctx, tail.x, tail.y, c.touchB, '#fb7185')

  // — Propiocepción (DVA): arco al costado hacia el que ondula el cuerpo —
  const turn = c.brain.oA[0]
  if (Math.abs(turn) > 0.18) {
    const mid = c.segs[4] ?? c
    const a0 = c.heading + (turn > 0 ? -1.1 : Math.PI - 0.4 + 1.5)
    ctx.strokeStyle = `rgba(251, 146, 60, ${Math.min(0.55, Math.abs(turn) * 0.8).toFixed(3)})`
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(mid.x, mid.y, 8, a0, a0 + 0.9)
    ctx.stroke()
  }

  // — Feromona de conglomerado (ADL): aura punteada violeta —
  const pher = world.wormPheromone(c.x, c.y)
  if (pher > 0.35) {
    ctx.strokeStyle = `rgba(192, 132, 252, ${(pher * 0.5).toFixed(3)})`
    ctx.setLineDash([2, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(c.x, c.y, 26 * pher + 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // — Etiqueta de fase: qué es y en qué punto del ciclo está —
  ctx.font = 'bold 8px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)'
  ctx.fillText(WORM_STAGE_LABEL[c.stage] ?? 'Adulto', c.x, c.y + 27)
}

function cfgDiet(c: Creature): number {
  return SPECIES_CONFIG[c.species].diet
}

/** Chispa mecánica (tacto): asterisco que se apaga con `k`. */
function drawSpark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  k: number,
  color: string,
): void {
  ctx.strokeStyle = color
  ctx.globalAlpha = Math.min(1, k * 1.2)
  ctx.lineWidth = 1.3
  const r = 4 + (1 - k) * 3
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    ctx.moveTo(x + Math.cos(a) * 1.5, y + Math.sin(a) * 1.5)
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
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
