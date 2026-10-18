# Arquitectura de NeuroEvo

Este documento describe cómo funciona el sistema por dentro: el motor de
simulación, los **dos cerebros** (conectoma biológico de *C. elegans* y ANN
evolutiva), el modelo de energía, el clima, la evolución, el renderer y la
integración con React/Next.js.

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

## 2. Los cerebros (`connectome/adapter.ts`, `connectome/elegans.ts`, `nn.ts`)

Desde v1.1.0 el ecosistema aloja **dos arquitecturas cerebrales** tras una
interfaz común (patrón Strategy):

```ts
interface IBrainAdapter {
  kind: 'ann' | 'elegans'          // 'drosophila' llegará en la Fase 2
  w: Float32Array                   // genoma plano serializable
  inA / hA / oA: Float32Array       // espejos para el inspector
  forward(inputs, voltage?)         // 30 Hz: 12 canales → [girar, avanzar, reproducir]
  clone(): IBrainAdapter            // reproducción asexual
  mutate(rng, rate?, sigma?)        // algoritmo genético
  connectomeView?(): ConnectomeActivity  // opcional: potenciales + picos
}
```

El registro `FACTORIES` (`createBrain(species, genome?)`) decide qué cerebro
usa cada especie: **mosca → ANN**, **gusano → conectoma de *C. elegans***.
Integrar el conectoma de *Drosophila* (Fase 2, ver
[FASE-2-DROSOPHILA.md](FASE-2-DROSOPHILA.md)) solo toca la fábrica de la mosca;
criatura, mundo, renderer e inspector no cambian.

### 2.1 Conectoma real de *C. elegans* (`connectome/elegans.ts`)

**Dataset** (`data/c_elegans_connectome.json`, 55 KB, procedente de
[OpenWorm](https://github.com/openworm/CElegansNeuroML)): 300 de las 302
neuronas del hermafrodita (CANL/R carecen de sinapsis; incluye las 20
faríngeas), **3.638 sinapsis químicas + 1.093 uniones en gap** (≈25.000
contactos), clasificadas en 86 sensoriales / 164 interneuronas / 50 motoras,
con neurotransmisor por neurona (ACh, GABA, Glu, 5HT, DA, OCT, TA, FMRF).

**Grafo compartido (CSR)**: la estructura sináptica es idéntica para todos
los gusanos (es biología), así que se construye **una sola vez** como arrays
planos (`srcOff`/`dst`/`w`/`txIdx` + `gapA`/`gapB`/`gapW`). El peso químico
es `signo · log₂(1 + contactos)` con GABA negativo; cada individuo solo
porta su estado de membrana (300 `Float32`) y su genoma de 20 genes.

**Dinámica LIF** (integración y disparo con fugas) por tick:

```
v[i] += dt/τ · (−v[i] + I_syn[i] + tónico)
si v[i] > umbral y pasó el refractario → pico:
  entrega inmediata w[j] · escalaTx(presináptico) a cada postsináptica
  (multiplicada por `voltage` — el Q10 térmico: frío extremo debilita
  la transmisión, como en el nemátodo real)
uniones en gap: difusión de potencial cada tick + picos transmitidos
  (así AVA/AVB comandan los pools motores A/B)
```

**Mapeo sensorial** (los 12 canales del mundo → neuronas reales):

| Canal | Neurona(s) | Papel biológico |
|---|---|---|
| Sesgo/tónico | AVB + RMDD | comando de avance + oscilador cefálico |
| Energía (hambre) | ADF | integración del estado interno |
| Térmico (con signo) | **AFD** + AWC | termosensor primario real |
| Luz | ASH | nociceptor polimodal (el nemátodo es fotofóbico) |
| Humedad | BAG | sensor ambiental |
| Comida X/Y/cercanía | ASE + AWC/AWA | gusto + olfato (asimetría L/R) |
| Veneno X/Y/cercanía | PHA/PHB + ASH | fásmidos aversivos + nocicepción |
| Multitud | PVD + ALM | nocicepción mecánica + tacto suave |

**Mapeo motor** (pools reales → las 3 salidas):

| Salida | Pools |
|---|---|
| Avanzar | VB01-11, DB01-07, AVB, PVC (comando B) |
| Girar | asimetría dorso-ventral de RMD/SM/SMB (el vaivén real), ×2.2 en reversa (VA/DA + AVA/AVD/AVE: al retroceder re-orienta) |
| Reproducirse | VC01-06 + HSN (circuito real de la puesta) |

**Genoma evolutivo (20 genes)** — el GA no toca la estructura, evoluciona la
neuromodulación y la excitabilidad, como en el animal:

| Genes | Contenido |
|---|---|
| `[0..11]` | ganancia sensorial por canal |
| `[12..15]` | escalas de transmisión: ACh / GABA / Glu / monoaminas+neuropéptidos |
| `[16..19]` | τ de fuga · umbral de disparo · periodo refractario · impulso tónico |

### 2.2 ANN 12 → 8 → 3 (`nn.ts`, moscas)

Topología fija **12 → 8 → 3** con activaciones `tanh` (ocultas y giro) y
`sigmoid` (avanzar/reproducir). Los 131 pesos viven en un `Float32Array`
plano con esta distribución:

| Rango | Contenido |
|---|---|
| `[0, 96)` | pesos entrada→oculta (`w1[i·8 + h]`) |
| `[96, 104)` | biases de las 8 ocultas |
| `[104, 128)` | pesos oculta→salida (`w2[h·3 + o]`) |
| `[128, 131)` | biases de las 3 salidas |

### 2.3 Conectoma real de *Drosophila* (`connectome/drosophila.ts`, Fase 2)

Las moscas usan el **cerebro larvario completo** (Winding et al. 2023,
*Science*): 2.956 neuronas, 41.977 aristas reales (257.414 sinapsis, 73,0 %),
generado por `scripts/build_drosophila.py` desde los CSV fuente. Misma
familia LIF que el gusano, sin gap junctions (la fuente no los reporta) y
con tres particularidades (ver `docs/CONECTOMA-DROSOPHILA.md`):

- **Tick-stepping 1:2**: cada cerebro alterna integración sensorial barata
  (typed arrays) y disparo completo (fuga leak²) — resolución efectiva
  15 Hz, coste total del ecosistema ~2,5 ms/tick.
- **Mapeo sensorial por modalidad anotada** (18 canales → grupos ORN/GRN/
  GNP/PR/NOC/THc/THw/MEC/PRO/RSP/GUT) y **motor por pools descendentes**
  (DN-VNC → avance; asimetría L/R de DNs → giro; DN-SEZ → puesta).
- **Plasticidad**: depresión homosináptica por uso (mecano/luz) por
  individuo + habituación conductual; knockouts (`setSilenced`) y electrodo
  virtual (`stimulate`) para el Laboratorio.

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

### Genoma y mutación (ANN)

El genoma de la mosca = pesos (131) + 2 rasgos cuantitativos: `maxSpeed` y
`vision`. `Brain.mutate(rng, tasa, sigma)` aplica ruido gaussiano a cada peso
con probabilidad `tasa` (10 % en reproducción natural, 5 % al sembrar del
Museo) y acota los pesos a ±4 para evitar explosiones. El genoma del gusano
son sus 20 genes de neuromodulación (sección 2.1); sus rasgos físicos mutan
igual que los de la mosca.

## 3. Las especies (`src/lib/sim/types.ts`)

| Parámetro | 🪰 Mosca | 🪱 Gusano |
|---|---|---|
| Energía inicial | 55 | 60 |
| Velocidad base | 145 px/s | 55 px/s |
| Visión base | 160 px | 125 px |
| Giro máximo | 4.0 rad/s | 2.2 rad/s |
| Gasto base | 1.05 E/s | 0.55 E/s (× escala de fase) |
| Gasto por moverse | 0.95 E/s | 0.35 E/s (× escala de fase) |
| Vida máxima | 110 s | ciclo completo (ver §4bis) |
| Temperatura óptima | 26 °C | 20 °C |
| Dieta | fruta + azúcar | detritos + azúcar |
| Tope poblacional | 220 | 220 (gusanos + huevos) |

La **visión efectiva** depende del clima (y de la fase en gusanos):

```
mosca:  visión × (0.25 + 0.75·luz) × (1 − 0.35·lluvia)   ← ciega de noche
gusano: visión × (0.9 + humedad·0.3) × (0.55 + 0.45·escala_fase)
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

- **Reproducción de las moscas** (control): energía > 62 **y** (impulso > 0.55
  **o** energía > 88). La cría recibe 28 E, el progenitor pierde 34 E.

## 4bis. Ciclo de vida y reproducción del gusano (v1.2)

Escala **1 s ≈ 1 h real a 20 °C** (`WORM_LIFE` en `types.ts`, lógica en
`creature.ts#tickWormLife` + `world.ts` para los huevos). Desarrollo con
**Q10 ≈ 2**: `dev = 2^((T−20)/10)` limitado a [0.3, 2.6].

| Fase | Duración (20 °C) | Escala cuerpo/metabolismo |
|---|---|---|
| Huevo (objeto del mundo) | 12 s de incubación | — (sin gasto) |
| L1 | 12 s | 45 % / 35 % |
| L2 | 10 s | 60 % / 50 % |
| L3 | 10 s | 72 % / 65 % |
| L4 | 10 s | 86 % / 85 % |
| Adulto | senescencia ~300 s ± 20 % | 100 % / 100 % |
| Dauer | hasta 320 s | 55 % / 5 %, no come, no envejece |

- **Dauer**: hambre (energía < 18) durante 5 s en L2/L3 → fase de
  resistencia; sale como L4 al oler comida 2.5 s.
- **Reproducción neural** (hermafrodita autofecundado): huevos internos si
  energía > 55 y adulto > 6 s; cada uno cuesta 16 E y 1 de esperma (140,
  máx. 8 maduros). La **feromona de conglomerado** (densidad de gusanos en
  70 px, canal 16 → ADL) frena la maduración hasta ×0.25. **La puesta solo
  la dispara el circuito real HSN+VC** (salida "Reproducir" > 0.5, ráfagas
  cada 1.4 s, por la vulva). El huevo contiene el cerebro clonado+mutado y
  eclosiona como L1 con 24 E de vitelo.
- Detalle completo: [SENSORES-CICLO-REPRODUCCION.md](./SENSORES-CICLO-REPRODUCCION.md).

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
mosca: energía > 62 y quiere_hijo → cría directa (clon + mutación)
gusano: circuito HSN+VC dispara → huevo en el mundo (clon + mutación
        ya aplicados en la puesta) → incubación 12 s → L1 con vitelo
     (mosca: 131 pesos ANN · gusano: 25 genes de neuromodulación;
       los genomas v1.1 de 20 genes se migran automáticamente)
   → rasgos: maxSpeed ±6 %, vision ±5 % (clamped a rangos por especie)
   → generación = progenitor + 1   (se rastrea maxGen global)
aptitud = comidas×2 + hijos×4 + edad×0.05   ← criterio del Museo
```

`World.getElite()` toma las 2 mejores criaturas de cada especie por aptitud
y las serializa (`kind` + pesos/genes redondeados a 3 decimales + rasgos)
para el Museo. `seedFromRecord()` siembra 8 individuos con ese cerebro y una
mutación leve (5 %, σ 0.2), conservando la generación para continuidad de
linaje; los registros de gusano previos a v1.1.0 (sin `kind`) se siembran
como ANN clásica.

## 8. Renderer (`src/lib/sim/render.ts`)

Función pura sobre `CanvasRenderingContext2D`, con **letterbox**: el mundo
lógico se escala al contenedor manteniendo la proporción (los clics se
invierten con `screenToWorld`). Capas, en orden:

1. Fondo del letterbox y terreno con gradiente + zona de suelo (45 %).
2. Alimentos (frutas con hoja, detritos, azúcar centelleante, veneno con glow).
3. Huevos de gusano: óvalos crema que se retuercen al madurar el embrión.
4. Criaturas: moscas con alas batientes y estela; gusanos de 8 segmentos
   escalados por fase (las larvas crecen), dauers grises con antenas
   plegadas y ráfaga dorada al poner un huevo.
5. Tinte nocturno (`α = (1−luz)·0.52`) + tinte cálido en amanecer/atardecer.
6. Lluvia procedural (partículas deterministas en función del tiempo).
7. Selección: círculo de visión efectiva, anillo pulsante, barra de energía
   y **sentidos del gusano** (línea/ondas de olfato, rayos de fotofobia,
   chispas de tacto, arco de propiocepción, aura de feromona, badge de fase).

## 9. Integración con React

- `useSimulation()` centraliza el loop y expone `SimApi` (acciones +
  snapshot). Las acciones que cambian la selección llaman a `refresh()`
  inmediato para que el inspector responda al instante.
- `<SimCanvas/>` registra su renderer en el loop (nada de React dentro del
  frame) y traduce los clics a coordenadas del mundo; si aciertan, la página
  cambia a la pestaña Inspector automáticamente.
- Los paneles consumen `ui: WorldView` (inmutable por snapshot), así que
  React re-renderiza a ~4.5 Hz como máximo.
- El inspector neuronal (`brain-view.tsx`) redibuja el cerebro en cada
  snapshot según su arquitectura:
  - **Gusano (conectoma)**: pestañas **"Circuito vivo"** (por defecto;
    `circuit-view.tsx`: riel de 16 sentidos → subgrafo real sensorial →
    comando → premotoras → pools → salidas, con partículas por arista
    activa en un rAF interno y badge de estado conductual) y **"Anillo"**
    (anillo con las 300 neuronas en tres sectores por clase, brillo por
    potencial, destellos de disparo, etiquetas clave, picos/tick y las 3
    salidas motoras). Encima, `sensor-strip.tsx` muestra los 17 canales
    con sus neuronas reales.
  - **Moscón (ANN)**: red 12→8→3 con nodos coloreados por activación (verde
    positivo / rojo negativo), aristas por peso×activación y un anillo dorado
    cuando el impulso reproductivo supera 0.55.

## 9bis. Cuatro modos de simulación (v1.3.0 + modo 3D en v1.4.0)

El mismo motor `World` con cuatro configuraciones (`SimMode`):

- **Ecosistema**: población inicial, clima, reproducción y evolución.
- **Arena/Retos** (`walls`, `goal`, cronómetro): paredes con colisión
  círculo-segmento y rebote (activa el reflejo de tacto real), meta,
  desenlaces con causa y récords en localStorage. Sin spawns ni
  reproducción (protocolo limpio).
- **3D** (`neuro3d`, v1.4.0): terrario de observación — plato rico a 20 °C
  con cuerpos 3D anatómicos y hologramas cerebrales en vivo (react-three-
  fiber; ver docs/MODO-3D.md). Colocación por clic de comida, cebos amargos
  y silueta de depredador; **aprendizaje alimentario por valor** en el
  motor (`learnGood`/`learnBad` por criatura). Sin reproducción.
- **Laboratorio** (plato de agar 20 °C): estímulos programables
  (`stimulate()`), el **tap** como electrodo virtual sobre el circuito
  mecanorreceptor real de cada especie, knockouts por clase
  (`setKnockout`, índices reales vía `connectome/knockouts.ts`), trazas
  10 Hz del cerebro seleccionado y líneas isogénicas de laboratorio.

El genoma del gusano pasó de 25 a **26 genes** (adaptación de tasa) y el de
la mosca a **27** (sesgo lateral), con migración automática de registros
antiguos. Los cerebros son portátiles: `.neuroevo.json`
(`brain-io.tsx`, zod-validado) exporta arquitectura+genoma+rasgos y
`seedFromRecord` siembra 8 individuos (el primero con el genoma EXACTO).

## 10. Datos y API (Museo de la Evolución)

```prisma
model EvolutionRecord {
  id         String   @id @default(cuid())
  name       String
  species    String            // 'fly' | 'worm'
  generation Int      @default(0)
  fitness    Float    @default(0)
  brain      String            // JSON: { kind:'ann'|'elegans', weights, traits }
  env        String            // JSON: clima en el momento del guardado
  createdAt  DateTime @default(now())
}
```

El campo `kind` es opcional y retrocompatible: los registros de gusanos
previos a v1.1.0 (sin `kind`) se siembran como ANN clásica; los elegans
llevan sus 20 genes en `weights`.

| Método | Ruta | Comportamiento |
|---|---|---|
| `GET` | `/api/records` | Últimos 60 por `createdAt` desc, con `brain`/`env` parseados a objetos. |
| `POST` | `/api/records` | Valida con zod (species enum, kind opcional, pesos numéricos, rasgos > 0); responde 201. |
| `DELETE` | `/api/records/[id]` | Elimina; 404 si no existe. Params asíncronos (Next.js 16). |

## 11. Export estático y despliegue

- **Modo dev** (`bun run dev`): Museo respaldado por la API + SQLite.
- **Modo estático** (`bun run build:static` → `output: "export"`): sin
  servidor, `src/lib/static-museum.ts` guarda los linajes élite en
  `localStorage` con el mismo contrato `EvolutionRecordDTO` (degradación
  elegante; la simulación corre íntegra en el navegador).
- `next.config.ts` conmuta por variables de entorno
  (`NEXT_OUTPUT`, `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_STATIC_MODE`,
  `NEXT_DIST_DIR`); el `basePath` se calcula según el repositorio en CI.
- **Workflow** `.github/workflows/deploy-pages.yml`: al subir un tag `v*`
  → build estático (excluyendo `src/app/api`) → `actions/deploy-pages` →
  `gh release create --generate-notes` con el sitio compilado como `.zip`.

## 12. Constantes de balance

Todas las constantes de tuning viven en `src/lib/sim/types.ts`
(`SPECIES_CONFIG`, `FOOD_INFO`, `DEFAULT_ENV`) y en los literales de
`world.ts`/`creature.ts` documentados arriba. Las constantes del motor LIF
(τ, umbral, refractario, escalas de transmisor y la forma de los pesos
`0.085·log₂(1+contactos)`) están calibradas empíricamente en
`connectome/elegans.ts` — ver [CONNECTOMA-C-ELEGANS.md](CONNECTOMA-C-ELEGANS.md)
para el razonamiento completo.
