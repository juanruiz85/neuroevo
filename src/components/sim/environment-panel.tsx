'use client'

// Panel de ambiente: presets climáticos + sliders en vivo.

import { useState } from 'react'
import {
  Apple,
  Clock,
  CloudRain,
  Droplets,
  Flame,
  Info,
  Skull,
  Snowflake,
  Sun,
  Thermometer,
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
import { Slider } from '@/components/ui/slider'
import { DEFAULT_ENV, type EnvParams } from '@/lib/sim/types'

interface Props {
  env: EnvParams
  onChange: (patch: Partial<EnvParams>) => void
}

interface SliderDef {
  key: keyof EnvParams
  label: string
  icon: LucideIcon
  min: number
  max: number
  step: number
  unit: string
  hint: string
}

const SLIDERS: SliderDef[] = [
  {
    key: 'temperature',
    label: 'Temperatura',
    icon: Thermometer,
    min: 0,
    max: 45,
    step: 1,
    unit: '°C',
    hint: 'Frío < 10°: baja el voltaje neural y las adormece · Calor > 33°: queman energía y puede ser mortal',
  },
  {
    key: 'humidity',
    label: 'Humedad',
    icon: Droplets,
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    hint: 'Por encima de 70% llueve: brotan más detritos, las moscas vuelan pesado y ven menos',
  },
  {
    key: 'dayLength',
    label: 'Ciclo día / noche',
    icon: Clock,
    min: 15,
    max: 180,
    step: 5,
    unit: ' s',
    hint: 'Duración de un día completo. Las moscas ven de día; los gusanos aprovechan la noche húmeda',
  },
  {
    key: 'foodRate',
    label: 'Abundancia de comida',
    icon: Apple,
    min: 0,
    max: 3,
    step: 0.1,
    unit: '×',
    hint: 'Frutas (moscas), detritos (gusanos) y azúcar compartida: la competencia directa',
  },
  {
    key: 'poisonRate',
    label: 'Veneno',
    icon: Skull,
    min: 0,
    max: 2,
    step: 0.1,
    unit: '×',
    hint: 'Blobs violeta que drenan 32 de energía: presión selectiva extra',
  },
]

interface Preset {
  name: string
  icon: LucideIcon
  env: Partial<EnvParams>
}

const PRESETS: Preset[] = [
  {
    name: 'Templado',
    icon: Sun,
    env: { temperature: 24, humidity: 55, foodRate: 1, poisonRate: 0.4, dayLength: 60 },
  },
  {
    name: 'Ola de calor',
    icon: Flame,
    env: { temperature: 39, humidity: 22, foodRate: 1.2, poisonRate: 0.8, dayLength: 90 },
  },
  {
    name: 'Monzón',
    icon: CloudRain,
    env: { temperature: 27, humidity: 96, foodRate: 1.6, poisonRate: 0.4, dayLength: 45 },
  },
  {
    name: 'Era de hielo',
    icon: Snowflake,
    env: { temperature: 4, humidity: 40, foodRate: 0.7, poisonRate: 0.2, dayLength: 120 },
  },
  {
    name: 'Banquete',
    icon: Apple,
    env: { temperature: 24, humidity: 60, foodRate: 2.6, poisonRate: 0.3, dayLength: 60 },
  },
  {
    name: 'Jardín tóxico',
    icon: Skull,
    env: { temperature: 26, humidity: 60, foodRate: 1, poisonRate: 2, dayLength: 60 },
  },
]

function formatValue(v: number, unit: string): string {
  return `${Number.isInteger(v) ? v : v.toFixed(1)}${unit}`
}

export function EnvironmentPanel({ env, onChange }: Props) {
  const [local, setLocal] = useState<EnvParams>({ ...env })

  const update = (patch: Partial<EnvParams>) => {
    setLocal((prev) => ({ ...prev, ...patch }))
    onChange(patch)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sun className="size-4 text-amber-500" />
            Presets climáticos
          </CardTitle>
          <CardDescription>
            Escenarios listos para poner a prueba a tus criaturas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.name}
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={() => update(p.env)}
            >
              <p.icon className="mr-1.5 size-3.5 opacity-80" />
              {p.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-sm">Variables ambientales</CardTitle>
          <CardDescription>
            Se aplican en vivo: la selección natural hace el resto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {SLIDERS.map((s) => {
            const Icon = s.icon
            const value = local[s.key]
            return (
              <div key={s.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className="size-3.5" />
                    {s.label}
                  </label>
                  <Badge
                    variant="secondary"
                    className="font-mono text-[11px] tabular-nums"
                  >
                    {formatValue(value, s.unit)}
                  </Badge>
                </div>
                <Slider
                  value={[value]}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  onValueChange={([v]) => update({ [s.key]: v } as Partial<EnvParams>)}
                  aria-label={s.label}
                />
                <p className="text-[10px] leading-snug text-muted-foreground/70">
                  {s.hint}
                </p>
              </div>
            )
          })}
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => update(DEFAULT_ENV)}
          >
            Valores por defecto
          </Button>
        </CardContent>
      </Card>

      <p className="flex gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Cada criatura nace con una red neuronal aleatoria. Las que comen y se
        reproducen dejan descendencia con cerebros mutados: tras varias
        generaciones verás comportamientos cada vez más eficientes.
      </p>
    </div>
  )
}
