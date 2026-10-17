# Fase 2 — Drosophila real + Laboratorio de Experimentos + Retos

> Estado: **EN CONSTRUCCIÓN** (v1.3.0). Este documento es el método riguroso que
> sigue la implementación; cada sección se marca ✅ al completarse y los
> resultados de las verificaciones se archivan en `docs/worklog.md` y
> `docs/PRUEBAS-FASE-2.md`. Nada de lo aquí descrito se considera "hecho" sin
> su prueba asociada.

---

## 0. Resumen ejecutivo

La Fase 2 convierte NeuroEvo en una plataforma experimental de dos organismos
con cerebros 100 % reales, añadiendo tres cosas:

1. **Cerebro de Drosophila real** (Task 14): las moscas dejan la ANN de
   control y pasan a usar el conectoma del cerebro de la **larva de
   *Drosophila melanogaster*** (Winding et al. 2023, *Science*) — el único
   conectoma de insecto completo publicado y descargable sin credenciales.
2. **Laboratorio de neurobiología** (Tasks 15/16): estímulos controlados
   (tap mecánico, sombra que se acerca, flash de luz, gota de comida, calor,
   chorro de aire), **knockouts por clase neuronal** y **trazas de actividad
   en vivo** — para replicar los experimentos clásicos de **habituación al
   tap** (Rankin et al. 1990) y de **escape** en ambos organismos.
3. **Modo Retos/Arena** (Tasks 15/16): editor de laberintos con paredes,
   veneno, comida y meta; suelta gusanos o moscas y mide tiempo hasta el
   objetivo o la muerte, con récords persistentes.

Además: **exportación/importación de cerebros** (JSON portable entre sesiones
y entre usuarios) y documentación exhausta pensada para **reutilizar esta
tecnología en otros proyectos**.

## 1. ¿Por qué la larva y no la mosca adulta? (decisión de datos)

| Candidato | Neuronas | Acceso | Decisión |
|---|---|---|---|
| Cerebro adulto FlyWire/CODCAA | ~138.000 | Vía web app, datasets de GB | ✗ imposible en navegador |
| Hemibrain (FlyEM) | ~25.000 | neuPrint requiere credenciales | ✗ |
| MaleCNS v1.0 | ~24.000 | Paquete R `malecns`, GBs | ✗ |
| **Larva — Winding et al. 2023** | **2.956 / 116.922 aristas / 352.611 sinapsis** | Netzschleuder + S1 público, sin login | ✓ **ELEGIDO** |

**Cita**: Winding M, Pedigo BD, Barnes CL, et al. (2023). *The connectome of
an insect brain.* **Science 379(6636):eadd9330**. DOI 10.1126/science.add9330.
Datos: mirror `networks.skewed.de/net/fly_larva` (validado: el total de
sinapsis 352.611 coincide exactamente con la matriz densa del suplemento S1).

El "Moscón" del ecosistema es una mosca adulta (vuela, ve fruta de lejos);
usamos el conectoma **larvario** porque es el único completo disponible. Es la
misma decisión honesta que ya tomamos con C. elegans: **estructura real,
comportamiento del adulto virtual**. Todo queda documentado en
`docs/CONECTOMA-DROSOPHILA.md`.

## 2. Pipeline de datos (Task 14-b) ✅ diseño

```
/tmp/drosophila-data/            (crudo descargado, verificado)
  larva_neurons.csv              2.956 filas: skid, hemisferio, homólogo,
                                 cell_type, annotations (modalidad sensorial),
                                 level_7_cluster, I/O axonal/dendrítico
  larva_edges_etype.csv          116.922 aristas: source, target,
                                 synapse_count, etype (ad/aa/dd/da)
        │
        ▼  scripts/build_drosophila.py  (reproducible, en el repo)
        │   1. Umbral sináptico: aristas con ≥3 contactos (71,7 % de las
        │      sinapsis; las de 1–2 contactos son mayoritariamente ruido EM)
        │   2. Neurotransmisor por TIPO celular (el dataset no lo trae):
        │      sensory/PN/KC/LHN/CN → ACh (excitador), LN/MB-FBN → GABA
        │      (inhibidor), MBIN → monoaminas (DA/OA/5HT, modulador),
        │      MBON → ACh|GABA|Glu, DNs → Glu (inhibidor en el VNC, el papel
        │      real de la glutamatergia motora de insecto). Referencia:
        │      gt_data.csv (forkelab) + Eckstein 2024 como literatura.
        │   3. etype: ad/dd = transmisión postsináptica normal; aa/da =
        │      modulación pre-sináptica (peso ×0.5) — aproximación declarada.
        │   4. Peso = log2(1+synapse_count) con signo por transmisor
        │      (misma familia de escala que C. elegans).
        ▼
src/lib/sim/data/drosophila_connectome.json   (~1–1,5 MB, embebido)
  { meta:{...}, neurons:[{n,c,t,hem,ann}], chem:{s,t,w,et} }
```

**Contrato con el motor**: mismo formato que el gusano (adaptador LIF
compartido, CSR, genoma de neuromodulación). El grafo es compartido por
todas las moscas (es biología); cada individuo solo guarda su estado de
membrana.

### Presupuesto de rendimiento (a validar empíricamente)
- Gusano: 300 neuronas/4.731 sinapsis × ~60 gusanos = 1,3 ms/tick (medido).
- Mosca: ~2.900 neuronas/~38.000 aristas × ~40 moscas ≈ 6–8× el coste.
- **Objetivo: < 8 ms/tick con 50 moscas.** Si se supera → *tick-stepping*
  (cada cerebro de mosca avanza cada 2 ticks, documentado) o recorte de
  aristas. La decisión empírica queda registrada en PRUEBAS-FASE-2.md.

## 3. Mapeo sensorial de Drosophila (17 canales, Task 14-b)

Cada canal excita las **neuronas anotadas con esa modalidad exacta** en el
dataset (campo `annotations`), NO neuronas inventadas:

| # | Canal mundo | Anotación real del dataset | Papor biológico |
|---|---|---|---|
| 0 | Tónico (CPG) | — (drive a DNs de locomoción) | oscilador endógeno |
| 1 | Hambre | gut | Crop/estiramiento intestinal, estado energético |
| 2 | Termo-frío | thermo-cold | termosensor frío |
| 3 | Termo-calor | thermo-warm | termosensor calor |
| 4 | Luz (global) | visual | 12 fotorreceptores → fotofobia larvaria (Kane 2013) |
| 5–6 | Olfato X/Y | olfactory | ORNs → gradiente direccional (klinotaxis real) |
| 7 | Gusto externo | gustatory-external | GRNs externos (comida cercana) |
| 8 | Gusto faríngeo | gustatory-pharyngeal | GRNs faríngeos (al comer) |
| 9 | Nocicepción | noci | md-IV → circuito real de escape/roll (Ohyama 2015) |
| 10 | Multitud | mechano-Ch | mecanosensores de quorda |
| 11 | Tacto | mechano-Ch (contacto) | contacto físico/paredes |
| 12 | Propiocepción de vuelo | proprio | chordotonales; en el adulto virtual: fase alar |
| 13 | Aire/respiración | respiratory | higrorreceptores/anoxia (humedad del medio) |
| 14 | Δ Gradiente | olfactory (derivada) | klinotaxis: cambio de concentración |
| 15 | Feromona de agregación | multitud de congéneres | larvas gregarias (aprox. declarada) |
| 16 | Saciedad (víscera) | gut | receptores de estiramiento |

### Mapeo motor (salidas del Canvas)

| Salida | Pool del conectoma | Base real |
|---|---|---|
| Girar | **asimetría L/R de DNs** (hemisphere del dataset) | la larva gira contrayendo un lado |
| Avanzar | tasa de **DN-VNC** (346 DNs → VNC) | neuronas descendentes de locomoción |
| Reproducir | tasa de **DN-SEZ** | SEZ = control visceral/oviposición |

### Genoma (24 genes, GA)
[0..16] ganancia por canal (17) · [17..20] escalas ACh/GABA/Glu/monoaminas ·
[21] τ de fuga · [22] umbral · [23] periodo refractario… + drive tónico.
Mismas reglas que el gusano: la evolución toca la **neuromodulación**, nunca
la estructura del conectoma.

### Reproducción de moscas con conectoma
Cuando el pool DN-SEZ dispara (salida "Reproducir") y hay energía, la mosca
**pone un huevo** (objeto del mundo, como el gusano) con el cerebro
clonado+mutado. Fin de `spawnChild` para moscas con conectoma (las ANN
sembradas del Museo conservan el brote directo como grupo de control).
`WormEgg` se generaliza a `Egg {species, brain, embryoT}` con Q10 de
mosca (óptimo ~25 °C, embrión ~18 s sim ≈ 24 h reales a escala 1 s ≈ 1 h).

## 4. Plasticidad real: habituación sináptica (Task 15)

Para replicar **Rankin, Broster & Wicks (1990)**: la respuesta al *tap*
decrece con la repetición y se recupera espontáneamente — sin tocar el
código del experimento, solo la sinaptica.

- Modelo: **depresión homosináptica por uso** en las aristas que SALEN de
  los mecanosensores del estímulo (gusano: ALM/AVM/PLM → circuito del
  *tap-withdrawal*; mosca: mechano-Ch → DNs).
- Implementación: por individuo, `Float32Array` de escalas para ese subconjunto
  de aristas (~150–300 valores, posiciones precomputadas del grafo compartido).
  Cada pico fuerte del sensor deprime sus aristas ×0.88; recuperación
  exponencial lenta (τ ≈ 60 s sim ≈ minutos reales, como el animal).
- Las escalas se aplican multiplicando el peso en `forward()`.
- La curva de respuesta (amplitud del giro por tap nº) se dibuja en el
  Laboratorio → curva de habituación clásica, con recuperación espontánea
  y dishabituation (un estímulo fuerte distinto "resetea").

## 5. Laboratorio de experimentos (Tasks 15–16-b)

**Estímulos** (botones + protocolos automáticos):
| Estímulo | Efecto en el mundo | Circuito activado |
|---|---|---|
| Tap mecánico | golpe al plato: corriente a mecanosensores con atenuación por distancia | ALM/AVM/PLM→AVA/PVC (gusano); mechano-Ch→DNs (mosca) |
| Sombra que crece (looming) | disco oscuro expandiéndose sobre el objetivo | visual→escape (gusano: LITE-1/ASH; mosca: PRs→DNs) |
| Flash de luz | pico del canal de luz | fotorreceptores |
| Gota de comida | spawnFood puntual | olfato/gusto |
| Pulso de calor | +8 °C durante 3 s | termosensores |
| Chorro de aire | empuje + corriente mecano | mecano/noci |

**Knockouts**: lista de clases neuronales por especie con interruptor
(p. ej. gusano: ASH, ASE, AFD, AVA/AVD (reversa), PVC (avance), HSN+VC
(puesta), PLM, ALM/AVM; mosca: ORNs, PRs/visual, noci, mechano, DNs-SEZ).
Implementación: `setSilenced(ids: Set<number> | null)` en `IBrainAdapter`;
las neuronas silenciadas tienen V≡0. Es la ablación láser virtual de
Chalfie et al. 1985.

**Trazas**: ring-buffer por tick de la tasa de picos por pool/clase del
cerebro seleccionado (~600 puntos), dibujado con recharts.

**Protocolo guiado de habituación**: 20 taps a intervalos de 10 s, gráfica
amplitud-vs-ensayo en vivo, con línea de decaimiento exponencial ajustada.
Exportable como JSON.

## 6. Modo Retos/Arena (Tasks 15–16-a)

- **Editor**: herramientas Pared (click-drag, segmentos), Meta (bandera),
  Veneno (pociones), Comida, Soltar gusano/mosca (elige arquitectura:
  conectoma o ANN-control), Borrar. La arena usa el mismo motor World.
- **Colisión con paredes**: círculo-segmento con rebote; activa el canal de
  tacto (nariz) — reutiliza los circuitos reales de choque frontal.
- **Medición**: cronómetro por participante; victoria al tocar la meta;
  muerte por veneno/inanición. Tabla de resultados + récord de la arena
  (localStorage, compatible con el build estático).
- **Huevos y evolución**: en la arena NO hay reproducción (protocolo limpio);
  la comida no reaparece salvo la colocada.

## 7. Export/Import de cerebros (Task 16-c)

```jsonc
{
  "format": "neuroevo-brain", "version": 1,
  "kind": "elegans" | "drosophila" | "ann",
  "species": "fly" | "worm",
  "generation": 12, "fitness": 38.4,
  "genome": [/* 25 genes | 131 pesos */],
  "traits": { "maxSpeed": 62, "vision": 150 },
  "meta": { "source": "inspector|museum|lab", "exportedAt": "..." }
}
```
- Exportar: botón en el Inspector (criatura seleccionada) y en el Museo
  (cada registro). Descarga como `.neuroevo.json`.
- Importar: en Museo/Laboratorio/Arena; valida formato y longitud del
  genoma contra la arquitectura; siembra 8 individuos (como hoy hace el
  Museo). Zod en la API para registros importados al museo.

## 8. Plan de pruebas (Task 17) — "se riguroso"

**Banco headless** (scripts `bun` fuera del repo, resultados archivados en
`docs/PRUEBAS-FASE-2.md`):

1. **Integridad del dato**: nº neuronas/aristas del JSON == fuente; sinapsis
   conservadas == esperadas; sin aristas fantasma.
2. **Dinámica LIF Drosophila**: con estímulo olfativo sostenido, los ORNs
   disparan y la actividad alcanza los DNs (path tracing); tasa de picos
   global en rango fisiológico (sin epilepsia); knockout de ORNs = cero
   propagación.
3. **Escape looming**: flash visual → picos en PRs y DNs > 3σ del baseline;
   con visual knockouteado → sin respuesta.
4. **Tap-habituation (gusano)**: 30 taps → amplitud de reversa decae
   monótonamente (H0: pendiente < 0, p < 0.05); recuperación espontánea >50 %
   tras 5 min sim; knockout PLM+ALM/AVM → respuesta inicial ≈ 0.
5. **Arena**: criatura contra pared rebota y no la atraviesa (10.000 ticks
   sin fuga); meta detectada en < 1 tick de error; veneno mata.
6. **Export/import roundtrip**: genome bit-idéntico tras export→import→export.
7. **Rendimiento**: 15 min de ecosistema con moscas-drosophila: población
   estable, ms/tick objetivo, sin GC pauses visibles.
8. **Ecosistema**: 15 min balanceado → moscas y gusanos coexisten o el
   documento explica la dinámica observada (extinción con causa).

**E2E con navegador** (agent-browser + VLM, como en v1.1/v1.2): los tres
modos, un experimento de habituación completo en vivo, export/import por la
UI, móvil 375×812 sin overflow, 0 errores de consola.

## 9. Cronograma de tareas (worklog)

| ID | Tarea | Agente |
|---|---|---|
| 13 | Este plan + arquitectura | main |
| 14-a | Descarga y validación de datos Winding 2023 | subagente ✅ |
| 14-b | JSON + DrosophilaBrain + 17 canales + calibración headless | main |
| 15 | Motor: paredes/arena, estímulos, knockouts, habituación, huevos mosca, trazas, shells de UI | main |
| 16-a | UI Retos/Arena (editor + cronómetro + récords) | subagente full-stack |
| 16-b | UI Laboratorio (estímulos, knockouts, trazas, protocolo habituación) | subagente full-stack |
| 16-c | UI Export/Import (inspector + museo + importación) | subagente full-stack |
| 17 | Banco de pruebas riguroso + E2E navegador | main |
| 18 | Documentación + CHANGELOG 1.3.0 + push + tag | main |

Push incremental a `main` tras cada tarea (token de uso único del usuario).

## 10. Referencias clave

- Winding et al. 2023, *Science* 379:eadd9330 — conectoma del cerebro larvario.
- Pedigo et al. 2023, *eLife* 12:e83739 — análisis del mismo conectoma.
- Rankin C.H., Broster S., Wicks S. 1990 — habituación al tap en C. elegans.
- Wicks R.J., Rankin C.H. 1997 — genética del circuito tap-withdrawal
  (ALM/AVM/PLM → AVA/AVD/AVE/PVC → VA/DA/VB/DB).
- Ohyama T. et al. 2015 — circuito de escape nociceptivo de la larva
  (md-IV → Basin/GF → DNs, roll).
- Kane E.A. et al. 2013, *eLife* — fototaxis negativa de la larva (12 PRs).
- von Reyn C.R. et al. 2017 — escape visual del adulto (LC4/LPLC2→GF),
  análogo adulto documentado.
- White J.G. et al. 1986 / Cook S.J. et al. 2019 — conectoma de C. elegans.
- OpenWorm — dataset del hermafrodita usado en la Fase 1.
