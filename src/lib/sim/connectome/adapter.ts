// ─────────────────────────────────────────────────────────────────────────────
// Adaptador de cerebros — patrón Strategy.
//
// Define el contrato común que el simulador (creature/world/Canvas) consume,
// de modo que la arquitectura neuronal de cada especie es intercambiable:
//
//   'ann'        → red 12→8→3 con pesos evolucionables (control experimental).
//   'elegans'    → conectoma biológico real de C. elegans + LIF (gusanos).
//   'drosophila' → conectoma real del cerebro larvario de D. melanogaster
//                  (Winding 2023, 2.956 neuronas) + LIF (moscas).
// ─────────────────────────────────────────────────────────────────────────────

import type { Rng } from '../rng'
import type { Species } from '../types'

export type BrainKind = 'ann' | 'elegans' | 'drosophila'

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

  /**
   * Opcional: knockout experimental — silencia un conjunto de neuronas
   * (V≡0, sin disparo). Es la ablación virtual del Laboratorio; la ANN
   * (control sin biología) no lo implementa.
   */
  setSilenced?(ids: Set<number> | null): void

  /**
   * Opcional: electrodo virtual — inyecta corriente a neuronas concretas
   * en el próximo tick (el tap del Laboratorio excita directamente los
   * mecanorreceptores del cuerpo, como el golpe real al plato).
   */
  stimulate?(ids: number[], amp: number): void
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
import { DrosophilaBrain } from './drosophila'

const FACTORIES: Record<Species, BrainCtor> = {
  // La mosca usa el conectoma real de Drosophila (Fase 2). La ANN queda
  // como control experimental sembrable desde el Museo/Laboratorio.
  fly: (genome) =>
    genome ? new DrosophilaBrain(genome) : new DrosophilaBrain(),
  worm: (genome) =>
    genome ? new ElegansBrain(genome) : new ElegansBrain(),
}

/** Crea el cerebro por defecto de una especie (con genoma opcional). */
export function createBrain(species: Species, genome?: Float32Array): IBrainAdapter {
  return FACTORIES[species](genome)
}
