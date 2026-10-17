'use client'

// Modo Retos / Arena — panel de control del editor de laberintos.
// SHELL (Task 15): estructura y contrato de props estables; la Task 16-a
// completa las herramientas del editor y la tabla de resultados.

import { Hammer, Info, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { SimApi } from '@/components/sim/use-simulation'

export function ArenaPanel({ sim }: { sim: SimApi }) {
  const { ui } = sim

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="size-4 text-amber-500" />
            Modo Retos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 size-3.5 shrink-0 text-sky-400" />
            Construye un laberinto con paredes, coloca veneno, comida y una
            meta, suelta gusanos o moscas (con conectoma real o ANN de
            control) y cronometra cuánto tardan en llegar… o en morir.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px]">
              <Hammer className="size-3" /> editor en camino
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {ui.walls.length} paredes
            </Badge>
            {ui.goal && (
              <Badge variant="outline" className="text-[10px] text-emerald-500">
                meta colocada
              </Badge>
            )}
            {ui.arenaRunning && (
              <Badge variant="outline" className="text-[10px] tabular-nums text-amber-500">
                ⏱ {ui.runT.toFixed(1)} s
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={sim.arenaStart}
            disabled={ui.counts.flies + ui.counts.worms === 0}
          >
            Iniciar ensayo (cronómetro)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
