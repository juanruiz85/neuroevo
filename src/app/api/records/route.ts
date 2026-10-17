import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

// Contrato local (equivale a EvolutionRecordDTO de src/lib/sim/types.ts,
// pero sin importar código del motor de simulación).
interface StoredBrainDTO {
  weights: number[]
  traits: { maxSpeed: number; vision: number }
}

interface RecordDTO {
  id: string
  name: string
  species: 'fly' | 'worm'
  generation: number
  fitness: number
  brain: StoredBrainDTO
  env: Record<string, unknown>
  createdAt: string // ISO
}

type RecordRow = {
  id: string
  name: string
  species: string
  generation: number
  fitness: number
  brain: string
  env: string
  createdAt: Date
}

// --- Validación (zod v4) -----------------------------------------------

const brainSchema = z.object({
  weights: z.array(z.number()),
  traits: z.object({
    maxSpeed: z.number().positive(),
    vision: z.number().positive(),
  }),
})

const createRecordSchema = z.object({
  name: z.string().max(120).optional(),
  species: z.enum(['fly', 'worm']),
  generation: z.number().int().min(0),
  fitness: z.number().min(0),
  brain: brainSchema,
  // Metadatos de entorno arbitrarios: si falta o viene corrupto, seguimos con {}.
  env: z.record(z.string(), z.unknown()).catch({}),
})

// --- Helpers ------------------------------------------------------------

function defaultName(species: 'fly' | 'worm', generation: number): string {
  return `${species === 'fly' ? 'Moscón' : 'Gusano'} G${generation}`
}

/** Convierte una fila de Prisma al DTO público (brain/env parseados a objeto). */
function toDTO(row: RecordRow): RecordDTO {
  let brain: unknown
  let env: unknown
  try {
    brain = JSON.parse(row.brain)
  } catch {
    brain = null
  }
  try {
    env = JSON.parse(row.env)
  } catch {
    env = null
  }
  const fallbackBrain: StoredBrainDTO = {
    weights: [],
    traits: { maxSpeed: 0, vision: 0 },
  }
  return {
    id: row.id,
    name: row.name,
    species: row.species === 'fly' ? 'fly' : 'worm',
    generation: row.generation,
    fitness: row.fitness,
    brain:
      brain !== null && typeof brain === 'object'
        ? (brain as StoredBrainDTO)
        : fallbackBrain,
    env:
      env !== null && typeof env === 'object' && !Array.isArray(env)
        ? (env as Record<string, unknown>)
        : {},
    createdAt: row.createdAt.toISOString(),
  }
}

// --- GET: últimos 60 registros -------------------------------------------

export async function GET() {
  try {
    const rows = await db.evolutionRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
    })
    return NextResponse.json({ records: rows.map(toDTO) })
  } catch (error) {
    console.error('[GET /api/records]', error)
    return NextResponse.json(
      { error: 'No se pudieron cargar los registros.' },
      { status: 500 },
    )
  }
}

// --- POST: guarda una élite ----------------------------------------------

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Body JSON inválido.' },
      { status: 400 },
    )
  }

  const parsed = createRecordSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Datos del registro inválidos.',
        details: parsed.error.issues.map(
          (issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`,
        ),
      },
      { status: 400 },
    )
  }

  const data = parsed.data
  const name = data.name?.trim() || defaultName(data.species, data.generation)

  try {
    const row = await db.evolutionRecord.create({
      data: {
        name,
        species: data.species,
        generation: data.generation,
        fitness: data.fitness,
        brain: JSON.stringify(data.brain),
        env: JSON.stringify(data.env),
      },
    })
    return NextResponse.json({ record: toDTO(row) }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/records]', error)
    return NextResponse.json(
      { error: 'No se pudo guardar el registro.' },
      { status: 500 },
    )
  }
}
