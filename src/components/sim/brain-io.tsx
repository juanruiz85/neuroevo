'use client'

// Cerebros portátiles (.neuroevo.json) — exportación e importación (Task 16-c).
//
// Formato (docs/PLAN-FASE-2-EXPERIMENTOS.md §7):
// {
//   "format": "neuroevo-brain", "version": 1,
//   "kind": "ann" | "elegans" | "drosophila",
//   "species": "fly" | "worm",
//   "generation": 12, "fitness": 38.4,
//   "genome": [/* 131 pesos ANN · 25/26 genes C. elegans · 27 genes Drosophila */],
//   "traits": { "maxSpeed": 62, "vision": 150 },
//   "meta": { "source": "inspector|museum|lab", "exportedAt": "ISO" }
// }
//
// La longitud del genoma NO se valida contra la arquitectura: el gusano pasó
// de 25 genes (v1.2) a 26 (v1.3) y los conectomas migran los genomas cortos
// por sí mismos (migrateGenome) al reconstruir el cerebro. Solo se exige un
// rango plausible (10..200 números) y que el motor decida la arquitectura
// a partir de `kind`.

import { useRef, type ComponentProps } from 'react'
import { z } from 'zod'
import { Download, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DROSOPHILA_GENES } from '@/lib/sim/connectome/drosophila'
import {
  DEFAULT_ENV,
  ELEGANS_GENES,
  SPECIES_CONFIG,
  type BrainKind,
  type CreatureView,
  type EliteRecord,
  type EvolutionRecordDTO,
  type Species,
} from '@/lib/sim'

// ─── Tipos del formato portable ────────────────────────────────────────────

/** Origen declarado en los metadatos de un archivo exportado. */
export type BrainFileSource = 'inspector' | 'museum' | 'lab'

/**
 * Cerebro serializado en formato «neuroevo-brain» v1. `meta` es informativo:
 * al importar se tolera que falte (archivos editados a mano).
 */
export interface BrainFileData {
  format: 'neuroevo-brain'
  version: 1
  kind: BrainKind
  species: Species
  generation: number
  fitness: number
  genome: number[]
  traits: { maxSpeed: number; vision: number }
  meta?: { source?: string; exportedAt?: string }
}

/** Archivo con metadatos completos: el que produce la exportación. */
export type BrainFile = BrainFileData & {
  meta: { source: BrainFileSource; exportedAt: string }
}

export type BrainParseResult =
  | { ok: true; data: BrainFileData }
  | { ok: false; error: string }

// ─── Etiquetas legibles ─────────────────────────────────────────────────────

/** Insignia de arquitectura (contrato Task 16-c del Inspector). */
export const BRAIN_ARCH_LABEL: Record<BrainKind, string> = {
  ann: 'ANN de control (131 pesos)',
  elegans: 'Conectoma C. elegans (300 neuronas)',
  drosophila: 'Conectoma Drosophila (2.956 neuronas)',
}

export const SPECIES_PLURAL: Record<Species, string> = {
  fly: 'moscas',
  worm: 'gusanos',
}

/** Tope de tamaño del archivo importado: un genoma válido ocupa unos pocos KB. */
const MAX_FILE_BYTES = 2_000_000

// ─── Exportación: construir el archivo ──────────────────────────────────────

/** Redondea el genoma a 4 decimales: archivo pequeño sin perder señal. */
function roundGenome(weights: readonly number[]): number[] {
  return weights.map((v) =>
    Number.isFinite(v) ? Math.round(v * 10_000) / 10_000 : 0,
  )
}

/**
 * Cerebro portátil a partir de la criatura seleccionada en el Inspector.
 * `selected.weights` ES el genoma (pesos ANN o genes de neuromodulación),
 * tal cual los produce el motor: no se adivina la longitud.
 */
export function brainFileFromCreature(selected: CreatureView): BrainFile {
  return {
    format: 'neuroevo-brain',
    version: 1,
    kind: selected.brainKind,
    species: selected.species,
    generation: selected.generation,
    fitness: Math.round(selected.fitness * 10) / 10,
    genome: roundGenome(selected.weights),
    traits: {
      maxSpeed: Math.round(selected.maxSpeed),
      vision: Math.round(selected.vision),
    },
    meta: { source: 'inspector', exportedAt: new Date().toISOString() },
  }
}

/**
 * Espejo de la heurística de World.seedFromRecord para los registros del
 * Museo anteriores a v1.3, que no guardaban `kind`: gusanos de 20/25/26
 * genes son conectoma; la ANN clásica tiene 131 pesos; la mosca con 27
 * genes es el conectoma de Drosophila.
 */
function inferKind(
  species: Species,
  weights: readonly number[],
  kind?: BrainKind,
): BrainKind {
  if (kind === 'ann' || kind === 'elegans' || kind === 'drosophila') return kind
  const n = weights.length
  if (species === 'worm') {
    return n === ELEGANS_GENES || n === 25 || n === 20 ? 'elegans' : 'ann'
  }
  return n === DROSOPHILA_GENES ? 'drosophila' : 'ann'
}

/** Cerebro portátil a partir de un registro conservado en el Museo. */
export function brainFileFromRecord(rec: EliteRecord): BrainFile {
  const cfg = SPECIES_CONFIG[rec.species]
  const weights = Array.isArray(rec.brain?.weights) ? rec.brain.weights : []
  return {
    format: 'neuroevo-brain',
    version: 1,
    kind: inferKind(rec.species, weights, rec.brain?.kind),
    species: rec.species,
    generation: Math.max(0, Math.round(rec.generation) || 0),
    fitness: Number.isFinite(rec.fitness) ? Math.round(rec.fitness * 10) / 10 : 0,
    genome: roundGenome(weights),
    traits: {
      maxSpeed: Math.round(rec.brain?.traits?.maxSpeed || cfg.baseSpeed),
      vision: Math.round(rec.brain?.traits?.vision || cfg.baseVision),
    },
    meta: { source: 'museum', exportedAt: new Date().toISOString() },
  }
}

// ─── Exportación: descargar el archivo ──────────────────────────────────────

function pad2(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Nombre de archivo: neuroevo-{kind}-{species}-G{gen}-{fecha}.neuroevo.json */
export function brainFileName(data: BrainFileData): string {
  const d = new Date()
  const date = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
  const time = `${pad2(d.getHours())}${pad2(d.getMinutes())}`
  return `neuroevo-${data.kind}-${data.species}-G${data.generation}-${date}-${time}.neuroevo.json`
}

/**
 * Descarga el cerebro como Blob JSON y devuelve el nombre del archivo
 * (para el toast de éxito), o null si el genoma está vacío (registro
 * dañado). La URL del objeto se libera tras el clic.
 */
export function downloadBrainFile(data: BrainFileData): string | null {
  if (!data.genome.length) return null
  const name = brainFileName(data)
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Safari mantiene la descarga viva un instante tras el clic; luego limpiamos.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return name
}

// ─── Importación: validar el archivo ────────────────────────────────────────

const GENERIC_ERROR = 'El archivo no es un cerebro NeuroEvo válido.'

// zod v4: z.number() ya rechaza NaN e Infinity → genoma de números finitos.
// La longitud se comprueba solo en rango plausible; el motor (y su
// migrateGenome) resuelve la arquitectura y las versiones antiguas.
const brainFileSchema = z.object({
  format: z.literal('neuroevo-brain'),
  version: z.literal(1),
  kind: z.enum(['ann', 'elegans', 'drosophila']),
  species: z.enum(['fly', 'worm']),
  generation: z.number().int().min(0).max(100_000),
  fitness: z.number().min(0).max(1_000_000),
  genome: z.array(z.number()).min(10).max(200),
  traits: z.object({
    maxSpeed: z.number().positive().max(100_000),
    vision: z.number().positive().max(100_000),
  }),
  meta: z
    .object({
      source: z.string().optional(),
      exportedAt: z.string().optional(),
    })
    .optional(),
})

/** Traduce el primer problema de zod a un mensaje claro en español. */
function friendlyError(
  issues: ReadonlyArray<{ path?: ReadonlyArray<PropertyKey> }>,
): string {
  switch (issues[0]?.path?.[0]) {
    case 'format':
      return 'No es un archivo de cerebro NeuroEvo: falta la marca «format: neuroevo-brain».'
    case 'version':
      return 'La versión del formato de cerebro no está soportada (se requiere la 1).'
    case 'kind':
      return 'El tipo de cerebro (kind) debe ser «ann», «elegans» o «drosophila».'
    case 'species':
      return 'La especie (species) debe ser «fly» (mosca) o «worm» (gusano).'
    case 'genome':
      return 'El genoma debe ser una lista de entre 10 y 200 números finitos.'
    case 'traits':
      return 'Los rasgos (traits.maxSpeed y traits.vision) deben ser números positivos.'
    case 'generation':
      return 'La generación debe ser un número entero no negativo.'
    case 'fitness':
      return 'La aptitud (fitness) debe ser un número no negativo.'
    default:
      return GENERIC_ERROR
  }
}

/**
 * Valida el texto de un archivo .neuroevo.json contra el formato exacto.
 * Nunca lanza: devuelve { ok, data | error } con mensajes en español.
 */
export function parseBrainFile(text: string): BrainParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'El archivo no contiene JSON válido.' }
  }
  const parsed = brainFileSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, data: parsed.data }
  }
  return { ok: false, error: friendlyError(parsed.error.issues) }
}

// ─── Importación: preparar la siembra ───────────────────────────────────────

/**
 * Convierte un cerebro importado en el registro que espera el motor
 * (SimApi.seedFromRecord → World.seedFromRecord): siembra 8 individuos
 * ligeramente mutados y reconstruye la arquitectura a partir de `kind`.
 * El motor no lee `env` al sembrar; DEFAULT_ENV solo satisface el tipo.
 */
export function toSeedRecord(data: BrainFileData): EvolutionRecordDTO {
  return {
    id: `import-${Date.now()}`,
    name: 'Cerebro importado',
    createdAt: new Date().toISOString(),
    species: data.species,
    generation: data.generation,
    fitness: data.fitness,
    brain: {
      weights: [...data.genome],
      traits: {
        maxSpeed: data.traits.maxSpeed,
        vision: data.traits.vision,
      },
      kind: data.kind,
    },
    env: { ...DEFAULT_ENV },
  }
}

// ─── Botones reutilizables ──────────────────────────────────────────────────

type ButtonVariant = ComponentProps<typeof Button>['variant']
type ButtonSize = ComponentProps<typeof Button>['size']

interface BrainExportButtonProps {
  /** Cerebro a exportar (null si no hay nada que guardar). */
  getBrain: () => BrainFile | null
  label?: string
  variant?: ButtonVariant
  size?: ButtonSize
  /** Modo compacto de solo icono (filas del Museo). */
  iconOnly?: boolean
  className?: string
  /** Texto del tooltip/aria-label en modo iconOnly. */
  title?: string
}

/** Botón que descarga el cerebro indicado como archivo .neuroevo.json. */
export function BrainExportButton({
  getBrain,
  label = 'Exportar cerebro',
  variant,
  size = 'sm',
  iconOnly = false,
  className,
  title,
}: BrainExportButtonProps) {
  const handleExport = () => {
    const data = getBrain()
    if (!data) {
      toast.error('No hay un cerebro que exportar.')
      return
    }
    const name = downloadBrainFile(data)
    if (!name) {
      toast.error('El registro está dañado: no tiene genoma que exportar.')
      return
    }
    toast.success(`Cerebro exportado: ${name}`)
  }
  return (
    <Button
      type="button"
      variant={variant ?? (iconOnly ? 'ghost' : 'outline')}
      size={iconOnly ? 'icon' : size}
      className={className}
      onClick={handleExport}
      title={iconOnly ? (title ?? label) : title}
      aria-label={iconOnly ? (title ?? label) : undefined}
    >
      <Download className="size-4" aria-hidden="true" />
      {!iconOnly && label}
    </Button>
  )
}

interface BrainImportButtonProps {
  /** Se invoca solo con archivos válidos; los errores se avisan con toast. */
  onParsed: (data: BrainFileData) => void
  label?: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  /** Deshabilita el botón (p. ej. panel sin acceso al motor). */
  disabled?: boolean
  /** Texto del tooltip nativo (refuerzo del tooltip externo si lo hay). */
  title?: string
}

/** Botón que carga un archivo .neuroevo.json, lo valida y lo entrega. */
export function BrainImportButton({
  onParsed,
  label = 'Importar cerebro',
  variant = 'default',
  size = 'sm',
  className,
  disabled = false,
  title,
}: BrainImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const readFile = (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error('El archivo es demasiado grande para ser un cerebro (máximo 2 MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseBrainFile(String(reader.result ?? ''))
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      onParsed(result.data)
    }
    reader.onerror = () => toast.error('No se pudo leer el archivo.')
    reader.readAsText(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.neuroevo.json,application/json"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) readFile(file)
          // Permite reintentar con el mismo archivo (p. ej. tras corregirlo).
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled}
        title={title}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" aria-hidden="true" />
        {label}
      </Button>
    </>
  )
}
