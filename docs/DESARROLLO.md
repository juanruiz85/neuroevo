# Cómo se creó NeuroEvo

Bitácora del proceso de desarrollo. Este documento resume **cómo** se diseñó y
construyó el proyecto; la bitácora cruda tarea por tarea está en
[worklog.md](worklog.md).

---

## Contexto

NeuroEvo nació de una idea de simulación de vida artificial: un ecosistema
donde moscas y gusanos con **redes neuronales** evolucionan bajo **variables
ambientales dinámicas** (temperatura, humedad, ciclo día/noche, comida y
veneno), con inspector cerebral en vivo y persistencia de élites.

El proyecto se construyó **de una sola sesión** con un enfoque multiagente
sobre un scaffold Next.js 16 + TypeScript + Tailwind 4 + shadcn/ui + Prisma:

- **Agente principal (arquitecto)**: definición, motor de simulación,
  frontend, integración y verificación.
- **Subagente full-stack**: backend del Museo de la Evolución (Prisma +
  API routes), ejecutado en paralelo bajo un contrato de API preacordado.

Todos los agentes compartieron una **bitácora común** (`worklog.md`) con el
formato `Task ID / Agent / Work Log / Stage Summary`, de modo que cada
trabajo se apoyó en las decisiones previas en lugar de pisarlas.

## Fases (5 tareas)

### Tarea 1 — Definición y arquitectura

- Exploración del scaffold disponible (shadcn/ui completo, recharts, sonner,
  zod, Prisma con SQLite).
- Decisiones estructurales clave:
  - **Motor desacoplado de React**: simulación imperativa en TypeScript puro
    con loop propio; React consume snapshots throttled. Motivo: evitar
    re-renders por frame y sostener 60 fps de render con 30 ticks/s de lógica.
  - **Contrato de datos primero**: los tipos `EliteRecord` /
    `EvolutionRecordDTO` se definieron en el motor antes de escribir la UI o
    el backend, lo que permitió construir ambos en paralelo sin fricción.
  - Paleta emerald (gusanos) / amber (moscas) / rose (veneno), tema oscuro
    por defecto, sin azules en la UI.

### Tarea 2 — Motor de simulación (`src/lib/sim/`)

- `rng.ts` (mulberry32 + Box-Muller), `nn.ts` (red 12→8→3 con activaciones
  expuestas para el inspector y el parámetro de voltaje por frío),
  `types.ts` (balance de especies y alimentos), `creature.ts` (ciclo
  sentir→pensar→moverse→metabolizar→comer→reproducirse→morir),
  `world.ts` (grilla espacial, clima, spawn de comida dependiente del
  ambiente, reproducción con mutación, estadísticas, élites) y `render.ts`
  (renderer Canvas puro con capas: terreno, entidades, noche, lluvia,
  selección).

### Tarea 3 — Frontend

- `use-simulation.ts`: puente React ↔ motor (loop rAF con acumulador de
  ticks y tope anti-espiral; mundo creado tras montar para evitar mismatch
  de hidratación por `Math.random`).
- `sim-canvas.tsx` (canvas responsivo con DPR ≤ 2 y clics traducidos a
  coordenadas del mundo), `sim-header.tsx` (controles), los cuatro paneles
  (ambiente con presets, inspector con `brain-view.tsx`, datos con recharts,
  museo) y `page.tsx` (HUD + pestañas + footer sticky).
- Correcciones durante la fase: error de lint
  `react-hooks/set-state-in-effect` (la primera snapshot se publica dentro
  del callback del rAF) y un import erróneo de `Skeleton` (detectado por el
  subagente del backend, ver abajo).

### Tarea 4 — Backend (subagente full-stack-developer)

- Contrato preacordado: `GET/POST /api/records`, `DELETE /api/records/[id]`
  con `EvolutionRecordDTO`. El subagente añadió el modelo `EvolutionRecord`
  a Prisma, aplicó `db:push` y construyó los route handlers con validación
  zod y params asíncronos de Next.js 16.
- Durante sus pruebas con curl descubrió que un import erróneo del frontend
  (`Skeleton` desde lucide-react) provocaba error 500 en toda la app; lo
  corrigió (import correcto desde `@/components/ui/skeleton`) y lo documentó
  en la bitácora — ejemplo del valor del worklog compartido.
- Probó la API de punta a punta: 200/201/400/404 según el caso, con `brain`
  y `env` parseados como objetos.

### Tarea 5 — Verificación E2E

Verificación con navegador real (agent-browser) + análisis visual de
capturas con modelo de visión (VLM):

| Verificación | Resultado |
|---|---|
| Render inicial + consola | Sin errores ni warnings |
| HUD en vivo (día/fase, temp, humedad, poblaciones) | Actualiza a ~4.5 Hz |
| Preset "Ola de calor" | Sliders y HUD cambian (39 °C / 22 %) y las moscas caen de ~40 a 9 |
| Inspector neuronal | Ficha + red 12-8-3 con aristas por peso (verificado visualmente) |
| Clic en el canvas | Pipeline completo probado con la simulación en pausa (des/selección) |
| Gráficas | 3 gráficas recharts con curvas reales |
| Museo E2E | Guardar élite (4 POST) → listar → sembrar (8 individuos) → eliminar |
| Responsivo | 375×812 sin overflow, footer al fondo, HUD legible |
| Evolución | Generación 17 en ~10 min (560 nacimientos / 579 muertes) |
| `bun run lint` | 0 errores, 0 warnings |

Un detalle del proceso: durante la verificación, dos criaturas seguidas
"murieron" durante las pruebas del inspector. En lugar de asumir un bug, se
diagnosticó con la simulación en pausa y se confirmó que era dinámica real
(criaturas con cerebros aleatorios mueren rápido) — el ecosistema funcionaba
mejor de lo esperado.

## Metodología

1. **Frontend primero**: el motor y la UI se construyeron antes que el
   backend, para poder ver resultados temprano.
2. **Contratos antes que implementaciones**: los tipos compartidos
   permitieron paralelizar frontend y backend sin coordinación adicional.
3. **Worklog compartido**: cada agente leyó lo anterior y añadió su sección;
   los errores descubiertos por uno beneficiaron al siguiente.
4. **Verificación honesta**: nada se dio por terminado por compilar; cada
   flujo de usuario se ejercitó en un navegador real y los resultados
   visuales se revisaron con un modelo de visión.

## Líneas futuras

- Causas de muerte registradas (hambre / calor / veneno / vejez).
- Modo espectador remoto vía WebSocket.
- Exportación/importación de mundos completos.
- Especiación: dietas mutables y rasgos adicionales (tamaño, fecundidad).
