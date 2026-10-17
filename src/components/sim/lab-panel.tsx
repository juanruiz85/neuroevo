'use client'

// Modo Laboratorio — estímulos programables, knockouts y trazas.
// SHELL (Task 15): estructura y contrato de props estables; la Task 16-b
// completa los controles de estímulo, knockouts y el protocolo de
// habituación al tap (Rankin 1990).

import { FlaskConical, Info, MousePointerClick } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SimApi } from '@/components/sim/use-simulation'

export function LabPanel({ sim }: { sim: SimApi }) {
  const { ui } = sim

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FlaskConical className="size-4 text-teal-400" />
            Laboratorio de neurobiología
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
            Estímulos controlados (tap del plato, sombra que crece, flash,
            calor, gota de comida, chorro de aire), ablaciones virtuales por
            clase neuronal y trazas de actividad en vivo.
          </p>
          <p className="flex items-start gap-2">
            <MousePointerClick className="mt-0.5 size-3.5 shrink-0 text-teal-400" />
            Selecciona una criatura en el mapa para registrar sus trazas.
            {ui.selected ? ' Cerebro vigilado ✓' : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => sim.stimulate('tap', ui.selected?.x ?? 640, ui.selected?.y ?? 420)}
          >
            Tap al plato (ensayo suelto)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
