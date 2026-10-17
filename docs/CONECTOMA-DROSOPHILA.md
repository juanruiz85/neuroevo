# El conectoma de *Drosophila melanogaster* en NeuroEvo

> **Estado: COMPLETADO (Fase 2, v1.3.0).** Las moscas del ecosistema piensan
> con el conectoma real del cerebro de la **larva** de Drosophila
> (Winding et al. 2023, *Science*). Este documento es la referencia técnica
> y científica: fuente de datos, pipeline, mapeos sensorial y motor,
> genoma, calibración y simplificaciones declaradas.

---

## 1. La fuente de datos

**Winding M, Pedigo BD, Barnes CL, et al. (2023). "The connectome of an
insect brain." Science 379(6636):eadd9330.** DOI: 10.1126/science.add9330.

| Métrica | Valor |
|---|---|
| Neuronas del cerebro larvario | **2.956** |
| Aristas dirigidas crudas | 116.922 |
| Sinapsis totales | **352.611** |
| Sensores de primer orden (con modalidad anotada) | **462** |
| Neuronas descendentes de salida (DN-VNC + DN-SEZ) | **346** |
| Uniones en gap | 0 (la fuente no las reporta) |

Descargas sin credenciales (verificadas):
- Nodos y aristas: `https://networks.skewed.de/net/fly_larva` (mirror oficial).
- Matriz densa S1 (validación cruzada): suplemento del paper.
- Copia de trabajo en `data/source/larva_winding2023/` (2 CSV construidos
  con hemisferio, tipo celular, modalidad y etype por arista).

**¿Por qué la larva y no el adulto?** El cerebro adulto (FlyWire, ~138.000
neuronas; hemibrain ~25.000) requiere credenciales o descargas de GB e
inviables en navegador. La larva es el único conectoma de insecto completo
publicado y libremente descargable: estructura real, 100 % reproducible
(`scripts/build_drosophila.py`).

## 2. Pipeline (100 % reproducible)

```
data/source/larva_winding2023/*.csv
        │  scripts/build_drosophila.py
        │   1. Umbral ≥3 contactos (73,0 % de las sinapsis; 1-2 contactos
        │      son mayoritariamente ruido EM) — EXCEPTO toda arista que
        │      SALE de un sensor de primer orden (siempre se conserva:
        │      los termosensores, p. ej., son 10 neuronas con sinapsis
        │      débiles y quedarían desconectadas).
        │   2. Neurotransmisor derivado por TIPO CELULAR (el dataset no lo
        │      incluye): sensory/PN/LHN/KC/CN/MB-FFN/ascending/pre-DN → ACh
        │      (excitador) · LN/MB-FBN → GABA · MBIN → DA (modulador ×0,6)
        │      · MBON → ACh · DN-VNC/DN-SEZ → Glu (la vía motora real de
        │      insecto es glutamatérgica).
        │   3. etype: ad/dd = transmisión normal; aa/da = modulación
        │      pre-sináptica (×0,5 en el LIF).
        │   4. Autoreferencias eliminadas (566).
        ▼
src/lib/sim/data/drosophila_connectome.json (684 KB, embebido)
  { meta, neurons:[{n,c,t,h,a}], chem:{s,t,w,et} }
```

Resultado: **2.956 neuronas · 41.977 aristas · 257.414 sinapsis ·
96,6 % del cerebro alcanzable desde los sensores · 337/346 DNs conectados ·
8 aisladas**.

Nombres legibles generales por tipo+hemisferio+ordinal (`ORN-L01`,
`GRN-R07`, `DNV-M12`…); el mapeo skid→nombre es reproducible desde el script.

## 3. Mapeo sensorial (18 canales → grupos anotados REALES)

Cada canal excita el **grupo neuronal anotado con esa modalidad exacta** en
el dataset (campo `annotations`); ningún sensor inventado:

| Canal | Grupo real | N |
|---|---|---|
| Hambre (víscera) | GUT (estiramiento intestinal) | 85 |
| Termo − | THc | 6 |
| Termo + | THw | 4 |
| Luz / sombra | PR (fotorreceptores; fotofobia larvaria) | 29 |
| Aire/humedad | RSP | 26 |
| Olfato X | ORN con contraste L/R | 42 |
| Olfato Y | ORN por ordinales (simplificación declarada) | 42 |
| Gusto externo | GRN externos | 132 |
| Nocicepción X/Y/int | NOC (vía md-IV del escape real) | 6 |
| Multitud / tacto / choque | MEC (chordotonales) | 14 |
| Propiocepción de vuelo | PRO | 8 |
| Δ Gradiente (klinotaxis) | ORNs (adaptación al cambio) | 42 |
| Faríngeo (al ingerir) | GNP | 110 |
| Feromona | **Sin mapeo** (el dataset no anota receptor feromonal: canal leído pero no inyectado, documentado) | — |

**Adaptación sensorial real** (Fase 2): luz, humedad y termo responden al
CAMBIO (τ 3-4 s), no al nivel — igual que los receptores reales. La ANN de
control conserva los niveles crudos.

## 4. Mapeo motor (pools reales → 3 salidas)

| Salida | Pool | Base real |
|---|---|---|
| Avanzar | tasa de disparo de **DN-VNC** (182) | descendentes de locomoción |
| Girar | **asimetría L/R** de todas las DNs (hemisphere del dataset) + **sesgo lateral innato** (klinotaxis, gen 26) durante las re-orientaciones | la larva gira contrayendo un lado |
| Reproducir | tasa de **DN-SEZ** (164), modulado por la ráfaga faríngea al comer (la oviposición real depende del estado nutricional — paralelo exacto de la modulación de HSN por saciedad del gusano) | descendentes viscerales/oviposición |

## 5. Genoma (27 genes — el GA evoluciona la neuromodulación, jamás la estructura)

```
[0..17]  ganancia sensorial por canal (18)
[18..21] escalas de transmisión: ACh / Glu / GABA / monoaminas
[22]     τ de fuga         [23] umbral de disparo
[24]     periodo refractario  [25] impulso tónico (CPG de vuelo)
[26]     sesgo lateral de giro (klinotaxis; asimetría individual, como la de AWC)
```

## 6. Rendimiento

- **Tick-stepping 1:2** calibrado: cada cerebro alterna integración sensoria
  barata (typed arrays) y disparo completo (fuga leak² equivalente,
  umbral, entrega sináptica con escala de habituación, pools). Resolución
  efectiva 15 Hz — suficiente para conductas de segundos (declarado).
- Grafo CSR **compartido** por todas las moscas (es biología); por individuo
  solo V/spike/refr/habituación (~20 KB).
- Medido con ecosistema completo: **2,4-2,6 ms/tick** (p95 3,5; presupuesto
  rAF de 33 ms a 30 ticks/s). Equivalente C. elegans: 1,3 ms.

## 7. Plasticidad: habituación (Rankin 1990, también en la mosca)

Las aristas que salen de los mecano (tap) y de los fotorreceptores (sombra
repetida) se deprimen por uso (**por sinapsis y por individuo**: el grafo es
compartido, las escalas no) con recuperación τ≈60 s. La habituación
comportamental la domina la **adaptación de tasa** (fatiga de disparo) del
comando — ver `docs/PRUEBAS-FASE-2.md` §4.

## 8. Línea de laboratorio

`drosophilaLabGenome()`: mosca **posada** (CPG de vuelo bajo el umbral) y
sensible (ACh alta, umbral bajo) — el animal del experimento de escape: el
fondo neural calla y el looming produce el acelerón nítido (banco §3).

## 9. Simplificaciones declaradas (honestidad científica)

1. **Estructura larvaria, adulto virtual**: el "Moscón" vuela y ve fruta
   como adulto; su cableado es el del cerebro larvario completo (el único
   disponible).
2. **Neurotransmisores derivados por tipo celular** (la fuente no los trae);
   firmas apoyadas en la literatura (gt_data/forkelab como referencia).
3. **Olfato Y por ordinales**: la larva resuelve el segundo eje direccional
   con klinotaxis temporal (canal Δ Gradiente), no con dos familias
   anatómicas.
4. **Feromona sin receptor anotado** → canal no inyectado en la mosca.
5. **Sin gap junctions** (la fuente no los reporta en este dataset).
6. **Umbral ≥3 contactos** con la excepción de las salidas sensoriales
   (§2); 8 neuronas quedan aisladas (0,27 %).
7. La puesta de huevos no simula esperma limitado ni útero (sí el gusano):
   cooldown energético + circuito DN-SEZ.
8. **Glu inhibitorio** en las DNs (papel real en el VNC de insecto); en
   C. elegans el Glu del reflejo del tap se modela excitador (como la
   vía mecanosensorial del nemátodo) — dos convenciones documentadas por
   especie, según la literatura de cada una.

## 10. Referencias

- Winding et al. 2023, Science 379:eadd9330 (conectoma larvario).
- Pedigo et al. 2023, eLife 12:e83739 (análisis del mismo conectoma).
- Ohyama et al. 2015 (circuito de escape nociceptivo larvario: md-IV → DNs).
- Kane et al. 2013, eLife (fotofobia larvaria: 12 PRs).
- Luo et al. 2010 (navegación por klinotaxis/biased random walk en la larva).
- von Reyn et al. 2017 (escape visual del adulto: LC4/LPLC2→GF, análogo).
- Appler 2015 / Eckstein et al. 2024 (neurotransmisores de Drosophila).
