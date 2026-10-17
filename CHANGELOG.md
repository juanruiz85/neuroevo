# Changelog

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
