// Museo de la Evolución — almacenamiento local (modo estático / GitHub Pages).
//
// En el despliegue estático no existe backend: los linajes élite se
// conservan en el navegador del visitante (localStorage) respetando el
// mismo contrato `EvolutionRecordDTO` que usa la API REST en desarrollo,
// de modo que el resto de la app (selección, siembra, borrado) funciona
// sin cambios.

import type { EliteRecord, EvolutionRecordDTO } from './sim/types'

const KEY = 'neuroevo:museum:v1'
const MAX = 60

const isBrowser = typeof window !== 'undefined'

function readAll(): EvolutionRecordDTO[] {
  if (!isBrowser) return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as EvolutionRecordDTO[]) : []
  } catch {
    return []
  }
}

function writeAll(records: EvolutionRecordDTO[]): void {
  if (!isBrowser) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(records.slice(0, MAX)))
  } catch {
    // Cuota agotada o almacenamiento bloqueado: se ignora en silencio.
  }
}

/** Lista los linajes conservados en este navegador (más recientes primero). */
export function listRecords(): EvolutionRecordDTO[] {
  return readAll()
}

/** Guarda un linaje élite y devuelve el registro creado. */
export function saveRecord(rec: EliteRecord, name: string): EvolutionRecordDTO {
  const record: EvolutionRecordDTO = {
    ...rec,
    id: generateId(),
    name,
    createdAt: new Date().toISOString(),
  }
  writeAll([record, ...readAll()])
  return record
}

/** Elimina un linaje por id. */
export function removeRecord(id: string): void {
  writeAll(readAll().filter((rec) => rec.id !== id))
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
