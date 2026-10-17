'use client'

// NeuroEvo: página principal. Canvas del ecosistema con HUD en vivo + panel
// lateral con pestañas (Ambiente, Inspector, Datos, Museo).

import { useState } from 'react'
import {
  Activity,
  Archive,
  Brain,
  Bug,
  CloudSun,
  Dna,
  Droplets,
  Moon,
  Pause,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  Worm,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SimCanvas } from '@/components/sim/sim-canvas'
import { SimHeader } from '@/components/sim/sim-header'
import { EnvironmentPanel } from '@/components/sim/environment-panel'
import { InspectorPanel } from '@/components/sim/inspector-panel'
import { StatsPanel } from '@/components/sim/stats-panel'
import { MuseumPanel } from '@/components/sim/museum-panel'
import { useSimulation } from '@/components/sim/use-simulation'
import type { Species } from '@/lib/sim/types'
import { cn } from '@/lib/utils'

export default function Home() {
  const sim = useSimulation()
  const [tab, setTab] = useState('ambiente')
  const { ui } = sim

  const phase = (ui.time / ui.env.dayLength) % 1
  const phaseInfo =
    phase < 0.25
      ? { icon: Sunrise, label: 'Mañana' }
      : phase < 0.5
        ? { icon: Sun, label: 'Tarde' }
        : phase < 0.75
          ? { icon: Sunset, label: 'Atardecer' }
          : { icon: Moon, label: 'Noche' }
  const PhaseIcon = phaseInfo.icon
  const tempClass =
    ui.ambientTemp > 33
      ? 'text-rose-400'
      : ui.ambientTemp < 10
        ? 'text-teal-300'
        : ''

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SimHeader sim={sim} />

      <main className="mx-auto grid w-full max-w-[1800px] flex-1 grid-cols-1 gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <Card className="relative h-[46vh] min-h-[320px] overflow-hidden p-0 lg:h-[calc(100vh-146px)]">
          <SimCanvas sim={sim} onSelect={() => setTab('inspector')} />

          {/* HUD en vivo */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Chip icon={PhaseIcon}>
                  Día {ui.day} · {phaseInfo.label}
                </Chip>
                <Chip icon={Thermometer} className={tempClass}>
                  {ui.ambientTemp.toFixed(1)}°C
                </Chip>
                <Chip icon={Droplets}>{Math.round(ui.humidity)}%</Chip>
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                <Chip icon={Bug} className="text-amber-500">
                  {ui.counts.flies}
                </Chip>
                <Chip icon={Worm} className="text-emerald-500">
                  {ui.counts.worms}
                </Chip>
                <Chip icon={Dna}>G{ui.maxGen}</Chip>
                {ui.extinctFly && (
                  <Chip
                    icon={Bug}
                    className="border-rose-500/50 text-rose-400"
                  >
                    Moscas extintas
                  </Chip>
                )}
                {ui.extinctWorm && (
                  <Chip
                    icon={Worm}
                    className="border-rose-500/50 text-rose-400"
                  >
                    Gusanos extintos
                  </Chip>
                )}
              </div>
            </div>

            <div className="flex items-end justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-background/70 px-2 py-1 backdrop-blur">
                <Legend color="bg-zinc-400" label="Moscón" />
                <Legend color="bg-emerald-400" label="Gusano" />
                <Legend color="bg-red-500" label="Fruta" />
                <Legend color="bg-stone-500" label="Detrito" />
                <Legend color="bg-zinc-100" label="Azúcar" />
                <Legend color="bg-violet-500" label="Veneno" />
              </div>
              <span className="hidden rounded-md bg-background/60 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur sm:block">
                Haz clic en una criatura para inspeccionar su cerebro
              </span>
            </div>
          </div>

          {sim.paused && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="rounded-full border border-amber-500/40 bg-background/70 px-4 py-1.5 text-sm font-semibold tracking-[0.25em] text-amber-500 backdrop-blur">
                PAUSADO
              </span>
            </div>
          )}
        </Card>

        <div className="nice-scroll lg:h-[calc(100vh-146px)] lg:overflow-y-auto lg:pr-1">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="ambiente" className="gap-1.5">
                <CloudSun className="size-3.5" />
                <span className="hidden sm:inline">Ambiente</span>
              </TabsTrigger>
              <TabsTrigger value="inspector" className="gap-1.5">
                <Brain className="size-3.5" />
                <span className="hidden sm:inline">Inspector</span>
              </TabsTrigger>
              <TabsTrigger value="datos" className="gap-1.5">
                <Activity className="size-3.5" />
                <span className="hidden sm:inline">Datos</span>
              </TabsTrigger>
              <TabsTrigger value="museo" className="gap-1.5">
                <Archive className="size-3.5" />
                <span className="hidden sm:inline">Museo</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ambiente" className="mt-3">
              <EnvironmentPanel env={ui.env} onChange={sim.setEnv} />
            </TabsContent>
            <TabsContent value="inspector" className="mt-3">
              <InspectorPanel
                selected={ui.selected}
                onFollow={(s: Species) => sim.followRandom(s)}
                onRelease={sim.deselect}
              />
            </TabsContent>
            <TabsContent value="datos" className="mt-3">
              <StatsPanel ui={ui} onReintroduce={sim.reintroduce} />
            </TabsContent>
            <TabsContent value="museo" className="mt-3">
              <MuseumPanel
                onGetElite={sim.getElite}
                onSeed={sim.seedFromRecord}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <footer className="mt-auto border-t bg-background/60">
        <div className="mx-auto flex w-full max-w-[1800px] flex-wrap items-center justify-between gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
          <span>
            NeuroEvo — evolución con redes neuronales · 30 ticks/s · selección
            natural en vivo
          </span>
          <span className="hidden sm:inline">
            Moscas vs. gusanos · clima dinámico · Museo de la Evolución
            persistente
          </span>
        </div>
      </footer>
    </div>
  )
}

function Chip({
  icon: Icon,
  children,
  className,
}: {
  icon: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border bg-background/75 px-2 py-0.5 text-[11px] font-medium tabular-nums shadow-sm backdrop-blur',
        className,
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      <span className={cn('size-2 rounded-full', color)} />
      {label}
    </span>
  )
}
