// ─────────────────────────────────────────────────────────────────────────────
// Grupos de knockout del Laboratorio — ablación virtual por clase neuronal.
//
// Cada grupo se resuelve a los ÍNDICES REALES del conectoma correspondiente
// (índices globales compartidos con el grafo LIF). Es la versión virtual de
// los experimentos de ablación láser clásicos (Chalfie et al. 1985) y de la
// genética de circuitos (Wicks & Rankin 1997).
// —───────────────────────────────────────────────────────────────────────────

import { getElegansIndicesByNames } from './elegans'
import { getDrosophilaIndicesByGroup } from './drosophila'
import type { Species } from '../types'

export interface KnockoutGroup {
  key: string
  label: string
  /** Descripción del papel del circuito. */
  desc: string
}

export const WORM_KNOCKOUT_GROUPS: readonly KnockoutGroup[] = [
  {
    key: 'ash', label: 'ASH — nocicepción y luz',
    desc: 'Nociceptor polimodal: veneno, tacto nasal y fotofobia LITE-1.',
  },
  {
    key: 'ase', label: 'ASE — gusto y klinotaxis',
    desc: 'Gusto y derivada del gradiente: la brújula quimiosensorial.',
  },
  {
    key: 'afd', label: 'AFD — termosensor',
    desc: 'Termotaxis primaria (botermafia).',
  },
  {
    key: 'commandA', label: 'AVA/AVD/AVE — comando de reversa',
    desc: 'Interneuronas de comando A: disparan la marcha atrás.',
  },
  {
    key: 'pvc', label: 'PVC — comando de avance',
    desc: 'Vía del acelerón al tocar la cola (PLM→PVC→VB/DB).',
  },
  {
    key: 'egg', label: 'HSN+VC — puesta de huevos',
    desc: 'El circuito real de oviposición: sin él, no hay descendencia.',
  },
  {
    key: 'plm', label: 'PLM — tacto caudal',
    desc: 'Mecanorreceptor posterior (circuito del tap).',
  },
  {
    key: 'alm', label: 'ALM/AVM — tacto cefálico',
    desc: 'Mecanorreceptores anteriores (circuito del tap).',
  },
]

const WORM_GROUP_NAMES: Record<string, string[]> = {
  ash: ['ASHL', 'ASHR'],
  ase: ['ASEL', 'ASER'],
  afd: ['AFDL', 'AFDR'],
  commandA: ['AVAL', 'AVAR', 'AVDL', 'AVDR', 'AVEL', 'AVER'],
  pvc: ['PVCL', 'PVCR'],
  egg: ['HSNL', 'HSNR', 'VC01', 'VC02', 'VC03', 'VC04', 'VC05', 'VC06'],
  plm: ['PLML', 'PLMR'],
  alm: ['ALML', 'ALMR', 'AVM'],
}

export const FLY_KNOCKOUT_GROUPS: readonly KnockoutGroup[] = [
  { key: 'olf', label: 'ORN — olfato (42)', desc: 'Neuronas olfativas del antenalar: la quimiotaxis se apaga.' },
  { key: 'vis', label: 'PR — visión (29)', desc: 'Fotorreceptores: fotofobia y sombra que crece (escape visual).' },
  { key: 'noc', label: 'NOC — nocicepción (6)', desc: 'Vía md-IV del escape: sin ella no hay huida del veneno.' },
  { key: 'mec', label: 'MEC — mecanosenso (14)', desc: 'Tacto, choques y multitud.' },
  { key: 'gut', label: 'GUT — víscera (85)', desc: 'Estiramiento intestinal: la señal del hambre.' },
  { key: 'gus', label: 'GRN — gusto externo (132)', desc: 'Gusto de superficie: detectar la comida cercana.' },
  { key: 'rsp', label: 'RSP — respiración (26)', desc: 'Aire/humedad del medio.' },
  { key: 'dnv', label: 'DN-VNC — locomoción (182)', desc: 'Las descendentes de vuelo/caminado: la mosca queda inmóvil.' },
  { key: 'dns', label: 'DN-SEZ — puesta (164)', desc: 'Descendentes viscerales: la oviposición se apaga.' },
]

/** Resuelve un grupo a los índices reales del conectoma de la especie. */
export function knockoutIndices(species: Species, key: string): number[] {
  if (species === 'worm') {
    return getElegansIndicesByNames(WORM_GROUP_NAMES[key] ?? [])
  }
  return getDrosophilaIndicesByGroup(
    key as Parameters<typeof getDrosophilaIndicesByGroup>[0],
  )
}

/** Grupos de knockout disponibles para una especie. */
export function knockoutGroups(species: Species): readonly KnockoutGroup[] {
  return species === 'worm' ? WORM_KNOCKOUT_GROUPS : FLY_KNOCKOUT_GROUPS
}
