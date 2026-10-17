// ─────────────────────────────────────────────────────────────────────────────
// Adaptador de cerebros — patrón Strategy.
//
// Define el contrato común que el simulador (creature/world/Canvas) consume,
// de modo que la arquitectura neuronal de cada especie es intercambiable:
//
//   'ann'      → red 12→8→3 con pesos evolucionables (moscas hoy).
//   'elegans'  → conectoma biológico real de C. elegans + LIF (gusanos).
//   'drosophila' → (FASE 2, ver docs/FASE-2-DROSOPHILA.md) conectoma de la
//                  mosca reducido offline con neuprint-python; implementará
//                  esta misma interfaz y el Canvas no notará el cambio.
// ─────────────────────────────────────────────────────────────────────────────

import type { Rng } from '../rng'
import type { Species } from '../types'

export type BrainKind = 'ann' | 'elegans'

/**
 * Contrato único entre el motor de simulación y cualquier arquitectura
 * neuronal, biológica o artificial. `forward()` se llama una vez por tick
 * (30 Hz dentro del bucle requestAnimationFrame del Canvas) y las tres
 * salidas motoras controlan giro, avance e impulso reproductivo.
 */
export interface IBrainAdapter {
  /** Arquitectura: 'ann' | 'elegans' (| 'drosophila' en la Fase 2). */
  readonly kind: BrainKind

  /** Genoma plano serializable (se guarda en el Museo de la Evolución). */
  readonly w: Float32Array

  /** Espejo de la última entrada sensorial (para el inspector). */
  readonly inA: Float32Array
  /** Resumen interno de 8 canales (clases/pools) para el inspector. */
  readonly hA: Float32Array
  /** Salidas motoras [girar, avanzar, reproducir] en [-1, 1]. */
  readonly oA: Float32Array

  /**
   * Propaga los 12 canales sensoriales y actualiza las salidas.
   * `voltage` < 1 simula el descenso de voltaje por frío extremo
   * (Q10 térmico): las señales se debilitan y la criatura se vuelve torpe.
   */
  forward(inputs: readonly number[] | Float32Array, voltage?: number): void

  /** Copia independiente (reproducción asexual). */
  clone(): IBrainAdapter

  /** Mutación gaussiana del genoma (algoritmo genético). */
  mutate(rng: Rng, rate?: number, sigma?: number): void

  /**
   * Opcional: actividad del conectoma para el inspector neuronal
   * (potenciales de membrana + picos del último tick). Solo lo implementan
   * los cerebros biológicos; la ANN devuelve undefined.
   */
  connectomeView?(): ConnectomeActivity
}

/** Actividad de un conectoma biológico para visualizar en vivo. */
export interface ConnectomeActivity {
  /** Potencial de membrana normalizado por neurona [0, ~2]. */
  v: Float32Array | number[]
  /** 1 si la neurona disparó en el último tick. */
  s: Float32Array | number[]
}

// ——— Registro de fábricas (extensible para la Fase 2) ———————————————————————
// Para integrar el conectoma de Drosophila basta con registrar/ajustar la
// fábrica de 'fly'; ninguna otra parte del motor cambia.

type BrainCtor = (genome?: Float32Array) => IBrainAdapter

import { Brain } from '../nn'
import { ElegansBrain } from './elegans'

const FACTORIES: Record<Species, BrainCtor> = {
  fly: (genome) => (genome ? new Brain(genome) : new Brain()),
  worm: (genome) =>
    genome ? new ElegansBrain(genome) : new ElegansBrain(),
}

/** Crea el cerebro por defecto de una especie (con genoma opcional). */
export function createBrain(species: Species, genome?: Float32Array): IBrainAdapter {
  return FACTORIES[species](genome)
}
