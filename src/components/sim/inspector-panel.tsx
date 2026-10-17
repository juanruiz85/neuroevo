'use client'

// Inspector neuronal: ficha de la criatura seleccionada + su cerebro en vivo.

import {
  Baby,
  Bug,
  Dna,
  Gauge,
  Radar,
  Thermometer,
  UtensilsCrossed,
  Worm,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { BrainView } from '@/components/sim/brain-view'
import {
  SPECIES_CONFIG,
  type CreatureView,
  type Species,
} from '@/lib/sim/types'
import { cn } from '@/lib/utils'

interface Props {
  selected: CreatureView | null
  onFollow: (s: Species) => void
  onRelease: () => void
}

export function InspectorPanel({ selected, onFollow, onRelease }: Props) {
  if (!selected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          <div className="grid size-14 place-items-center rounded-full bg-muted">
            <Bug className="size-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Ninguna criatura seleccionada</p>
            <p className="mx-auto max-w-[240px] text-xs leading-relaxed text-muted-foreground">
              Haz clic en una criatura del mapa para abrir su red neuronal en
              vivo, o sigue una al azar.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onFollow('fly')}>
              <Bug className="mr-1.5 size-3.5 text-amber-500" />
              Seguir una mosca
            </Button>
            <Button variant="outline" size="sm" onClick={() => onFollow('worm')}>
              <Worm className="mr-1.5 size-3.5 text-emerald-500" />
              Seguir un gusano
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const c = selected
  const cfg = SPECIES_CONFIG[c.species]
  const energyPct = Math.max(0, Math.min(100, (c.energy / c.maxEnergy) * 100))
  const agePct = Math.min(100, (c.age / c.maxAge) * 100)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-lg',
                  c.species === 'fly'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-emerald-500/15 text-emerald-500',
                )}
              >
                {c.species === 'fly' ? (
                  <Bug className="size-5" />
                ) : (
                  <Worm className="size-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 font-semibold leading-none">
                  {cfg.label} #{c.id}
                  <Badge variant="outline" className="font-mono text-[10px]">
                    G{c.generation}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  linaje: hijo de G{c.parentGen} · posición ({c.x}, {c.y})
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={onRelease}
              aria-label="Soltar selección"
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <Bar
              label={`Energía ${Math.max(0, Math.round(c.energy))}/${c.maxEnergy}`}
              pct={energyPct}
              color={energyPct > 50 ? 'bg-emerald-500' : energyPct > 25 ? 'bg-amber-500' : 'bg-rose-500'}
            />
            <Bar
              label={`Edad ${Math.round(c.age)}s / ${c.maxAge}s`}
              pct={agePct}
              color="bg-emerald-700"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat icon={Gauge} label="Velocidad" value={`${c.speed.toFixed(0)} u/s`} sub={`máx ${c.maxSpeed.toFixed(0)}`} />
            <Stat icon={Radar} label="Visión efectiva" value={`${c.effVision.toFixed(0)} px`} sub={`base ${c.vision.toFixed(0)}`} />
            <Stat icon={Thermometer} label="Temp. corporal" value={`${c.bodyTemp.toFixed(1)}°C`} />
            <Stat icon={UtensilsCrossed} label="Comidas" value={`${c.foodEaten}`} />
            <Stat icon={Baby} label="Hijos" value={`${c.children}`} />
            <Stat icon={Zap} label="Aptitud" value={`${c.fitness}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Dna className="size-4 text-emerald-500" />
            Cerebro en vivo
          </CardTitle>
          <CardDescription className="text-[11px]">
            12 sensores → 8 neuronas → 3 motores. Verde = excitación, rojo =
            inhibición; el grosor es la fuerza sináptica.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrainView creature={c} />
        </CardContent>
      </Card>
    </div>
  )
}

function Bar({
  label,
  pct,
  color,
}: {
  label: string
  pct: number
  color: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-200', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border bg-card/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
        {value}
      </div>
      {sub ? (
        <div className="text-[10px] text-muted-foreground">{sub}</div>
      ) : null}
    </div>
  )
}
