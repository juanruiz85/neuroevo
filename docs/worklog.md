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
