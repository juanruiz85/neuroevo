// Red neuronal compacta para las criaturas de NeuroEvo.
// Topología fija: 12 sensores -> 8 neuronas ocultas (tanh) -> 3 motores.
// Los pesos son el "genoma" que se hereda y muta entre generaciones.
// Implementa IBrainAdapter: la alternativa biológica es ElegansBrain
// (conectoma real de C. elegans) — ver ./connectome/adapter.ts.

import type { Rng } from './rng'
import type { IBrainAdapter } from './connectome/adapter'

export const NN_IN = 12
export const NN_H = 8
export const NN_OUT = 3
export const NN_SIZE = NN_IN * NN_H + NN_H + NN_H * NN_OUT + NN_OUT

export const INPUT_LABELS = [
  'Sesgo',
  'Energía',
  'Térmico',
  'Luz',
  'Humedad',
  'Comida X',
  'Comida Y',
  'Comida cer.',
  'Veneno X',
  'Veneno Y',
  'Veneno cer.',
  'Multitud',
] as const

export const OUTPUT_LABELS = ['Girar', 'Avanzar', 'Reproducir'] as const

// Distribución de los pesos dentro del array plano.
const W1 = 0
const B1 = NN_IN * NN_H
const W2 = B1 + NN_H
const B2 = W2 + NN_H * NN_OUT

export class Brain implements IBrainAdapter {
  readonly kind = 'ann' as const
  readonly w: Float32Array
  /** Activaciones de la última propagación (para el inspector visual). */
  readonly inA = new Float32Array(NN_IN)
  readonly hA = new Float32Array(NN_H)
  readonly oA = new Float32Array(NN_OUT)

  constructor(weights?: Float32Array) {
    if (weights) {
      this.w = weights
    } else {
      this.w = new Float32Array(NN_SIZE)
      for (let i = 0; i < NN_SIZE; i++) {
        this.w[i] = (Math.random() * 2 - 1) * 0.9
      }
    }
  }

  /**
   * Propaga los sensores y escribe las activaciones.
   * `voltage` < 1 simula el descenso de voltaje neuronal por frío extremo:
   * las señales motoras se debilitan y la criatura se vuelve torpe.
   */
  forward(inputs: readonly number[] | Float32Array, voltage = 1): void {
    const { w, inA, hA, oA } = this
    for (let i = 0; i < NN_IN; i++) inA[i] = inputs[i]

    for (let h = 0; h < NN_H; h++) {
      let sum = w[B1 + h]
      for (let i = 0; i < NN_IN; i++) sum += inA[i] * w[W1 + i * NN_H + h]
      hA[h] = Math.tanh(sum)
    }

    for (let o = 0; o < NN_OUT; o++) {
      let sum = w[B2 + o]
      for (let h = 0; h < NN_H; h++) sum += hA[h] * w[W2 + h * NN_OUT + o]
      if (o === 0) oA[o] = Math.tanh(sum) * voltage // girar
      else if (o === 1) oA[o] = sigmoid(sum) * voltage // avanzar
      else oA[o] = sigmoid(sum) // impulso reproductivo
    }
  }

  clone(): Brain {
    return new Brain(new Float32Array(this.w))
  }

  /** Mutación gausiana por gen con tasa y sigma configurables. */
  mutate(rng: Rng, rate = 0.1, sigma = 0.4): void {
    const w = this.w
    for (let i = 0; i < w.length; i++) {
      if (rng.next() < rate) {
        w[i] = clamp(w[i] + rng.gauss(sigma), -4, 4)
      }
    }
  }
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
