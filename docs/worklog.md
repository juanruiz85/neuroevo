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
