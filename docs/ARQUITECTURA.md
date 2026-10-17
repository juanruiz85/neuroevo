# Arquitectura de NeuroEvo

Este documento describe cómo funciona el sistema por dentro: el motor de
simulación, la red neuronal, el modelo de energía, el clima, la evolución, el
renderer y la integración con React/Next.js.

---

## Visión general

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                            │
│                                                             │
│  ┌────────────────────┐        ┌────────────────────────┐  │
│  │   React (UI)       │        │  MOTOR (TS puro)       │  │
│  │                    │ 220ms  │                        │  │
│  │  HUD / paneles     │◄───────│  World.snapshot()      │  │
│  │  Inspector         │snapshot│  · criaturas           │  │
│  │  Gráficas recharts │        │  · alimentos           │  │
│  │  Museo             │───────►│  · clima y evolución   │  │
│  │                    │ acciones│  · estadísticas       │  │
│  │  <SimCanvas/>      │        │                        │  │
│  │   │ registra       │ 60fps  │  World.step(dt) ×30/s  │  │
│  │   ▼                │◄───────│  (loop rAF externo a   │  │
│  │  renderWorld()  ◄──│────────┘   React)               │  │
│  └────────────────────┘        └────────────────────────┘  │
│                                                             │
│            fetch /api/records (Museo de la Evolución)       │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
                 ┌───────────────────────────┐
                 │ Next.js Route Handlers    │
                 │ GET/POST /api/records     │
                 │ DELETE /api/records/[id]  │
                 │ zod + Prisma + SQLite     │
                 └───────────────────────────┘
```

**Principio clave**: el motor (`src/lib/sim/`) no importa React. Vive en un
loop `requestAnimationFrame` propio y expone dos interfaces:

1. `World.snapshot(): WorldView` — estado serializado para la UI (throttle de
   ~220 ms).
2. `renderWorld(ctx, world, viewport, now)` — dibujado del frame actual
   (60 fps).

Así React solo re-renderiza paneles ~4.5 veces/s mientras el canvas corre a
60 fps y la simulación a 30 ticks/s, sin que un sistema frene al otro.

---

## 1. El bucle de simulación

`src/components/sim/use-simulation.ts`

- **Tick fijo** de `1/30 s`. El acumulador convierte el tiempo real en ticks
  según la velocidad (×0.5 a ×8).
- Tope anti-espiral: como máximo `2 × velocidad` ticks por frame; si se
  acumula backlog (pestaña en segundo plano), se descarta.
- El mundo se crea **tras montar** (en `useEffect`) para evitar mismatch de
  hidratación por `Math.random()` durante el SSR.
- Cada ~220 ms se publica `world.snapshot()` a React mediante `setUi`.

## 2. La red neuronal (`src/lib/sim/nn.ts`)

Topología fija **12 → 8 → 3** con activaciones `tanh` (ocultas y giro) y
`sigmoid` (avanzar/reproducir). Los 131 pesos viven en un `Float32Array`
plano con esta distribución:

| Rango | Contenido |
|---|---|
| `[0, 96)` | pesos entrada→oculta (`w1[i·8 + h]`) |
| `[96, 104)` | biases de las 8 ocultas |
| `[104, 128)` | pesos oculta→salida (`w2[h·3 + o]`) |
| `[128, 131)` | biases de las 3 salidas |

### Entradas (sensores)

| # | Sensor | Rango | Notas |
|---|---|---|---|
| 0 | Sesgo | 1 | constante |
| 1 | Energía | 0–1 | `energía / máx` |
| 2 | Confort térmico | −1–1 | `clamp((T − Tóptima)/9)` |
| 3 | Luz | 0–1 | fase del ciclo día/noche |
| 4 | Humedad | 0–1 | |
| 5–7 | Comida | −1–1, 0–1 | `cos/sin` del ángulo relativo + cercanía `1 − d/visión` |
| 8–10 | Veneno | −1–1, 0–1 | ídem |
| 11 | Multitud | 0–1 | vecinos de su especie en 42 px, normalizado /5 |

### Salidas (motores)

| # | Motor | Función | Efecto |
|---|---|---|---|
| 0 | Girar | `tanh × voltaje` | `heading += out × turnRate × dt` |
| 1 | Avanzar | `sigmoid × voltaje` | `speed = out × maxSpeed × clima` |
| 2 | Reproducirse | `sigmoid` | si `> 0.55` y energía > 62 → cría |

### Voltaje neural

Con temperaturas bajo 10 °C, `voltaje ∈ [0.25, 1]` escala las salidas
motoras: las señales se debilitan y las criaturas se adormecen (mecánica
inspirada en la poiquilotermia de los insectos reales).

### Genoma y mutación

El genoma = pesos (131) + 2 rasgos cuantitativos: `maxSpeed` y `vision`.
`Brain.mutate(rng, tasa, sigma)` aplica ruido gaussiano a cada peso con
probabilidad `tasa` (10 % en reproducción natural, 5 % al sembrar del Museo)
y acota los pesos a ±4 para evitar explosiones.

## 3. Las especies (`src/lib/sim/types.ts`)

| Parámetro | 🪰 Mosca | 🪱 Gusano |
|---|---|---|
| Energía inicial | 55 | 60 |
| Velocidad base | 145 px/s | 55 px/s |
| Visión base | 160 px | 125 px |
| Giro máximo | 4.0 rad/s | 2.2 rad/s |
| Gasto base | 1.05 E/s | 0.55 E/s |
| Gasto por moverse | 0.95 E/s | 0.35 E/s |
| Vida máxima | 110 s | 180 s |
| Temperatura óptima | 26 °C | 20 °C |
| Dieta | fruta + azúcar | detritos + azúcar |
| Tope poblacional | 220 | 220 |

La **visión efectiva** depende del clima:

```
mosca:  visión × (0.25 + 0.75·luz) × (1 − 0.35·lluvia)   ← ciega de noche
gusano: visión × (0.9 + humedad·0.3)                     ← la humedad afina el olfato
```

## 4. Clima y metabolismo (`src/lib/sim/world.ts`, `creature.ts`)

- **Luz**: `0.5 + 0.5·sin(2π·t / duraciónCiclo)` — empieza al amanecer.
- **Temperatura ambiente**: `T_clima + (luz − 0.5) · 7` — los mediodías son
  más calurosos, las noches más frías.
- **Lluvia**: intensidad `(humedad − 70)/30` cuando la humedad supera 70 %.
- **Metabolismo** (energía/s):

```
gasto = base + (velocidad/velBase)·movimiento
      + calor:   máx(0, T − 33) × 0.12 (mosca) o 0.06 (gusano)
      + frío:    si T < 8 → gasto × 0.7 (letargo)
      + gusanos: luz · máx(0, T − 24) · (1 − humedad) · 0.16   ← desecación
                 si humedad > 80 → gasto × 0.85
```

- **Reproducción**: energía > 62 **y** (impulso > 0.55 **o** energía > 88).
  La cría recibe 28 E, el progenitor pierde 34 E.

## 5. Alimentos y ecología

| Tipo | Energía | Radio | Vida útil | Tasa base (comida 1×) | Tope |
|---|---|---|---|---|---|
| 🍎 Fruta | +42 | 7 px | 70 s | 0.8/s | 60·comida + 10 |
| 🍂 Detritos | +34 | 5.5 px | 100 s | 0.9/s × (0.55 + humedad·1.1) | 55·comida + 12 |
| 🍬 Azúcar | +26 | 4.5 px | 50 s | 0.16/s | 14 |
| ☠️ Veneno | −32 | 6 px | 45 s | 0.07/s × veneno | 8 + 18·veneno |

- Los detritos aparecen solo en el **suelo** (45 % inferior del mapa).
- El **azúcar** es el recurso compartido que genera competencia directa
  entre especies.
- Al morir, una criatura tiene un 60 % de probabilidad de dejar un detrito
  de 18 E: **la energía se recicla** dentro del ecosistema.

## 6. Grilla espacial

El mundo (1280×840 unidades lógicas) se divide en celdas de **130 px**. Cada
tick se reconstruyen dos grids (alimentos y criaturas) y las consultas
(comida más cercana dentro de la dieta, veneno más cercano, conteo de
vecinos) examinan la celda y sus 8 vecinas. Con ~300 criaturas y ~250
alimentos esto mantiene el costo por tick en el orden de decenas de
miles de operaciones.

## 7. Evolución

```
criatura.energy > 62 y quiere_hijo
   → hijo = clon(ponderado) del cerebro + mutación
   → rasgos: maxSpeed ±6 %, vision ±5 % (clamped a rangos por especie)
   → generación = progenitor + 1   (se rastrea maxGen global)
aptitud = comidas×2 + hijos×4 + edad×0.05   ← criterio del Museo
```

`World.getElite()` toma las 2 mejores criaturas de cada especie por aptitud
y las serializa (pesos redondeados a 3 decimales + rasgos) para el Museo.
`seedFromRecord()` siembra 8 individuos con ese cerebro y una mutación leve
(5 %, σ 0.2), conservando la generación para continuidad de linaje.

## 8. Renderer (`src/lib/sim/render.ts`)

Función pura sobre `CanvasRenderingContext2D`, con **letterbox**: el mundo
lógico se escala al contenedor manteniendo la proporción (los clics se
invierten con `screenToWorld`). Capas, en orden:

1. Fondo del letterbox y terreno con gradiente + zona de suelo (45 %).
2. Alimentos (frutas con hoja, detritos, azúcar centelleante, veneno con glow).
3. Criaturas: moscas con alas batientes y estela; gusanos de 8 segmentos que
   siguen la trayectoria de la cabeza con antenas.
4. Tinte nocturno (`α = (1−luz)·0.52`) + tinte cálido en amanecer/atardecer.
5. Lluvia procedural (partículas deterministas en función del tiempo).
6. Selección: círculo de visión efectiva, anillo pulsante y barra de energía.

## 9. Integración con React

- `useSimulation()` centraliza el loop y expone `SimApi` (acciones +
  snapshot). Las acciones que cambian la selección llaman a `refresh()`
  inmediato para que el inspector responda al instante.
- `<SimCanvas/>` registra su renderer en el loop (nada de React dentro del
  frame) y traduce los clics a coordenadas del mundo; si aciertan, la página
  cambia a la pestaña Inspector automáticamente.
- Los paneles consumen `ui: WorldView` (inmutable por snapshot), así que
  React re-renderiza a ~4.5 Hz como máximo.
- El inspector neuronal (`brain-view.tsx`) redibuja la red en cada snapshot:
  nodos coloreados por activación (verde positivo / rojo negativo), aristas
  por peso×activación, y un anillo dorado cuando el impulso reproductivo
  supera 0.55.

## 10. Datos y API (Museo de la Evolución)

```prisma
model EvolutionRecord {
  id         String   @id @default(cuid())
  name       String
  species    String            // 'fly' | 'worm'
  generation Int      @default(0)
  fitness    Float    @default(0)
  brain      String            // JSON: { weights: number[131], traits }
  env        String            // JSON: clima en el momento del guardado
  createdAt  DateTime @default(now())
}
```

| Método | Ruta | Comportamiento |
|---|---|---|
| `GET` | `/api/records` | Últimos 60 por `createdAt` desc, con `brain`/`env` parseados a objetos. |
| `POST` | `/api/records` | Valida con zod (species enum, pesos numéricos, rasgos > 0); responde 201. |
| `DELETE` | `/api/records/[id]` | Elimina; 404 si no existe. Params asíncronos (Next.js 16). |

## 11. Constantes de balance

Todas las constantes de tuning viven en `src/lib/sim/types.ts`
(`SPECIES_CONFIG`, `FOOD_INFO`, `DEFAULT_ENV`) y en los literales de
`world.ts`/`creature.ts` documentados arriba. Cambiarlas ahí recalibra todo
el ecosistema sin tocar la interfaz.
