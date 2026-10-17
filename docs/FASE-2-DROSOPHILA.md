# Fase 2 — Conectoma de *Drosophila melanogaster* (hoja de ruta)

> Estado: **planificada**. La Fase 1 (conectoma real de *C. elegans* en
> los gusanos) está completa y el patrón Strategy (`IBrainAdapter`)
> mantiene el Canvas, el GA y el Museo ajenos a la arquitectura neuronal.
> Integrar el cerebro de la mosca **solo tocará la fábrica de cerebros**.

---

## 1. Contrato de integración (ya operativo)

```ts
// src/lib/sim/connectome/adapter.ts
export interface IBrainAdapter {
  readonly kind: BrainKind            // 'ann' | 'elegans' | 'drosophila'
  readonly w: Float32Array            // genoma serializable (Museo)
  forward(inputs, voltage?): void     // 12 sensores → 3 motores, 30 Hz
  clone(): IBrainAdapter
  mutate(rng, rate?, sigma?): void
  connectomeView?(): ConnectomeActivity  // inspector neuronal en vivo
}

// Registro de fábricas — ÚNICO punto de cambio de la Fase 2:
const FACTORIES: Record<Species, BrainCtor> = {
  fly:  (genome) => new DrosophilaBrain(genome),  // ← sustituye a Brain (ANN)
  worm: (genome) => new ElegansBrain(genome),
}
```

El `DrosophilaBrain` consumirá el mismo dataset compacto que
`ElegansBrain` (nodos + aristas + clases), por lo que **el 95 % del
motor LIF (CSR, fuga, refractario, gap junctions, GA de
neuromodulación) es directamente reutilizable**. La diferencia será el
mapeo sensorial/motor (ver §4).

## 2. Fuentes de datos oficiales

| Fuente | Contenido | Acceso |
|---|---|---|
| **Janelia Research Campus — MaleCNS v1.0** | Conectoma completo del macho (~24.000 neuronas, ~32 M sinapsis) | https://www.janelia.org/project-team/flyem/male-cns-connectome · paquete R `malecns` (natverse) |
| **FlyWire / Princeton** | Conectoma del cerebro hembra, comunidad + pruebas automáticas | https://flywire.ai · **FlyWire Codex** |
| **neuPrint API** (Janelia/HHMI) | Consultas programáticas de conectomas | https://neuprint.janelia.org · `neuprint-python` |
| Explorador de tipos celulares | Referencia visual de tipos neuronales | https://reiserlab.github.io/celltype-explorer-drosophila-male-cns/ |
| Neuroglancer (demo) | Inspección visual de volúmenes | https://neuroglancer-demo.appspot.com/ |

## 3. Estrategia de reducción (NUNCA cargar el crudo en cliente)

Los conectomas crudos de la mosca pesan **7-12 GB** (~18.000-24.000
neuronas y millones de sinapsis): imposible e innecesario en el
navegador. El plan es un **preprocesamiento offline en Python**:

```python
# scripts/preprocess_drosophila.py (Fase 2) — esbozo
# Pipeline: neuprint-python → filtrado de circuitos → JSON compacto
from neuprint import Client

c = Client('neuprint.janelia.org', dataset='hemibrain:v1.2.1')

# 1) Subredes funcionales clave:
#    · Escape visual: LC4 + LPLC2 (detección de sombras en expansión)
#    · Control de vuelo: DNs descendentes (DNg, DNp) + motores torácicos
#    · Gusto/olfato: ORNs → AL → MB calices (versión resumida)
#
# 2) Reducción topológica: agrupar neuronas por tipo (downsample
#    18k → ~2-5k unidades funcionales con pesos agregados).
#
# 3) Exportar al mismo formato compacto que C. elegans:
#    { meta, neurons[{n,c,t}], chem{s,t,w}, gap{p,w} }
#    Objetivo: 10-30 MB JSON (~3-6 MB gzip) cargado con fetch + progreso.
```

**Presupuesto de descarga**: 10-30 MB tras la reducción (glop de
sinapsis → agregación por tipo). El archivo vivo en
`public/data/drosophila_connectome.json` con carga perezosa (solo al
habilitar "modo mosca biológica") y barra de progreso.

## 4. Mapeo sensorial/motor previsto (mosca)

| Mundo (12 canales) | Circuito de *Drosophila* |
|---|---|
| Comida (visión/olfato) | ORNs del antenarlo → glomérulos AL ( versión reducida ) |
| **Veneno/sombra en expansión** | **LC4 + LPLC2 → gigante descendente (GDN)**: el reflejo real de escape |
| Luz (día/noche) | fotorreceptores → LPLC2 lateral |
| Térmico | neuronas de la aristista (frío/calor) |
| Motores | DNs descendentes → velocidad de vuelo y giro del Canvas |
| Reproducir | circuitos peptidérgicos ováricos (simplificado) |

## 5. Checklist de implementación

- [ ] `scripts/preprocess_drosophila.py` con `neuprint-python`
      (requiere credenciales de neuPrint; ejecutar offline).
- [ ] `src/lib/sim/connectome/drosophila.ts` — `DrosophilaBrain
      implements IBrainAdapter` (reutiliza el núcleo LIF).
- [ ] Carga perezosa del JSON grande (fetch + caché + progreso) — a
      diferencia de *C. elegans* (55 KB embebido), la mosca NO va en el
      bundle inicial.
- [ ] `FACTORIES.fly` → `DrosophilaBrain` (toggle por bandera de
      función para conservar el modo ANN como control experimental).
- [ ] Vista de inspector adaptada (los sectores serán: sensoriales /
      proyección / motor-descendente) y ajuste del zod del Museo
      (`kind: 'drosophila'`).
- [ ] Validación de rendimiento: objetivo < 4 ms/tick con 60 moscas.

## 6. Referencias

- Phelps, J. S. et al. (2021). *A connectome of the adult Drosophila
  central brain*. BioRxiv (MaleCNS).
- Dorkenwald, S. et al. (FlyWire). *Binary and analog variation of
  synapses across cortical layers*. / FlyWire Codex docs.
- von Reyn, C. R. et al. — circuito LC4/LPLC2 de escape visual.
- MaleCNS R package (`natverse`) y `neuprint-python` (Janelia/HHMI).
