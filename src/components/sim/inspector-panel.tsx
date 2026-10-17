'use client'

// Inspector neuronal: ficha de la criatura seleccionada + su cerebro en vivo.

import {
  Baby,
  Brain,
  Bug,
  Dna,
  Egg,
  FileDown,
  Gauge,
  Hourglass,
  Network,
  Radar,
  Shield,
  Thermometer,
  UtensilsCrossed,
  Wind,
  Worm,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
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
  BRAIN_ARCH_LABEL,
  BrainExportButton,
  BrainImportButton,
  SPECIES_PLURAL,
  brainFileFromCreature,
  toSeedRecord,
  type BrainFileData,
} from '@/components/sim/brain-io'
import { SensorStrip } from '@/components/sim/sensor-strip'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  ELEGANS_INFO,
  SPECIES_CONFIG,
  WORM_LIFE,
  WORM_STAGE_LABEL,
  type CreatureView,
  type EvolutionRecordDTO,
  type Species,
  type WormStage,
} from '@/lib/sim'
import { cn } from '@/lib/utils'

interface Props {
  selected: CreatureView | null
  onFollow: (s: Species) => void
  onRelease: () => void
  /**
   * Siembra un cerebro importado (SimApi.seedFromRecord). Es opcional para no
   * romper la integración actual: si se proporciona, el Inspector muestra
   * también el botón «Importar y sembrar».
   */
  onSeed?: (rec: EvolutionRecordDTO) => number
}

export function InspectorPanel({
  selected,
  onFollow,
  onRelease,
  onSeed,
}: Props) {
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
  const isElegans = c.brainKind === 'elegans' && c.connectome
  const spikes = c.connectome?.s.filter((x) => x === 1).length ?? 0
  const activity = c.connectome
    ? Math.round(
        (c.connectome.v.reduce((a, x) => a + Math.min(x, 1.4), 0) /
          (c.connectome.v.length * 1.4)) *
          100,
      )
    : 0

  // Cerebro importado → registro del motor → 8 individuos sembrados (sin
  // restricción de especie: seedFromRecord añade criaturas al mundo actual
  // funcione en el modo que funcione).
  const handleImportBrain = (data: BrainFileData) => {
    if (!onSeed) return
    const n = onSeed(toSeedRecord(data))
    if (n > 0) {
      toast.success(
        `Cerebro importado: ${n} individuos sembrados (${SPECIES_PLURAL[data.species]}, G${data.generation}).`,
      )
    } else {
      toast.error('No se pudo sembrar el cerebro importado.')
    }
  }

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
            {c.species === 'worm' ? (
              <WormStageBar c={c} />
            ) : (
              <Bar
                label={`Edad ${Math.round(c.age)}s / ${c.maxAge}s`}
                pct={agePct}
                color="bg-emerald-700"
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat icon={Gauge} label="Velocidad" value={`${c.speed.toFixed(0)} u/s`} sub={`máx ${c.maxSpeed.toFixed(0)}`} />
            <Stat icon={Radar} label="Visión efectiva" value={`${c.effVision.toFixed(0)} px`} sub={`base ${c.vision.toFixed(0)}`} />
            <Stat icon={Thermometer} label="Temp. corporal" value={`${c.bodyTemp.toFixed(1)}°C`} />
            <Stat icon={UtensilsCrossed} label="Comidas" value={`${c.foodEaten}`} />
            <Stat icon={Baby} label="Hijos" value={`${c.children}`} />
            <Stat icon={Zap} label="Aptitud" value={`${c.fitness}`} />
            {isElegans && (
              <>
                <Stat icon={Brain} label="Picos / tick" value={`${spikes}/${ELEGANS_INFO.neurons}`} sub="modelo LIF" />
                <Stat icon={Network} label="Actividad media" value={`${activity}%`} sub={`${ELEGANS_INFO.synapses} sinapsis reales`} />
              </>
            )}
            {c.species === 'worm' && (
              <>
                <Stat icon={Egg} label="Huevos puestos" value={`${c.eggsLaid ?? 0}`} sub="en el mundo" />
                <Stat icon={Hourglass} label="Huevos maduros" value={`${c.matureEggs ?? 0}`} sub="en útero" />
                <Stat icon={Dna} label="Esperma" value={`${c.spermLeft ?? 0}`} sub={`de ${WORM_LIFE.spermCap}`} />
                <Stat icon={Wind} label="Feromona" value={`${Math.round((c.pheromone ?? 0) * 100)}%`} sub="ascarósidos" />
                {c.stage === 'dauer' && (
                  <Stat
                    icon={Shield}
                    label="Resistencia dauer"
                    value={`${Math.round((1 - Math.max(0, Math.min(1, c.stagePct ?? 0))) * 100)}%`}
                    sub="reservas lipídicas"
                  />
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Dna className="size-4 text-emerald-500" />
            {isElegans ? 'Cerebro biológico en vivo' : 'Cerebro en vivo'}
            {isElegans && (
              <Badge variant="outline" className="font-mono text-[9px] text-amber-500">
                C. elegans · conectoma real
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-[11px]">
            {isElegans
              ? `Conectoma real de C. elegans: ${ELEGANS_INFO.neurons} neuronas y ${ELEGANS_INFO.synapses.toLocaleString('es')} sinapsis bajo un modelo LIF. Dos vistas: «Circuito vivo» sigue el flujo de los 17 sentidos hacia los pools motores, y «Anillo» muestra las 300 neuronas por clase.`
              : '12 sensores → 8 neuronas → 3 motores. Verde = excitación, rojo = inhibición; el grosor es la fuerza sináptica.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {c.brainKind === 'elegans' && <SensorStrip creature={c} />}
          <BrainView key={c.brainKind} creature={c} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileDown className="size-4 text-amber-500" />
            Cerebro portátil
          </CardTitle>
          <CardDescription className="text-[11px]">
            Guarda este cerebro como archivo .neuroevo.json para conservarlo o
            trasladarlo a otra simulación (incluye arquitectura, genoma y
            rasgos).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="px-1.5 py-0 font-mono text-[10px] leading-4"
            >
              {BRAIN_ARCH_LABEL[c.brainKind]}
            </Badge>
            <Badge
              variant="secondary"
              className="px-1.5 py-0 font-mono text-[10px] leading-4 tabular-nums"
            >
              {c.weights.length}{' '}
              {c.brainKind === 'ann' ? 'pesos' : 'genes'}
            </Badge>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            El archivo porta el genoma completo (la estructura del conectoma es
            compartida por toda la especie), listo para sembrarse en cualquier
            simulación y seguir evolucionando.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <BrainExportButton
              getBrain={() => brainFileFromCreature(c)}
              label="Exportar"
            />
            {onSeed ? (
              <BrainImportButton
                onParsed={handleImportBrain}
                label="Importar y sembrar"
                variant="secondary"
              />
            ) : (
              // Degradación elegante: sin onSeed el botón queda visible pero
              // deshabilitado, con tooltip que explica por qué.
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <BrainImportButton
                      onParsed={handleImportBrain}
                      label="Importar y sembrar"
                      variant="secondary"
                      disabled
                      title="La siembra no está disponible: este panel no está conectado al motor de simulación."
                    />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  La siembra no está disponible: este panel no está conectado al
                  motor de simulación.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
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

/** Fase del ciclo de vida del gusano (huevo→L1→…→adulto, con dauer). */
function WormStageBar({ c }: { c: CreatureView }) {
  const stage = c.stage
  if (!stage || c.stagePct === undefined) {
    // Salvaguarda: sin datos de fase se conserva la barra de edad clásica.
    const agePct = Math.min(100, (c.age / c.maxAge) * 100)
    return (
      <Bar
        label={`Edad ${Math.round(c.age)}s / ${c.maxAge}s`}
        pct={agePct}
        color="bg-emerald-700"
      />
    )
  }
  const pct = Math.round(Math.max(0, Math.min(1, c.stagePct)) * 100)
  const next: Record<WormStage, string | null> = {
    l1: 'L2',
    l2: 'L3',
    l3: 'L4',
    l4: 'Adulto',
    adult: null,
    dauer: null,
  }
  const isDauer = stage === 'dauer'
  const isAdult = stage === 'adult'
  // La insignia ya muestra la fase y la derecha el %: la nota aporta el rumbo
  // ("Fase L3 · 62% · hacia L4" se compone de badge + % + nota).
  const note = isDauer
    ? 'supervivencia'
    : isAdult
      ? `de ~${WORM_LIFE.adultMedian}s de vida`
      : `hacia ${next[stage]}`
  const badgeCls = isDauer
    ? 'border-purple-400/60 text-purple-300'
    : isAdult
      ? 'border-amber-400/60 text-amber-400'
      : 'border-emerald-400/60 text-emerald-400'
  const barCls = isDauer ? 'bg-purple-400' : isAdult ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn('shrink-0 px-1.5 py-0 font-mono text-[10px] leading-4', badgeCls)}
          >
            {WORM_STAGE_LABEL[stage]}
          </Badge>
          <span className="truncate">{note}</span>
        </span>
        <span className="shrink-0 tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-[width] duration-200', barCls)}
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
