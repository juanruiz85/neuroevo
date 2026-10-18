'use client'

// Cabecera: identidad, selector de MODO (ecosistema/retos/laboratorio),
// métricas en vivo, velocidad, pausa, reset y tema.

import { useTheme } from 'next-themes'
import {
  Baby,
  Box,
  Bug,
  Dna,
  FlaskConical,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Skull,
  Sun,
  Timer,
  Trophy,
  Worm,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SimApi } from '@/components/sim/use-simulation'
import type { SimMode } from '@/lib/sim/types'
import { cn } from '@/lib/utils'

const SPEEDS = [0.5, 1, 2, 4, 8]

const MODES: { key: SimMode; label: string; short: string; icon: typeof Dna }[] = [
  { key: 'ecosystem', label: 'Ecosistema — evolución libre con clima', short: 'Ecosistema', icon: Dna },
  { key: 'arena', label: 'Retos — construye laberintos y cronometra', short: 'Retos', icon: Trophy },
  { key: 'lab', label: 'Laboratorio — estímulos, knockouts y trazas', short: 'Laboratorio', icon: FlaskConical },
  { key: 'neuro3d', label: '3D — cuerpo y cerebro en vivo (anatomía real)', short: '3D', icon: Box },
]

export function SimHeader({ sim }: { sim: SimApi }) {
  const { ui } = sim
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-[1800px] flex-wrap items-center gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500">
            <Dna className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">NeuroEvo</div>
            <div className="hidden text-[10px] text-muted-foreground sm:block">
              ecosistema neuronal evolutivo
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-1.5 lg:flex">
          <Chip icon={Timer}>{formatTime(ui.time)}</Chip>
          <Chip icon={Dna}>G{ui.maxGen}</Chip>
          <Chip icon={Baby}>{ui.births}</Chip>
          <Chip icon={Skull}>{ui.deaths}</Chip>
        </div>

        <TooltipProvider delayDuration={300}>
          <ToggleGroup
            type="single"
            value={sim.mode}
            onValueChange={(v) => {
              if (v) sim.setMode(v as SimMode)
            }}
            variant="outline"
            size="sm"
            className="gap-0"
            aria-label="Modo de simulación"
          >
            {MODES.map((m) => {
              const Icon = m.icon
              return (
                <Tooltip key={m.key}>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value={m.key}
                      className="gap-1.5 px-2.5 text-[11px] font-medium"
                    >
                      <Icon className="size-3.5" />
                      <span className={cn(sim.mode === m.key ? 'inline' : 'hidden md:inline')}>
                        {m.short}
                      </span>
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px]">
                    {m.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </ToggleGroup>
        </TooltipProvider>

        <div className="ml-auto flex items-center gap-1.5">
          <ToggleGroup
            type="single"
            value={String(sim.speed)}
            onValueChange={(v) => {
              if (v) sim.setSpeed(Number(v))
            }}
            variant="outline"
            size="sm"
            className="hidden sm:flex"
            aria-label="Velocidad de simulación"
          >
            {SPEEDS.map((s) => (
              <ToggleGroupItem
                key={s}
                value={String(s)}
                className="px-2 font-mono text-[11px]"
              >
                ×{s}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Button
            size="icon"
            variant={sim.paused ? 'default' : 'outline'}
            onClick={sim.togglePause}
            aria-label={sim.paused ? 'Reanudar simulación' : 'Pausar simulación'}
            title={sim.paused ? 'Reanudar' : 'Pausar'}
          >
            {sim.paused ? (
              <Play className="size-4" />
            ) : (
              <Pause className="size-4" />
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                aria-label="Reiniciar ecosistema"
                title="Reiniciar ecosistema"
              >
                <RotateCcw className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  ¿Reiniciar el ecosistema?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán todas las criaturas y volverás a la generación
                  0 con cerebros aleatorios. El clima y los ajustes se
                  mantienen. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={sim.reset}>
                  Reiniciar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            size="icon"
            variant="outline"
            onClick={() =>
              setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
            }
            aria-label="Cambiar tema"
            title="Cambiar tema"
          >
            <Sun className="size-4 dark:hidden" />
            <Moon className="hidden size-4 dark:block" />
          </Button>
        </div>
      </div>
    </header>
  )
}

function Chip({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-card/70 px-2 py-0.5 text-[11px] font-medium tabular-nums">
      <Icon className="size-3 text-muted-foreground" />
      {children}
    </span>
  )
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export const HeaderIcons = { Bug, Worm }
