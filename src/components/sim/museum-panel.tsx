'use client'

// Museo de la Evolución: guarda las élites (cerebros evolucionados) en la base
// de datos vía /api/records y permite sembrarlas en la simulación actual.
// En el despliegue estático (GitHub Pages, NEXT_PUBLIC_STATIC_MODE=1) no hay
// backend y el Museo degrada con elegancia: usa localStorage del visitante.

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Archive,
  Bug,
  Save,
  Sprout,
  Trash2,
  Upload,
  Worm,
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
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BrainExportButton,
  BrainImportButton,
  SPECIES_PLURAL,
  brainFileFromRecord,
  toSeedRecord,
  type BrainFileData,
} from '@/components/sim/brain-io'
import type {
  EliteRecord,
  EvolutionRecordDTO,
} from '@/lib/sim/types'
import {
  listRecords,
  removeRecord,
  saveRecord,
} from '@/lib/static-museum'
import { cn } from '@/lib/utils'

const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === '1'

interface Props {
  onGetElite: () => EliteRecord[]
  onSeed: (rec: EvolutionRecordDTO) => number
}

export function MuseumPanel({ onGetElite, onSeed }: Props) {
  const [records, setRecords] = useState<EvolutionRecordDTO[] | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (STATIC_MODE) {
      setRecords(listRecords())
      return
    }
    try {
      const res = await fetch('/api/records')
      if (!res.ok) throw new Error('GET falló')
      const data = await res.json()
      setRecords(data.records ?? [])
    } catch {
      setRecords([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    const elite = onGetElite()
    if (!elite.length) {
      toast.error('No hay criaturas vivas que guardar.')
      return
    }
    setSaving(true)
    const prefix = name.trim() || 'Élite'
    try {
      if (STATIC_MODE) {
        elite.forEach((rec) =>
          saveRecord(
            rec,
            `${prefix} · ${rec.species === 'fly' ? 'Moscón' : 'Gusano'} G${rec.generation}`,
          ),
        )
        toast.success(
          `${elite.length} cerebros guardados en este navegador (sitio estático).`,
        )
        setName('')
        setRecords(listRecords())
        return
      }
      const results = await Promise.all(
        elite.map((rec) =>
          fetch('/api/records', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...rec,
              name: `${prefix} · ${rec.species === 'fly' ? 'Moscón' : 'Gusano'} G${rec.generation}`,
            }),
          }),
        ),
      )
      if (results.some((r) => !r.ok)) throw new Error('POST falló')
      toast.success(
        `${elite.length} cerebros guardados en el Museo de la Evolución.`,
      )
      setName('')
      await load()
    } catch {
      toast.error('No se pudo guardar la élite. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (rec: EvolutionRecordDTO) => {
    if (STATIC_MODE) {
      removeRecord(rec.id)
      toast.success('Registro eliminado del Museo.')
      setRecords(listRecords())
      return
    }
    try {
      const res = await fetch(`/api/records/${rec.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('DELETE falló')
      toast.success('Registro eliminado del Museo.')
      await load()
    } catch {
      toast.error('No se pudo eliminar el registro.')
    }
  }

  const seed = (rec: EvolutionRecordDTO) => {
    const n = onSeed(rec)
    toast.success(
      `Sembrados ${n} individuos de ${rec.species === 'fly' ? 'moscas' : 'gusanos'} (G${rec.generation}).`,
    )
  }

  // Importación global: archivo .neuroevo.json válido → registro del motor →
  // 8 individuos sembrados en el mundo actual (funciona también en modo
  // estático: la siembra no depende del backend).
  const importBrain = (data: BrainFileData) => {
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
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Save className="size-4 text-amber-500" />
            Guardar la élite actual
          </CardTitle>
          <CardDescription>
            {STATIC_MODE
              ? 'Sitio estático: los linajes se conservan en este navegador (localStorage).'
              : 'Conserva los 4 mejores cerebros (2 por especie, por aptitud) en la base de datos para sembrarlos en cualquier simulación futura.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre del linaje (opcional)"
            maxLength={60}
          />
          <Button onClick={save} disabled={saving}>
            <Save className="mr-1.5 size-4" />
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Archive className="size-4 text-emerald-500" />
            Cerebros conservados
            {records !== null && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {records.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            «Sembrar» libera 8 individuos con ese cerebro (ligeramente
            mutados) en el mapa actual.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {records === null ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : records.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Aún no hay cerebros guardados. Deja evolucionar tu ecosistema y
              vuelve para conservar las élites.
            </p>
          ) : (
            <ScrollArea className="max-h-96 nice-scroll pr-2">
              <div className="space-y-2">
                {records.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-center gap-2.5 rounded-lg border bg-card/60 p-2 transition-colors hover:bg-accent/50"
                  >
                    <div
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-md',
                        rec.species === 'fly'
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'bg-emerald-500/15 text-emerald-500',
                      )}
                    >
                      {rec.species === 'fly' ? (
                        <Bug className="size-4" />
                      ) : (
                        <Worm className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{rec.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        G{rec.generation} · aptitud {rec.fitness} ·{' '}
                        {safeDate(rec.createdAt)}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-emerald-500 hover:text-emerald-400"
                      onClick={() => seed(rec)}
                      title="Sembrar en el ecosistema"
                      aria-label="Sembrar en el ecosistema"
                    >
                      <Sprout className="size-4" />
                    </Button>
                    <BrainExportButton
                      getBrain={() => brainFileFromRecord(rec)}
                      iconOnly
                      className="size-7 text-muted-foreground hover:text-foreground"
                      title={`Exportar «${rec.name}» como archivo .neuroevo.json`}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-rose-400"
                      onClick={() => remove(rec)}
                      title="Eliminar registro"
                      aria-label="Eliminar registro"
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Upload className="size-4 text-amber-500" />
            Importar cerebro
          </CardTitle>
          <CardDescription>
            Carga un archivo .neuroevo.json (exportado del inspector, de este
            museo o de otra simulación) y suelta 8 individuos con ese cerebro
            en el mundo actual. Después podrás conservarlos con «Guardar la
            élite».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrainImportButton
            onParsed={importBrain}
            label="Importar cerebro"
            className="w-full sm:w-auto"
          />
        </CardContent>
      </Card>
    </div>
  )
}

function safeDate(iso: string): string {
  try {
    return format(new Date(iso), "d MMM · HH:mm", { locale: es })
  } catch {
    return ''
  }
}
