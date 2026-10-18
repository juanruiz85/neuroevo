'use client'

// Estado compartido del modo 3D: qué herramienta de colocación está activa
// y preferencias de visualización. Zustand evita propagar props entre la
// escena (Canvas) y el panel de controles, que viven en ramas distintas
// del árbol de page.tsx.

import { create } from 'zustand'

/** Herramienta de colocación: clic en el plato 3D. */
export type Tool3D =
  | 'none'
  | 'sugar'
  | 'fruit'
  | 'bitter'
  | 'shadow'
  | 'tap'
  | 'airPuff'

export const TOOL_INFO: Record<
  Tool3D,
  { label: string; hint: string; icon: string }
> = {
  none: {
    label: 'Navegar',
    hint: 'Arrastra para girar la cámara; rueda para acercar. Elige una herramienta para colocar con clic.',
    icon: '🔍',
  },
  sugar: {
    label: 'Azúcar',
    hint: 'Clic en el plato: gota de azúcar (comida buena — recompensa).',
    icon: '🍬',
  },
  fruit: {
    label: 'Fruta',
    hint: 'Clic en el plato: trozo de fruta madura (comida buena para moscas).',
    icon: '🍎',
  },
  bitter: {
    label: 'Cebo amargo',
    hint: 'Clic en el plato: cebo con quinina/denatonio — HUELE a comida pero castiga al probarlo. Observa cómo aprenden a evitarlo.',
    icon: '🟫',
  },
  shadow: {
    label: 'Silueta',
    hint: 'Clic en el plato: sombra de depredador que crece (looming). La mosca debe escapar por la fibra gigante; el gusano responde a la sombra.',
    icon: '🦅',
  },
  tap: {
    label: 'Golpe',
    hint: 'Clic en el plato: golpe al plato (vibración global — circuito del tap-withdrawal ALM/AVM→AVA/PVC).',
    icon: '👆',
  },
  airPuff: {
    label: 'Chorro',
    hint: 'Clic en el plato: chorro de aire (empuja y excita los mecanosensores).',
    icon: '💨',
  },
}

interface Neuro3DState {
  tool: Tool3D
  /** Mostrar etiquetas de los grupos/anclas en el holograma. */
  labels: boolean
  setTool: (t: Tool3D) => void
  setLabels: (v: boolean) => void
}

export const useNeuro3D = create<Neuro3DState>((set) => ({
  tool: 'none',
  labels: true,
  setTool: (tool) => set({ tool }),
  setLabels: (labels) => set({ labels }),
}))
