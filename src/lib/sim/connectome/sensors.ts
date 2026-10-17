// ─────────────────────────────────────────────────────────────────────────────
// Canales sensoriales del mundo → neuronas reales de C. elegans.
//
// Metadatos COMPARTIDOS entre el motor (elegans.ts inyecta la corriente en
// las neuronas sensoriales reales) y la interfaz (tira de sensores en vivo y
// vista "Circuito vivo" del inspector). Este archivo no contiene lógica.
//
// Los gusanos perciben el mundo con 16 sentidos + 1 canal tónico; cada uno
// excita las mismas neuronas que usa el nemátodo real (OpenWorm):
//
//   · Quimiotaxis     AWC/AWA (olfato) + ASE (gusto, klinotaxis)
//   · Nocicepción     ASH (polimodal: química, mecánica y LUZ vía LITE-1)
//   · Termotaxis      AFD + AWC
//   · Higrosensación  BAG
//   · Mecanosenso     ALM/PLM (tacto suave), FLP/OLQ (nariz), PVD (brusco)
//   · Propiocepción   DVA (estiramiento corporal, TRP-4) + SMDD
//   · Estado interno  ADF (hambre/5HT-like) + HSN (tone reproductivo)
//   · Feromona        ADL (ascarósidos de conglomerado)
//
// Las moscas (ANN de control) solo leen los 12 primeros canales: son la
// especie experimental de referencia y mantienen su red 12→8→3 intacta.
// —───────────────────────────────────────────────────────────────────────────

/** Índices de los 17 canales (contrato motor ⇄ conectoma ⇄ interfaz). */
export const CH = {
  TONIC: 0,
  ENERGY: 1,
  THERMO: 2,
  LIGHT: 3,
  HUMIDITY: 4,
  FOOD_X: 5,
  FOOD_Y: 6,
  FOOD_NEAR: 7,
  POISON_X: 8,
  POISON_Y: 9,
  POISON_NEAR: 10,
  CROWD: 11,
  TOUCH_FRONT: 12,
  TOUCH_BACK: 13,
  PROPRIO: 14,
  FOOD_DELTA: 15,
  PHEROMONE: 16,
} as const

export type SensorGroup = 'motor' | 'interno' | 'quimico' | 'fisico' | 'social'

export interface SensorChannel {
  key: string
  /** Nombre completo del sentido. */
  label: string
  /** Etiqueta corta para la tira de sensores en vivo. */
  short: string
  /** Neuronas reales que este canal excita dentro del conectoma. */
  neurons: string
  group: SensorGroup
  desc: string
}

export const SENSOR_GROUP_LABEL: Record<SensorGroup, string> = {
  motor: 'Motor',
  interno: 'Interno',
  quimico: 'Químico',
  fisico: 'Físico',
  social: 'Social',
}

export const SENSOR_GROUP_COLOR: Record<SensorGroup, string> = {
  motor: '#94a3b8',
  interno: '#f472b6',
  quimico: '#34d399',
  fisico: '#fbbf24',
  social: '#c084fc',
}

export const SENSOR_CHANNELS: readonly SensorChannel[] = [
  {
    key: 'tonico',
    label: 'Impulso tónico (CPG)',
    short: 'Tónico',
    neurons: 'AVB + RMDD',
    group: 'motor',
    desc: 'Generador locomotor central endógeno: el vaivén basal del nemátodo.',
  },
  {
    key: 'energia',
    label: 'Hambre / saciedad interna',
    short: 'Hambre',
    neurons: 'ADF + HSN',
    group: 'interno',
    desc: 'Estado energético (5HT/NSM-like): modula exploración y tono reproductivo.',
  },
  {
    key: 'termico',
    label: 'Termosensación',
    short: 'Termo',
    neurons: 'AFD + AWC',
    group: 'fisico',
    desc: 'AFD detecta gradientes térmicos (botermotaxis); señal con signo: frío negativo.',
  },
  {
    key: 'luz',
    label: 'Fotorrecepción (LITE-1)',
    short: 'Luz',
    neurons: 'ASH',
    group: 'fisico',
    desc: 'C. elegans no tiene ojos: LITE-1 en ASH genera fotofobia (avoidance).',
  },
  {
    key: 'humedad',
    label: 'Higrosensación',
    short: 'Humedad',
    neurons: 'BAG',
    group: 'fisico',
    desc: 'Higrosensación ambiental (BAG responde a osmolaridad y aire).',
  },
  {
    key: 'comida_x',
    label: 'Olfato direccional X',
    short: 'Olfato X',
    neurons: 'AWC L/R',
    group: 'quimico',
    desc: 'Contraste contralateral AWC izquierda/derecha (asimetría quimiosensorial).',
  },
  {
    key: 'comida_y',
    label: 'Olfato direccional Y',
    short: 'Olfato Y',
    neurons: 'AWA L/R',
    group: 'quimico',
    desc: 'Segundo eje olfativo con contraste L/R vía AWA.',
  },
  {
    key: 'comida_cerca',
    label: 'Gusto / cercanía de comida',
    short: 'Gusto',
    neurons: 'ASE + AWC',
    group: 'quimico',
    desc: 'Concentración local del gradiente de detritos/azúcar (ASE, gusto).',
  },
  {
    key: 'veneno_x',
    label: 'Quimiorrecepción aversiva X',
    short: 'Veneno X',
    neurons: 'PHA L/R',
    group: 'quimico',
    desc: 'Fásmidos caudales: contraste L/R del gradiente de veneno.',
  },
  {
    key: 'veneno_y',
    label: 'Quimiorrecepción aversiva Y',
    short: 'Veneno Y',
    neurons: 'PHB L/R',
    group: 'quimico',
    desc: 'Segundo eje aversivo vía PHB (fásmidos).',
  },
  {
    key: 'veneno_cerca',
    label: 'Nocicepción química',
    short: 'Nocicep.',
    neurons: 'ASH',
    group: 'quimico',
    desc: 'ASH polimodal: intensidad del estímulo nocivo (veneno).',
  },
  {
    key: 'multitud',
    label: 'Mecanonocicepción / multitud',
    short: 'Multitud',
    neurons: 'PVD + ALM',
    group: 'social',
    desc: 'Contacto brusco (PVD) y tacto suave (ALM) de la marea de congéneres.',
  },
  {
    key: 'tacto_nariz',
    label: 'Tacto cefálico (nariz)',
    short: 'Tacto nariz',
    neurons: 'ASH + FLP + OLQ',
    group: 'fisico',
    desc: 'Circuito real de choque frontal: ASH→AVA→VA/DA desencadena la reversa.',
  },
  {
    key: 'tacto_cola',
    label: 'Tacto caudal',
    short: 'Tacto cola',
    neurons: 'PLM',
    group: 'fisico',
    desc: 'Circuito real: PLM→PVC→VB/DB acelera el avance al tocar de atrás.',
  },
  {
    key: 'propio',
    label: 'Propiocepción (curvatura)',
    short: 'Propio',
    neurons: 'DVA + SMDD',
    group: 'interno',
    desc: 'TRP-4 en DVA siente el estiramiento del cuerpo al ondular (con signo).',
  },
  {
    key: 'delta_comida',
    label: 'Deriva del gradiente (klinotaxis)',
    short: 'Δ Gradiente',
    neurons: 'ASE L/R',
    group: 'quimico',
    desc: 'ASE se adapta: responde al CAMBIO de concentración, no al nivel.',
  },
  {
    key: 'feromona',
    label: 'Feromona de conglomerado',
    short: 'Feromona',
    neurons: 'ADL',
    group: 'social',
    desc: 'Ascarósidos (real): densidad de congéneres; frena la puesta y provoca dauer.',
  },
]

export const NN_CHANNELS = SENSOR_CHANNELS.length + 1
// 17 canales del gusano + 1 exclusivo de la mosca (gusto faríngeo, índice 17
// en fly-sensors.ts): un único array de entradas compartido por todas las
// arquitecturas cerebrales (la ANN lee solo los 12 primeros).

export const CHANNEL_NEURONS: readonly string[][] = SENSOR_CHANNELS.map(
  (ch) => ch.neurons.split(/\s*\+\s*|\s*\/\s*|\s*,\s*/).filter(Boolean),
)
