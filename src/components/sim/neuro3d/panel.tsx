'use client'

// Panel de controles del modo 3D: sujeto (soltar/seguir), herramientas de
// colocación (comida buena/cebo amargo/silueta/golpe/chorro), aprendizaje
// alimentario en vivo, leyenda del holograma, sentidos en vivo y
// procedencia de los datos anatómicos.

import { useState } from 'react'
import {
  Bug,
  Eye,
  FlaskConical,
  Info,
  Lightbulb,
  MousePointerClick,
  Rat,
  RotateCcw,
  Worm,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { SensorStrip } from '@/components/sim/sensor-strip'
import type { SimApi } from '@/components/sim/use-simulation'
import type { Species } from '@/lib/sim/types'
import { SPECIES_CONFIG } from '@/lib/sim/types'
import { cn } from '@/lib/utils'
import { TOOL_INFO, useNeuro3D, type Tool3D, type FlyStage } from './store'
import { FLY_3D, FLY_LABEL_GROUPS } from './data'
import { LARVA_GROUP_TINT } from './larva'
import { elegansLabGenome } from '@/lib/sim/connectome/elegans'
import { drosophilaForagerGenome } from '@/lib/sim/connectome/drosophila'

const TOOLS: { key: Tool3D; label: string; icon: string; tone: string }[] = [
  { key: 'none', label: 'Navegar', icon: '🔍', tone: 'data-[on=true]:bg-zinc-700' },
  { key: 'sugar', label: 'Azúcar 🍬', icon: '', tone: 'data-[on=true]:bg-amber-600' },
  { key: 'fruit', label: 'Fruta 🍎', icon: '', tone: 'data-[on=true]:bg-red-700' },
  { key: 'bitter', label: 'Cebo amargo', icon: '', tone: 'data-[on=true]:bg-lime-800' },
  { key: 'shadow', label: 'Silueta 🦅', icon: '', tone: 'data-[on=true]:bg-stone-600' },
  { key: 'tap', label: 'Golpe 👆', icon: '', tone: 'data-[on=true]:bg-zinc-500' },
  { key: 'airPuff', label: 'Chorro 💨', icon: '', tone: 'data-[on=true]:bg-cyan-800' },
]

/** Leyenda de grupos del holograma LARVARIO (colores del tinte real). */
const LARVA_LEGEND: { groups: string[]; color: string; label: string; n: number }[] = [
  { groups: ['ORN'], color: LARVA_GROUP_TINT.ORN, label: 'ORN · olfato (órgano dorsal)', n: 42 },
  { groups: ['GRN'], color: LARVA_GROUP_TINT.GRN, label: 'GRN · gusto (órgano terminal)', n: 132 },
  { groups: ['GNP'], color: LARVA_GROUP_TINT.GNP, label: 'GNP · gusto faríngeo', n: 110 },
  { groups: ['PR'], color: LARVA_GROUP_TINT.PR, label: 'PR · luz (órgano de Bolwig)', n: 29 },
  { groups: ['KC'], color: LARVA_GROUP_TINT.KC, label: 'KC · memoria (cuerpo fungiforme)', n: 144 },
  { groups: ['MBON'], color: LARVA_GROUP_TINT.MBON, label: 'MBON/MBIN · salida y refuerzo del MB', n: 238 },
  { groups: ['LHN'], color: LARVA_GROUP_TINT.LHN, label: 'LHN · innato (cuerno lateral)', n: 202 },
  { groups: ['PN'], color: LARVA_GROUP_TINT.PN, label: 'PN/mPN/LN · lóbulo antenal', n: 468 },
  { groups: ['DNV'], color: LARVA_GROUP_TINT.DNV, label: 'Descendentes · cerebro→VNC', n: 924 },
  { groups: ['ASC'], color: LARVA_GROUP_TINT.ASC, label: 'ASC · ascendentes (VNC)', n: 18 },
  { groups: ['GUT'], color: LARVA_GROUP_TINT.GUT, label: 'GUT · sistema nervioso entérico', n: 85 },
  { groups: ['MEC'], color: LARVA_GROUP_TINT.MEC, label: 'MEC/NOC/PRO · pared del cuerpo', n: 28 },
]

export function Neuro3DControls({ sim }: { sim: SimApi }) {
  const tool = useNeuro3D((s) => s.tool)
  const setTool = useNeuro3D((s) => s.setTool)
  const labels = useNeuro3D((s) => s.labels)
  const setLabels = useNeuro3D((s) => s.setLabels)
  const flyStage = useNeuro3D((s) => s.flyStage)
  const setFlyStage = useNeuro3D((s) => s.setFlyStage)
  const [provenance, setProvenance] = useState(false)
  const sel = sim.ui.selected
  const cfg = sel ? SPECIES_CONFIG[sel.species] : null
  const drop = (species: Species) => {
    // Genomas de línea de laboratorio: gusano N2 y mosca forrajera (drive
    // tónico de locomoción — camina y explora el terrario).
    const genome = species === 'worm' ? elegansLabGenome() : drosophilaForagerGenome()
    const c = sim.spawnAt(species, species === 'worm' ? 'elegans' : 'drosophila', 640, 420, genome)
    if (c) sim.selectAt(c.x, c.y)
  }

  return (
    <div className="space-y-3">
      {/* — Sujeto — */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Rat className="size-4 text-emerald-500" /> Sujeto del terrario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => drop('worm')}>
              <Worm className="size-3.5 text-emerald-500" /> Soltar gusano
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => drop('fly')}>
              <Bug className="size-3.5 text-amber-500" /> Soltar mosca
            </Button>
          </div>
          {sel && cfg ? (
            <div className="space-y-1.5 rounded-lg border bg-muted/40 p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {sel.species === 'worm' ? 'Gusano' : 'Mosca'}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {sel.brainKind === 'elegans' ? 'conectoma C. elegans (300)' : sel.brainKind === 'drosophila' ? 'conectoma Drosophila LARVA (2.956)' : 'ANN de control'}
                  </span>
                </span>
                {sel.species === 'worm' && sel.stage && (
                  <span className="rounded bg-emerald-950 px-1.5 py-px font-mono text-[10px] text-emerald-300">
                    {sel.stage}
                  </span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Energía</span>
                <Progress
                  value={(sel.energy / cfg.maxEnergy) * 100}
                  className={cn(
                    'mt-1 h-1.5',
                    sel.energy < cfg.maxEnergy * 0.25
                      ? '[&>div]:bg-rose-500'
                      : '[&>div]:bg-emerald-500',
                  )}
                />
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>vel {sel.speed.toFixed(0)} px/s</span>
                <span>G{sel.generation}</span>
                <span>x{sel.speed > 0 ? '' : ''}{sim.speed} tiempo</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Suelta un organismo o sigue a uno del ecosistema: su cerebro se
              dibuja en 3D sobre el plato con cada pico real.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="ghost" onClick={() => sim.followRandom('worm')}>
              <Worm className="size-3.5" /> Seguir gusano
            </Button>
            <Button size="sm" variant="ghost" onClick={() => sim.followRandom('fly')}>
              <Bug className="size-3.5" /> Seguir mosca
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* — Herramientas — */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MousePointerClick className="size-4 text-amber-500" /> Colocar en el plato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {TOOLS.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant="outline"
                data-on={tool === t.key}
                className={cn(
                  'h-8 justify-start px-2 text-xs',
                  tool === t.key && 'border-primary',
                  t.tone,
                )}
                onClick={() => setTool(t.key)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
            <Lightbulb className="mr-1 inline size-3 text-amber-400" />
            {TOOL_INFO[tool].hint}
          </p>
        </CardContent>
      </Card>

      {/* — Aprendizaje alimentario — */}
      {sel?.learn && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FlaskConical className="size-4 text-rose-400" /> Aprendizaje alimentario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div>
              <div className="mb-1 flex justify-between">
                <span>Preferencia por lo bueno</span>
                <span className="font-mono text-emerald-400">
                  {(sel.learn.good * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={sel.learn.good * 100} className="h-1.5 [&>div]:bg-emerald-500" />
            </div>
            <div>
              <div className="mb-1 flex justify-between">
                <span>Aversión aprendida a lo amargo</span>
                <span className="font-mono text-rose-400">
                  {(sel.learn.bad * 100).toFixed(0)}%
                </span>
              </div>
              <Progress value={sel.learn.bad * 100} className="h-1.5 [&>div]:bg-rose-500" />
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>🍽️ comilonas buenas: <b>{sel.learn.bites}</b></span>
              <span>😖 pruebas amargas: <b>{sel.learn.bitterBites}</b></span>
            </div>
            <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
              Aprendizaje por valor: la recompensa (NSM/serotonina ·
              octopamina) refuerza la atracción; el castigo del amargo
              (RIM/tiramina · dopamina PPL1→MBON) reescribe la valencia del
              olor — el cebo pasa de «oler a comida» a «oler a peligro». La
              memoria se extingue despacio si no se repite.
            </p>
          </CardContent>
        </Card>
      )}

      {/* — Holograma — */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="size-4 text-cyan-400" /> Holograma cerebral
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {/* Etapa del cerebro de la mosca: dos datasets reales de D. melanogaster */}
          {sel?.species === 'fly' && (
            <div className="space-y-1.5">
              <p className="text-muted-foreground">Etapa del cerebro (2 datasets reales):</p>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  data-on={flyStage === 'larva'}
                  className={cn(
                    'h-11 flex-col items-start justify-center px-2 text-left text-[11px] leading-tight',
                    flyStage === 'larva' && 'border-primary bg-amber-950/60',
                  )}
                  onClick={() => setFlyStage('larva')}
                >
                  <span className="font-semibold">🐛 Drosophila Larva</span>
                  <span className="text-muted-foreground">2.956 neuronas (Winding 2023)</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  data-on={flyStage === 'adult'}
                  className={cn(
                    'h-11 flex-col items-start justify-center px-2 text-left text-[11px] leading-tight',
                    flyStage === 'adult' && 'border-primary bg-amber-950/60',
                  )}
                  onClick={() => setFlyStage('adult')}
                >
                  <span className="font-semibold">🪰 Drosophila Adulta</span>
                  <span className="text-muted-foreground">141.781 somas (Berg 2026)</span>
                </Button>
              </div>
            </div>
          )}
          {sel?.species === 'worm' ? (
            <p className="leading-snug text-muted-foreground">
              El <b>sistema nervioso completo</b> en disposición anatómica real
              (WormBase Virtual Worm): los <b>302 somas</b> tenues por clase y,
              encima, los <b>puntos que se activan</b> brillando con cada
              voltaje LIF. Andamio central: <b>anillo nervioso</b> + <b>cordón
              ventral</b> (por los somas motores reales) + <b>cordón dorsal</b>.
              Andamio <b>sensorial</b>: <b>anfídios</b> y <b>fasmas</b> (poros +
              tractos), los 6 receptores de <b>tacto</b> (ALM/PLM/AVM/PVM) y
              <b> PVD</b> (nocicepción) — cada tracto brilla con la actividad
              real de sus neuronas. Cabeza a la izquierda.
            </p>
          ) : sel?.species === 'fly' && flyStage === 'larva' ? (
            <p className="leading-snug text-muted-foreground">
              El <b>cerebro larvario REAL</b> que simula el motor (Winding
              2023): <b>2.956 puntos, uno por neurona</b>, cada uno brillando
              con su voltaje LIF propio — igual que el gusano. Andamio
              canónico: <b>lóbulos antenales</b>, <b>cuerpos fungiformes</b>{' '}
              (cálices → pedúnculos → lóbulos), <b>cuernos laterales</b>,{' '}
              <b>SEZ</b>, nervios sensoriales (<b>órgano dorsal</b>,{' '}
              <b>Bolwig</b>, terminal, faríngeo), <b>conectivo cervical</b> y{' '}
              <b>cordón ventral</b> de 11 neuromeros (T1–T3, A1–A8) con nervios
              segmentarios. Cabeza a la izquierda.
            </p>
          ) : sel?.species === 'fly' ? (
            <p className="leading-snug text-muted-foreground">
              El <b>CNS adulto masculino</b> completo (141.781 somas reales,
              Berg 2026) como nube de vóxeles por región; sobre él, la
              actividad de los <b>29 grupos larvarios</b> que simula el motor
              (Winding 2023) proyectada en sus familias adultas homólogas.
              Andamio derivado de la propia nube: <b>tractos ópticos</b>,{' '}
              <b>nervios antenales</b>, <b>probóscide</b>, <b>conectivo
              cervical</b> y <b>eje del cordón ventral</b>.
            </p>
          ) : (
            <p className="leading-snug text-muted-foreground">
              Suelta un organismo (o sigue a uno del ecosistema) y su cerebro
              se dibujará aquí en 3D: el gusano con sus 302 neuronas reales, la
              mosca con su conectoma larvario real y su anatomía adulta.
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Etiquetas de grupos</span>
            <Switch checked={labels} onCheckedChange={setLabels} aria-label="Etiquetas del holograma" />
          </div>
          {sel?.species === 'fly' && flyStage === 'larva' && (
            <div className="nice-scroll max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {LARVA_LEGEND.map((c) => (
                <div key={c.label} className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 rounded-[2px]"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <span className="flex-1 text-[11px] text-muted-foreground">{c.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{c.n}</span>
                </div>
              ))}
            </div>
          )}
          {sel?.species === 'fly' && flyStage === 'adult' && (
            <div className="nice-scroll max-h-28 space-y-1 overflow-y-auto rounded-md border p-2">
              {FLY_3D.classes.filter((c) => c.n > 0).map((c) => (
                <div key={c.key} className="flex items-center gap-2">
                  <span
                    className="inline-block size-2.5 rounded-[2px]"
                    style={{ backgroundColor: c.color }}
                    aria-hidden
                  />
                  <span className="flex-1 text-[11px] text-muted-foreground">{c.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {c.n.toLocaleString('es')}
                  </span>
                </div>
              ))}
            </div>
          )}
          {sel?.species === 'fly' && flyStage === 'adult' && (
            <p className="text-[10px] leading-snug text-muted-foreground">
              Grupos etiquetados: {FLY_LABEL_GROUPS.join(' · ')} — pasa el
              tiempo cerca de comida o de la silueta y mira qué familias se
              encienden.
            </p>
          )}
        </CardContent>
      </Card>

      {/* — Sentidos — */}
      {sel && (
        <Card>
          <CardContent className="pt-4">
            <SensorStrip
              creature={sel}
              variant={sel.brainKind === 'drosophila' ? 'fly' : 'worm'}
            />
          </CardContent>
        </Card>
      )}

      {/* — Procedencia — */}
      <Card>
        <CardHeader className="pb-2">
          <button
            className="flex w-full items-center justify-between text-left"
            onClick={() => setProvenance((v) => !v)}
            aria-expanded={provenance}
          >
            <CardTitle className="flex items-center gap-2 text-sm">
              <Info className="size-4 text-muted-foreground" /> Datos y simplificaciones
            </CardTitle>
            <RotateCcw
              className={cn('size-3.5 text-muted-foreground transition-transform', provenance && 'rotate-180')}
            />
          </button>
        </CardHeader>
        {provenance && (
          <CardContent className="space-y-2 text-[11px] leading-snug text-muted-foreground">
            <p>
              <b className="text-foreground">Gusano (anatomía):</b> 302 somas
              reales en µm — WormBase Virtual Worm (C. Grove &amp; P.
              Sternberg, Caltech, dominio público) vía OpenWorm c302 (MIT).
              Sistema sensorial según WormAtlas (anfídios/fasmas/tacto/PVD).
            </p>
            <Separator />
            <p>
              <b className="text-foreground">Mosca — etapa LARVA:</b> el
              conectoma larvario completo que simula el motor (Winding et al.
              2023, Science: 2.956 neuronas/41.977 aristas) dibujado{' '}
              <b className="text-foreground">neurona a neurona</b> sobre un
              layout canónico de su neuroanatomía larvaria (Berck 2016;
              Eichler 2017; Eschbach 2020/21): la posición por neurona es una
              aproximación declarada, la actividad es 100 % real (LIF por
              neurona).
            </p>
            <Separator />
            <p>
              <b className="text-foreground">Mosca — etapa ADULTA:</b> CNS
              adulto masculino neuPrint <i>male-cns:v1.0</i> (Berg et al., Cell
              2026, CC BY 4.0), 141.781 somas reales, extraído del binario
              FLYB de github.com/blendi-remade/fly-brain-minecraft (MIT). El
              andamio adulto (tractos ópticos, nervios antenales, probóscide,
              conectivo, eje del VNC) se deriva de los centroides/bines de la
              propia nube. El cuerpo voxelar es un{' '}
              <b className="text-foreground">diseño propio</b> de NeuroEvo.
            </p>
            <Separator />
            <p>
              <b className="text-foreground">Actividad en vivo:</b> conectomas
              reales que simula el motor — C. elegans (OpenWorm, 300
              neuronas/4.731 sinapsis, LIF) y cerebro larvario de Drosophila
              (Winding 2023). En la vista adulta, la actividad larvaria se
              ancla a los centroides de las familias adultas homólogas
              (simplificación declarada).
            </p>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
