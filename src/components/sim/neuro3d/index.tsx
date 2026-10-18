'use client'

// Entrada del modo 3D: la escena WebGL se carga de forma diferida (sin SSR)
// y el panel de controles se importa directo (DOM puro).

import dynamic from 'next/dynamic'
import type { SimApi } from '@/components/sim/use-simulation'

const SceneImpl = dynamic(
  () => import('./scene').then((m) => m.Neuro3DScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="size-10 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-400" />
          <p className="text-xs">Cargando el terrario 3D…</p>
        </div>
      </div>
    ),
  },
)

export function Neuro3DScene(props: { sim: SimApi }) {
  return <SceneImpl {...props} />
}

export { Neuro3DControls } from './panel'
