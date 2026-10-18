# Modo 3D — Cuerpo y cerebro en vivo

> **Versión 1.4.2.** Pestaña «3D» del selector de modos (tras «Laboratorio»).
> Un terrario 3D donde sueltas un gusano o una mosca, ves su **cuerpo
> anatómico real** y su **cerebro disparando en vivo**, le colocas comida
> (buena y amarga), siluetas de depredador y estímulos, y observas cómo
> **aprende**. El cerebro de la mosca tiene ahora sus **dos etapas**
> (Larva / Adulta) con datasets reales distintos.

---

## 1. Qué se ve

| Elemento | Gusano (*C. elegans*) | Mosca (*D. melanogaster*) |
|---|---|---|
| **Cuerpo** | Cadena de cápsulas siguiendo los 8 segmentos reales del motor (ondulación en vivo), semitransparente | **Diseño voxelar propio** (v1.4.1, sin copiar el mod): ojos compuestos rojos dominantes + triángulo ocelar, cérvix, tórax ocre con quetas dorsocentrales/escutelares y escutelo, tergitos decrecientes con punta negra del macho, alas plegadas en reposo, halterios pedunculados, 6 patas caminantes |
| **Neuronas dentro** | Las **302 neuronas en sus posiciones somáticas reales** (µm), coloreadas por su voltaje LIF del tick actual | — (el cerebro de la mosca está en la cabeza; se magnifica arriba) |
| **Holograma** | El sistema nervioso completo en disposición anatómica real, cabeza a la izquierda (inclinado 34° para ver el anillo en escorzo): **capa de anatomía** con los **302 somas reales** tenues por clase (300 del conectoma + CANL/CANR) y **capa de actividad** con blend aditivo — **solo los puntos que se disparan brillan**. Andamio central: anillo nervioso circunfaríngeo (torus blanquecino) + cordones ventral/dorsal, **cada tracto iluminado por la actividad media real de sus neuronas**. Andamio **sensorial** (v1.4.2): poros y tractos de los **anfídios** (14 canales quimio/termo) y los **fasmas** de la cola, los 6 receptores de **tacto** (ALM/PLM/AVM/PVM, procesos sublaterales que recorren la pared del cuerpo) y **PVD** (nocicepción) — cada uno brilla con el voltaje real de sus neuronas. 8 neuronas célebres en abanico + 4 etiquetas sensoriales + título | **Dos etapas reales** (v1.4.2, conmutables en el panel):
· **LARVA** (por defecto): el conectoma larvario real que simula el motor (Winding 2023) dibujado **neurona a neurona** — **2.956 puntos**, cada uno con su voltaje LIF propio, en su neuroanatomía larvaria canónica (lóbulos antenales, cuerpos fungiformes cálices→pedúnculos→lóbulos, cuernos laterales, SEZ, órgano dorsal/Bolwig/terminal/faríngeo, conectivo cervical y **VNC de 11 neuromeros** T1–T3+A1–A8 con nervios segmentarios). Misma escala µm que el gusano, cabeza a la izquierda
· **ADULTA**: la nube voxelar del CNS adulto masculino (141.781 somas → 15.001 celdas) coloreada por región + actividad de los 29 grupos en sus familias homólogas + **andamio derivado de la propia nube** (tractos ópticos, nervios antenales, probóscide, conectivo cervical, eje del VNC) y marcadores de órganos (antenas, probóscide, retinas) |
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

### 2.2 Drosophila — dos etapas, dos datasets reales

| Campo | Etapa **LARVA** (por defecto) | Etapa **ADULTA** |
|---|---|---|
| Dataset | Conectoma larvario completo **Winding et al. 2023** (Science 379:eadd9330) — el que el motor simula: 2.956 neuronas / 41.977 aristas | neuPrint **`male-cns:v1.0`** — CNS adulto masculino (Berg et al., *Cell* 2026), 141.781 somas con posición |
| Anatomía | Layout canónico de la larva (Berck 2016; Eichler 2017; Eschbach 2020/21) — coordenadas por neurona = aproximación declarada (§5.9) | Nube voxel 15.001 celdas vía binario FLYB de **fly-brain-minecraft** (MIT/CC BY 4.0) |
| Actividad | **100 % real, por neurona** (voltaje LIF de cada una de las 2.956) | 29 grupos larvarios anclados a las familias adultas homólogas (§3) + andamio derivado de la propia nube (§5.11) |
| Centrado | Layout simétrico (mismo marco que el gusano) | **Recentrado en la línea media real** de la nube: x +3,65 (media de los centroides OL L/R) y z +5,05 (mediana D-V) — el cordón ventral cae en x=0 |
| Crédito UI | *«Winding 2023 · 2.956 neuronas reales»* | *«Berg 2026 · 141.781 somas (CC BY 4.0)»* |

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
8. **Andamio del holograma del gusano (v1.4.1)**:
   - **Anillo nervioso**: centro (−1.4, −211, −4.4 µm) y radio derivados de
         los somas reales que flanquean el istmo faríngeo (banda A-P
         −232…−186, n=14); la orientación del plano sale del eje faríngeo
         deducido del arco cefálico dorsal→ventral de los ganglios (la
         cabeza está inclinada en el modelo Virtual Worm). El radio real
         (~15 µm) se dibuja algo magnificado (20 µm) para legibilidad, y el
         holograma se inclina 34° para ver el aro en escorzo (⊥ al eje A-P,
         de canto se invisible).
   - **Cordón ventral**: medias locales (bins de 40 µm) de los somas
         motores reales — sin invención; sigue el arco de postura real
         (z −66 µm en el RVG → +4 a mitad del cuerpo → −13 en la cola).
   - **Cordón dorsal**: tracto real **sin somas propios** (son los axones
         de DA/DB/DD, con soma ventral) — su ruta es una aproximación por
         la línea media dorsal siguiendo el estrechamiento del cuerpo.
   - **Brillo por tracto**: cada tracto muestra la media (√t, gamma de
         visualización) de sus neuronas reales: anillo = ganglios cefálicos
     (202), ventral = AS/DA/DB/DD/VA/VB/VC/VD en ±45 µm, dorsal = DA/DB/DD
         en ±60 µm.
9. **Layout larvario por neurona (v1.4.2)**: el dataset Winding no
   publica somas en µm — cada una de las 2.956 neuronas se coloca de forma
   **determinista** (jitter sembrado por índice) dentro de la **región
   canónica real de su grupo** (órgano dorsal, Bolwig, terminal, faríngeo,
   AL, cálices/pedúnculos/lóbulos del MB, LH, núcleo cerebral, VNC por
   neuromero, pared del cuerpo por segmento, intestino para GUT). La
   **actividad es 100 % real por neurona**; la posición, aproximación
   declarada. Misma escala µm→unidades que el gusano (el CNS larvario es
   de verdad más corto que el cuerpo del gusano: ~27 vs 46 unidades).
10. **Sensorial del gusano (v1.4.2)**: los poros anfidiales son la
   continuación anterior del grupo somático real (medias L/R medidas);
   los procesos de tacto (ALM/PLM/AVM/PVM) y PVD se dibujan como líneas
   sublaterales rectas en la pared del cuerpo (±28–30 µm) a la altura
   D-V de su soma real — el brillo es el voltaje **individual** de cada
   neurona, sin mezclar.
11. **Andamio adulto derivado de la nube (v1.4.2)**: tractos ópticos
   (centroides OL L/R → centroide cb), eje del VNC (bines de 240 puntos
   sobre los vóxeles 'vnc' reales), conectivo cervical y nervios
   antenal/probóscide (anclados a los centroides PN/GRN del §3, extendidos
   hacia los órganos periféricos). Marcadores de antenas/probóscide/
   retinas iluminados con la actividad real de ORN/GRN/PR.

---

## 6. Banco de pruebas (40/40 ✓)

`/home/z/calib/banco-3d-v2.ts` (v1.4.1; el histórico `banco-3d.ts` de la
v1.4.0 con sus 28/28 está resumido abajo) — 40 comprobaciones sobre los
 componentes reales del modo 3D:

1. **Fix de especie (3)**: `FlyBody` se oculta con cualquier sujeto que no
     sea mosca (guard antes de posicionar); `WormBody` mantiene su guard.
2. **Diseño propio de la mosca (10)**: 0/16 colores del mod en la paleta;
   declaraciones de diseño propio; partes anatómicas nuevas (ocelos,
   quetas, franjas, cérvix, punta del macho, vena transversal); alas
   plegadas en reposo; patas con ciclo de caminado.
3. **Holograma del gusano (27)**: 302 somas (300 + CANL/CANR sin sinapsis,
   anatomía pura); cabeza a la izquierda (−23…+23 u); anillo de 64 puntos
   cerrado con diámetros correctos (L-R 2,55 · D-V 2,32 u) iluminado por
   202 vecinos cefálicos; cordón ventral (110 pts) nunca dorsal (z ≤ +4,2
   µm), sin tejer (retrocesos < 3 µm), vecinos = las 75 motoras reales;
   cordón dorsal dorsal (z > 8 µm en el cuerpo) con vecinos DA/DB/DD (22);
   dorsal sobre ventral a mitad del cuerpo; todo dentro de ±25 u; sin
   `WORM_EDGES`; dos capas de puntos; capa aditiva con umbral; anillo
   torus en su plano real.

### 6.0 Banco histórico v1.4.0 (28/28 ✓)

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

### 6.2 E2E navegador (v1.4.1, re-verificado completo)

Modo 3D carga desde la pestaña; soltar gusano lo selecciona (anillo ámbar
+ haz) y **ya no aparece cuerpo de mosca sobre él** (fix verificado por
visión: `fly_body_on_worm: false`); el holograma del gusano muestra las
dos capas (somas tenues + **puntos que se encienden**), el **aro blanquecino
visible en escorzo** (confirmado por visión en zoom), los cordones y las 8
etiquetas; **sin ovillo de líneas** (verificado: «solo algunas líneas
estructurales limpias… no hay miles de líneas»); la mosca nueva renderiza
ojos rojos, quetas, bandas, punta negra y **alas plegadas**; el holograma
de la mosca sigue OK; móvil 375×812 sin overflow, holograma y aro visibles.
Consola: solo el ruido preexistente documentado (§7).

Hallazgos de método durante la verificación: el anillo visto de canto es
invisible (⊥ al eje A-P) → inclinación 34° del holograma + torus con
brillo blanquecino separado del lenguaje de color de la actividad; las
líneas de 1 px se pierden en la nube de somas → torus 3D; la media de un
grupo grande (202 neuronas) casi nunca pasa de 0,3 → gamma √t.

### 6.3 E2E navegador (v1.4.2 — dos etapas + sensorial)

Verificado con agente navegador + modelo de visión:

- **Arranque sin sujeto**: `any_hologram_or_floating_cloud: false` —
  **el cerebro de la mosca ya NO aparece al inicio** (fix del bug: el
  conmutador de holograma solo monta el del sujeto seleccionado).
- **Larva (por defecto)**: holograma presente, horizontal con cabeza a la
  izquierda, nube densa de puntos (2.956 neuronas), cordón segmentado
  visible (11 neuromeros), grupos de órganos sensoriales a la izquierda,
  título leído **«D. melanogaster · larva»**, `activity_glow: many`.
- **Adulta** (selector del panel): erguida con el cerebro arriba, nube por
  regiones, cordón colgando, líneas de andamio visibles, etiquetas con
  guía legibles (ORN/PR/MBON/KC/CN/ASC), **centrada sobre el plato**
  (recentrado verificado), título **«D. melanogaster · adulto ♂»**.
- **Gusano sensorial**: poros de **anfídios** en la cabeza y **fasmas** en
  la cola confirmados por visión, líneas sublaterales de **tacto** en las
  dos paredes del cuerpo, etiquetas leídas (Anfídios, Fasmas, Tacto,
  Nocicepción) y título «C. elegans · hermafrodita».
- **Interacción**: azúcar junto a la mosca → `head_end_glow: strong` con
  muchos puntos encendidos (respuesta sensorial ORN/GRN real en vivo).
- **Móvil 375×812**: sin overflow horizontal, holograma visible.
- Consola del navegador y `dev.log` limpios (solo el ruido §7).

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
├── store.ts        # zustand: herramienta activa + etiquetas + etapa de la mosca
├── data.ts         # datasets 3D + andamios (anillo/cordones, sensorial del gusano,
│                   #   adulto derivado de la nube) + recentrado de la línea media
├── vox.tsx         # helpers voxel (paleta PROPIA de la mosca, rampa de actividad)
├── labels.tsx      # etiquetas-sprite canvas (sin portales DOM)
├── fly-body.tsx    # mosca voxelar (diseño propio de NeuroEvo, D. melanogaster real)
├── worm-body.tsx   # gusano: cápsulas + 302 neuronas reales dentro
├── larva.ts        # LAYOUT LARVARIO (v1.4.2): 2.956 posiciones por neurona,
│                   #   nervios sensoriales, VNC de 11 neuromeros, órganos
├── brain-hologram.tsx # hologramas: gusano (2 capas+anillo+cordones+sensorial) /
│                   #   larva (2.956 neuronas+andamio) / adulto (nube+anclajes+andamio)
├── scene.tsx       # Canvas: terrario, comida, silueta, ondas, clic, cámara
├── panel.tsx       # controles: sujeto, colocar, aprendizaje, etapa Larva/Adulta…
└── index.tsx       # carga diferida (ssr:false)
```

Motor: `FoodKind 'bitter'` + aprendizaje por valor (`creature.ts`,
`world.ts`), `SimMode 'neuro3d'`, `dropFood` en el hook, `learn` en
`CreatureView`, línea `drosophilaForagerGenome`.
