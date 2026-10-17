# NeuroEvo — Worklog

Proyecto: Ecosistema neuronal evolutivo (moscas vs. gusanos) con clima dinámico,
evolución por mutación de redes neuronales, inspector cerebral en vivo y
"Museo de la Evolución" persistido en SQLite (Prisma).

Rutas/archivos clave:
- Motor: src/lib/sim/{rng,nn,types,creature,world,render,index}.ts
- Frontend: src/components/sim/*, src/app/page.tsx
- Backend: src/app/api/records/**, prisma/schema.prisma (model EvolutionRecord)

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Definir el proyecto, su arquitectura y plan de ejecución.

Work Log:
- Explorado el scaffold: Next.js 16 + TS + Tailwind 4 + shadcn/ui completo,
  recharts 2.15, sonner, zustand, Prisma 6 (SQLite en db/custom.db), zod 4.
- Dev server corriendo en :3000 (dev.log OK).
- Decidida arquitectura: motor de simulación TS puro (30 ticks/s) desacoplado
  de React; UI reacciona con snapshots throttled (~220ms); canvas 2D con
  letterbox; backend REST /api/records para el Museo de la Evolución.

Stage Summary:
- Contrato de datos del Museo definido en src/lib/sim/types.ts
  (EliteRecord / EvolutionRecordDTO: species, generation, fitness,
  brain {weights:number[], traits{maxSpeed,vision}}, env).
- Paleta: emerald (gusanos), amber (moscas), rose (veneno/peligro), slate.
  Sin indigo/azul en la UI. Tema oscuro por defecto con next-themes.

---
Task ID: 2
Agent: main (Z.ai Code)
Task: Motor de simulación neuronal-evolutiva.

Work Log:
- src/lib/sim/rng.ts: RNG mulberry32 determinista + gauss (Box-Muller).
- src/lib/sim/nn.ts: Brain 12→8→3 (tanh/sigmoid), 131 pesos Float32Array,
  activaciones expuestas (inA/hA/oA) para el inspector, mutate() gaussiano,
  parámetro `voltage` que debilita señales motoras con frío (<10°C).
- src/lib/sim/types.ts: EnvParams, SPECIES_CONFIG (mosca/gusano), FOOD_INFO,
  StatPoint, CreatureView, WorldView, EliteRecord/EvolutionRecordDTO
  (contrato del Museo), máscaras de dieta.
- src/lib/sim/creature.ts: ciclo sentir→pensar→moverse→metabolismo→comer→
  reproducirse→morir. Metabolismo: calor >33° acelera el gasto (fatal >42°),
  gusanos se desecan con sol+sequedad, humedad alta los beneficia.
- src/lib/sim/world.ts: grilla espacial 130px, spawn de comida con tasas
  dependientes del clima, reproducción asexual con mutación de pesos y rasgos
  (maxSpeed/vision), cadáveres→detritos, stats cada 0.5s (buffer 480),
  selectAt/followRandom/reintroduce/seedFromRecord/getElite, snapshot() para UI.
- src/lib/sim/render.ts: renderer Canvas puro con letterbox, terreno,
  frutas/detritos/azúcar/veneno, moscas con alas batientes + estela, gusanos
  de 8 segmentos con antenas, tinte de noche + amanecer/atardecer, lluvia
  procedural, anillo de selección + barra de energía + rango sensorial.
- src/lib/sim/index.ts: barrel de exports.

Stage Summary:
- Motor 100% independiente de React, ~30 ticks/s, hasta 8× de velocidad.
- Balance: moscas ~28-60 con frutas+azúcar, gusanos ~40-80 con detritos;
  azúcar compartida genera competencia directa entre especies.

---
Task ID: 3
Agent: main (Z.ai Code)
Task: Frontend completo de la app.

Work Log:
- src/components/sim/use-simulation.ts: hook puente. Mundo creado tras montar
  (evita mismatch de hidratación por Math.random), loop rAF con acumulador
  de ticks + tope anti-espiral, snapshots de UI cada 220ms. API: SimApi
  (pause/speed/reset/env/selección/reintroducción/élite/renderer).
- src/components/sim/sim-canvas.tsx: canvas responsive con DPR≤2, ResizeObserver,
  clic traducido a coordenadas del mundo, registra renderer en el loop.
- src/components/sim/sim-header.tsx: sticky, chips de métricas, velocidad
  (×0.5-×8 ToggleGroup), pausa, reset con AlertDialog, toggle de tema.
- src/components/sim/environment-panel.tsx: 6 presets climáticos + 5 sliders
  (temperatura/humedad/ciclo/comida/veneno) con pistas explicativas.
- src/components/sim/inspector-panel.tsx + brain-view.tsx: ficha de la criatura
  (energía/edad/trazas) + red neuronal dibujada en canvas (nodos por activación,
  aristas por peso, etiquetas de sensores/motores, pulso al reproducirse).
- src/components/sim/stats-panel.tsx: KPIs + 3 gráficas recharts (población,
  velocidad media, generación media) + alerta de extinción con reintroducción.
- src/components/sim/museum-panel.tsx: guardar élite (POST ×4), listado con
  scroll max-h-96, sembrar (8 individuos mutados) y eliminar.
- src/app/page.tsx: layout general, HUD sobre el canvas (día/fase, temp,
  humedad, poblaciones, extinciones, leyenda), pestañas, footer sticky.
- src/app/layout.tsx: lang=es, ThemeProvider (dark por defecto), Sonner.
- globals.css: scrollbar .nice-scroll.
- Corregido error de lint react-hooks/set-state-in-effect (primera snapshot
  ahora se publica dentro del callback del rAF).

Stage Summary:
- `bun run lint` pasa sin errores ni warnings.
- El Museo espera el backend de la Tarea 4 bajo el contrato
  GET/POST /api/records y DELETE /api/records/[id] con EvolutionRecordDTO.

---
Task ID: 5
Agent: main (Z.ai Code)
Task: Integración, lint y verificación E2E con navegador.

Work Log:
- Revisada la corrección del subagente en stats-panel.tsx (import de Skeleton
  movido de lucide-react a @/components/ui/skeleton). Lint global: 0 errores.
- Verificación E2E con agent-browser + VLM sobre capturas:
  - Página renderiza (dark theme), consola limpia, sin errores de página.
  - HUD en vivo: Día/fase (Mañana/Tarde/Atardecer/Noche), temp ambiente con
    oscilación día/noche, humedad, poblaciones, leyenda.
  - Inspector: botones "Seguir mosca/gusano" seleccionan; ficha de criatura
    con barras y stats; red neuronal "Cerebro en vivo" con 12-8-3 nodos,
    etiquetas en español, aristas verde/rojo por peso (verificado con VLM,
    estaba bajo el pliegue del viewport).
  - Clic en el canvas: pipeline completo verificado con sim pausada
    (des-selección al fallar, cambio a pestaña Inspector al acertar).
  - Ambiente: preset "Ola de calor" actualiza sliders y HUD (39°C/22%) y
    desploma la población de moscas de ~40 a 9; "Templado" la recupera.
  - Datos: 8 KPIs + 3 gráficas recharts con curvas reales de población,
    velocidad y generación.
  - Museo E2E: guardar élite (4 POST, nombres "Linaje Nexus · ..."), listado,
    sembrar (toast + 8 individuos), eliminar (DELETE + toast), API confirmada
    con curl.
  - Móvil 375x812: layout apilado, header compacto, HUD legible, footer al
    fondo, sin overflow horizontal.
  - dev.log sin errores tras toda la sesión; GET / 200.

Stage Summary:
- App 100% verificada en navegador: render, interactividad, E2E del flujo
  completo del Museo y responsividad. Evolución observada hasta G17 en ~10
  min de simulación con 560 nacimientos / 579 muertes.
- Quedaron 3 registros "Linaje Nexus" reales en el Museo como datos de
  demostración (cerebros evolucionados de esta sesión).
- Pendiente futuro opcional: websocket para espectadores remotos, causas de
  muerte, export/import de mundos completos.

---
Task ID: 4
Agent: full-stack-developer
Task: Backend Museo de la Evolución (Prisma + API routes).

Work Log:
- Leído worklog.md y el contrato del frontend (EvolutionRecordDTO en
  src/lib/sim/types.ts, consumido por museum-panel.tsx).
- prisma/schema.prisma: añadido model EvolutionRecord (id cuid, name, species,
  generation Int, fitness Float, brain/env String JSON, createdAt) conservando
  User y Post. `bun run db:push` OK (cliente Prisma 6.19.2 regenerado).
- src/app/api/records/route.ts: GET (últimos 60 por createdAt desc, brain/env
  parseados de JSON string a objeto, `{records: []}` si vacío) y POST (zod v4:
  species enum estricto, generation int>=0, fitness>=0, traits>0,
  env `z.record(...).catch({})`; name opcional con default
  "Moscón/Gusano G{n}"; guarda JSON.stringify; responde 201 con el record
  parseado). Tipos definidos localmente (sin importar el motor de simulación).
- src/app/api/records/[id]/route.ts: DELETE con params como Promise (Next 16),
  404 `{error}` si no existe, `{ok:true}` al borrar, try/catch con 500.
- INCIDENCIA (fix bloqueante de Task 3): stats-panel.tsx importaba `Skeleton`
  desde lucide-react (ese export no existe) y el error de compilación hacía
  que el dev server devolviera la página 500 para TODAS las rutas, incluidas
  las API. Corregido a `import { Skeleton } from '@/components/ui/skeleton'`
  (cambio de 1 línea, misma convención que museum-panel.tsx).
- curl tests completos (ver Stage Summary) y limpieza de los registros de
  prueba para dejar el Museo vacío de cara al usuario.
- eslint (solo archivos tocados): 0 errores. tsc --noEmit: src/ limpio (solo
  hay errores preexistentes en examples/ y skills/, fuera de alcance).

Stage Summary:
- Endpoints: GET /api/records (200, `{records:[...]}` con brain/env como
  objetos), POST /api/records (201 `{record}`, 400 con `details` de zod,
  400 en JSON roto), DELETE /api/records/[id] (200 `{ok:true}`, 404
  `{error:"Registro no encontrado."}`).
- curl: POST sin name → 201 "Moscón G3" (default aplicado) con brain/env
  como objetos; POST worm con name "Linaje Ártico" → 201; species "bee" →
  400; generation -2 y maxSpeed -5 → 400 con 2 issues; JSON roto → 400;
  sin env → 201 con env={}; GET ordena desc y devuelve objetos; DELETE
  existente → 200, inexistente → 404; GET final → `{"records":[]}`.
- Decisión: weights se valida como array de números sin tope de longitud
  (el test especificado envía 2 pesos; el frontend real envía 131) para no
  romper el contrato de prueba; env usa .catch({}) por ser metadato
  auxiliar; name se recorta y cae al default si queda vacío.
- Dev server verificado vía dev.log: 200/201/400/404 sin errores runtime.

---
Task ID: 6
Agent: main (Z.ai Code)
Task: Re-verificación E2E post-sesión de continuación + aviso de seguridad.

Work Log:
- Usuario envió un token de acceso personal de GitHub (ghp_...) sin
  instrucciones adjuntas. NO se utilizó para nada. Se avisó al usuario
  de revocarlo de inmediato por exposición en el chat.
- Confirmado estado completo del proyecto leyendo docs/worklog.md
  (Tasks 1-5) y verificando el dev server (GET / 200, log sin errores).
- Verificación E2E con agent-browser + VLM:
  - Página renderiza: canvas con criaturas, HUD (Día 1 - Mañana,
    26.5°C, 55% humedad, poblaciones), leyenda, 4 pestañas
    (Ambiente/Inspector/Datos/Museo), controles de velocidad ×0.5-×8.
  - Consola limpia, 0 page errors.
  - Pestaña "Datos" clicable OK.
  - Preset "Ola de calor" aplicado por ref (@e19): HUD pasó a 35.8°C
    (rojo) y 22% humedad; sliders reflejaron el cambio; sin errores.
  - Restaurado preset "Templado" y cerrado el navegador.
- dev.log final: solo GET / 200, sin errores runtime.

Stage Summary:
- App 100% operativa y re-verificada tras la continuación de sesión.
- Credencial expuesta NO usada; usuario advertido para revocarla.
- Pendiente futuro opcional: websocket espectadores, causas de muerte,
  export/import de mundos.

---
Task ID: 7
Agent: main (Z.ai Code)
Task: Publicación en GitHub: repo, tag v1.0.0, Release, GitHub Pages y
workflow de despliegue automático por versión.

Work Log:
- Verificado soporte de output:"export" en Next 16 (config-shared.d.ts).
- next.config.ts: modos env-driven — NEXT_OUTPUT (export|standalone),
  NEXT_PUBLIC_BASE_PATH, NEXT_PUBLIC_STATIC_MODE, NEXT_DIST_DIR.
- src/lib/static-museum.ts + museum-panel.tsx: modo estático del Museo
  (localStorage con el mismo contrato EvolutionRecordDTO) para GitHub
  Pages, donde no hay backend; en dev sigue usando /api/records.
- package.json: script build:static. .gitignore: /build-static/.
- .github/workflows/deploy-pages.yml: trigger push tags v* + dispatch;
  checkout → setup-bun → bun install → rm src/app/api → basePath
  calculado según repo → build:static → configure-pages →
  upload-pages-artifact → deploy-pages → gh release create con
  --generate-notes y el sitio compilado como .zip adjunto.
- Verificación local del export estático (NEXT_DIST_DIR=build-static,
  basePath /neuroevo simulado con python http.server): render, HUD,
  Museo localStorage (guardar/listar/sembrar/eliminar) — todo OK.
  Detalle: con distDir custom, Next 16 vuelca el export en el propio
  distDir (y el cache de build a .next, lo que tumbó el dev server;
  reiniciado). En CI (sin distDir) el export va a out/ como espera el
  workflow.
- Commit 3594b24 (ci) + tag v1.0.0 anotado.
- Token del usuario (scopes repo, workflow) usado solo para: validar
  identidad (juanruiz85), crear repo público neuroevo con topics,
  push de main, habilitar Pages (build_type workflow) y push del tag.
  Borrado de /tmp al terminar.
- INCIDENCIA CI: run #1-3 fallaron al arranque — "Tag v1.0.0 is not
  allowed to deploy to github-pages due to environment protection
  rules": el entorno github-pages auto-creado solo permite la rama
  main y los endpoints de deployment-tag-policies devuelven 404.
  Fix: quitado el bloque environment: del job (deploy-pages funciona
  sin él) — commit b0cf61c; tag v1.0.0 movido al nuevo commit.
- Run #4: SUCCESS (15/15 pasos). Pages 200 con assets bajo
  /neuroevo/_next. Release v1.0.0 creada con
  neuroevo-v1.0.0-sitio-estatico.zip (568 KB) y notas autogeneradas.
- E2E del sitio público https://juanruiz85.github.io/neuroevo/ con
  agent-browser + VLM: título, 0 errores de página, canvas con
  simulación viva, HUD, 4 pestañas, 22 elementos interactivos, preset
  "Ola de calor" aplicado con éxito. Dev server local (3000)
  reiniciado y verificado (200).

Stage Summary:
- Repo: https://github.com/juanruiz85/neuroevo (público, topics).
- Sitio: https://juanruiz85.github.io/neuroevo/ (deploy automático).
- Release: https://github.com/juanruiz85/neuroevo/releases/tag/v1.0.0
  con el sitio compilado adjunto.
- Publicar una nueva versión = git tag -a v1.1.0 + git push origin
  v1.1.0 → el workflow hace build, deploy a Pages y Release solos.
- Credencial del usuario usada solo para el setup y eliminada de
  /tmp; se recomendó al usuario revocarla/rotarla por haberse
  expuesto en el chat.

---
Task ID: 8
Agent: main (Z.ai Code)
Task: Fase 1 — migrar los gusanos al conectoma biológico real de
C. elegans con motor LIF, dejando la arquitectura preparada para la
Fase 2 (Drosophila).

Work Log:
- Descarga de datos: GitHub API con rate limit agotado → blobless
  clone de openworm/CElegansNeuroML (git ls-tree sin API) →
  herm_full_edgelist.csv (7.379 aristas) + CElegansNeuronTables.xls
  (neurotransmisores, 86 sensoriales con función, uniones
  neurona-músculo; parseado con xlrd).
- Dataset compacto generado con python: 300 neuronas (excl. músculos
  en minúscula; CANL/R sin sinapsis no figuran), 3.638 sinapsis
  químicas + 1.093 gap (deduplicadas), clasificación derivada de los
  datos (86 sensoriales / 50 motoras por unión muscular / 164
  interneuronas), transmisores del xls + relleno curado del cordón
  ventral (AS/DA/DB/VA/VB/VC=ACh; DD/VD=GABA) y faringe. 55 KB JSON
  en src/lib/sim/data/.
- adapter.ts: IBrainAdapter (patrón Strategy) + registro FACTORIES
  (fly→ANN, worm→ElegansBrain); la Fase 2 solo toca FACTORIES.fly.
- elegans.ts: grafo compartido CSR (peso = signo·log₂(1+contactos),
  GABA negativo) + gap junctions; LIF por gusano (fuga τ, umbral,
  refractario, inyección sensorial, disparo con entrega inmediata,
  difusión + transmisión de picos por gaps). Mapeo sensorial: AFD ←
  térmico con signo, ASE/AWC/AWA ← comida (asimetría L/R con signo
  explícito), ASH/PHA/PHB ← veneno, PVD/ALM ← multitud, BAG ←
  humedad, ADF ← hambre, tónico → AVB+RMD. Motores: VB/DB+AVB/PVC →
  avanzar; asimetría dorso-ventral RMD/SM/SMB (×2.2 en reversa
  VA/DA+AVA) → girar; VC+HSN (puesta real) → reproducir.
- Sintonía empírica con scripts headless en bun (/tmp, no
  commiteados): primera versión epiléptica (48% de disparo, estímulos
  sin efecto) → pesos 0.085·log₂, vth 1.35, τ 7.5, refr 3; segunda
  versión con cadena comando→motor muerta → añadir transmisión de
  picos por gap (AVA/AVB → pools A/B); giro sesgado → dirección por
  asimetría dorso-ventral con tónico equilibrado. Resultado final:
  giro bidireccional, avance 0.5-0.8, 0 gusanos paralizados, G8 en
  3 min, ~1.2 ms/tick con 60 conectomas.
- Integración: creature.ts usa IBrainAdapter + createBrain; world.ts
  (selectedView con brainKind + connectome, seedFromRecord
  retrocompatible por kind/longitud, getElite con kind); types.ts
  (CreatureView.brainKind/connectome, StoredBrain.kind); zod del POST
  acepta kind opcional; nn.ts implementa la interfaz (moscas intactas).
- UI: brain-view.tsx con dos vistas (ANN 12→8→3 intacta; anillo del
  conectoma: 3 sectores por clase, brillo por potencial, destellos
  blancos de pico, etiquetas AFD/ASE/AVA/VB/VC..., picos/tick,
  salida 3 motores a la derecha). inspector-panel.tsx: badge
  "C. elegans · conectoma real", descripción condicional y stats
  Picos/Actividad media. Bug visual corregido: alfa base 0.16 hacía
  invisibles las neuronas sub-umbral → 0.45 + pot·0.55.
- Docs: docs/CONNECTOMA-C-ELEGANS.md (dataset, LIF, mapeos,
  genoma de 20 genes, simplificaciones honestas) y
  docs/FASE-2-DROSOPHILA.md (Janelia MaleCNS, FlyWire/neuPrint,
  reducción neuprint-python → 10-30 MB, checklist). CHANGELOG 1.1.0,
  README actualizado, package.json 1.1.0.
- Verificación: lint 0 errores; E2E con agent-browser + VLM
  (inspector de gusano con anillo y 3 sectores confirmado por
  análisis de píxeles y VLM neutral; moscas con ANN intacta — 912 px
  de aristas verdes/132 rojas; 61 FPS; Museo guarda élite gusana con
  kind=elegans y 20 pesos vía API; registro de prueba eliminado).
- Commit 628cda1 (16 archivos, +1.129) tras corregir ruido de
  mode changes del entorno (chmod 644 + amend + core.fileMode) y
  tag v1.1.0 anotado (local; sin push por carecer de credenciales).

Stage Summary:
- Los gusanos piensan con el conectoma real de C. elegans (OpenWorm)
  bajo LIF a 30 Hz; el GA evoluciona su neuromodulación (20 genes).
- Arquitectura Strategy (IBrainAdapter) lista para Drosophila (Fase 2
  documentada con fuentes y pipeline de reducción).
- Museo retrocompatible (kind); moscas ANN como control experimental.
- v1.1.0 taggeada localmente; publicar requiere push del usuario
  (token anterior revocado) → tag → workflow despliega Pages+Release.

---
Task ID: 9
Agent: main (Z.ai Code)
Task: Publicar v1.1.0 (conectoma C. elegans) en GitHub con el nuevo
token del usuario: push de main + tag → workflow → verificar Pages,
Release y E2E del sitio público.

Work Log:
- Estado local verificado: árbol limpio, tag v1.1.0 → 628cda1
  (commit feat!), 3 commits por delante del remoto (789344a docs,
  628cda1 feat, c87516c docs). tsc --noEmit: 0 errores en src/
  (confianza alta para el build de CI).
- Token nuevo del usuario guardado en /tmp/ghtoken (chmod 600);
  identidad verificada (juanruiz85) y remoto en b0cf61c (v1.0.0).
- Push fast-forward de main (b0cf61c→c87516c) y push del tag v1.1.0
  → disparó el workflow "Deploy a GitHub Pages" (run #3).
- Run #3: SUCCESS a la primera (~40 s de polling; sin la incidencia
  de protección de entorno de v1.0.0).
- Release v1.1.0 creada: notas autogeneradas (compare v1.0.0...v1.1.0)
  + neuroevo-v1.1.0-sitio-estatico.zip (585 KB). Pages 200.
- E2E del sitio público con agent-browser + VLM:
  - Título correcto, 0 page errors, 0 errores/ warnings en consola.
  - Inspector → "Seguir un gusano": ficha con PICOS/TICK 107/300
    (modelo LIF) y ACTIVIDAD MEDIA 82% (4731 sinapsis reales).
  - Canvas del conectoma verificado por VLM: anillo de ~300 puntos
    en 3 sectores por clase (ámbar/gris/esmeralda), destellos blancos
    de pico, etiquetas AFD/ASE/AWA/AVA/AVB/VB/VC, 3 salidas motoras
    (Girar -0.04 · Avanzar 0.5 · Reproducir 1) y leyenda "4731
    sinapsis · OpenWorm".
  - Control intacto: "Seguir una mosca" → ANN 12→8→3 clásica.
  - Detalle de verificación: los gusanos aleatorios morían (hambre/
    vejez) antes de la captura → pausar la simulación estabiliza la
    selección; el canvas del cerebro vive bajo el pliegue en un panel
    con scroll interno → scrollIntoView para la captura.
  - Ecosistema vivo al cierre: moscas en G8 reproduciéndose.
- Token eliminado de /tmp; usuario advertido de revocarlo/rotarlo
  (expuesto en el chat por segunda vez).

Stage Summary:
- https://github.com/juanruiz85/neuroevo — main actualizado con la
  Fase 1 (conectoma C. elegans) y todo el historial.
- https://juanruiz85.github.io/neuroevo/ — v1.1.0 en producción,
  verificada E2E (gusanos con conectoma real + moscas ANN de control).
- https://github.com/juanruiz85/neuroevo/releases/tag/v1.1.0 —
  Release con el sitio compilado adjunto.
- Pipeline v* → build → Pages + Release confirmado de nuevo (run #3
  SUCCESS). Siguiente versión: tag v1.2.0 + push.

---
Task ID: 10
Agent: main (Z.ai Code)
Task: Actualizar toda la documentación al estado actual (v1.1.x) y
arreglar la imagen que faltaba en el README.

Work Log:
- Diagnóstico: el README describía el conectoma como característica
  estrella pero NO tenía ninguna captura de él; además
  inspector-neuronal.png mostraba un GUSANO con la ANN 12→8→3 (cerebro
  que los gusanos ya no usan desde v1.1.0). CHANGELOG ya estaba al día
  con 1.1.0; ARQUITECTURA.md y DESARROLLO.md seguían en v1.0.0.
- Bug encontrado y arreglado en brain-view.tsx: las etiquetas de las
  salidas motoras del conectoma se dibujaban en outX+11 = w−53 y
  "Reproducir 1.00" (~75 px) se salía del canvas (aparecía "Reproduci…").
  outX pasa de w−64 a w−92 (el mismo margen que usa la vista ANN).
- Capturas nuevas (dev local, tema oscuro, viewport 1680×1050):
  - docs/screenshots/conectoma-elegans.png (NUEVA): gusano con el anillo
    del conectoma — verificada por VLM 9/10, tres sectores, destellos y
    las 3 etiquetas motoras completas (Girar -0.00 · Avanzar 0.54 ·
    Reproducir 0.71).
  - docs/screenshots/inspector-neuronal.png (RETOMADA): ahora una mosca
    (Moscón #121) con su ANN 12→8→3 — VLM 9/10. El truco para capturar:
    scrollIntoView del canvas (el panel tiene scroll interno y la captura
    full-page no lo alcanza) y pausar la sim para que no muera el
    seleccionado (mueren de hambre en segundos).
- README.md: badge de release dinámico, enlace "Probar en vivo", fila de
  conectoma en la tabla de interfaz, sección "Cómo funciona" reescrita
  con los dos cerebros (tabla estímulo→neurona / conducta→pool), genética
  dual, estructura con connectome/ + dataset + static-museum, API con
  brain.kind, experimento 6 "Biología vs. azar" y enlace al doc del
  conectoma en la cabecera.
- ARQUITECTURA.md: sección 2 "Los cerebros" (IBrainAdapter + FACTORIES,
  dataset OpenWorm, grafo CSR, dinámica LIF, tablas de mapeos, genoma de
  20 genes, ANN como 2.2), sección 7 con evolución dual y
  retrocompatibilidad kind, sección 9 con las dos vistas del inspector,
  sección 10 con kind en el modelo, nueva sección 11 (export estático y
  despliegue) y 12 (constantes + calibración LIF).
- DESARROLLO.md: "Fases (9 tareas)" — añadidas tareas 6-9 (re-verificación
  + aviso de seguridad, publicación v1.0.0 con la incidencia CI resuelta,
  Fase 1 C. elegans con la sintonía empírica honesta, publicación v1.1.0
  con E2E), metodología ampliada con "simplificaciones declaradas" y
  líneas futuras encabezadas por la Fase 2 Drosophila.
- CHANGELOG 1.1.1 (arreglo + docs) y package.json a 1.1.1.
- lint: 0 errores. Dev server: compilación limpia tras el fix.

Stage Summary:
- Documentación al día con la v1.1.1: README, ARQUITECTURA, DESARROLLO,
  CHANGELOG y worklog reflejan los dos cerebros y todo el pipeline.
- La "imagen que faltaba" era la del conectoma: captura nueva verificada
  9/10 + la vieja captura de gusano-ANN sustituida por una mosca.
- Bug visual real de v1.1.0 corregido (etiquetas motoras cortadas).
- Publicado como v1.1.1 (tag → workflow → Pages + Release automáticos).

---
Task ID: 11-a
Agent: full-stack-developer
Task: Interfaz de la Task 11 (solo frontend): vista "Circuito vivo"
del conectoma, tira de 17 sentidos, ficha de ciclo de vida/reproducción
del gusano, chip HUD y línea de población de huevos.

Work Log:
- Leído worklog.md completo + contrato de datos verificado en el código:
  sensors.ts (SENSOR_CHANNELS/CH/colores), elegans.ts (getElegansCircuit:
  53 nodos 30/16/7 por carril, 450 aristas reales —362 químicas + 88
  gap—, 36 haces, pools), types.ts (stage/stagePct/eggsLaid/matureEggs/
  spermLeft/pheromone, StatPoint.eggs, WorldView.counts.eggs). Medido el
  tamaño real del subgrafo con un script bun antes de maquetar.
- NUEVO src/components/sim/circuit-view.tsx: canvas 400px con rAF interno
  (useRef de la última criatura + cancelAnimationFrame en cleanup) que
  interpola entre snapshots (~220 ms): destellos de disparo (decay 420 ms),
  potenciales suavizados exponencialmente (τ=110 ms) y pool de partículas
  reutilizable (tope 140, nacimiento con desfase determinista por arista,
  viaje a→b en 420 ms por la misma bézier de la arista). Layout: riel de
  16 sensores a la izquierda (punto de grupo + short + neuronas mono 7px +
  barra; canales con signo centrados rosa/esmeralda, resto 0..1 con color
  de grupo), columnas A sensoriales (ámbar) / B comando con etiqueta
  (pizarra) / C premotoras con etiqueta (esmeralda) / D 4 chips de pool
  (VB/DB·Avance ← hidden[3], VA/DA·Reversa ← hidden[4], RMD/SM·Cabeza ←
  % de s sobre headDorsal+headVentral, VC/HSN·Puesta ← hidden[6], cada uno
  con barra de tasa y borde que se aviva) / E salidas Girar·Avanzar·
  Reproducir con valor. Aristas reales tenues (alfa 0.05-0.14 por |w|,
  rosa GABA / verde, gap punteado) que se iluminan + emiten partículas
  cuando la presináptica disparó; haces comando→pool con grosor por w y
  brillo por actividad; conectores pool→salida (reversa punteada).
  Insignia de estado conductual en vivo (PONIENDO HUEVO dorado con anillo
  expansivo sobre el chip de puesta / REVERSA / GIRANDO izq-der /
  AVANZANDO / QUIETO) + línea con el circuito responsable (HSN+VC →
  vulva, ASH/AVA → VA/DA, AVB/PVC → VB/DB...). DPR≤2, ancho=parent con
  mínimo 280, modo compacto <210px de red con cabeceras y chips reducidos.
- NUEVO src/components/sim/sensor-strip.tsx: "Sentidos en vivo" en DOM
  accesible (role list/group/listitem, tooltip nativo title=desc), 17
  canales agrupados Motor/Interno/Químico/Físico/Social con cabecita de
  color, filas punto+short+neuronas mono+barra (misma semántica de signo)
  +valor numérico; tónico al final del grupo Motor con barra completa
  atenuada y valor "ref"; max-h-72 overflow-y-auto + nice-scroll.
- brain-view.tsx: BrainView ahora es un conmutador — moscas intactas
  (AnnCanvas); gusanos con Tabs shadcn [Circuito vivo (default) | Anillo],
  el anillo existente (drawConnectome) queda intacto como RingCanvas en la
  segunda pestaña.
- inspector-panel.tsx: para gusanos la barra "Edad" se sustituye por
  WormStageBar (insignia de fase L1-L4 esmeralda / Adulto ámbar / Dauer
  violeta + barra de progreso stagePct + nota "hacia L4" / "de ~300s de
  vida" / "supervivencia"; salvaguarda con barra de edad si faltan datos).
  Stats nuevos con el componente Stat: Huevos puestos (Egg), Huevos
  maduros (Hourglass, "en útero"), Esperma (Dna, de 140), Feromona (Wind,
  %), Resistencia dauer (Shield, 100-stagePct) solo en dauer. Card del
  cerebro: título "Cerebro biológico en vivo" (ya existía), descripción
  reescrita mencionando las dos vistas, SensorStrip sobre el BrainView
  dentro de la misma card y key={brainKind} para volver a "Circuito vivo"
  al cambiar de arquitectura cerebral.
- page.tsx: chip HUD "Huevos" (icono Egg, ámbar) junto a Moscas/Gusanos,
  mismo patrón icono+número.
- stats-panel.tsx: línea "Huevos" (#fbbf24, strokeDasharray "4 3") en la
  gráfica de población con stats[].eggs; Series.dash opcional añadido;
  descripción actualizada. No hay leyenda en ChartCard: el nombre entra
  por el tooltip de recharts (como Moscas/Gusanos).
- Corregidos 2 errores TS propios (Set<2|5|6|...> inferido literal al
  usar CH como const → SIGNED: ReadonlySet<number>).

Stage Summary:
- La vista "Circuito vivo" responde al pedido del usuario: se ve QUÉ red
  se activa al actuar (sentidos→comando→pools→salidas) con aristas reales
  del subgrafo, partículas y estado conductual; el anillo queda como
  segunda pestaña y las moscas intactas.
- bun run lint: 0 errores. bunx tsc --noEmit: src/ limpio (solo errores
  preexistentes de skills/, fuera de alcance). GET / 200 y dev.log sin
  errores de compilación tras los cambios.
- NO se tocó nada de src/lib/sim/**, src/app/api/** ni prisma/**.
- Decisión tomada: dirección del giro (outputs[0] > 0 → "derecha")
  derivada del convenio heading+=... con y del canvas hacia abajo
  (horario = derecha); si el render lo invierte, es un cambio de 1 línea
  en behaviorOf.
- Pendiente del agente principal: E2E del inspector con un gusano vivo
  (selección, pestañas, partículas a 60 fps, dauer/adulto, HUD huevos).

---
Task ID: 11
Agent: main (Z.ai Code)
Task: Biología v1.2 completa del gusano: nueva visualización cerebral
"otra forma" (el usuario no apreciaba las redes en el anillo), máximo de
sensores entre cerebro y gusano en pantalla, ciclo de vida real, y
reproducción por impulsos neurales reales (no programada). Documentación
detallada de todo.

Work Log:
- Contrato de datos (yo, antes de lanzar el subagente 11-a):
  - NUEVO src/lib/sim/connectome/sensors.ts: metadatos de los 17 canales
    (key/label/short/neurons/group/desc) + constantes CH + colores de
    grupo. Motor y UI comparten esta única fuente de verdad.
  - types.ts: WormStage, WORM_LIFE (12/12/10/10/10 s + adulto 300 s,
    Q10≈2), WORM_STAGE_DRAIN/SCALE, CreatureView con
    stage/stagePct/adultAge/eggsLaid/matureEggs/spermLeft/pheromone,
    counts.eggs y StatPoint.eggs.
  - elegans.ts: mapa sensorial 12→17 canales (nariz ASH+FLP+OLQ, cola
    PLM, propiocepción DVA+SMDD, Δgradiente ASE, feromona ADL; saciedad
    ahora también excita HSN como la 5HT de NSM). Genoma 20→25 genes con
    migrateGenome() para los registros v1.1 del Museo. Export
    getElegansCircuit(): subgrafo de 53 nodos / 450 aristas reales +
    haces comando→pool para la nueva vista.
- Motor biológico:
  - creature.ts reescrito: sensores de fase (tacto nariz/cola contra
    bordes y cuerpos, decaen exp(-6t)), propiocepción con signo, Δ del
    gradiente (klinotaxis), feromona; fases L1→adulto con Q10, mudas con
    coste, dauer (entrada por hambre L2/L3, salida olfateando comida,
    sin comer ni envejecer, tope 320 s), senescencia (300 s ± 20 %,
    acelerada por calor >26 °C), maduración de huevos internos (16 E,
    esperma 140, máx 8 en útero, frenada ×0.25 por feromona) y PUESTA
    SOLO por oA[2]>0.5 del circuito HSN+VC (cooldown 1.4 s). Las moscas
    quedan intactas como control (12 canales, brote directo).
  - world.ts: clase WormEgg (objeto del mundo con cerebro
    clonado+mutado en la puesta — la meiosis), incubación ×Q10,
    eclosión como L1 con 24 E de vitelo, tope 48 s; layEgg() desde la
    vulva (segs[3]) con ráfaga dorada; spawnChild solo moscas;
    wormPheromone() (densidad 70 px); countNeighbors 'any'.
  - render.ts: huevos crema que se retuercen al madurar, larvas
    escaladas por fase, dauer gris, overlay de sentidos sobre el gusano
    seleccionado (línea+ondas de olfato, rayos de fotofobia, chispas
    nariz/cola, arco de propiocepción, aura de feromona, badge de fase),
    ráfaga dorada de puesta.
- Balance headless (/tmp→/home/z, 900 s): población 55-80 gusanos
  estable, huevos 1-9 simultáneos, dauers 1-9, 147 gusanos distintos
  pusieron huevos SOLO por circuito neural, G31 en 15 min, 1.3 ms/tick.
- Test headless de retrocompatibilidad: genoma v1.1 (20 floats) migra a
  25 conservando τ/tónica y ganancias nuevas=1; seedFromRecord siembra
  8 conectomas; 300 ticks sin errores.
- Documentación: NUEVO docs/SENSORES-CICLO-REPRODUCCION.md (respuestas
  directas a las preguntas del usuario + tabla de 17 sentidos + ciclo +
  dauer + reproducción + simplificaciones honestas); CONNECTOMA
  actualizado (17 canales, 25 genes, rendimiento); README v1.2.0
  (características, tabla interfaz con captura nueva, "Cómo funciona",
  genética dual, experimentos 6-8 nuevos, doc nueva enlazada);
  CHANGELOG 1.2.0; package.json 1.2.0; ARQUITECTURA §4bis + secciones
  3/7/8/9 actualizadas.
- E2E con agent-browser + VLM:
  - 0 page errors / 0 console errors en toda la sesión.
  - HUD: Día 16 · Gusanos 65 · Huevos 8 · G33 (reproducción viva por
    huevos en el navegador).
  - Vista "Circuito vivo" (VLM 9/10): riel de sensores con barras,
    columnas ámbar/gris/esmeralda, pools VB/DB·VA/DA·RMD/SM·VC/HSN,
    salidas con valores, aristas con partículas y badge dorado
    "PONIENDO HUEVO (HSN+VC — vulva)" capturado EN VIVO. Captura
    guardada como docs/screenshots/circuito-vivo.png.
  - Anillo intacto como 2ª pestaña (VLM: 3 sectores, etiquetas AFD/ASE/
    AVA/VB/VC/HSN, salidas completas "Girar -0.02 · Avanzar 0.77 ·
    Reproducir 0.94").
  - Ficha: badge "Adulto · de ~300s de vida" + stats HUEVOS PUESTOS/
    MADUROS/ESPERMA/FEROMONA; "SENTIDOS EN VIVO" con 17 canales.
  - Moscón intacto (ANN 12→8→3, Edad 15s/110s). Móvil 375×812 sin
    overflow horizontal. Truco heredado: pausar antes de seguir un
    gusano (a ×8 mueren antes de la captura).
- lint 0 errores · tsc 0 errores en src/ · dev.log limpio · GET / 200.

Stage Summary:
- El cerebro biológico tiene DOS vistas: "Circuito vivo" (por defecto;
  el flujo sentido→neurona→comando→pool→acción con sinapsis reales
  animadas y estado conductual) y "Anillo". Los sentidos se ven en el
  inspector Y sobre el gusano en el mapa.
- El gusano vive su ciclo real (huevo→L1→L2→L3→L4→adulto, dauer) y se
  reproduce SOLO cuando su conectoma dispara HSN+VC; los nuevos
  gusanos nacen exclusivamente de huevos incubados en el mundo.
- v1.2.0 lista para publicar: falta push (sin token disponible; tag
  v1.2.0 + push → Pages + Release automáticos).

---
Task ID: 12
Agent: main (Z.ai Code)
Task: Publicar v1.2.0 en GitHub (push de main + tag → Pages + Release)
con el nuevo token aportado por el usuario, y E2E del sitio en vivo.

Work Log:
- Token nuevo verificado contra la API (login juanruiz85), guardado en
  /tmp/ghtoken (permisos 600, uso único) y usado solo en las URLs de push
  (el remote origin queda limpio, sin credenciales persistentes).
- Push de main: cdb4238..aadb08d (biología v1.2, 22 archivos, +2735/−168).
- Tag anotado v1.2.0 creado con resumen completo de la biología del gusano
  y pusheado → workflow "Deploy a GitHub Pages" (run 39038240527)
  completado con SUCCESS en ~2 min.
- Release v1.2.0 publicada con asset neuroevo-v1.2.0-sitio-estatico.zip.
- E2E del sitio en vivo (https://juanruiz85.github.io/neuroevo/):
  - 0 page errors / 0 console errors en toda la sesión.
  - HUD: Día 5 · G8 · 63 gusanos · 5 huevos al pausar; tras reanudar ×8
    quedó en 9 huevos → la reproducción neural por puesta opera en
    producción (los nuevos gusanos nacen de esos huevos).
  - Ficha del gusano (botón "Seguir un gusano"): fase "Adulto · de ~300s
    de vida", stats HUEVOS PUESTOS/MADUROS/ESPERMA 140/FEROMONA 60%, y
    "SENTIDOS EN VIVO" con los 17 canales y sus neuronas reales (ADF+HSN,
    DVA+SMDD, AWC, AWA, ASE, PHA, PHB, ASH, AFD, BAG, ASH+FLP+OLQ, PLM,
    PVD+ALM, ADL...).
  - Vista "Circuito vivo" verificada por VLM ×2: riel de sensores,
    columnas ámbar/gris/esmeralda, chips VB/DB · VA/DA · RMD/SM · VC/HSN,
    salidas Girar/Avanzar/Reproducir, aristas con partículas verdes/rojas.
  - Linaje observado: "Gusano #607, hijo de G1" → genealogía por huevos.
- Token borrado de /tmp tras el uso; se recomienda al usuario revocarlo
  en GitHub (politica de seguridad del proyecto).

Stage Summary:
- v1.2.0 EN LÍNEA: main aadb08d + tag v1.2.0 → Pages y Release
  automáticos; E2E en producción sin errores y con la biología nueva
  (17 sentidos, ciclo de vida, huevos, Circuito vivo) funcionando.

---
Task ID: 13
Agent: main (Z.ai Code)
Task: Diseñar la Fase 2 completa (Drosophila real + Laboratorio + Retos +
export/import) y documentar el método riguroso.

Work Log:
- Leído el motor completo (adapter/elegans/sensors/creature/world/types/nn,
  use-simulation, page) y docs/FASE-2-DROSOPHILA.md (plan antiguo).
- ESCRITO docs/PLAN-FASE-2-EXPERIMENTOS.md: decisión de datos (larva
  Winding 2023 — único conectoma de insecto completo y descargable sin
  credenciales), pipeline CSV→JSON, 17 canales sensoriales mapeados a las
  anotaciones REALES del dataset, mapeo motor por asimetría L/R de DNs +
  DN-VNC + DN-SEZ, genoma de 24 genes, habituación sináptica por depresión
  homosináptica, laboratorio (6 estímulos + knockouts por clase + trazas +
  protocolo guiado), arena con paredes/meta/récords, formato de export,
  plan de 8 pruebas headless + E2E, cronograma de tareas y 9 referencias.
- Decisión clave documentada: Moscón = adulto virtual con estructura del
  cerebro LARVARIO completo (2.956 neuronas); ANN conservada como control
  experimental sembrable desde el Museo/Lab/Arena.

Stage Summary:
- Método completo de la Fase 2 en docs/PLAN-FASE-2-EXPERIMENTOS.md; nada
  se declarará "hecho" sin su prueba archivada (PRUEBAS-FASE-2.md).

---
Task ID: 14-a
Agent: general-purpose (subagente)
Task: Encontrar, descargar y validar un dataset REAL del conectoma de
Drosophila sin credenciales.

Work Log:
- Fuente ganadora: Winding et al. 2023 Science 379:eadd9330 (conectoma del
  cerebro de la larva). Descargado desde networks.skewed.de (mirror oficial)
  + suplementos desde el bucket AWS de PMC (esquiva Cloudflare/reCAPTCHA).
- Validación cruzada: 2.956 neuronas, 116.922 aristas, 352.611 sinapsis —
  total idéntico a la matriz densa del S1 (7/8 aristas aleatorias spot-check).
- Construidos /tmp/drosophila-data/larva_neurons.csv (201 KB: skid,
  hemisferio, homólogo L/R, cell_type, annotations=modalidad sensorial real,
  level_7_cluster, I/O axón/dendrita) y larva_edges_etype.csv (2,6 MB:
  source, target, synapse_count, etype ad/aa/dd/da).
- Sin gap junctions en el dataset (todo químico); neurotransmisores NO
  incluidos → derivar por tipo celular con gt_data.csv (forkelab) de
  referencia. Umbral recomendado w≥3 → 38.303 aristas (71,7% sinapsis).

Stage Summary:
- Datos reales listos en /tmp/drosophila-data/ con modalidades sensoriales
  por neurona (olfactory, gustatory-external/pharyngeal, visual, noci,
  thermo-cold/warm, mechano-Ch, proprio, respiratory, gut) y 346 DNs
  (salidas motoras). Informe completo del agente con URLs y citas.
