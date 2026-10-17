'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Modo Laboratorio de neurobiología — el panel del experimentalista.
//
// El motor ya está calibrado (el circuito del tap replica Rankin 1990, banco
// 5/5). Este panel lo ORQUESTA:
//   1. Preparar el plato: líneas de laboratorio (conectoma real + genoma
//      isogénico) o ANN de control.
//   2. Los 6 estímulos clásicos (tap, sombra que crece, flash, calor, gota
//      de comida, chorro de aire) sobre el animal vigilado.
//   3. Ablación virtual por clase neuronal (knockouts → V≡0, Chalfie 1985).
//   4. Trazas en vivo del cerebro seleccionado (pools de salida, 10 Hz).
//   5. Protocolo estrella: habituación al tap de Rankin, Broster & Wicks
//      (1990) — 20 taps, curva por ensayo en vivo y exportación JSON.
//   6. Clima del plato (temperatura).
// —————————————————————————————————————————————————————————————————————————————

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity,
  Apple,
  BarChart3,
  Bug,
  CloudMoon,
  Cpu,
  Download,
  FlaskConical,
  Flame,
  Info,
  MousePointerClick,
  Play,
  RotateCcw,
  Scissors,
  Square,
  Thermometer,
  Trash2,
  Vibrate,
  Wind,
  Worm,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SimApi } from '@/components/sim/use-simulation'
import { knockoutGroups } from '@/lib/sim/connectome/knockouts'
import { elegansLabGenome } from '@/lib/sim/connectome/elegans'
import { drosophilaLabGenome } from '@/lib/sim/connectome/drosophila'
import type { BrainKind } from '@/lib/sim/connectome/adapter'
import type { Species, StimKind, TracePoint } from '@/lib/sim/types'

// ——— Constantes visuales del laboratorio (sin indigo/azul) ————————————————

const EMERALD = '#10b981'
const ROSE = '#f43f5e'
const AMBER = '#f59e0b'
const SLATE = '#94a3b8'

const chartTooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
}

/** Centro del plato (mundo 1280×840). */
const CENTER = { x: 640, y: 420 }

// ——— Protocolo de habituación ————————————————————————————————————————————————

const TOTAL_TAPS = 20
const TAP_INTERVAL_MS = 1600
/** Ventana de respuesta medida tras cada tap (s de simulación). */
const WINDOW_S = 0.6
/** Cierre de emergencia de un ensayo sin datos (ms de reloj, sin pausa). */
const TRIAL_TIMEOUT_MS = 5000

interface Trial {
  n: number
  /** Tiempo de simulación del tap. */
  t: number
  /** Amplitud de respuesta (deflexión motora neta de la ventana). */
  amp: number
  /** Máximo de la serie de picos en la ventana (extra para el JSON). */
  spike: number
}

interface PendingTrial {
  t0: number
  end: number
  /** Línea base pre-tap (media de la deflexión en los 0,4 s previos). */
  base: number
  maxResp: number
  spikeMax: number
  firedAt: number
}

interface Summary {
  decayPct: number | null
  first: number
  last: number
  partial: boolean
  why: 'completo' | 'cancelado' | 'plato vacío'
}

interface SubjectInfo {
  species: Species
  brainKind: BrainKind
  id: number
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000
const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)

const SPECIES_LABEL: Record<Species, string> = { worm: 'Gusano', fly: 'Mosca' }

function kindLabel(kind: BrainKind): string {
  if (kind === 'elegans') return 'conectoma C. elegans'
  if (kind === 'drosophila') return 'conectoma Drosophila'
  return 'ANN de control (sin trazas)'
}

// ═════════════════════════════════════════════════════════════════════════════

export function LabPanel({ sim }: { sim: SimApi }) {
  return (
    <div className="space-y-3">
      <PlateCard sim={sim} />
      <StimuliCard sim={sim} />
      <KnockoutCard sim={sim} />
      <TracesCard sim={sim} />
      <HabituationCard sim={sim} />
      <ClimateCard sim={sim} />
    </div>
  )
}

// ——— 1. Preparar el plato ————————————————————————————————————————————————————

function PlateCard({ sim }: { sim: SimApi }) {
  const { ui } = sim
  const total = ui.counts.worms + ui.counts.flies
  const [annSpecies, setAnnSpecies] = useState<Species>('worm')

  /** Suelta un animal y lo deja vigilado (selección + refresco). */
  const drop = (species: Species, kind: BrainKind, genome?: Float32Array) => {
    const w = sim.getWorld()
    if (!w) return
    const x = CENTER.x + (Math.random() - 0.5) * 110
    const y = CENTER.y + (Math.random() - 0.5) * 90
    w.spawnAt(species, kind, x, y, genome)
    sim.selectAt(x, y) // selecciona (distancia 0) y refresca el snapshot
  }

  const retireAll = () => {
    const w = sim.getWorld()
    if (!w) return
    w.creatures.length = 0
    w.eggs.length = 0
    w.selectedId = null
    sim.deselect() // refresca el snapshot
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FlaskConical className="size-4 text-teal-400" />
          Laboratorio de neurobiología
        </CardTitle>
        <CardDescription className="text-[11px]">
          Eres el experimentalista: prepara el plato con líneas de laboratorio
          (conectomas reales), aplica estímulos controlados y silencia
          circuitos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-auto flex-col items-center gap-1 border-emerald-500/40 py-2.5 text-emerald-600 hover:border-emerald-500/80 hover:bg-emerald-500/10 hover:text-emerald-500 dark:text-emerald-400"
            onClick={() => drop('worm', 'elegans', elegansLabGenome())}
            aria-label="Soltar un gusano de laboratorio con conectoma de C. elegans"
          >
            <Worm className="size-4" />
            <span className="text-xs font-semibold leading-tight">
              Gusano de laboratorio
            </span>
            <span className="text-[10px] font-normal leading-tight text-muted-foreground">
              C. elegans · línea isogénica (N2)
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto flex-col items-center gap-1 border-amber-500/40 py-2.5 text-amber-600 hover:border-amber-500/80 hover:bg-amber-500/10 hover:text-amber-500 dark:text-amber-400"
            onClick={() => drop('fly', 'drosophila', drosophilaLabGenome())}
            aria-label="Soltar una mosca de laboratorio con conectoma de Drosophila"
          >
            <Bug className="size-4" />
            <span className="text-xs font-semibold leading-tight">
              Mosca de laboratorio
            </span>
            <span className="text-[10px] font-normal leading-tight text-muted-foreground">
              Drosophila · genoma calibrado
            </span>
          </Button>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Control experimental (ANN, sin conectoma)
          </p>
          <div className="flex items-stretch gap-2">
            <ToggleGroup
              type="single"
              value={annSpecies}
              onValueChange={(v) => {
                if (v) setAnnSpecies(v as Species)
              }}
              variant="outline"
              aria-label="Especie del cuerpo del ANN de control"
            >
              <ToggleGroupItem
                value="worm"
                className="h-10 gap-1 px-2.5 text-[11px]"
                aria-label="ANN en cuerpo de gusano"
              >
                <Worm className="size-3.5" />
                Gusano
              </ToggleGroupItem>
              <ToggleGroupItem
                value="fly"
                className="h-10 gap-1 px-2.5 text-[11px]"
                aria-label="ANN en cuerpo de mosca"
              >
                <Bug className="size-3.5" />
                Mosca
              </ToggleGroupItem>
            </ToggleGroup>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 flex-1 gap-1.5 border border-dashed text-[11px] text-muted-foreground"
                  onClick={() => drop(annSpecies, 'ann')}
                  aria-label="Soltar un ANN de control de la especie elegida"
                >
                  <Cpu className="size-3.5" />
                  Soltar ANN de control
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-52 text-[11px]">
                Red 12→8→3 evolutiva, sin conectoma: el control experimental
                para comparar con el cerebro biológico (no emite trazas).
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px] text-emerald-500">
              <Worm className="size-3" />
              Gusanos {ui.counts.worms}
            </Badge>
            <Badge variant="outline" className="gap-1 text-[10px] text-amber-500">
              <Bug className="size-3" />
              Moscas {ui.counts.flies}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-2 text-[11px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            onClick={retireAll}
            disabled={total === 0}
            aria-label="Retirar todos los animales del plato"
          >
            <Trash2 className="size-3.5" />
            Retirar todos
          </Button>
        </div>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <MousePointerClick className="mt-0.5 size-3.5 shrink-0 text-teal-400" />
          Haz clic en un animal del plato para vigilar su cerebro (trazas,
          estímulos centrados y protocolo).
        </p>
      </CardContent>
    </Card>
  )
}

// ——— 2. Estímulos del plato ————————————————————————————————————————————————

interface StimDef {
  kind: StimKind
  label: string
  icon: LucideIcon
  title: string
  hint: string
  /** 'subject' → sobre el animal vigilado (o el centro); 'random' → cerca del centro. */
  target: 'subject' | 'random'
}

const STIMULI: readonly StimDef[] = [
  {
    kind: 'tap',
    label: 'Tap',
    icon: Vibrate,
    title: 'Tap al plato',
    target: 'subject',
    hint: 'Golpe mecánico: vibración global del agar + electrodo virtual sobre ALM/AVM/PLM → PVC/AVD (Wicks & Rankin 1997). En la mosca: mechano-Ch → DNs.',
  },
  {
    kind: 'shadow',
    label: 'Sombra',
    icon: CloudMoon,
    title: 'Sombra que crece',
    target: 'subject',
    hint: 'Disco oscuro expandiéndose sobre el animal (looming): escape visual — LITE-1/ASH en el gusano, PR → DNs en la mosca.',
  },
  {
    kind: 'flash',
    label: 'Flash',
    icon: Zap,
    title: 'Flash de luz',
    target: 'subject',
    hint: 'Pulso de luz breve y global: pico del canal visual (fotorreceptores).',
  },
  {
    kind: 'heat',
    label: 'Calor',
    icon: Flame,
    title: 'Pulso de calor',
    target: 'subject',
    hint: '+9 °C durante 3 s: termosensores (AFD del gusano; thermo-warm/cold de la mosca).',
  },
  {
    kind: 'foodDrop',
    label: 'Comida',
    icon: Apple,
    title: 'Gota de comida',
    target: 'random',
    hint: 'Deja una fruta cerca del centro: gradiente de olfato/gusto (AWC/ASE del gusano; ORNs/GRNs de la mosca).',
  },
  {
    kind: 'airPuff',
    label: 'Aire',
    icon: Wind,
    title: 'Chorro de aire',
    target: 'subject',
    hint: 'Soplo sobre el animal: empuje físico + ráfaga mecanosensorial/nociceptiva.',
  },
]

function StimuliCard({ sim }: { sim: SimApi }) {
  const apply = (s: StimDef) => {
    const sel = sim.ui.selected
    let x: number
    let y: number
    if (s.target === 'random') {
      x = CENTER.x + (Math.random() - 0.5) * 160
      y = CENTER.y + (Math.random() - 0.5) * 160
    } else if (sel) {
      x = sel.x
      y = sel.y
    } else {
      x = CENTER.x
      y = CENTER.y
    }
    sim.stimulate(s.kind, x, y)
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Estímulos del plato</CardTitle>
        <CardDescription className="text-[11px]">
          Cada estímulo excita el circuito sensorial real de la especie
          correspondiente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {STIMULI.map((s) => {
            const Icon = s.icon
            return (
              <Tooltip key={s.kind} delayDuration={200}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex h-auto flex-col items-center gap-1 py-2.5 text-[11px]"
                    onClick={() => apply(s)}
                    aria-label={`${s.title}: ${s.hint}`}
                  >
                    <Icon className="size-4 text-teal-400" />
                    {s.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-56 text-[11px]">
                  <span className="font-semibold">{s.title}.</span> {s.hint}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-teal-400" />
          Se centran en el animal vigilado (o en el centro del plato). Los
          estímulos son globales/posicionales: funcionan aunque no haya
          selección.
        </p>
      </CardContent>
    </Card>
  )
}

// ——— 3. Ablación virtual (knockouts) ———————————————————————————————————————

type KoMap = Record<string, boolean>

function KnockoutCard({ sim }: { sim: SimApi }) {
  const { ui } = sim

  const readKo = (sp: Species): KoMap => {
    const out: KoMap = {}
    for (const g of knockoutGroups(sp)) out[g.key] = sim.knockoutOn(sp, g.key)
    return out
  }

  const [ko, setKo] = useState<Record<Species, KoMap>>({
    worm: readKo('worm'),
    fly: readKo('fly'),
  })
  const [choice, setChoice] = useState<Species>('worm')

  // La lista DERIVA de la selección cuando la hay (sin efecto): el selector
  // manual solo manda con el plato sin animal vigilado.
  const selSpecies = ui.selected?.species
  const koSpecies: Species = selSpecies ?? choice

  const toggle = (species: Species, key: string, on: boolean) => {
    sim.setKnockout(species, key, on)
    setKo((prev) => ({ ...prev, [species]: { ...prev[species], [key]: on } }))
  }

  const activeOf = (sp: Species): number =>
    Object.values(ko[sp]).filter(Boolean).length
  const otherSpecies: Species = koSpecies === 'worm' ? 'fly' : 'worm'
  const activeTarget = activeOf(koSpecies)
  const activeOther = activeOf(otherSpecies)

  const restoreSpecies = (sp: Species) => {
    for (const g of knockoutGroups(sp)) {
      if (ko[sp][g.key]) sim.setKnockout(sp, g.key, false)
    }
    const blank: KoMap = {}
    for (const g of knockoutGroups(sp)) blank[g.key] = false
    setKo((prev) => ({ ...prev, [sp]: blank }))
  }

  const groups = knockoutGroups(koSpecies)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Scissors className="size-4 text-rose-400" />
          Ablación virtual (knockouts)
        </CardTitle>
        <CardDescription className="text-[11px]">
          Silencia clases neuronales reales (V≡0) — la ablación láser virtual
          de Chalfie et al. 1985.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            value={koSpecies}
            onValueChange={(v) => {
              if (v) setChoice(v as Species)
            }}
            variant="outline"
            size="sm"
            disabled={!!selSpecies}
            aria-label="Especie cuyos knockouts se editan"
          >
            <ToggleGroupItem value="worm" className="h-9 gap-1.5 text-[11px]">
              <Worm className="size-3.5" />
              Gusano
            </ToggleGroupItem>
            <ToggleGroupItem value="fly" className="h-9 gap-1.5 text-[11px]">
              <Bug className="size-3.5" />
              Mosca
            </ToggleGroupItem>
          </ToggleGroup>
          {selSpecies ? (
            <span className="text-[10px] text-muted-foreground">
              sigue al {SPECIES_LABEL[selSpecies].toLowerCase()} vigilado
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              sin selección: elige especie
            </span>
          )}
        </div>

        {activeTarget > 0 ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
            <p className="font-semibold">⚠ Ablación activa ({activeTarget})</p>
            <p className="mt-0.5">
              {activeTarget} circuito{activeTarget > 1 ? 's' : ''} del{' '}
              {SPECIES_LABEL[koSpecies].toLowerCase()} silenciado
              {activeTarget > 1 ? 's' : ''} — se aplica a todos los individuos
              de la especie en el plato (también a los que sueltes después).
              {activeOther > 0 &&
                ` El ${SPECIES_LABEL[otherSpecies].toLowerCase()} conserva ${activeOther} activo${activeOther > 1 ? 's' : ''}: cámbiale de selector para verlo.`}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1.5 h-9 gap-1.5 px-2 text-[11px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              onClick={() => restoreSpecies(koSpecies)}
              aria-label="Restaurar todos los circuitos silenciados de esta especie"
            >
              <RotateCcw className="size-3.5" />
              Restaurar todas
            </Button>
          </div>
        ) : (
          activeOther > 0 && (
            <p className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
              ⚠ El {SPECIES_LABEL[otherSpecies].toLowerCase()} conserva{' '}
              {activeOther} ablación{activeOther > 1 ? 'es' : ''} activa
              {activeOther > 1 ? 's' : ''} (cambia el selector para gestionarla).
            </p>
          )
        )}

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Cada ablación se aplica a todos los individuos de la especie del
          plato: sus neuronas quedan a V≡0 (ablación láser virtual).
        </p>

        <ul className="nice-scroll max-h-72 space-y-1 overflow-y-auto pr-1">
          {groups.map((g) => (
            <li
              key={g.key}
              className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 hover:bg-accent/50"
            >
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <span className="cursor-help text-left text-[11px] font-medium leading-tight">
                    {g.label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-56 text-[11px]">
                  {g.desc}
                </TooltipContent>
              </Tooltip>
              <Switch
                checked={ko[koSpecies][g.key] ?? false}
                onCheckedChange={(on) => toggle(koSpecies, g.key, on)}
                aria-label={`${ko[koSpecies][g.key] ? 'Restaurar' : 'Ablar'} ${g.label}`}
                className="data-[state=checked]:bg-rose-500"
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ——— 4. Trazas en vivo ————————————————————————————————————————————————————

interface TraceSeries {
  key: keyof TracePoint & string
  name: string
  color: string
}

/** Series del ploteado — colores del laboratorio y etiqueta de la serie
 * de reversa según la especie vigilada (reversa del gusano vs. asimetría
 * lateral de giro de la mosca). */
function traceSeries(species: Species): readonly TraceSeries[] {
  const isWorm = species === 'worm'
  return [
    { key: 'fwd', name: isWorm ? 'Avante (VB/DB)' : 'Avante (DN-VNC)', color: EMERALD },
    { key: 'rev', name: isWorm ? 'Reversa (VA/DA)' : 'Asimetría L/R (DNs)', color: AMBER },
    { key: 'egg', name: isWorm ? 'Puesta (HSN+VC)' : 'Puesta (DN-SEZ)', color: ROSE },
    { key: 'spike', name: 'Picos', color: SLATE },
  ]
}

function TracesCard({ sim }: { sim: SimApi }) {
  const { ui } = sim
  const sel = ui.selected

  let body: ReactNode
  if (!sel) {
    body = (
      <Hint icon={MousePointerClick}>
        Selecciona una criatura en el plato para registrar sus trazas.
      </Hint>
    )
  } else if (sel.brainKind === 'ann') {
    body = (
      <Hint icon={Cpu}>
        El control ANN no emite trazas de conectoma: suelta un animal con
        cerebro biológico (gusano o mosca de laboratorio).
      </Hint>
    )
  } else if (ui.traces.length < 2) {
    body = (
      <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-muted-foreground">
        <Skeleton className="h-full w-full rounded-lg opacity-30" />
        <span className="text-[11px]">Recolectando trazas…</span>
      </div>
    )
  } else {
    body = (
      <div className="h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ui.traces} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickFormatter={(t) => `${Math.round(Number(t))}s`}
              minTickGap={28}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              width={42}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <RTooltip
              contentStyle={chartTooltipStyle}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              labelFormatter={(t) => `t = ${Number(t).toFixed(1)} s`}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            />
            {traceSeries(sel.species).map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={1.8}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="size-4 text-teal-400" />
          Trazas en vivo
        </CardTitle>
        <CardDescription className="text-[11px]">
          {sel
            ? `Vigilado: ${SPECIES_LABEL[sel.species]} #${sel.id} · ${kindLabel(sel.brainKind)} · 10 Hz`
            : 'Pools de salida del cerebro seleccionado (muestreo 10 Hz).'}
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}

// ——— 5. Protocolo de habituación al tap (Rankin 1990) ———————————————————

function HabituationCard({ sim }: { sim: SimApi }) {
  const { ui } = sim
  const total = ui.counts.worms + ui.counts.flies
  // Sujetos con cerebro biológico en el plato (los ANN no emiten trazas:
  // no tienen conectoma que registrar). Se lee del mundo real en cada
  // render — el snapshot re-renderiza el panel ~4-5 veces por segundo.
  const world = sim.getWorld()
  let bioCount = 0
  if (world) {
    for (const c of world.creatures) if (c.alive && c.brain.kind !== 'ann') bioCount++
  }

  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle')
  const [trials, setTrials] = useState<Trial[]>([])
  const [fired, setFired] = useState(0)
  const [summary, setSummary] = useState<Summary | null>(null)

  const simRef = useRef(sim)
  useEffect(() => {
    simRef.current = sim
  }, [sim])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pendingRef = useRef<PendingTrial | null>(null)
  const trialsRef = useRef<Trial[]>([])
  const firedRef = useRef(0)
  const subjectRef = useRef<SubjectInfo | null>(null)

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const pushTrial = useCallback((tr: Trial) => {
    trialsRef.current = [...trialsRef.current, tr]
    setTrials(trialsRef.current)
  }, [])

  const finish = useCallback(
    (why: Summary['why']) => {
      clearTimer()
      const amps = trialsRef.current.map((t) => t.amp)
      const h = Math.max(1, Math.floor(amps.length / 2))
      const first = mean(amps.slice(0, h))
      const last = amps.length > 1 ? mean(amps.slice(h)) : 0
      setSummary({
        decayPct: amps.length >= 2 && first > 1e-6 ? Math.round((1 - last / first) * 100) : null,
        first: round3(first),
        last: round3(last),
        partial: why !== 'completo',
        why,
      })
      setPhase('done')
    },
    [clearTimer],
  )

  const closePending = useCallback(
    (finishIfComplete: boolean) => {
      const p = pendingRef.current
      if (!p) return
      pendingRef.current = null
      pushTrial({
        n: trialsRef.current.length + 1,
        t: round3(p.t0),
        amp: round3(Math.max(0, p.maxResp - p.base)),
        spike: round3(p.spikeMax),
      })
      if (
        finishIfComplete &&
        firedRef.current >= TOTAL_TAPS &&
        trialsRef.current.length >= TOTAL_TAPS
      ) {
        finish('completo')
      }
    },
    [pushTrial, finish],
  )

  /**
   * Garantiza un cerebro biológico vigilado: si no lo hay, selecciona al
   * primer gusano disponible (o la primera criatura con conectoma).
   */
  const ensureSubject = useCallback((): SubjectInfo | null => {
    const s = simRef.current
    const cur = s.ui.selected
    if (cur && cur.brainKind !== 'ann') {
      return { species: cur.species, brainKind: cur.brainKind, id: cur.id }
    }
    const w = s.getWorld()
    if (!w) return null
    const pool = w.creatures.filter((c) => c.alive && c.brain.kind !== 'ann')
    const cand = pool.find((c) => c.species === 'worm') ?? pool[0]
    if (!cand) return null
    if (!s.selectAt(cand.x, cand.y)) return null
    const sel = w.getSelected()
    return sel
      ? { species: sel.species, brainKind: sel.brain.kind, id: sel.id }
      : null
  }, [])

  const fireTap = useCallback(() => {
    const s = simRef.current
    const w = s.getWorld()
    if (!w) return
    closePending(true)
    // Línea base pre-tap (0,4 s) del buffer sin throttle del mundo.
    const pre = w.traces.slice(-4)
    const base = pre.length
      ? pre.reduce((a, p) => a + Math.max(p.fwd, Math.abs(p.rev)), 0) / pre.length
      : 0
    const sel = s.ui.selected
    const x = sel?.x ?? CENTER.x
    const y = sel?.y ?? CENTER.y
    const t0 = w.time
    s.stimulate('tap', x, y)
    pendingRef.current = {
      t0,
      end: t0 + WINDOW_S,
      base,
      maxResp: 0,
      spikeMax: 0,
      firedAt: Date.now(),
    }
    firedRef.current += 1
    setFired(firedRef.current)
  }, [closePending])

  const tick = useCallback(() => {
    if (simRef.current.paused) return // plato congelado: el tap no haría nada
    if (firedRef.current >= TOTAL_TAPS) {
      clearTimer()
      return
    }
    fireTap()
  }, [fireTap, clearTimer])

  const start = useCallback(() => {
    clearTimer()
    subjectRef.current = ensureSubject()
    if (!subjectRef.current) return // sin cerebro biológico: nada que medir
    trialsRef.current = []
    setTrials([])
    firedRef.current = 0
    setFired(0)
    setSummary(null)
    setPhase('running')
    // El primer tap llega tras un intervalo: deja al cerebro vigilado
    // estabilizar su línea base de trazas.
    intervalRef.current = setInterval(tick, TAP_INTERVAL_MS)
  }, [clearTimer, ensureSubject, tick])

  const stop = useCallback(() => {
    clearTimer()
    closePending(false)
    if (trialsRef.current.length >= 2) {
      finish('cancelado')
    } else {
      setPhase('idle')
      setSummary(null)
    }
  }, [clearTimer, closePending, finish])

  // Mide la ventana de respuesta del ensayo abierto con las trazas recién
  // publicadas (los puntos del mundo llegan a 10 Hz de tiempo de simulación).
  useEffect(() => {
    if (phase !== 'running') return
    const p = pendingRef.current
    if (!p) return
    let beyond = false
    let maxResp = 0
    let spikeMax = 0
    for (const tr of ui.traces) {
      if (tr.t < p.t0 - 0.05) continue
      if (tr.t > p.end) {
        beyond = true
        continue
      }
      if (tr.fwd > maxResp) maxResp = tr.fwd
      const asym = Math.abs(tr.rev)
      if (asym > maxResp) maxResp = asym
      if (tr.spike > spikeMax) spikeMax = tr.spike
    }
    if (maxResp > p.maxResp) p.maxResp = maxResp
    if (spikeMax > p.spikeMax) p.spikeMax = spikeMax
    const stalled =
      !simRef.current.paused && Date.now() - p.firedAt > TRIAL_TIMEOUT_MS
    if (beyond || stalled) closePending(true)
  }, [ui.traces, phase, closePending])

  // El plato quedó sin animales → el protocolo no tiene sujeto: se detiene.
  useEffect(() => {
    if (phase !== 'running' || total > 0) return
    closePending(false)
    finish('plato vacío')
  }, [phase, total, closePending, finish])

  // Limpieza al desmontar (cambio de modo): nunca dejes taps huérfanos.
  useEffect(() => () => clearTimer(), [clearTimer])

  const exportJson = () => {
    const subj = subjectRef.current
    const s = simRef.current
    const abl = (['worm', 'fly'] as const).flatMap((sp) =>
      knockoutGroups(sp)
        .filter((g) => s.knockoutOn(sp, g.key))
        .map((g) => `${sp === 'worm' ? 'gusano' : 'mosca'} · ${g.label}`),
    )
    const notas = `Ensayo ${summary?.why ?? 'en curso'} · ablaciones activas: ${
      abl.length ? abl.join(' | ') : 'ninguna'
    } · temperatura del plato ${s.ui.env.temperature.toFixed(1)} °C · protocolo Rankin 1990`
    const data = {
      format: 'neuroevo-habituacion',
      version: 1,
      fecha: new Date().toISOString(),
      especie: subj?.species ?? null,
      cerebro: subj?.brainKind ?? null,
      sujetoId: subj?.id ?? null,
      notas,
      protocolo: {
        taps: TOTAL_TAPS,
        intervalo_s: TAP_INTERVAL_MS / 1000,
        ventana_respuesta_s: WINDOW_S,
      },
      taps: trialsRef.current.map((t) => t.amp),
      ensayos: trialsRef.current.map((t) => ({
        n: t.n,
        t: t.t,
        amplitud: t.amp,
        picos: t.spike,
      })),
      decaimiento_pct: summary?.decayPct ?? null,
      referencia: 'Rankin, Broster & Wicks (1990) — habituación al tap en C. elegans',
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `neuroevo-habituacion-${subj?.species ?? 'plato'}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const subjectLine = ui.selected
    ? `${SPECIES_LABEL[ui.selected.species]} #${ui.selected.id} · ${kindLabel(ui.selected.brainKind)}`
    : 'ninguno (sin trazas: las amplitudes quedarán a 0)'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <BarChart3 className="size-4 text-emerald-500" />
          Habituación al tap — Rankin 1990
        </CardTitle>
        <CardDescription className="text-[11px]">
          El experimento estrella: 20 taps (uno cada 1,6 s) sobre el animal
          vigilado; si el circuito mecanorreceptor se habitúa, la respuesta
          decae ensayo a ensayo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sujeto: <span className="font-medium text-foreground">{subjectLine}</span>
        </p>

        {phase === 'idle' && (
          <>
            <Button
              className="w-full gap-2"
              onClick={start}
              disabled={bioCount === 0}
              aria-label="Ejecutar el protocolo de habituación con 20 taps"
            >
              <Play className="size-4" />
              Ejecutar {TOTAL_TAPS} taps ({TAP_INTERVAL_MS / 1000} s entre taps)
            </Button>
            {bioCount === 0 && (
              <Hint icon={Info}>
                Suelta primero un animal con conectoma (gusano o mosca de
                laboratorio): sin cerebro biológico vigilado no hay respuesta
                que medir.
              </Hint>
            )}
          </>
        )}

        {phase === 'running' && (
          <>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {fired === 0
                    ? 'Estabilizando la línea base del cerebro vigilado…'
                    : `Taps: ${fired}/${TOTAL_TAPS} · ensayos medidos: ${trials.length}/${TOTAL_TAPS}`}
                </span>
                <span className="font-mono tabular-nums">
                  {Math.round((fired / TOTAL_TAPS) * 100)}%
                </span>
              </div>
              <Progress
                value={(fired / TOTAL_TAPS) * 100}
                className="h-1.5"
                aria-label="Progreso del protocolo de habituación"
              />
            </div>
            {(!ui.selected || ui.selected.brainKind === 'ann') && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                Sin cerebro biológico vigilado: haz clic en un animal del plato
                (las amplitudes sin trazas se registran como 0).
              </div>
            )}
            {trials.length > 0 ? (
              <TrialChart trials={trials} />
            ) : (
              <div className="flex h-[120px] items-center justify-center text-[11px] text-muted-foreground">
                Esperando el primer ensayo…
              </div>
            )}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Consejo: no apliques otros estímulos durante el ensayo — un
              estímulo fuerte distinto produce deshabituación (resetea la
              curva).
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-full gap-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              onClick={stop}
              aria-label="Detener el protocolo"
            >
              <Square className="size-3.5" />
              Detener protocolo
            </Button>
          </>
        )}

        {phase === 'done' && summary && (
          <>
            <SummaryBox summary={summary} />
            {trials.length > 0 && <TrialChart trials={trials} />}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5"
                onClick={exportJson}
                disabled={trials.length === 0}
                aria-label="Exportar el ensayo como JSON"
              >
                <Download className="size-3.5" />
                Exportar ensayo (JSON)
              </Button>
              <Button size="sm" className="h-9 gap-1.5" onClick={start}>
                <RotateCcw className="size-3.5" />
                Repetir protocolo
              </Button>
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Protocolo clásico de habituación al tap — Rankin, Broster &amp;
              Wicks (1990). La recuperación espontánea llega tras ~1 min de
              reposo: espera y repite el ensayo para verla.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TrialChart({ trials }: { trials: Trial[] }) {
  return (
    <div className="h-[120px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trials} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="n"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickFormatter={(v) => `#${v}`}
            minTickGap={6}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            width={42}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <RTooltip
            contentStyle={chartTooltipStyle}
            labelStyle={{ color: 'var(--muted-foreground)' }}
            labelFormatter={(v) => `Ensayo #${v}`}
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          />
          <Bar
            dataKey="amp"
            name="Amplitud"
            fill={EMERALD}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SummaryBox({ summary }: { summary: Summary }) {
  const dec = summary.decayPct
  const partialNote =
    summary.why === 'cancelado'
      ? ' Protocolo detenido manualmente antes de tiempo.'
      : summary.why === 'plato vacío'
        ? ' El plato quedó sin animales: ensayo incompleto.'
        : ''
  if (dec === null) {
    const tooShort = summary.first > 1e-6
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] leading-relaxed text-rose-600 dark:text-rose-400">
        <p className="font-semibold">
          {tooShort ? 'Ensayo demasiado corto' : 'Sin respuesta medible'}
        </p>
        <p className="mt-0.5">
          {tooShort
            ? `Solo se registró respuesta en los primeros ensayos (${summary.first.toFixed(
                3,
              )}): hace falta al menos un par de taps para medir el decaimiento.`
            : 'No se registró deflexión motora frente a la línea base. ¿Había un animal con conectoma vigilado? Recuerda que la ablación de ALM/AVM+PLM elimina el reflejo del tap (Wicks & Rankin 1997).'}
          {partialNote}
        </p>
      </div>
    )
  }
  if (dec >= 30) {
    return (
      <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-[11px] leading-relaxed text-emerald-600 dark:text-emerald-400">
        <p className="font-semibold">Habituación observada</p>
        <p className="mt-0.5">
          Respuesta inicial {summary.first.toFixed(3)} → final{' '}
          {summary.last.toFixed(3)} (decae {dec} %): la repetición deprime las
          sinapsis del circuito ALM/AVM/PLM → PVC/AVD. Deja el plato en reposo
          ~1 min y repite para ver la recuperación espontánea.{partialNote}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
      <p className="font-semibold">Decaimiento débil ({dec} %)</p>
      <p className="mt-0.5">
        Respuesta inicial {summary.first.toFixed(3)} → final{' '}
        {summary.last.toFixed(3)}: apenas cambió. ¿Estaba el circuito ya
        habituado de un ensayo anterior? Prueba tras un reposo más largo, o
        silencia ALM/PLM para comparar.{partialNote}
      </p>
    </div>
  )
}

// ——— 6. Clima del plato ———————————————————————————————————————————————————

function ClimateCard({ sim }: { sim: SimApi }) {
  const { ui } = sim
  const [temp, setTemp] = useState(() => ui.env.temperature)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Thermometer className="size-4 text-teal-400" />
          Clima del plato
        </CardTitle>
        <CardDescription className="text-[11px]">
          La temperatura modula el voltaje neural y la velocidad de
          desarrollo (Q10).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-lg font-semibold tabular-nums">
            {temp.toFixed(1)} °C
          </span>
          <span className="text-[11px] text-muted-foreground">
            plato ahora: {ui.ambientTemp.toFixed(1)} °C
          </span>
        </div>
        <Slider
          value={[temp]}
          min={16}
          max={32}
          step={0.5}
          onValueChange={(v) => {
            setTemp(v[0])
            sim.setEnv({ temperature: v[0] })
          }}
          aria-label="Temperatura del plato en grados centígrados"
        />
        <div className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0 text-teal-400" />
          20 °C: plato estándar de C. elegans · 25 °C: óptimo de Drosophila.
          Los pulsos de calor del laboratorio añaden +9 °C temporales sobre
          esta base.
        </div>
      </CardContent>
    </Card>
  )
}

// ——— Utilidades comunes ———————————————————————————————————————————————————

function Hint({
  icon: Icon,
  children,
}: {
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <p className="flex items-start gap-1.5 rounded-lg border border-dashed p-2.5 text-[11px] leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-teal-400" />
      {children}
    </p>
  )
}
