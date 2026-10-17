'use client'

// "Sentidos en vivo": los 17 canales sensoriales del gusano (C. elegans)
// en versión DOM, accesible y con tooltips nativos. Complementa al riel
// de sensores del canvas "Circuito vivo": aquí cada fila explica qué
// neuronas reales excita cada sentido del mundo.
//
// Semántica de barras: los canales con signo (térmico, comida/veneno X-Y,
// propiocepción y Δ gradiente) usan una barra centrada — negativo hacia
// la izquierda en rosa, positivo hacia la derecha en esmeralda; el resto
// son magnitudes 0..1 con el color de su grupo. El canal 0 (tónico) es
// la referencia endógena del generador locomotor: valor fijo 1.

import {
  CH,
  SENSOR_CHANNELS,
  SENSOR_GROUP_COLOR,
  SENSOR_GROUP_LABEL,
  type SensorChannel,
  type SensorGroup,
} from '@/lib/sim'
import {
  FLY_GROUP_LABEL,
  FLY_SENSOR_CHANNELS,
  type FlySensorChannel,
} from '@/lib/sim/connectome/fly-sensors'
import type { CreatureView } from '@/lib/sim/types'
import { cn } from '@/lib/utils'

const GROUP_ORDER: readonly SensorGroup[] = [
  'motor',
  'interno',
  'quimico',
  'fisico',
  'social',
]

/** Canales con signo (barra centrada). */
const SIGNED: ReadonlySet<number> = new Set([
  CH.THERMO,
  CH.FOOD_X,
  CH.FOOD_Y,
  CH.POISON_X,
  CH.POISON_Y,
  CH.PROPRIO,
  CH.FOOD_DELTA,
])

export function SensorStrip({
  creature,
  variant = 'worm',
}: {
  creature: CreatureView
  variant?: 'worm' | 'fly'
}) {
  const isFly = variant === 'fly'
  const channels: readonly (SensorChannel & { ch?: number })[] | readonly FlySensorChannel[] =
    isFly ? FLY_SENSOR_CHANNELS : SENSOR_CHANNELS
  const groupColor = isFly ? SENSOR_GROUP_COLOR : SENSOR_GROUP_COLOR
  const groupLabel = isFly ? FLY_GROUP_LABEL : SENSOR_GROUP_LABEL
  const indexOf = (i: number, ch: (SensorChannel & { ch?: number }) | FlySensorChannel) =>
    isFly ? (ch as FlySensorChannel).ch : i
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Sentidos en vivo
        </p>
        <span className="font-mono text-[9px] text-muted-foreground">
          {isFly ? '18 canales → neuronas reales' : '17 canales → neuronas reales'}
        </span>
      </div>
      <div
        className="nice-scroll max-h-72 overflow-y-auto pr-1"
        role="list"
        aria-label={`Canales sensoriales ${isFly ? 'de la mosca' : 'del gusano'} en vivo`}
      >
        {GROUP_ORDER.map((g) => {
          const rows = channels
            .map((ch, i) => ({ ch, idx: indexOf(i, ch) }))
            .filter((r) => r.ch.group === g)
          if (rows.length === 0) return null
          return (
            <div key={g} role="group" aria-label={groupLabel[g]}>
              <p
                className="flex items-center gap-1.5 px-0.5 pb-0.5 pt-1 text-[9px] font-semibold uppercase tracking-wider"
                style={{ color: groupColor[g] }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: groupColor[g] }}
                />
                {groupLabel[g]}
              </p>
              {rows.map(({ ch, idx }) => (
                <SensorRow
                  key={ch.key}
                  channel={ch}
                  index={idx}
                  value={creature.inputs[idx] ?? 0}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SensorRow({
  channel,
  index,
  value,
}: {
  channel: (SensorChannel & { ch?: number }) | FlySensorChannel
  index: number
  value: number
}) {
  const signed = SIGNED.has(index)
  const tonic = index === CH.TONIC
  const mag = Math.min(1, Math.abs(value))
  return (
    <div
      className="flex items-center gap-2 py-[3px] pl-2"
      role="listitem"
      title={tonic ? `${channel.desc} (canal de referencia: valor fijo 1)` : channel.desc}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: SENSOR_GROUP_COLOR[channel.group] }}
        aria-hidden
      />
      <span className="w-[64px] shrink-0 text-[11px] leading-none">
        {channel.short}
      </span>
      <span className="w-[84px] shrink-0 truncate font-mono text-[9px] leading-none text-muted-foreground">
        {channel.neurons}
      </span>
      <div className="relative h-1.5 flex-1 rounded-full bg-muted">
        {signed ? (
          <>
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/40" />
            <span
              className={cn(
                'absolute inset-y-0 rounded-full',
                value < 0 ? 'right-1/2 bg-rose-400' : 'left-1/2 bg-emerald-400',
              )}
              style={{ width: `${mag * 50}%` }}
            />
          </>
        ) : (
          <span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: tonic ? '100%' : `${mag * 100}%`,
              backgroundColor: tonic
                ? 'rgba(148, 163, 184, 0.55)'
                : SENSOR_GROUP_COLOR[channel.group],
            }}
          />
        )}
      </div>
      <span className="w-8 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
        {tonic ? 'ref' : signed ? `${value > 0 ? '+' : ''}${value.toFixed(2)}` : value.toFixed(2)}
      </span>
    </div>
  )
}
