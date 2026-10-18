# Changelog

## 1.4.2 — El cerebro de la mosca en sus dos etapas + sistema sensorial

### 🐛 Correcciones
- **El cerebro de la mosca ya no aparece al arrancar**: el conmutador del
  holograma solo montaba el del gusano o el de la mosca según la especie,
  pero sin sujeto seleccionado caía en la rama «mosca» y la nube del CNS
  adulto se veía desde el primer segundo del modo 3D. Ahora **solo se
  dibuja el cerebro del sujeto seleccionado** (gusano → gusano, mosca →
  larva/adulta, nada → nada).
- **CNS adulto recentrado en su línea media real**: la nube venía
  descentrada de la parrilla normalizada (línea media L-R a x=−3,65,
  rango D-V desplazado −5,05 — medido sobre los 15.001 vóxeles reales);
  tras el recentrado el cordón ventral cae en x=0 y el holograma queda
  **centrado sobre el plato**.

### 🪰 Mosca: dos etapas, dos datasets reales (conmutables en el panel)
- **Drosophila Larva (por defecto)**: el conectoma larvario real que el
  motor simula (Winding et al. 2023) dibujado **neurona a neurona** —
  **2.956 puntos**, cada uno brillando con **su voltaje LIF propio**, en
  el lenguaje visual del gusano (capa de anatomía tenue por grupo + capa
  de actividad aditiva con umbral sobre el reposo).
  - **Andamio canónico de la larva** (Berck 2016 · Eichler 2017 · Eschbach
    2020/21): lóbulos antenales, **cuerpos fungiformes** completos
    (cálices → pedúnculos → lóbulos vertical y medial), cuernos laterales,
    **SEZ**, neuropilos ópticos larvarios, glándula del anillo.
  - **Sistema sensorial cefálico real**: órgano dorsal (olfato/termo/higró)
    con su nervio antenal → lóbulo antenal, **órganos de Bolwig**
    (fotorreceptores) con el nervio de Bolwig → neuropilo óptico, órgano
    terminal (gusto) → SEZ y órgano faríngeo → SEZ.
  - **Conectivo cervical** + **cordón ventral de 11 neuromeros**
    (T1–T3 + A1–A8) con **nervios segmentarios** a la pared del cuerpo.
  - Cada tracto y cada marcador de región se ilumina con la **media real**
    de sus grupos (ORN el nervio antenal, KC los pedúnculos, MBON/MBIN los
    lóbulos, ASC el eje del VNC…). Misma escala µm que el gusano; cabeza
    a la izquierda; título «D. melanogaster · larva».
- **Drosophila Adulta**: la nube del CNS adulto masculino (Berg 2026)
  con los 29 grupos larvarios proyectados, y ahora además:
  - **Andamio derivado de la propia nube**: **tractos ópticos**
    (centroides reales de los lóbulos ópticos L/R → cerebro central),
    **nervios antenales** y **probóscide** (hacia el lóbulo antenal y la
    SEZ), **conectivo cervical** y **eje del cordón ventral** trazado con
    bines sobre los vóxeles reales.
  - **Marcadores de órganos sensoriales** (antenas ×2, probóscide,
    retinas ×2) que se encienden con la actividad real de ORN/GRN/PR.
  - 9 **etiquetas con líneas guía en abanico** (como el gusano) y título
    «D. melanogaster · adulto ♂».

### 🪱 Gusano: andamio sensorial
- **Anfídios** (los 14 canales quimio/termosensoriales de la cabeza:
  AWA–AWC, ASE, AFD, ASH, ASG–ASK, ADL, BAG + AQR): poros en la punta de
  la nariz + tractos dendríticos hasta el anillo, iluminados con la media
  real de sus neuronas.
- **Fasmas** (PHA/PHB, quimiosensores de la cola): poros + tractos.
- **Tacto** (los 6 receptores de microtúbulos): los procesos largos
  sublaterales de ALML/R, PLML/R, AVM y PVM recorren la pared del cuerpo
  y **cada línea brilla con el voltaje individual de su neurona**.
- **PVD** (nocicepción, la neurona «árbol de Navidad»): procesos laterales
  cabeza-cola con su voltaje real.
- 4 etiquetas sensoriales (Anfídios · Fasmas · Tacto · Nocicepción) y
  título «C. elegans · hermafrodita».

### 📚 Documentación
- `docs/MODO-3D.md`: §1 (tabla con las dos etapas), §2.2 (dos datasets),
  §5.9–5.11 (nuevas simplificaciones declaradas), §6.3 (E2E v1.4.2), §8
  (estructura con `larva.ts`). README y CHANGELOG actualizados.

## 1.4.1 — Modo 3D pulido: anillo nervioso, mosca propia y fix del gusano

### 🐛 Correcciones
- **El gusano ya no «lleva la textura de la mosca»**: el cuerpo voxelar de
  la mosca se dibujaba sobre CUALQUIER sujeto seleccionado (solo comprobaba
  que hubiera sujeto, no la especie) — al seleccionar un gusano, la mosca
  de Minecraft se pegaba a su posición. Ahora `FlyBody` se oculta salvo con
  una mosca.
- **Orientación del holograma del gusano**: la cabeza quedaba a la derecha
  aunque la UI/documentación decían «a la izquierda». Corregida la
  proyección (`wormHoloPos`) — cabeza a la izquierda, de verdad.

### 🎨 Mosca: diseño voxelar propio
- El cuerpo de la mosca ya **no copia el modelo del mod de Minecraft**:
  proporciones y paleta **originales de NeuroEvo**, construidas a partir de
  la morfología real de *D. melanogaster*: cabeza dominada por los dos ojos
  compuestos rojos con triángulo ocelar, cérvix (cuello), tórax ocre con
  franjas dorsales y **quetas** (macroquetas dorsocentrales y escutelares),
  escutelo, abdomen de tergitos decrecientes con bandas y punta negra del
  macho, **alas que se pliegan sobre el abdomen en reposo** y baten al
  volar, halterios con pedúnculo y maza, y 6 patas con ciclo de caminado.

### 🧠 Holograma del gusano: puntos que se encienden (como la mosca)
- **Fuera las 4.731 «rayas»**: se eliminan todas las sinapsis dibujadas
  (el «ovillo») y el holograma pasa al lenguaje del cerebro de la mosca:
  - **Capa de anatomía**: los **302 somas reales** (300 del conectoma +
    CANL/CANR) tenues, teñidos por clase (sensorial/inter/motora; CAN en
    gris pizarra).
  - **Capa de actividad**: los mismos 302 puntos con blend aditivo — **solo
    los que se activan brillan** (umbral por encima del reposo LIF; cada
    pico destella).
  - **Andamio neuroanatómico real** en vez del ovillo: **anillo nervioso
    circunfaríngeo** (torus fino blanquecino — centro/orientación derivados
    de los somas reales que lo flanquean y del eje faríngeo del arco
    cefálico; el holograma se inclina 34° para verlo en escorzo),
    **cordón ventral** trazado por las medias locales de los somas motores
    reales (AS/DA/DB/DD/VA/VB/VC/VD) y **cordón dorsal** (aproximación
    declarada). **Cada tracto se ilumina con la actividad media real de las
    neuronas que lo forman**: el anillo con los ganglios cefálicos, el
    ventral con sus motoras, el dorsal con los axones DA/DB/DD.
- Gamma de visualización (√t) en los tractos para que las dinámicas de baja
  frecuencia sean legibles.

### 🧪 Calidad
- Banco de pruebas del modo 3D ampliado a **40/40 ✓** (fix de especie,
  originalidad de la paleta, 302 somas, orientación, anillo/cordones con
  vecinos reales, sin aristas) + E2E con navegador (gusano sin cuerpo de
  mosca, aro visible confirmado por visión, mosca nueva con quetas/alas
  plegadas, móvil 375×812 sin overflow).

## 1.4.0 — Modo 3D: cuerpo y cerebro en vivo

### 🧊 Terrario 3D con anatomía real (nueva pestaña «3D», tras Laboratorio)
- **Gusano**: cuerpo ondulante (los 8 segmentos reales del motor) con las
  **302 neuronas en posición somática real** (µm) dentro del cuerpo,
  coloreadas por su voltaje LIF tick a tick. Anatomía: WormBase Virtual
  Worm (dominio público) vía OpenWorm c302 (MIT).
- **Mosca**: cuerpo voxelar estilo Minecraft con las proporciones y la
  paleta de `FlyModel.java` de **fly-brain-minecraft** (MIT).
- **Holograma cerebral en vivo** flotando sobre el plato: en la mosca, la
  **nube voxelar del CNS adulto masculino completo** (neuPrint
  `male-cns:v1.0`, Berg et al., Cell 2026 — 141.781 somas reales → 15.001
  celdas, datos CC BY 4.0) coloreada por región como el build de bloques,
  con la actividad de los **29 grupos larvarios** (Winding 2023) proyectada
  sobre sus familias adultas homólogas (ORN→lóbulo antenal, KC→cuerpo
  fungiforme…, 29 anclajes documentados); en el gusano, los 300 somas con
  las **4.731 sinapsis** y las presinápticas activas destellando, con 8
  neuronas célebres etiquetadas (AVA, ASE, AFD…).
- **Interacción con clic**: soltar sujeto (gusano N2 / mosca forrajera),
  colocar azúcar, fruta, **cebo amargo** o disparar **silueta de
  depredador** (looming), golpe y chorro de aire sobre el plato 3D.

### 🍽️ Aprendizaje alimentario por valor
- Nuevo `FoodKind 'bitter'`: cebos con quinina/denatonio que **huelen a
  comida** pero castigan al probarlos (no letales, persistentes).
- **Memoria por valor** por criatura: recompensa (comer bien) y castigo
  (probar amargo) con referencia real (NSM/serotonina · RIM/tiramina ·
  DAN→MBON). La aversión aprendida **reescribe la valencia del olor**:
  apaga la vía olfativa del cebo y enciende la nociceptiva; extinción lenta.
- Daño decreciente con la aversión (retracción de probóscide) + salto de
  rechazo: el cebo solo no puede matar.
- Panel con barras de preferencia/aversión y contadores en vivo.

### 🐛 Correcciones
- **Puesta fantasma** (preexistente): las moscas pagaban el coste
  energético de la puesta aunque `layEgg` abortara en lab/arena/3D → el
  coste se cobra solo si el huevo existe.
- Terrario rico (44 ítems): la mosca localiza comida en sus vuelos (su
  lóbulo antenal no da señal de giro fiable — como en el mod de Minecraft
  original), el gusano quimiotaxea.

### ✅ Pruebas
- **Banco 3D: 28/28 ✓** (datos anatómicos, aprendizaje, cebo no letal,
  escape por silueta con knockout visual, modo/APIs) — docs/MODO-3D.md.
- Regresión Fase 2: **33/33 ✓** (2,96 ms/tick).

## 1.3.0 — Fase 2: Drosophila real, Laboratorio y Retos

### 🧠 Moscas con conectoma real de Drosophila (Winding et al. 2023, Science)
- Cerebro larvario completo: **2.956 neuronas, 41.977 aristas reales**
  (257.414 sinapsis, 73,0 %; umbral ≥3 contactos salvo TODAS las salidas de
  sensores de primer orden). Pipeline 100 % reproducible
  (`scripts/build_drosophila.py`, fuente en `data/source/larva_winding2023/`).
- **18 sentidos mapeados a los grupos neuronales con la modalidad anotada
  en el dataset**: olfato (42 ORNs, contraste L/R), gusto externo (132 GRNs)
  y faríngeo (110 GNP), visión (29 PRs), nocicepción (6 NOCs), termo frío
  (6 THc) y calor (4 THw), tacto (14 MECs), propiocepción de vuelo (8 PROs),
  aire (26 RSPs) y víscera/hambre (85 GUTs).
- Salidas por pools descendentes reales: **DN-VNC** (avance), **asimetría
  L/R de las DNs** (giro) y **DN-SEZ** (puesta). Klinotaxis con sesgo
  lateral innato. Genoma de 27 genes. **Puesta de huevos por circuito
  DN-SEZ** con vitelo e incubación Q10 a 25 °C.
- Anillo en vivo de las 2.956 neuronas + tira de 18 sentidos en el
  inspector. Rendimiento: tick-stepping 1:2 → **~2,5 ms/tick** con
  ecosistema completo (banco de 33 pruebas).

### 🧪 Laboratorio de neurobiología (nuevo modo)
- 6 estímulos controlados; el **tap** aplica un electrodo virtual sobre el
  circuito mecanorreceptor real de cada especie (ALM/AVM/PLM del gusano —
  Wicks & Rankin 1997; MEC de la mosca).
- **Ablaciones virtuales por clase neuronal** (17 grupos entre ambas
  especies; la ablación láser de Chalfie 1985, sin sacrificio animal).
- **Trazas de actividad a 10 Hz** del cerebro vigilado.
- **Protocolo guiado de habituación al tap — Rankin 1990**: 20 taps
  cronometrados, gráfica de amplitudes en vivo, decaimiento calculado y
  exportación del ensayo en JSON. Verificado: habituación y recuperación
  espontánea replicadas sobre el conectoma (banco §4: 5/5).
- Líneas isogénicas de laboratorio (gusano N2 en reposo; mosca posada).

### 🏆 Modo Retos / Arena (nuevo modo)
- Editor de laberintos con 7 herramientas (pared a arrastre con
  previsualización, meta, fruta, veneno, borrar, soltar, elegir).
- Participantes con **arquitectura elegible** (conectoma real vs ANN
  control) y cronómetro de ensayo con desenlaces y causas (meta, veneno,
  inanición, edad). **Récords persistentes** en localStorage.

### 🔧 Motor y biología
- **Adaptación sensorial real** (luz/humedad/termo responden al CAMBIO,
  τ 3-4 s) en ambos cerebros biológicos: el fondo neural de un animal en
  reposo calla (antes: ASH saturado por la luz del día).
- **Gen 26 del gusano: adaptación de tasa** (fatiga de disparo) —
  ráfagas sí, oscilación perpetua jamás; genomas 25→26 con migración.
- **Bug v1.2 corregido**: `countNeighbors` se auto-contaba por error de
  redondeo flotante → el gusano creía tocarse la nariz a sí mismo (~40 % de
  los ticks) y olía su propia feromona.
- Colisiones círculo-segmento con paredes (rebote + reflejo de tacto).
- `seedFromRecord`: el primer individuo sembrado lleva el genoma EXACTO.

### 💾 Cerebros portátiles
- Exportación/importación `.neuroevo.json` (zod-validado) desde el
  inspector y el Museo: arquitectura + genoma + rasgos; siembra de 8
  individuos con migración automática de genomas antiguos.

### 📚 Documentación
- `docs/CONECTOMA-DROSOPHILA.md` (nuevo): fuente, pipeline, mapeos,
  calibración y 8 simplificaciones declaradas.
- `docs/PRUEBAS-FASE-2.md` (nuevo): banco de 33 pruebas + E2E navegador.
- `docs/PLAN-FASE-2-EXPERIMENTOS.md`: método completo (ejecutado).
- README y ARQUITECTURA actualizados.

---

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto se adhiere al [Versionado Semántico](https://semver.org/lang/es/).

## [1.2.0] — 2026-10-17

Los gusanos viven su biología completa: 17 sentidos reales, ciclo de vida
con fases y dauer, y reproducción 100 % neural por puesta de huevos.
Nueva vista cerebral "Circuito vivo".

### Añadido
- **17 canales sensoriales** mapeados a neuronas reales (antes 12): tacto
  cefálico → ASH+FLP+OLQ (circuito real de choque frontal → reversa),
  tacto caudal → PLM (reflejo PLM→PVC→VB/DB de acelerón), propiocepción
  con signo → DVA+SMDD (TRP-4), derivada del gradiente de comida → ASE
  (klinotaxis adaptativa) y feromona de conglomerado → ADL (ascarósidos).
  El canal de saciedad ahora también excita HSN (tono reproductivo
  análogo a la serotonina de NSM).
- **Ciclo de vida real de C. elegans** (escala 1 s ≈ 1 h a 20 °C): huevo
  incubando en el mundo → L1 → L2 → L3 → L4 → adulto; desarrollo con
  Q10 ≈ 2 según temperatura; larvas progresivamente más grandes, rápidas
  y sensibles; senescencia adulta ~300 s ± 20 % (acelerada por calor).
- **Fase dauer**: hambre sostenida en L2/L3 → larva de resistencia (boca
  sellada, no come, metabolismo 5 %, no envejece, casi inmóvil); sale
  como L4 al oler comida durante 2.5 s.
- **Reproducción real por puesta**: hermafroditas autofecundados con
  esperma limitado (140) y hasta 8 huevos maduros por útero; la maduración
  cuesta energía y la frena la feromona de conglomerado; la puesta solo
  ocurre cuando el circuito real HSN+VC dispara (salida "Reproducir"),
  en ráfagas separadas 1.4 s, por la vulva del cuerpo. Los huevos son
  objetos del mundo que se retuercen antes de eclosionar como L1 con
  vitelo. Ningún gusano nuevo aparece por programación (las moscas
  conservan su brote directo como control).
- **Vista "Circuito vivo"** en el inspector (nueva, por defecto en
  gusanos): riel con los 16 sentidos en vivo, neuronas sensoriales →
  comando → premotoras con las **sinapsis reales del subgrafo** (450
  aristas), pools motores con su tasa, salidas, partículas animadas por
  las aristas activas y badge de **estado conductual** (AVANZANDO /
  GIRANDO / REVERSA / PONIENDO HUEVO) con el circuito responsable. El
  anillo clásico queda como segunda pestaña.
- **"Sentidos en vivo"**: tira DOM accesible con los 17 canales, sus
  neuronas reales y valores al instante, agrupados por modalidad.
- **Sentidos dibujados sobre el gusano seleccionado** en el mapa: línea
  punteada hacia la comida con ondas quimiosensoriales, rayos de
  fotofobia, chispas de tacto nariz/cola, arco de propiocepción, aura de
  feromona, badge de fase y ráfaga dorada al poner un huevo.
- HUD con chip de **huevos** y línea de huevos en la gráfica de
  población; larvas escaladas y dauers con estilo propio en el mapa.
- Documento nuevo **docs/SENSORES-CICLO-REPRODUCCION.md** (respondiendo
  con detalle: vida, ciclo, reproducción, dauer, balance y
  simplificaciones honestas).

### Cambiado
- Genoma del conectoma: 20 → **25 genes** (17 ganancias sensoriales).
  Los registros del Museo con genoma v1.1 (20 floats) se **migran
  automáticamente** al cargarlos.
- Ficha del inspector de gusanos: barra de edad sustituida por **fase del
  ciclo de vida** con progreso; stats de huevos puestos/maduros, esperma
  y feromona.
- Balance verificado headless (900 s): 55-80 gusanos, 147 reproductores
  distintos por circuito neural, generación 31, 1.3 ms/tick.

## [1.1.1] — 2026-10-17

Mantenimiento de documentación y un ajuste visual del inspector.

### Arreglado
- **Conectoma (inspector)**: las etiquetas de las salidas motoras quedaban
  cortadas en el borde derecho del canvas ("Reproduci…"); la columna de
  motores ahora reserva espacio suficiente y "Girar/Avanzar/Reproducir" con
  su valor se ven completos en cualquier ancho.

### Documentación
- README: añadida la **captura del conectoma de *C. elegans* en vivo**
  (faltaba la imagen de la característica estrella de v1.1.0), tabla de la
  interfaz reorganizada (gusano/conectoma y mosca/ANN), sección "Cómo
  funciona" reescrita con los dos cerebros (mapeos sensoriales y motores
  del conectoma + ANN), genética dual (20 genes vs 131 pesos), estructura
  del proyecto actualizada (`connectome/`, dataset, `static-museum.ts`),
  API con `brain.kind`, badge de release dinámico, enlace "Probar en vivo"
  y un experimento nuevo ("Biología vs. azar").
- `inspector-neuronal.png` retomada: mostraba un gusano con la ANN 12→8→3
  (cerebro que los gusanos ya no usan desde v1.1.0); ahora muestra una
  mosca, que es quien conserva esa arquitectura como control experimental.
- `docs/ARQUITECTURA.md`: sección 2 reescrita ("Los cerebros") con la
  interfaz `IBrainAdapter`, el grafo CSR compartido del conectoma, la
  dinámica LIF, las tablas de mapeo sensorial/motor, el genoma de 20 genes,
  la evolución dual y nueva sección de export estático y despliegue.
- `docs/DESARROLLO.md`: fases 6-9 documentadas (publicación de v1.0.0,
  Fase 1 *C. elegans* con su sintonía empírica, publicación de v1.1.0 y
  verificación E2E del sitio público).

## [1.1.0] — 2026-10-17

Los gusanos dejan atrás las redes neuronales aleatorias: ahora simulan el
**conectoma biológico real de *C. elegans***. (Fase 1 del plan de
cerebros biológicos; la Fase 2 — *Drosophila* — queda documentada y
preparada con el patrón Strategy.)

### Añadido

**Conectoma real de C. elegans para los gusanos**
- Dataset compacto (55 KB, `src/lib/sim/data/c_elegans_connectome.json`)
  generado desde OpenWorm: **300 de las 302 neuronas** del hermafrodita
  (incluidas las 20 faríngeas; CANL/R no tienen sinapsis), **3.638 sinapsis
  químicas + 1.093 uniones en gap** (≈25.000 contactos), con clasificación
  (86 sensoriales / 164 interneuronas / 50 motoras) y neurotransmisores.
- Motor **LIF** (integración y disparo con fugas) por gusano: potenciales
  de membrana, umbral, refractario, sinapsis químicas con signo según el
  transmisor presináptico (GABA inhibitorio) y uniones en gap con difusión
  + transmisión de picos (así comandan AVA/AVB a los pools motores A/B).
- Mapeo sensorial documentado (AFD ← temperatura — el termosensor real,
  ASE ← comida, ASH ← veneno, PHA/PHB ← quimiorrecepción aversiva, PVD/ALM
  ← multitud, BAG ← humedad…) y motor por pools reales (VB/DB+AVB →
  avanzar; asimetría dorso-ventral RMD/SM/SMB → girar, amplificada en las
  reversas VA/DA+AVA; VC+HSN — el circuito real de puesta — → reproducir).
- **GA sobre neuromodulación**: 20 genes heredables (ganancias sensoriales,
  escalas de transmisión ACh/Glu/GABA/monoaminas, τ de fuga, umbral,
  refractario, impulso tónico). La estructura sináptica es intocable
  — es biología; la selección natural ajusta la química, como en el animal.
- Frío extremo = coeficiente **Q10**: la entrega sináptica se debilita con
  `voltage` (el nemátodo real se vuelve torpe y letárgico bajo 10 °C).

**Arquitectura extensible (patrón Strategy)**
- Interfaz `IBrainAdapter` + registro de fábricas: cambiar la mosca ANN por
  el futuro conectoma de *Drosophila* (Fase 2) solo toca una línea del
  registro. La ANN 12→8→3 de las moscas queda intacta como control
  experimental.
- Inspector neuronal con dos vistas: anillo del conectoma (300 neuronas en
  tres sectores por clase — ámbar sensoriales, gris interneuronas, esmeralda
  motoras — con destellos blancos por pico, etiquetas de AFD/ASE/AVA/VB…,
  picos/tick y actividad media) para gusanos; red clásica 12→8→3 para moscas.
- Museo de la Evolución retrocompatible: los cerebros serializados incluyen
  `kind` ('ann' | 'elegans') y los registros antiguos de gusanos se siembran
  como ANN clásica (API + zod actualizados).
- Rendimiento: ~1.2 ms/tick para el mundo completo (≈60 gusanos con 300
  neuronas cada uno + moscas) — 3-4 % del presupuesto de frame a 60 FPS.
- Documentación: `docs/CONNECTOMA-C-ELEGANS.md` (mapeos, modelo LIF,
  procedencia y simplificaciones honestas) y `docs/FASE-2-DROSOPHILA.md`
  (fuentes Janelia MaleCNS/FlyWire/neuPrint, reducción offline prevista con
  `neuprint-python` hacia un JSON de 10-30 MB, checklist de integración).

## [1.0.0] — 2026-10-17

Primera versión pública completa.

### Añadido

**Motor de simulación** (`src/lib/sim/`)
- Red neuronal por criatura con topología 12 → 8 → 3 (131 pesos sinápticos
  heredables): sensores (energía, confort térmico, luz, humedad, dirección y
  cercanía de comida/veneno, multitud) → neuronas ocultas → motores
  (girar, avanzar, impulso reproductivo).
- Dos especies con nichos ecológicos distintos:
  - **Moscón** (volador, diurno, visión dependiente de la luz, dieta fruta + azúcar).
  - **Gusano** (rastrero, quimiorreceptor, nocturno, dieta detritos + azúcar).
  - Competencia directa por el azúcar compartida.
- Clima dinámico en vivo: temperatura 0–45 °C (el frío reduce el "voltaje
  neural"; el calor acelera el metabolismo y puede ser mortal), humedad/lluvia
  0–100 % (favorece detritos, entorpece el vuelo), ciclo día/noche configurable
  y abundancia de comida y veneno ajustables.
- Evolución por reproducción asexual con mutación gaussiana de los pesos
  sinápticos y de rasgos heredables (velocidad máxima y rango sensorial),
  con generaciones, linajes y aptitud.
- Ecología con reciclaje de energía: los cadáveres se descomponen en detritos.
- Grilla espacial uniforme (celdas de 130 px) para consultas de vecinos,
  comida y veneno a 30 ticks/s con velocidades ×0.5 a ×8.

**Interfaz** (`src/components/sim/`, `src/app/page.tsx`)
- Canvas 2D con letterbox responsivo, ciclo día/noche con tintes, lluvia
  procedural, estelas de vuelo, gusanos segmentados y anillo de selección
  con rango sensorial visible.
- HUD en vivo: día/fase solar, temperatura ambiente, humedad, poblaciones,
  generación máxima y avisos de extinción.
- Pestaña **Ambiente**: 6 presets climáticos (Templado, Ola de calor, Monzón,
  Era de hielo, Banquete, Jardín tóxico) + 5 sliders en tiempo real.
- Pestaña **Inspector**: clic en cualquier criatura para ver su ficha
  (energía, edad, velocidad, visión, temperatura corporal, descendencia)
  y su **red neuronal iluminándose en vivo**.
- Pestaña **Datos**: 8 KPIs + 3 gráficas recharts (población, velocidad media
  y generación media a lo largo del tiempo) con reintroducción de especies
  extintas.
- Pestaña **Museo** (backend): guardar las élites evolucionadas en SQLite y
  sembrarlas en cualquier simulación.
- Controles: pausa, velocidad ×0.5–×8, reinicio con confirmación y tema
  claro/oscuro (next-themes).

**Backend / API** (`src/app/api/records/`, `prisma/schema.prisma`)
- Modelo `EvolutionRecord` en Prisma (SQLite) con cerebros serializados.
- `GET /api/records` — lista los últimos 60 registros con cerebros parseados.
- `POST /api/records` — valida con zod y guarda una élite.
- `DELETE /api/records/[id]` — elimina un registro (params asíncronos de Next.js 16).

**Despliegue** (`.github/workflows/deploy-pages.yml`, `next.config.ts`)
- Publicación automática a **GitHub Pages** al subir una etiqueta `v*`:
  build estático (`output: "export"` con Turbopack) con `basePath` calculado
  según el repositorio, despliegue con `actions/deploy-pages` y creación de
  la **Release** con `gh` (notas autogeneradas + sitio compilado como
  archivo adjunto `.zip`).
- **Modo estático del Museo de la Evolución**: sin backend, los linajes
  élite se guardan en `localStorage` del visitante (degradación elegante con
  el mismo contrato `EvolutionRecordDTO`); la simulación corre íntegra en
  el cliente.
- `bun run build:static` para reproducir localmente el build de Pages
  (variables `NEXT_OUTPUT`, `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_STATIC_MODE`,
  `NEXT_DIST_DIR`).

**Documentación**
- README con guía de instalación, uso y experimentos sugeridos.
- `docs/ARQUITECTURA.md`: especificación técnica completa del motor.
- `docs/DESARROLLO.md`: cómo se creó el proyecto (proceso multiagente).
- `docs/worklog.md`: bitácora de trabajo detallada por tarea.
- Capturas de pantalla en `docs/screenshots/`.

### Verificado
- ESLint sin errores ni advertencias.
- Verificación E2E en navegador real: render, clics de selección, presets
  climáticos (una ola de calor redujo las moscas de ~40 a 9), gráficas en
  vivo y flujo completo del Museo (guardar → sembrar → eliminar).
- Evolución observada hasta la generación 17 en ~10 minutos de simulación
  (560 nacimientos / 579 muertes).

[1.1.1]: https://github.com/juanruiz85/neuroevo/releases/tag/v1.1.1
[1.1.0]: https://github.com/juanruiz85/neuroevo/releases/tag/v1.1.0
[1.0.0]: https://github.com/juanruiz85/neuroevo/releases/tag/v1.0.0
