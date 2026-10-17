'use client'

// Panel de estadísticas: KPIs + gráficas recharts (población, velocidad,
// generación media) y reintroducción de especies extintas.

import { Bug, Dna, Hourglass, Sprout, Worm } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Species, StatPoint, WorldView } from '@/lib/sim/types'
import { cn } from '@/lib/utils'

interface Props {
  ui: WorldView
  onReintroduce: (s: Species) => void
}

interface Series {
  key: keyof StatPoint & string
  color: string
  name: string
  /** Patrón de guiones del trazo (p. ej. huevos). */
  dash?: string
}

const FLY_COLOR = '#f59e0b'
const WORM_COLOR = '#10b981'
const EGG_COLOR = '#fbbf24'

const tooltipStyle = {
  background: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
}

export function StatsPanel({ ui, onReintroduce }: Props) {
  const totalFood = ui.counts.fruit + ui.counts.detritus + ui.counts.sugar

  return (
    <div className="space-y-4">
      {(ui.extinctFly || ui.extinctWorm) && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
          <p className="font-medium">Especie extinta</p>
          <p className="mt-0.5 leading-relaxed">
            La selección natural fue demasiado dura. Puedes reintroducir
            individuos con cerebros aleatorios o sembrar élites del Museo.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ui.extinctFly && (
              <Button size="sm" variant="outline" onClick={() => onReintroduce('fly')}>
                <Sprout className="mr-1.5 size-3.5" />
                Reintroducir 15 moscas
              </Button>
            )}
            {ui.extinctWorm && (
              <Button size="sm" variant="outline" onClick={() => onReintroduce('worm')}>
                <Sprout className="mr-1.5 size-3.5" />
                Reintroducir 15 gusanos
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi label="Moscas" value={ui.counts.flies} icon={<Bug className="size-3.5 text-amber-500" />} />
        <Kpi label="Gusanos" value={ui.counts.worms} icon={<Worm className="size-3.5 text-emerald-500" />} />
        <Kpi label="Gen. máxima" value={ui.maxGen} icon={<Dna className="size-3.5 text-emerald-500" />} />
        <Kpi label="Comida" value={totalFood} icon={<Hourglass className="size-3.5 text-muted-foreground" />} />
        <Kpi label="Nacimientos" value={ui.births} />
        <Kpi label="Muertes" value={ui.deaths} />
        <Kpi label="Día" value={ui.day} />
        <Kpi label="Tiempo sim" value={formatTime(ui.time)} />
      </div>

      <ChartCard
        title="Población"
        description="Moscas, gusanos y huevos puestos a lo largo del tiempo."
        data={ui.stats}
        series={[
          { key: 'flies', color: FLY_COLOR, name: 'Moscas' },
          { key: 'worms', color: WORM_COLOR, name: 'Gusanos' },
          { key: 'eggs', color: EGG_COLOR, name: 'Huevos', dash: '4 3' },
        ]}
      />
      <ChartCard
        title="Velocidad media"
        description="Cómo evoluciona el ritmo de cada especie (u/s)."
        data={ui.stats}
        series={[
          { key: 'flySpeed', color: FLY_COLOR, name: 'Moscas' },
          { key: 'wormSpeed', color: WORM_COLOR, name: 'Gusanos' },
        ]}
      />
      <ChartCard
        title="Generación media"
        description="El ritmo generacional refleja el éxito reproductivo."
        data={ui.stats}
        series={[
          { key: 'flyGen', color: FLY_COLOR, name: 'Moscas' },
          { key: 'wormGen', color: WORM_COLOR, name: 'Gusanos' },
        ]}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  icon,
}: {
  label: string
  value: number | string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-semibold leading-tight tabular-nums">
        {value}
      </div>
    </div>
  )
}

function ChartCard({
  title,
  description,
  data,
  series,
}: {
  title: string
  description: string
  data: StatPoint[]
  series: Series[]
}) {
  const hasData = data.length >= 2
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <CardDescription className="text-[11px]">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickFormatter={formatTime}
                  minTickGap={30}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={42}
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--muted-foreground)' }}
                  labelFormatter={(t) => `t = ${formatTime(Number(t))}`}
                />
                {series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color}
                    strokeWidth={1.8}
                    strokeDasharray={s.dash}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Skeleton className="h-full w-full rounded-lg opacity-30" />
            <span className="text-[11px]">Recolectando datos…</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
