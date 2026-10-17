// ─────────────────────────────────────────────────────────────────────────────
// Canales sensoriales del mundo → neuronas reales de Drosophila (cerebro
// larvario, Winding et al. 2023).
//
// Metadatos COMPARTIDOS entre el motor (drosophila.ts inyecta la corriente en
// los grupos neuronales anotados con cada modalidad REAL en el dataset) y la
// interfaz (tira "Sentidos en vivo" de la mosca).
//
// La mosca percibe el mundo con 17 sentidos + 1 canal propio (gusto faríngeo);
// los índices 0..16 COINCIDEN con los del gusano (contrato común del motor,
// ver sensors.ts) para que creature.ts llene un único array de entradas:
//
//   · Olfato          ORNs (42, antenales) — contraste L/R + klinotaxis
//   · Gusto externo   GRNs externos (132) — gradiente de comida cercana
//   · Gusto faríngeo  GRNs faríngeos (110) — se activan AL INGERIR
//   · Visión          PRs (29, fotorreceptores) — fotofobia larvaria real
//   · Nocicepción     md-IV-like (6) — veneno y estímulos nocivos → escape
//   · Termo frío/calor  THc (6) + THw (4) — dos poblaciones reales distintas
//   · Mecanosenso     chordotonales (14) — tacto, multitud, choques
//   · Propiocepción   proprio (8) — vuelo/curvatura con signo
//   · Respiración     RSP (26) — aire/humedad del medio
//   · Víscera         GUT (85) — estiramiento intestinal (hambre)
//
// Canales SIN mapeo real en el dataset (documentado):
//   · Feromona (16)   la larva agrega por señales químicas, pero el dataset
//     no anota ningún receptor feromonal identificable → el canal existe en
//     el contrato común pero NO se inyecta en el cerebro de la mosca.
// —───────────────────────────────────────────────────────────────────────────

import { CH } from './sensors'

/** Índice del canal exclusivo de Drosophila. */
export const DCH = {
  ...CH,
  /** Gusto faríngeo: GRNs que responden al ingerir comida. */
  FPHARYNX: 17,
} as const

/** Nº total de canales del contrato común (gusano 17 + faríngeo 18). */
export const ALL_CHANNELS = 18

type SensorGroup = 'motor' | 'interno' | 'quimico' | 'fisico' | 'social'

export interface FlySensorChannel {
  key: string
  /** Índice en el array de entradas del cerebro. */
  ch: number
  label: string
  short: string
  /** Grupos neuronales reales que este canal excita (con su tamaño). */
  neurons: string
  group: SensorGroup
  desc: string
}

export const FLY_GROUP_LABEL: Record<SensorGroup, string> = {
  motor: 'Motor',
  interno: 'Interno',
  quimico: 'Químico',
  fisico: 'Físico',
  social: 'Social',
}

export const FLY_SENSOR_CHANNELS: readonly FlySensorChannel[] = [
  {
    key: 'tonico', ch: DCH.TONIC, label: 'Impulso tónico (CPG de vuelo)',
    short: 'Tónico', neurons: 'DNs de locomoción', group: 'motor',
    desc: 'Drive endógeno a las neuronas descendentes: el latido basal del vuelo/caminado.',
  },
  {
    key: 'hambre', ch: DCH.ENERGY, label: 'Hambre (víscera)',
    short: 'Hambre', neurons: 'GUT (85)', group: 'interno',
    desc: 'Receptores de estiramiento intestinal: estado energético (análogo AKH).',
  },
  {
    key: 'termico', ch: DCH.THERMO, label: 'Termosensación con signo',
    short: 'Termo', neurons: 'THc (6) + THw (4)', group: 'fisico',
    desc: 'Dos poblaciones reales distintas: frío (negativo) y calor (positivo).',
  },
  {
    key: 'luz', ch: DCH.LIGHT, label: 'Visión (fotorreceptores)',
    short: 'Luz', neurons: 'PR (29)', group: 'fisico',
    desc: 'Los PRs larvarios median la fotofobia real (Kane 2013); también la sombra que crece.',
  },
  {
    key: 'humedad', ch: DCH.HUMIDITY, label: 'Aire / respiración',
    short: 'Aire', neurons: 'RSP (26)', group: 'fisico',
    desc: 'Neuronas respiratorias: calidad del aire e higrosensación del medio.',
  },
  {
    key: 'olfato_x', ch: DCH.FOOD_X, label: 'Olfato direccional X',
    short: 'Olfato X', neurons: 'ORN L/R (42)', group: 'quimico',
    desc: 'Contraste contralateral de ORNs izquierdas/derechas.',
  },
  {
    key: 'olfato_y', ch: DCH.FOOD_Y, label: 'Olfato direccional Y',
    short: 'Olfato Y', neurons: 'ORN (42, mitad A/B)', group: 'quimico',
    desc: 'Segundo eje direccional repartido por ordinales (simplificación: la larva resuelve Y con klinotaxis).',
  },
  {
    key: 'gusto', ch: DCH.FOOD_NEAR, label: 'Gusto externo / cercanía',
    short: 'Gusto', neurons: 'GRN ext (132)', group: 'quimico',
    desc: 'GRNs externos: concentración local del gradiente de comida/azúcar.',
  },
  {
    key: 'veneno_x', ch: DCH.POISON_X, label: 'Nocicepción aversiva X',
    short: 'Noci X', neurons: 'NOC L/R (6)', group: 'quimico',
    desc: 'Nociceptores con contraste L/R del gradiente de veneno.',
  },
  {
    key: 'veneno_y', ch: DCH.POISON_Y, label: 'Nocicepción aversiva Y',
    short: 'Noci Y', neurons: 'NOC (6, mitad A/B)', group: 'quimico',
    desc: 'Segundo eje aversivo de los nociceptores.',
  },
  {
    key: 'veneno_cerca', ch: DCH.POISON_NEAR, label: 'Intensidad nociceptiva',
    short: 'Nocicep.', neurons: 'NOC (6)', group: 'quimico',
    desc: 'Vía del escape real de la larva: md-IV → DNs → roll/huida (Ohyama 2015).',
  },
  {
    key: 'multitud', ch: DCH.CROWD, label: 'Mecanosenso / multitud',
    short: 'Multitud', neurons: 'MEC (14)', group: 'social',
    desc: 'Chordotonales: la marea de cuerpos que rodea a la mosca.',
  },
  {
    key: 'tacto_nariz', ch: DCH.TOUCH_FRONT, label: 'Tacto frontal (choque)',
    short: 'Tacto', neurons: 'MEC (14)', group: 'fisico',
    desc: 'Choque contra paredes o cuerpos: la corriente mecano llega alta al mismo grupo.',
  },
  {
    key: 'tacto_cola', ch: DCH.TOUCH_BACK, label: 'Tacto posterior',
    short: 'Tacto cola', neurons: 'MEC (14)', group: 'fisico',
    desc: 'Aproximación (no separada del frontal en el dataset): ganancia media.',
  },
  {
    key: 'propio', ch: DCH.PROPRIO, label: 'Propiocepción de vuelo',
    short: 'Propio', neurons: 'PRO (8)', group: 'interno',
    desc: 'Estiramiento del cuerpo y fase alar con signo (sensillas campaniformes del adulto).',
  },
  {
    key: 'delta_comida', ch: DCH.FOOD_DELTA, label: 'Deriva olfativa (klinotaxis)',
    short: 'Δ Gradiente', neurons: 'ORN (42)', group: 'quimico',
    desc: 'Las ORNs se adaptan: disparan al CAMBIO de concentración (el cabeceo real de la larva).',
  },
  {
    key: 'feromona', ch: DCH.PHEROMONE, label: 'Feromona de agregación',
    short: 'Feromona', neurons: '— (sin mapeo)', group: 'social',
    desc: 'La larva agrega por señales químicas reales, pero el dataset no anota el receptor: canal sin inyección (documentado).',
  },
  {
    key: 'gusto_faringeo', ch: DCH.FPHARYNX, label: 'Gusto faríngeo (al comer)',
    short: 'Faríngeo', neurons: 'GNP (110)', group: 'quimico',
    desc: 'Ráfaga al ingerir: los GRNs faríngeos cierran el lazo de realimentación de la comida.',
  },
]
