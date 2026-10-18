'use client'

// Etiquetas 3D como sprites con textura canvas: sin portales DOM (evita
// los errores de unmount de drei Html con React 19) y con aspecto
// holográfico (billboards siempre legibles).

import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture>()

function makeLabelTexture(title: string, sub: string, accent: string): THREE.CanvasTexture {
  const key = `${title}|${sub}|${accent}`
  const hit = cache.get(key)
  if (hit) return hit
  const W = 360
  const H = 84
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  // pastilla redondeada translúcida
  const r = 18
  g.beginPath()
  g.moveTo(r, 4)
  g.lineTo(W - r, 4)
  g.quadraticCurveTo(W - 4, 4, W - 4, 4 + r)
  g.lineTo(W - 4, H - r)
  g.quadraticCurveTo(W - 4, H - 4, W - r, H - 4)
  g.lineTo(r, H - 4)
  g.quadraticCurveTo(4, H - 4, 4, H - r)
  g.lineTo(4, 4 + r)
  g.quadraticCurveTo(4, 4, r, 4)
  g.closePath()
  g.fillStyle = 'rgba(8, 11, 10, 0.82)'
  g.fill()
  g.strokeStyle = accent
  g.globalAlpha = 0.55
  g.lineWidth = 2
  g.stroke()
  g.globalAlpha = 1
  // título monoespaciado + subtítulo gris
  g.font = '600 30px ui-monospace, monospace'
  g.fillStyle = accent
  g.textBaseline = 'middle'
  g.fillText(title, 18, H * 0.38)
  g.font = '400 24px ui-sans-serif, system-ui'
  g.fillStyle = 'rgba(190, 197, 189, 0.92)'
  g.fillText(sub, 18, H * 0.74)
  const tex = new THREE.CanvasTexture(cv)
  tex.anisotropy = 2
  cache.set(key, tex)
  return tex
}

/**
 * Etiqueta flotante (billboard). `scale` en unidades de escena por unidad
 * de textura (la textura es 360×84 → relación ≈ 4.3:1).
 */
export function Label3D({
  position,
  title,
  sub,
  accent,
  width = 5.4,
}: {
  position: [number, number, number]
  title: string
  sub: string
  accent: string
  /** Ancho del cartel en unidades de escena. */
  width?: number
}) {
  const tex = makeLabelTexture(title, sub, accent)
  const h = width * (84 / 360)
  return (
    <sprite position={position} scale={[width, h, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} depthTest={false} />
    </sprite>
  )
}
