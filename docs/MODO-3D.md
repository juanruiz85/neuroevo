# Modo 3D — Cuerpo y cerebro en vivo

> **Versión 1.4.0.** Pestaña «3D» del selector de modos (tras «Laboratorio»).
> Un terrario 3D donde sueltas un gusano o una mosca, ves su **cuerpo
> anatómico real** y su **cerebro disparando en vivo**, le colocas comida
> (buena y amarga), siluetas de depredador y estímulos, y observas cómo
> **aprende**.

---

## 1. Qué se ve

| Elemento | Gusano (*C. elegans*) | Mosca (*D. melanogaster*) |
|---|---|---|
| **Cuerpo** | Cadena de cápsulas siguiendo los 8 segmentos reales del motor (ondulación en vivo), semitransparente | Mosca voxelar estilo Minecraft: tórax 6×6×6, cabeza con ojos rojos, abdomen bandeado, 2 alas de membrana, 2 halterios, 6 patas — proporciones y paleta de `FlyModel.java` |
| **Neuronas dentro** | Las **302 neuronas en sus posiciones somáticas reales** (µm), coloreadas por su voltaje LIF del tick actual | — (el cerebro de la mosca está en la cabeza; se magnifica arriba) |
| **Holograma** | El sistema nervioso completo en disposición anatómica real: 300 somas + **4.731 sinapsis** dibujadas; las aristas presinápticas activas destellan; 8 neuronas célebres etiquetadas (AVA, ASE, AFD, ASH, ALM, HSN, AVB, DVA) en abanico con líneas guía | La **nube voxelar del CNS adulto masculino** (141.781 somas reales → 15.001 celdas deduplicadas por rejilla, el mismo método del build de bloques de Minecraft) coloreada por región; sobre ella, la actividad de los **29 grupos larvarios** que simula el motor, proyectada en sus familias adultas homólogas |
| **Comida** | Cubos voxel: fruta roja, azúcar blanca, detrito gris, **cebo amargo verde-oliva** | ídem (fruta/azúcar para ella) |
| **Silueta** | Ave voxel oscura que se cierne y **crece** (looming 1,2 s) con su sombra proyectada sobre el agar | ídem → dispara el circuito visual→fibra gigante→salto de escape |
| **Otros** | Anillo ámbar de selección bajo el sujeto, haz de luz al holograma, ondas expansivas de golpe/chorro, huevos | ídem |

**Controles**: arrastrar = orbitar la cámara · rueda = zoom · clic en el
plato = colocar lo que esté activo en el panel (azúcar, fruta, cebo amargo,
silueta, golpe, chorro de aire).

---

## 2. Fuentes de datos anatómicos (todas reales)

### 2.1 C. elegans — 302 somas

| Campo | Valor |
|---|---|
| Geometría | **WormBase Virtual Worm** (C. Grove & P. Sternberg, Caltech) — dominio público |
| Vía | OpenWorm **c302** (`examples/c302_C_Full.net.nml`), MIT |
| Paper | Gleeson et al. 2018, *Phil. Trans. R. Soc. B* 373, doi:10.1098/rstb.2017.0379 |
| Ejes | +x izquierda · −y cabeza · +y cola · +z dorsal (µm) |
| Cobertura | **302/302** neuronas (300 del conectoma del motor + CANL/CANR) |
| Normalización | `DA1→DA01` (nuestro conectoma usa dos dígitos) |
| Crédito UI | *«Somas: WormBase Virtual Worm (dominio público), vía OpenWorm c302 (MIT)»* |

### 2.2 Drosophila — nube del CNS adulto + cuerpo voxelar

| Campo | Valor |
|---|---|
| Dataset | neuPrint **`male-cns:v1.0`** — CNS adulto masculino completo (Berg et al., *Cell* 189(18), 2026, doi:10.1016/j.cell.2026.08.015) |
| Contenido | 176.422 neuronas / 6,29 M conexiones / **141.781 somas con posición** (8 nm/voxel) |
| Vía | binario FLYB (`malecns-v1.0.flyb.gz`) de **github.com/blendi-remade/fly-brain-minecraft** (código MIT, datos **CC BY 4.0**) |
| Cuerpo | proporciones y paleta de `FlyModel.java` / `gen_fly_texture.py` del mismo proyecto (MIT) |
| Ejes (verificados sobre la nube) | x = izquierda-derecha (lóbulos ópticos a ambos extremos) · z = eje cerebro→cordón · y = dorso-ventral |
| Crédito UI | *«Datos CC BY 4.0 · github.com/blendi-remade/fly-brain-minecraft»* |

### 2.3 Actividad en vivo

El motor simula los **conectomas reales** de siempre: *C. elegans*
(OpenWorm, 300 neuronas / 4.731 sinapsis, LIF) y el **cerebro larvario**
de Drosophila (Winding et al. 2023, 2.956 neuronas / 41.977 aristas).
El holograma pinta esa actividad (voltaje/pico de cada tick, ~30 Hz).

### 2.4 Reproducibilidad

```
python3 scripts/build_3d_data.py \
  --nml  /home/z/3d-data/c302_C_Full.net.nml \        # OpenWorm c302
  --flyb /home/z/3d-data/malecns-v1.0.flyb.gz \       # fly-brain-minecraft
  --out-dir src/lib/sim/data
# → c_elegans_3d.json (302 somas) + fly_cns_3d.json (15.001 celdas b64 + 29 anclajes)
```

`fly_cns_3d.json` sha256:`b0cf13a5bd6b…`.

---

## 3. Anclajes larvario→adulto (mosca)

La anatomía es del **adulto** y la actividad del **larvario** — la
simplificación se declara así: cada uno de los 29 grupos del conectoma
larvario se proyecta sobre el **centroide real de sus neuronas adultas
homólogas** (posición + radio en la nube), tal y como están en male-cns.

| Grupo larvario | Anclaje adulto | Nota |
|---|---|---|
| ORN | clase `olfactory` (2.635, periféricas) → **lóbulo antenal** (ALPN) | los ORN adultos viven en la antena: se anclan a su entrada real |
| GRN | clase `gustatory` → **zona subesofágica** (SEZPN) | ídem: labello/tarsos |
| GNP | `gustatory` + subclase *pharyngeal sensillum* → SEZ | sensilos faríngeos |
| MEC, M23 | `mechanosensory` / `mechanosensory_tactile` → SEZ | órgano de Johnston, cerdas |
| PRO | `mechanosensory_proprioceptive` (halteros) | las pocas con soma en el CNS |
| THc, THw, RSP | `thermosensory` / `hygrosensory` → lóbulo antenal | arista |
| NOC | `chemosensory` → SEZ | sin homólogo adulto etiquetado (las mdIV son larvarias) |
| PR | tabla retina del binario: **L1/L2/L3 de la lámina** (con soma) | fotorreceptores reales |
| GUT | superclase `ENS` → SEZ | entérico |
| ASC | superclase `ascending_neuron` (1.846 con soma) | reales |
| DNV/DNS/pDNV/pDNS | `descending_neuron` en 4 sub-nubes por cuartiles del eje rostro-caudal | 1.314 somas reales |
| PN, mPN | clase `ALPN` (680 con soma) | reales |
| LN | clase `ALIN` | reales |
| LHN | tipos `LH*` (2.027) | reales |
| KC | `Kenyon_Cell` (4.050) | cuerpo fungiforme |
| MBON | `MBON` (96) | salidas del MB |
| MBIN | `DAN` (340: PAM/PPL1) | dopamina de recompensa/castigo |
| MBF, MBFF | anclaje MBON | feedback del MB |
| CN | `CX` (2.944) | cuerpo central |
| RGN | `cb_endocrine` (68) | glándula del anillo |
| UNK | `cb_intrinsic` (difusa, atenuada) | sin anotación |

Los **periféricos** (ORN/GRN/MEC/…) no tienen soma dentro del CNS: el
anclaje cae en su **neuropilio de entrada** documentado y el JSON lo marca
`fallback: true`.

---

## 4. Aprendizaje alimentario por valor

El experimento del usuario: *«ponerle comida que le gusta y otra que no, y
que vaya aprendiendo cuál es buena y cuál mala»*.

### 4.1 El cebo amargo

Nuevo `FoodKind 'bitter'` (quinina/denatonio): **huele a comida** (los cebos
reales llevan azúcar: atraen a los ingenuos por los canales olfativos
`FOOD_X/Y/NEAR`) pero al probarlo castiga (−6 energía, NO letal — a
diferencia del veneno) y no se consume (queda para repetir el ensayo).
Refractario de degustación 1,2 s.

### 4.2 La memoria por valor

| Evento | Efecto | Circuito real de referencia |
|---|---|---|
| Comer comida buena | `learnGood +0,25` (refuerzo) | NSM/serotonina (gusano) · octopamina (mosca) |
| Probar el cebo amargo | `learnBad +0,5` + daño `−6·(1−0,85·learnBad)` + salto de rechazo | RIM/tiramina (gusano) · dopamina PPL1→MBON (mosca) |

La aversión aprendida **reescribe la valencia del olor** (aprendizaje por
valor): los canales `FOOD_*` hacia el cebo se apagan (×(1−0,9·learnBad)) y
el mismo cebo pasa a excitar la vía **nociceptiva** (`POISON_*`, ×0,85·learnBad)
— «lo aprendido huele a peligro». La klinotaxis (`FOOD_DELTA`) también se
compuerta. Extinción lenta (learnBad −1/900 s, learnGood −1/600 s), como la
recuperación espontánea de la habituación real (Rankin et al. 1990).

El **daño decrece con la aversión** (el animal que aprendió retira la
probóscide y deja de ingerir: retracción de probóscide real de las GRN
amargas) y la primera prueba da un **salto de rechazo** (16 px) que aparta
al animal del cebo — el cebo solo no puede matar (daño total acotado ~13 E).

### 4.3 Dónde verlo

Panel «Aprendizaje alimentario»: barras de preferencia (esmeralda) y
aversión (rosa), contadores de comilonas/pruebas, y la nota del circuito.
En el holograma: al probar el amargo, GRN/NOC se encienden; tras aprender,
los canales olfativos callan y los nociceptivos guían la huida.

---

## 5. Simplificaciones declaradas

1. **Anatomía adulta + actividad larvaria** (mosca): los 29 grupos se
   anclan a los centroides de sus familias adultas homólogas (§3). Es la
   única forma honesta de proyectar la dinámica real del conectoma que
   simulamos sobre la forma real del CNS publicado.
2. **Cuerpos magnificados**: el gusano se dibuja ~×2 y la mosca a escala
   del modelo de Minecraft para que sean visibles sobre el plato de 128×84.
3. **Cuerpo del gusano recto-ondulante**: los somas se proyectan sobre la
   curva de los segmentos reales (t = fracción A-P); la sección
   transversal se aproxima a la banda somática real (±80 µm → ±0,82·radio).
4. **Nube voxelar deduplicada**: 141.781 somas → 15.001 celdas de rejilla
   con mayoría de clase (el método del build de bloques de Minecraft);
   submuestreo estratificado por clase para conservar las minoritarias.
5. **La mosca no quimiotaxea el olor** (hallazgo, no atajo): el lóbulo
   antenal larvario no produce señal de giro fiable con nuestro umbral
   sináptico — igual que en el mod de Minecraft original («a reflex layer
   takes over while the brain is quiet»). Por eso el terrario es rico en
   comida (44 ítems) y la forrajera la localiza en sus vuelos de
   exploración; el gusano sí quimiotaxea (verificado: 120→59 px hacia un
   detrito único en 40 s).
6. **Silueta** = estímulo `shadow` existente (disco que crece 1,2 s sobre
   el epicentro, radios 30→200 px): la mosca lo resuelve por el circuito
   visual PR→fibra gigante (escape, §6); el gusano percibe el cambio de
   luz por los fotorreceptores (LITE-1/ASH).
7. **Genomas del terrario**: gusano = línea N2 de laboratorio; mosca =
   nueva línea **forrajera** (`drosophilaForagerGenome`, tónico 0,42:
   camina y explora; el looming sigue disparando el escape).

---

## 6. Banco de pruebas (28/28 ✓)

`/home/z/calib/banco-3d.ts` — 28 comprobaciones, todas sobre el motor real:

1. **Datos anatómicos (8)**: 300/300 somas con posición; tripletes µm
   válidos; nube = 15.001 celdas; decodificación b64 exacta; clases 0-8;
   29/29 anclajes; ≥8 fallbacks periféricos declarados; créditos/licencias.
2. **Aprendizaje (9)**: terrario con 44 ítems; ingenuo huele el cebo
   (FOOD_NEAR 0,95); 2 pruebas → learnBad 1,0; vía olfativa apagada
   (FOOD_X 0,09); vía nociceptiva encendida (POISON_NEAR 0,78); cebo
   persiste y no envenena; comida buena → learnGood; snapshot expone
   `learn`; extinción 1,0→0,88 en 240 s.
3. **Cebo no letal (4)**: la forrajera sobrevive ≥45 s con el cebo encima
   (antes del fix de la puesta fantasma: ~15 s); aprende con 1 bocado; el
   salto de rechazo la aparta 16,8 px; nunca `poisoned`.
4. **Escape por silueta (2)**: acelerón integrado +40 px/s (semilla fija,
   determinista); **knockout visual (PR) lo elimina** (+0) — el circuito
   real, no un atajo.
5. **Modo y APIs (5)**: plato limpio a 20 °C; `addFoodAt('bitter')`;
   sin reproducción en el terrario (protocolo limpio); el sujeto expone
   `connectomeView()` para el holograma.

**Regresión**: el banco de la Fase 2 sigue **33/33 ✓** (2,96 ms/tick,
p95 3,81 ms — mejor que antes del modo 3D).

### 6.1 Correcciones de método durante la calibración

- **Puesta fantasma** (bug preexistente detectado): la mosca pagaba los
  34 E del coste de puesta aunque `layEgg` abortara en modos sin
  reproducción (lab/arena/3D) → `layEgg` ahora devuelve `boolean` y el
  coste se cobra solo si el huevo existe.
- **Cebo letal por repetición**: el daño fijo (−6 × cada 1,2 s) mataba a
  un animal posado sobre el cebo (−198 E) → daño decreciente con la
  aversión + salto de rechazo (retracción de probóscide real).
- **Moscas posadas vs forrajeras**: la línea de laboratorio (tónico 0,15,
  calibrada para Rankin) se muere de hambre en el terrario → línea
  forrajera propia del modo 3D.

### 6.2 E2E navegador

Modo 3D carga desde la pestaña; soltar gusano/mosca selecciona al sujeto
(anillo ámbar + haz); el cerebro del gusano (puntos+líneas+8 etiquetas en
abanico) y de la mosca (nube cian/blanca/lime con actividad cálida y
etiquetas de grupos) renderizan; clic coloca el cebo (cubo verde-oliva
visible); las barras de aprendizaje se mueven (18 %/1 comida tras comer el
azúcar); la silueta (ave voxel + sombra que crece) aparece y dispara el
escape; móvil 375×812 sin overflow horizontal, holograma arriba y tarjetas
abajo. Consola: solo el ruido preexistente documentado (§7).

## 7. Nota ambiental: consola en desarrollo

Desde Chromium 155 (build actual de agent-browser) aparecen ~20 errores
`Attempted to synchronously unmount a root while React was already
rendering` **también en la v1.3.0 publicada** (verificado en producción,
sin código del modo 3D): es la interacción Radix Tooltip (10 tooltips) ×
react-dom 19.2.3, cosmética y sin impacto funcional. Se investigó por
bisección (sin sonner, sin ThemeProvider, sin el módulo 3D: persiste).
Pendiente de actualizar Radix/react-dom en cuanto salga el parche upstream.

---

## 8. Estructura del código

```
src/components/sim/neuro3d/
├── store.ts        # zustand: herramienta activa + preferencias
├── data.ts         # datasets 3D decodificados + conversiones mundo↔escena
├── vox.tsx         # helpers voxel (paleta del mod, rampa de actividad)
├── labels.tsx      # etiquetas-sprite canvas (sin portales DOM)
├── fly-body.tsx    # mosca voxelar (FlyModel de fly-brain-minecraft)
├── worm-body.tsx   # gusano: cápsulas + 302 neuronas reales dentro
├── brain-hologram.tsx # hologramas: gusano (somos+sinapsis) / mosca (nube+anclajes)
├── scene.tsx       # Canvas: terrario, comida, silueta, ondas, clic, cámara
├── panel.tsx       # controles: sujeto, colocar, aprendizaje, leyenda…
└── index.tsx       # carga diferida (ssr:false)
```

Motor: `FoodKind 'bitter'` + aprendizaje por valor (`creature.ts`,
`world.ts`), `SimMode 'neuro3d'`, `dropFood` en el hook, `learn` en
`CreatureView`, línea `drosophilaForagerGenome`.
