// Generador pseudoaleatorio determinista (mulberry32) + utilidades.

export class Rng {
  private s: number

  constructor(seed?: number) {
    this.s = (seed ?? Math.floor(Math.random() * 2 ** 31)) | 0
  }

  /** Valor en [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Valor en [a, b). */
  range(a: number, b: number): number {
    return a + this.next() * (b - a)
  }

  /** Entero en [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n)
  }

  /** Ruido gaussiano (Box-Muller) con desviación sigma. */
  gauss(sigma = 1): number {
    let u = 0
    let v = 0
    while (u === 0) u = this.next()
    while (v === 0) v = this.next()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma
  }
}
