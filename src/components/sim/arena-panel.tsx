'use client'

// Modo Retos / Arena (Task 16-a): editor de laberintos con herramientas
// (pared/meta/fruta/veneno/borrar/soltar organismos), cronómetro de ensayo en
// vivo, tabla de resultados y récords persistentes en localStorage
// (compatible con el despliegue estático: cero fetch).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Apple,
  BrickWall,
  Bug,
  CheckCircle2,
  CircleX,
  Eraser,
  Flag,
  Hand,
  Info,
  Lightbulb,
  Medal,
  MousePointer2,
  Play,
  Skull,
  Timer,
  Trash2,
  Trophy,
  Undo2,
  Worm,
  type LucideIcon,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useArenaToolStore,
  type ArenaTool,
  type ToolPoint,
} from '@/components/sim/sim-canvas'
import type { SimApi } from '@/components/sim/use-simulation'
import { clamp, type ArenaResult, type Wall } from '@/lib/sim/types'
import { cn } from '@/lib/utils'

// ——— Tipos locales ————————————————————————————————————————————————————

type DropSpecies = 'worm' | 'fly'
type DropArch = 'elegans' | 'ann' | 'drosophila'

/** Récord de un ensayo terminado (localStorage). */
interface ArenaRecord {
  id: string
  /** Fecha ISO del final del ensayo. */
  date: string
  /** Mejor tiempo de llegada (s); null si nadie llegó. */
  bestTime: number | null
  bestSpecies: DropSpecies | null
  bestKind: DropArch | null
  participants: number
  successes: number
  walls: number
  hadGoal: boolean
}

const RECORDS_KEY = 'neuroevo-arena-records'
const MAX_RECORDS = 20
/** Radio de tolerancia (px del mundo) del borrador de paredes. */
const ERASE_RADIUS = 14

const CAUSE_LABEL: Record<NonNullable<ArenaResult['cause']>, string> = {
  goal: 'meta',
  poison: 'veneno',
  starve: 'inanición',
  age: 'edad',
}

const TOOLS: { key: ArenaTool; label: string; icon: LucideIcon; hint: string }[] = [
  {
    key: 'select',
    label: 'Elegir',
    icon: MousePointer2,
    hint: 'haz clic en una criatura del mapa para seleccionarla',
  },
  {
    key: 'wall',
    label: 'Pared',
    icon: BrickWall,
    hint: 'arrastra sobre el mapa para dibujar una pared; suelta el botón para fijarla',
  },
  {
    key: 'goal',
    label: 'Meta',
    icon: Flag,
    hint: 'un clic coloca la meta (radio 42); si ya había una, se mueve aquí',
  },
  {
    key: 'food',
    label: 'Fruta',
    icon: Apple,
    hint: 'un clic suelta una fruta de energía 42 (se marchita a los 70 s)',
  },
  {
    key: 'poison',
    label: 'Veneno',
    icon: Skull,
    hint: 'un clic suelta veneno: −32 de energía para quien lo pruebe',
  },
  {
    key: 'erase',
    label: 'Borrar',
    icon: Eraser,
    hint: `clic junto a una pared (a menos de ${ERASE_RADIUS} px) para quitarla`,
  },
  {
    key: 'drop',
    label: 'Soltar',
    icon: Hand,
    hint: 'un clic suelta UN organismo de la especie y el cerebro elegidos; repite para soltar más',
  },
]

const SPECIES_OPTIONS: { value: DropSpecies; label: string }[] = [
  { value: 'worm', label: 'Gusano · C. elegans' },
  { value: 'fly', label: 'Mosca · Drosophila' },
]

const ARCH_OPTIONS: Record<DropSpecies, { value: DropArch; label: string }[]> = {
  worm: [
    { value: 'elegans', label: 'Conectoma real · 302 neuronas' },
    { value: 'ann', label: 'ANN de control · 12→8→3' },
  ],
  fly: [
    { value: 'drosophila', label: 'Conectoma real · 2.956 neuronas' },
    { value: 'ann', label: 'ANN de control · 12→8→3' },
  ],
}

// ——— Utilidades ———————————————————————————————————————————————————————

/** mm:ss.d (83.42 s → «01:23.4»). */
function formatRun(t: number): string {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  const ss = s < 10 ? `0${s.toFixed(1)}` : s.toFixed(1)
  return `${String(m).padStart(2, '0')}:${ss}`
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function safeDate(iso: string): string {
  try {
    return format(new Date(iso), 'd MMM · HH:mm', { locale: es })
  } catch {
    return ''
  }
}

/** Distancia (px del mundo) de un punto al segmento de una pared. */
function distToWall(px: number, py: number, w: Wall): number {
  const dx = w.x2 - w.x1
  const dy = w.y2 - w.y1
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : ((px - w.x1) * dx + (py - w.y1) * dy) / len2
  const cx = w.x1 + clamp(t, 0, 1) * dx
  const cy = w.y1 + clamp(t, 0, 1) * dy
  return Math.hypot(px - cx, py - cy)
}

function isRecord(v: unknown): v is ArenaRecord {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.date === 'string' &&
    (r.bestTime === null || typeof r.bestTime === 'number') &&
    typeof r.participants === 'number' &&
    typeof r.successes === 'number' &&
    typeof r.walls === 'number' &&
    typeof r.hadGoal === 'boolean'
  )
}

function loadRecords(): ArenaRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(RECORDS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecord).slice(0, MAX_RECORDS)
  } catch {
    return []
  }
}

function saveRecords(list: ArenaRecord[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(RECORDS_KEY, JSON.stringify(list))
  } catch {
    // Almacenamiento no disponible (p. ej. modo privado): los récords
    // viven solo en memoria durante esta sesión.
  }
}

// ——— Récords como fuente externa (localStorage + caché en memoria) ————————
// useSyncExternalStore evita tanto el mismatch de hidratación (el servidor
// renderiza la lista vacía) como el setState-in-effect: la caché se lee en
// el primer render de cliente y React re-renderiza tras hidratar.

const EMPTY_RECORDS: ArenaRecord[] = []
let recordsCache: ArenaRecord[] | null = null
const recordListeners = new Set<() => void>()

function getRecordSnapshot(): ArenaRecord[] {
  if (recordsCache === null) recordsCache = loadRecords()
  return recordsCache
}

function getServerRecordSnapshot(): ArenaRecord[] {
  return EMPTY_RECORDS
}

function subscribeRecords(listener: () => void): () => void {
  recordListeners.add(listener)
  return () => {
    recordListeners.delete(listener)
  }
}

function commitRecords(next: ArenaRecord[]): void {
  recordsCache = next.slice(0, MAX_RECORDS)
  saveRecords(recordsCache)
  recordListeners.forEach((l) => l())
}

// ——— Panel ————————————————————————————————————————————————————————————

export function ArenaPanel({ sim }: { sim: SimApi }) {
  const { ui } = sim

  const tool = useArenaToolStore((s) => s.tool)
  const setTool = useArenaToolStore((s) => s.setTool)
  const setOnAction = useArenaToolStore((s) => s.setOnAction)

  const [dropSpecies, setDropSpecies] = useState<DropSpecies>('worm')
  const [dropKind, setDropKind] = useState<DropArch>('elegans')
  const records = useSyncExternalStore(
    subscribeRecords,
    getRecordSnapshot,
    getServerRecordSnapshot,
  )

  // ——— Acciones del editor (llegan desde el canvas en coords del mundo) —

  const handleToolAction = useCallback(
    (kind: 'click' | 'wall', a: ToolPoint, b?: ToolPoint) => {
      const world = sim.getWorld()
      if (!world) return
      const x = clamp(a.x, 8, world.width - 8)
      const y = clamp(a.y, 8, world.height - 8)
      if (kind === 'wall') {
        // Segmento dibujado con clic-arrastre (canvas → inicio a, fin b).
        if (!b) return
        const x2 = clamp(b.x, 8, world.width - 8)
        const y2 = clamp(b.y, 8, world.height - 8)
        if (Math.hypot(x2 - x, y2 - y) < 12) return // clic accidental
        sim.arenaAddWall({ x1: x, y1: y, x2, y2 })
        return
      }
      // Clic puntual: la herramienta activa decide qué se coloca o borra
      // (leída de la tienda en el instante del clic, sin closures viejos).
      switch (useArenaToolStore.getState().tool) {
        case 'goal':
          sim.arenaSetGoal({ x, y, r: 42 })
          break
        case 'food':
          world.addFoodAt('fruit', x, y)
          break
        case 'poison':
          world.addFoodAt('poison', x, y)
          break
        case 'erase': {
          let idx = -1
          let best = ERASE_RADIUS
          world.walls.forEach((w, i) => {
            const d = distToWall(a.x, a.y, w)
            if (d < best) {
              best = d
              idx = i
            }
          })
          if (idx >= 0) world.walls = world.walls.filter((_, i) => i !== idx)
          break
        }
        case 'drop':
          // Genoma aleatorio nuevo: los animales de arena compiten con
          // cerebros vírgenes (nada de genomas de laboratorio).
          sim.spawnAt(dropSpecies, dropKind, x, y)
          break
      }
    },
    [sim, dropSpecies, dropKind],
  )

  // Publica el callback del editor en la tienda que lee el canvas. Va
  // separado del reset de desmontaje: cambiar especie/arquitectura recrea el
  // callback y NO debe desactivar la herramienta «Soltar» activa.
  useEffect(() => {
    setOnAction(handleToolAction)
    return () => setOnAction(null)
  }, [handleToolAction, setOnAction])

  // Al desmontar (cambio de modo) el mapa vuelve a su comportamiento
  // clásico de selección.
  useEffect(
    () => () => {
      const st = useArenaToolStore.getState()
      st.setOnAction(null)
      st.setTool('select')
    },
    [],
  )

  // ——— Fin de ensayo → archivar récord ————————————————————————————————
  // Snapshot reciente (refs sincronizados en efecto, nunca durante render)
  // para que el efecto del cambio arenaRunning lea los valores del commit.
  const latestRef = useRef({
    results: ui.arenaResults,
    walls: ui.walls.length,
    goal: ui.goal !== null,
  })
  useEffect(() => {
    latestRef.current = {
      results: ui.arenaResults,
      walls: ui.walls.length,
      goal: ui.goal !== null,
    }
  })
  const prevRunningRef = useRef(false)

  useEffect(() => {
    if (prevRunningRef.current && !ui.arenaRunning) {
      const { results, walls, goal } = latestRef.current
      if (results.length > 0) {
        const successes = results.filter((r) => r.success)
        const best = successes.length
          ? successes.reduce((m, r) => (r.time < m.time ? r : m))
          : null
        const record: ArenaRecord = {
          id: makeId(),
          date: new Date().toISOString(),
          bestTime: best?.time ?? null,
          bestSpecies: best?.species ?? null,
          bestKind: best?.brainKind ?? null,
          participants: results.length,
          successes: successes.length,
          walls,
          hadGoal: goal,
        }
        commitRecords([record, ...getRecordSnapshot()])
        toast.success(
          best
            ? `Ensayo archivado — mejor tiempo ${formatRun(best.time)}.`
            : 'Ensayo archivado — ningún participante llegó a la meta.',
        )
      }
    }
    prevRunningRef.current = ui.arenaRunning
  }, [ui.arenaRunning])

  const deleteRecord = (id: string) => {
    commitRecords(getRecordSnapshot().filter((r) => r.id !== id))
  }

  // ——— Derivados ————————————————————————————————————————————————————

  const participants = ui.counts.flies + ui.counts.worms
  const total = participants + ui.arenaResults.length
  const finished = ui.arenaResults.length
  const arenaEmpty =
    ui.walls.length === 0 &&
    !ui.goal &&
    participants === 0 &&
    ui.counts.fruit === 0 &&
    ui.counts.poison === 0
  // Guía inicial: basta que no haya paredes ni criaturas sueltas.
  const showHint = ui.walls.length === 0 && participants === 0

  const sorted = useMemo(
    () =>
      [...ui.arenaResults].sort((a, b) =>
        a.success === b.success ? a.time - b.time : a.success ? -1 : 1,
      ),
    [ui.arenaResults],
  )
  const bestRow = useMemo(
    () => sorted.find((r) => r.success) ?? null,
    [sorted],
  )
  const activeTool = TOOLS.find((t) => t.key === tool) ?? TOOLS[0]

  const changeSpecies = (s: DropSpecies) => {
    setDropSpecies(s)
    setDropKind(s === 'worm' ? 'elegans' : 'drosophila')
  }

  return (
    <div className="space-y-3">
      {showHint && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="size-4 text-amber-400" />
              Tu primer reto, en 3 pasos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-1.5 text-xs leading-snug text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Pared</span>:
                arrastra sobre el mapa para dibujar un laberinto.
              </li>
              <li>
                <span className="font-medium text-foreground">Meta</span>: un
                clic coloca la bandera de llegada.
              </li>
              <li>
                <span className="font-medium text-foreground">Soltar</span>:
                elige gusano o mosca (conectoma real o ANN de control), haz
                clic en el mapa —un organismo por clic— y pulsa{' '}
                <span className="font-medium text-foreground">Iniciar
                ensayo</span>.
              </li>
            </ol>
            <p className="mt-2 text-[10px] text-muted-foreground/80">
              Opcional: fruta (energía) y veneno (riesgo) para complicar el
              camino hacia la meta.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ——— Editor ——— */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="size-4 text-amber-500" />
            Constructor de retos
          </CardTitle>
          <CardDescription className="text-xs">
            Dibuja paredes, coloca la meta y suelta competidores: conectoma
            real contra ANN de control.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="gap-1 text-[10px] tabular-nums">
              {ui.walls.length} pared{ui.walls.length === 1 ? '' : 'es'}
            </Badge>
            {ui.goal ? (
              <Badge
                variant="outline"
                className="gap-1 text-[10px] text-emerald-500"
              >
                <Flag className="size-3" /> meta
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                sin meta
              </Badge>
            )}
            <Badge variant="outline" className="gap-1 text-[10px] tabular-nums">
              {participants} participantes
            </Badge>
            {ui.counts.fruit > 0 && (
              <Badge variant="outline" className="gap-1 text-[10px] tabular-nums">
                <Apple className="size-3 text-red-400" /> {ui.counts.fruit}
              </Badge>
            )}
            {ui.counts.poison > 0 && (
              <Badge variant="outline" className="gap-1 text-[10px] tabular-nums">
                <Skull className="size-3 text-violet-400" /> {ui.counts.poison}
              </Badge>
            )}
          </div>

          <TooltipProvider delayDuration={300}>
            <ToggleGroup
              type="single"
              value={tool}
              onValueChange={(v) => {
                if (v) setTool(v as ArenaTool)
              }}
              variant="outline"
              aria-label="Herramientas del editor de arena"
              className="grid w-full grid-cols-4 gap-1.5 shadow-none"
            >
              {TOOLS.map((t) => {
                const Icon =
                  t.key === 'drop'
                    ? dropSpecies === 'fly'
                      ? Bug
                      : Worm
                    : t.icon
                return (
                  <Tooltip key={t.key}>
                    <TooltipTrigger asChild>
                      <ToggleGroupItem
                        value={t.key}
                        aria-label={`${t.label}: ${t.hint}`}
                        className="h-auto min-h-11 flex-col gap-1 rounded-md px-1 py-2 text-[10px] leading-tight data-[variant=outline]:border-l"
                      >
                        <Icon className="size-4" aria-hidden="true" />
                        <span>{t.label}</span>
                      </ToggleGroupItem>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-52 text-[11px]">
                      {t.hint}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </ToggleGroup>
          </TooltipProvider>

          <p className="flex items-start gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500/80" />
            <span>
              <span className="font-medium text-foreground">
                {activeTool.label}
              </span>
              : {activeTool.hint}.
            </span>
          </p>

          <div className="space-y-2 rounded-lg border bg-card/60 p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Organismo de la herramienta «Soltar»
            </p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label
                  htmlFor="arena-species"
                  className="text-[10px] text-muted-foreground"
                >
                  Especie
                </Label>
                <Select
                  value={dropSpecies}
                  onValueChange={(v) => changeSpecies(v as DropSpecies)}
                >
                  <SelectTrigger
                    id="arena-species"
                    size="sm"
                    className="h-11 w-full text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIES_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="arena-arch"
                  className="text-[10px] text-muted-foreground"
                >
                  Arquitectura cerebral
                </Label>
                <Select
                  value={dropKind}
                  onValueChange={(v) => setDropKind(v as DropArch)}
                >
                  <SelectTrigger
                    id="arena-arch"
                    size="sm"
                    className="h-11 w-full text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ARCH_OPTIONS[dropSpecies].map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground/80">
              Cada clic suelta un individuo con genoma aleatorio nuevo:
              aquí los cerebros compiten desde cero, sin genomas de
              laboratorio.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-11"
              onClick={sim.arenaUndoWall}
              disabled={ui.walls.length === 0}
              aria-label="Deshacer la última pared dibujada"
              title="Deshacer la última pared"
            >
              <Undo2 className="mr-1 size-3.5" />
              Deshacer pared
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-11 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  disabled={arenaEmpty}
                  aria-label="Limpiar la arena por completo"
                  title="Limpiar la arena"
                >
                  <Trash2 className="mr-1 size-3.5" />
                  Limpiar todo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Limpiar la arena?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se eliminarán {ui.walls.length} pared
                    {ui.walls.length === 1 ? '' : 'es'}, la meta
                    {ui.goal ? '' : ' (no hay)'}, la comida colocada y los{' '}
                    {participants} participante
                    {participants === 1 ? '' : 's'}. El cronómetro y los
                    resultados del ensayo también se reinician. Los récords
                    guardados se conservan. Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 text-white hover:bg-rose-500"
                    onClick={sim.arenaClear}
                  >
                    Limpiar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* ——— Ensayo ——— */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Timer className="size-4 text-amber-500" />
            Ensayo cronometrado
          </CardTitle>
          {ui.arenaRunning ? (
            <CardDescription className="text-xs tabular-nums">
              {finished} de {total} participante{total === 1 ? '' : 's'} ha
              {finished === 1 ? '' : 'n'} cruzado la línea o caído.
            </CardDescription>
          ) : (
            <CardDescription className="text-xs">
              {ui.goal
                ? 'Victoria al tocar la meta; derrota por veneno, hambre o edad.'
                : 'Sin meta colocada se cronometra la supervivencia.'}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {ui.arenaRunning ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Cronómetro
                  </p>
                  <p
                    className="font-mono text-3xl font-semibold tabular-nums text-amber-400"
                    aria-live="polite"
                    aria-label={`Tiempo ${formatRun(ui.runT)}`}
                  >
                    {formatRun(ui.runT)}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-400">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
                  </span>
                  Ensayo en marcha
                </span>
              </div>
              <div className="space-y-1.5">
                <Progress
                  value={total > 0 ? (finished / total) * 100 : 0}
                  className="h-1.5"
                  aria-label="Progreso del ensayo"
                />
                <p className="text-[10px] text-muted-foreground">
                  El cronómetro avanza con el tiempo de simulación: pausa y
                  velocidad actúan también sobre él.
                </p>
              </div>
            </>
          ) : (
            <>
              <Button
                size="lg"
                className="h-12 w-full bg-emerald-600 text-sm font-semibold text-emerald-50 hover:bg-emerald-500"
                onClick={sim.arenaStart}
                disabled={participants === 0}
                aria-label="Iniciar el ensayo cronometrado"
              >
                <Play className="mr-2 size-4" />
                Iniciar ensayo
              </Button>
              {participants === 0 ? (
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500/80" />
                  Suelta primero algún organismo: activa la herramienta
                  «Soltar» y haz clic en el mapa (un clic, un organismo).
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500/80" />
                  {ui.goal
                    ? `Listo con ${participants} participante${participants === 1 ? '' : 's'}: el ensayo termina cuando todos lleguen a la meta o mueran.`
                    : 'Coloca una meta (herramienta «Meta») si quieres una carrera en lugar de una prueba de supervivencia.'}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ——— Resultados ——— */}
      {!ui.arenaRunning && ui.arenaResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="size-4 text-amber-500" />
              Resultados del ensayo
              <Badge variant="secondary" className="font-mono text-[10px]">
                {ui.arenaResults.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 pl-2.5 text-[10px] font-medium">
                      Participante
                    </TableHead>
                    <TableHead className="h-8 text-right text-[10px] font-medium">
                      Tiempo
                    </TableHead>
                    <TableHead className="h-8 pr-2.5 text-right text-[10px] font-medium">
                      Desenlace
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => {
                    const isBest = bestRow !== null && bestRow.id === r.id
                    return (
                      <TableRow
                        key={r.id}
                        className={cn(
                          'border-border/50',
                          isBest && 'bg-amber-500/10',
                        )}
                      >
                        <TableCell className="py-2 pl-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'grid size-7 shrink-0 place-items-center rounded-md',
                                r.species === 'fly'
                                  ? 'bg-amber-500/15 text-amber-500'
                                  : 'bg-emerald-500/15 text-emerald-500',
                              )}
                              aria-hidden="true"
                            >
                              {r.species === 'fly' ? (
                                <Bug className="size-3.5" />
                              ) : (
                                <Worm className="size-3.5" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-tight">
                                {r.species === 'fly' ? 'Mosca' : 'Gusano'}{' '}
                                <span className="font-normal text-muted-foreground">
                                  #{r.id}
                                </span>
                              </p>
                              <ArchBadge kind={r.brainKind} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <span className="font-mono text-xs tabular-nums">
                            {isBest && (
                              <Trophy
                                className="mr-1 inline size-3.5 text-amber-400"
                                aria-label="Mejor tiempo del ensayo"
                              />
                            )}
                            {formatRun(r.time)}
                          </span>
                        </TableCell>
                        <TableCell className="py-2 pr-2.5 text-right">
                          {r.success ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                              <CheckCircle2 className="size-3.5" />
                              Llegó
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-400">
                              <CircleX className="size-3.5" />
                              Murió
                              <span className="font-normal text-muted-foreground">
                                · {CAUSE_LABEL[r.cause ?? 'starve']}
                              </span>
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-11 w-full"
              onClick={() => setTool('drop')}
              aria-label="Activar la herramienta Soltar para repoblar la arena"
            >
              <Hand className="mr-1.5 size-3.5" />
              Soltar participantes y repetir
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ——— Récords ——— */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Medal className="size-4 text-amber-500" />
            Récords de la arena
            {records.length > 0 && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {records.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            Se guardan en este navegador (localStorage): funcionan igual en el
            despliegue estático.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Termina un ensayo para archivar tu primer récord: mejor tiempo,
              fecha, participantes y tamaño del laberinto.
            </p>
          ) : (
            <ScrollArea className="max-h-72 nice-scroll pr-2">
              <div className="space-y-1.5">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-2.5 rounded-lg border bg-card/60 p-2 transition-colors hover:bg-accent/50"
                  >
                    <div
                      className="grid size-8 shrink-0 place-items-center rounded-md bg-amber-500/10 text-amber-400"
                      aria-hidden="true"
                    >
                      <Medal className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {rec.bestTime !== null ? (
                        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-semibold">
                          <span className="font-mono tabular-nums text-amber-400">
                            {formatRun(rec.bestTime)}
                          </span>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            mejor marca
                          </span>
                          {rec.bestSpecies && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-0.5 text-[10px] font-normal',
                                rec.bestSpecies === 'fly'
                                  ? 'text-amber-500'
                                  : 'text-emerald-500',
                              )}
                            >
                              {rec.bestSpecies === 'fly' ? (
                                <Bug className="size-3" />
                              ) : (
                                <Worm className="size-3" />
                              )}
                              {rec.bestKind === 'ann'
                                ? 'ANN'
                                : rec.bestKind === 'drosophila'
                                  ? 'Drosophila'
                                  : 'C. elegans'}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-muted-foreground">
                          Sin llegadas
                        </p>
                      )}
                      <p className="truncate text-[10px] text-muted-foreground">
                        {safeDate(rec.date)} · {rec.successes}/{rec.participants}{' '}
                        llegaron · {rec.walls} pared
                        {rec.walls === 1 ? '' : 'es'}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-11 shrink-0 text-muted-foreground hover:text-rose-400"
                      onClick={() => deleteRecord(rec.id)}
                      aria-label="Borrar este récord"
                      title="Borrar récord"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ArchBadge({ kind }: { kind: ArenaResult['brainKind'] }) {
  if (kind === 'ann') {
    return (
      <Badge
        variant="secondary"
        className="mt-0.5 h-auto px-1 py-0 text-[9px] text-muted-foreground"
      >
        ANN
      </Badge>
    )
  }
  if (kind === 'elegans') {
    return (
      <Badge
        variant="outline"
        className="mt-0.5 h-auto border-emerald-500/40 px-1 py-0 text-[9px] text-emerald-400"
      >
        C. elegans
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="mt-0.5 h-auto border-amber-500/40 px-1 py-0 text-[9px] text-amber-400"
    >
      Drosophila
    </Badge>
  )
}
