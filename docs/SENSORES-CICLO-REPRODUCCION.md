# Sentidos, ciclo de vida y reproducción de *C. elegans* en NeuroEvo

> **Versión 1.2.0** — Este documento describe con detalle la biología
> implementada en los gusanos de NeuroEvo: sus **17 canales sensoriales**
> mapeados a neuronas reales, su **ciclo de vida completo** (huevo → L1 →
> L2 → L3 → L4 → adulto, con fase **dauer**) y su **reproducción real por
> puesta de huevos** dirigida por el circuito neural HSN+VC.
>
> Datos del conectoma: OpenWorm (300 neuronas, 4.731 sinapsis). Ver
> [CONNECTOMA-C-ELEGANS.md](./CONNECTOMA-C-ELEGANS.md) para el modelo LIF.

---

## Índice

1. [Respuestas directas a las preguntas frecuentes](#1-respuestas-directas)
2. [Los 17 sentidos del gusano](#2-los-17-sentidos)
3. [Ciclo de vida completo](#3-ciclo-de-vida)
4. [La fase dauer (supervivencia)](#4-la-fase-dauer)
5. [Reproducción: circuito real de puesta](#5-reproducción)
6. [Muerte y balance ecológico](#6-muerte-y-balance-ecológico)
7. [Visualización: cómo ver todo esto en la app](#7-visualización)
8. [Simplificaciones honestas](#8-simplificaciones-honestas)

---

## 1. Respuestas directas

### ¿La "vida" del gusano es el promedio de su ciclo de vida real?

**Ahora sí.** Antes de v1.2.0, la vida era una simple barra de edad con un
tope fijo (180 s). Desde v1.2.0 el gusano vive las **mismas fases que el
nematodo real**, con duraciones proporcionales a la biología (escala
**1 segundo de simulación ≈ 1 hora real a 20 °C**):

| Fase | Duración real (20 °C) | En la simulación | Qué hace |
|---|---|---|---|
| **Huevo** | ~10-15 h de embriogénesis | 12 s | Incuba en el sustrato; se retuerce antes de eclosionar. La incubación se acelera con el calor (Q10 ≈ 2). |
| **L1** | ~12 h | 12 s | Larva diminuta (45 % del tamaño), come poco, huele menos lejos. |
| **L2** | ~10 h | 10 s | Crece; si pasa hambre sostenida aquí puede entrar en **dauer**. |
| **L3** | ~10 h | 10 s | Sigue creciendo; última ventana de dauer. |
| **L4** | ~10 h | 10 s | Casi adulta (86 %); la dauer que encuentra comida reanuda aquí. |
| **Adulto** | mediana ~18 días | **~300 s** (comprimida ×1.4) | Se reproduce por puesta; muere de senescencia. |

La **senescencia adulta** es lo único comprimido (×1.4 respecto a la
proporción real, para que la vida completa sea observable): cada gusano
sortea al nacer una longevidad de **300 s ± 20 %**, y el calor por encima
de 26 °C acorta esa vida, como en el animal real.

**Nota**: las larvas crecen de verdad — son más pequeñas, más lentas,
gastan menos energía y su rango sensorial es menor. El desarrollo avanza
más rápido con calor y se detiene casi por completo con frío (Q10 ≈ 2,
rango biológico 0.3×–2.6×).

### ¿La reproducción es una simulación real de impulsos o es provocada por programación?

**Es real y neural.** Desde v1.2.0 la cadena completa es biológica:

1. El gusano es **hermafrodita autofecundado** (como el real): produce
   huevos internos gastando energía, con **esperma limitado** (140; el real
   ~300), solo cuando está bien alimentado.
2. La **feromona de conglomerado** (ascarósidos reales) que siente con ADL
   **frena** la maduración de huevos cuando hay demasiados gusanos cerca.
3. La puesta **solo** ocurre cuando el **circuito real de puesta** — las
   motoneuronas **HSN + VC** del conectoma — alcanza suficiente tasa de
   disparo. Esa actividad viaja por el conectoma (NSM/HSN reciben el estado
   de saciedad vía ADF, como la serotonina real) y emerge como la salida
   motora "Reproducir" del inspector.
4. Si el cerebro de un gusano **nunca** dispara ese circuito, ese gusano
   **no deja descendencia** y su linaje muere. Es presión de selección
   real: en la prueba de balance, 147 gusanos distintos pusieron huevos
   en 15 minutos y la población alcanzó la generación 31.

### ¿Los nuevos gusanos aparecen por reproducción o se agregan por programación?

**Por reproducción, sin excepción.** Cada gusano nuevo nace de un
**huevo** depositado en el mundo por el circuito HSN+VC de su madre:

- El huevo **es un objeto del mundo** (se ve en el mapa: un óvalo crema
  que se retuerce cuando el embrión madura).
- Contiene ya el cerebro **clonado y mutado** (la "meiosis" ocurre en la
  puesta: mutación de la neuromodulación + rasgos velocidad/visión).
- Incuba **12 s** (más rápido con calor) y **eclosiona como larva L1**
  con su reserva de vitelo (24 unidades de energía).

Las únicas dos formas de gusanos "de laboratorio" (y así se documentan)
son: la **población inicial** al arrancar/reiniciar el mundo, y los
botones **Reintroducir** / **Sembrar del Museo**, que son intervenciones
del experimentador. El motor nunca genera gusanos espontáneamente. Las
**moscas** (especie de control ANN) sí conservan su reproducción por
brote directo, para poder comparar ambas estrategias.

---

## 2. Los 17 sentidos

El gusano percibe el mundo a través de **17 canales**; cada canal inyecta
corriente directamente en las **neuronas sensoriales reales** del
conectoma (definición en `src/lib/sim/connectome/sensors.ts`, inyección en
`elegans.ts`). Los primeros 12 son compartidos con las moscas (que leen
solo esos); los 5 últimos son exclusivos del gusano.

| # | Canal | Estímulo en el mundo | Neuronas reales | Notas biológicas |
|---|---|---|---|---|
| 0 | Tónico (sesgo) | — | AVB + RMDD | Impulso endógeno del generador locomotor central (CPG). Equilibrado dorso-ventral para que la asimetría la decida la red. |
| 1 | Hambre interna | energía corporal | ADF + HSN | Hambre = 1 − energía. Con saciedad excita HSN (tono reproductivo), papel análogo a la serotonina de NSM. |
| 2 | Termosensación | temperatura − óptimo | AFD + AWC | **Con signo** (frío negativo). AFD es el termosensor primario real; controla la cripta/botermotaxis. También escala la Q10 del desarrollo. |
| 3 | Luz | luz día/noche | ASH | *C. elegans no tiene ojos*: detecta luz con el receptor **LITE-1** y es **fotofóbico**. Aquí la luz alta activa la evitación vía ASH (nociceptor polimodal). |
| 4 | Humedad | humedad ambiental | BAG | Higrosensación; la humedad además afina el olfato quimiorreceptor. |
| 5 | Olfato direccional X | cos(ángulo a la comida) | AWC L/R | **Contraste contralateral**: AWCL se excita, AWCR se inhibe (y viceversa). Así se orienta el animal real (asimetría quimiosensorial). |
| 6 | Olfato direccional Y | sin(ángulo a la comida) | AWA L/R | Segundo eje olfativo, mismo truco L/R. |
| 7 | Gusto / cercanía | proximidad de comida | ASE + AWC | Concentración local del gradiente. ASE es el sensor de "sabor" principal. |
| 8-10 | Veneno X/Y/cerca | gradiente de veneno | PHA + PHB + ASH | Los **fásmidos** caudales (PHA/PHB) son los quimiorreceptores aversivos reales; ASH añade la nocicepción. |
| 11 | Multitud | densidad de congéneres | PVD + ALM | PVD = tacto brusco (mecanonocicepción), ALM = tacto suave. |
| **12** | **Tacto cefálico (nariz)** | choque frontal contra borde u otro cuerpo | **ASH + FLP + OLQ** | **Circuito real de "nose touch"**: ASH→AVA→VA/DA desencadena la **reversa**. La señal es fáscica (decae en ~160 ms). |
| **13** | **Tacto caudal** | contacto por detrás | **PLM** | **Reflejo real**: PLM→PVC→VB/DB **acelera el avance** al ser tocado de atrás. |
| **14** | **Propiocepción** | curvatura del propio cuerpo (firma del giro) | **DVA + SMDD** | DVA siente el estiramiento corporal con el canal TRP-4, como el animal. **Con signo** según el lado de la ondulación. |
| **15** | **Δ Gradiente (klinotaxis)** | derivada temporal de la concentración de comida | **ASE L/R** | ASE real **se adapta** y dispara al *cambio* de concentración, no al nivel: así hace klinotaxis el nemátodo. |
| **16** | **Feromona de conglomerado** | densidad de gusanos en 70 px | **ADL** | Proxy de los **ascarósidos** reales: frenan la puesta y (con hambre) disparan la dauer. |

**Genoma**: cada canal tiene su **ganancia sensorial heredable y mutable**
(genes 0-16 del genoma de 25). La evolución puede, por ejemplo, afinar el
olfato (canal 7) o volverse hipersensible al tacto (canal 12).

### Los circuitos que se iluminan al actuar

Cuando el gusano ejecuta una acción, en el inspector "Circuito vivo" se ve
la red real que la produce:

- **Reversa** (evitación): `ASH/FLP (nariz o veneno) → AVA/AVD/AVE → VA/DA`
- **Avance**: `AVB/PVC → VB/DB` (comando B), acelerado por `PLM → PVC`
- **Giro/ondulación**: asimetría `RMD/SM/SMB` dorso-ventral, amplificada
  durante las reversas (el animal re-orienta al retroceder)
- **Puesta de huevo**: `ADF (saciedad) → HSN + VC → vulva`

---

## 3. Ciclo de vida

Constantes en `src/lib/sim/types.ts` (`WORM_LIFE`), lógica en
`creature.ts` (`tickWormLife`) y `world.ts` (huevos).

- **Escala temporal**: 1 s ≈ 1 h real a 20 °C. Toda la fase de huevo a
  adulto son ~52 h reales ≈ 52 s de simulación.
- **Q10 del desarrollo**: la velocidad de desarrollo de larvas y de la
  embriogénesis de los huevos se multiplica por `2^((T−20)/10)` limitada a
  [0.3×, 2.6×]. Con 26 °C maduran casi el doble de rápido; con frío casi
  se detienen (realismo directo del laboratorio).
- **Crecimiento**: cada fase tiene escala corporal y metabólica (tabla
  `WORM_STAGE_SCALE` / `WORM_STAGE_DRAIN`): una L1 mide 45 %, gasta 35 %
  y huele 55 % del alcance de un adulto; cada muda cuesta 3 de energía.
- **Senescencia**: al mudar a adulto, cada gusano ya sorteó su
  longevidad (300 s ± 20 %). El calor > 26 °C **acelera el envejecimiento**
  (×1.05 por grado, como el estrés térmico real).

## 4. La fase dauer

La dauer es la fase de supervivencia por excelencia de *C. elegans*: una
larva L2/L3 que pasa hambre **y** detecta feromona de conglomerado forma
una larva dauer con la boca sellada, metabolismo casi nulo y resistencia
extrema (en el animal real sobrevive meses).

En NeuroEvo:

- **Entrada**: larva L2/L3 con energía < 18 durante 5 s seguidos.
- **Dentro**: gasta **5 %** de energía, **no come** (boca sellada), apenas
  se mueve (14 % de velocidad), **no envejece**, y se dibuja como un
  quiste gris pálido con el badge "Dauer" violeta.
- **Salida**: al oler comida durante 2.5 s **reanuda como L4** con una
  reserva mínima de 22 de energía (las reservas lipídicas reales).
- **Límite**: 320 s de dauer como máximo (agotamiento de lípidos).

Con el slider de comida al mínimo puedes **provocar una hambruna** y ver
cómo la población colapsa a dauers que reviven cuando devuelves la comida.

## 5. Reproducción

La cadena completa (con referencias reales):

1. **Autofecundación**: el hermafrodita madura huevos internos cuando
   `energía > 55` y `adulto > 6 s` (madurez reproductiva real ~5 h tras
   la última muda). Cada huevo cuesta **16 de energía** y consume **1 de
   esperma** (stock 140). Máximo **8 huevos maduros** en el útero (el
   real porta ~10-15).
2. **Control por comida**: el estado de saciedad (canal 1 → ADF) excita
   HSN, como la serotonina de NSM en el animal: **sin comida no hay puesta**.
3. **Feromona (ascarósidos)**: la densidad local de gusanos (canal 16 →
   ADL) frena la maduración hasta ×0.25 con multitud — el control de
   población por feromona del nemátodo real.
4. **Puesta neural**: la salida "Reproducir" es la tasa de disparo del
   pool **VC01-06 + HSN** (circuito real de la vulva). Solo si supera el
   umbral se deposita un huevo **por la vulva** (segmento medio del
   cuerpo) con ráfagas separadas 1.4 s — el animal real pone en ráfagas
   de varios huevos con pausas. **No hay ninguna otra vía de puesta.**
5. **El huevo** (clase `WormEgg`): visible en el mundo, incubación 12 s
   (×Q10), contiene el cerebro clonado+mutado y rasgos (velocidad/visión)
   heredados con mutación gaussiana. Eclosiona como **L1 con 24 de
   vitelo**. Si el mundo está saturado (popCap 220), espera; si envejece
   48 s sin eclosionar, se pierde.

**Ejemplo de lectura del inspector**: "Huevos puestos 12 · maduros 3 ·
esperma 83/140 · feromona 22 %" — ese adulto ha puesto 12 huevos al mundo,
tiene 3 listos en el útero y aún le queda esperma para 83 más.

## 6. Muerte y balance ecológico

Un gusano muere por: **inanición** (energía ≤ 0), **senescencia** (agotó
su longevidad adulta), **calor/desecación** (drenaje acelerado) o **dauer
prolongada** (lípidos agotados). Los cadáveres se reciclan como detritos.

Balance verificado en prueba headless de 15 min (900 s): población de
gusanos oscila 55-80, huevos simultáneos 1-9, dauers 1-9 constantes,
**147 reproductores distintos**, generación 31, 1.3 ms/tick con ~90
criaturas. El sistema es estable sin ninguna intervención.

## 7. Visualización

- **Inspector → pestaña "Circuito vivo"** (nueva, por defecto): el flujo
  completo sentidos → neuronas sensoriales → interneuronas de comando →
  pools motores → salidas, con las **sinapsis reales del subgrafo**, picos
  destellando, partículas viajando por las aristas activas y un badge del
  **estado conductual en vivo** (AVANZANDO / GIRANDO / REVERSA / PONIENDO
  HUEVO) con el circuito responsable. El anillo clásico queda como
  segunda pestaña.
- **"Sentidos en vivo"**: tira con los 17 canales, sus neuronas reales y
  sus valores al instante, agrupados (químico/físico/interno/social/motor).
- **Sobre el gusano seleccionado en el mapa**: línea punteada hacia la
  comida olfateada con ondas quimiosensoriales, rayos ámbar si la luz le
  molesta (fotofobia), chispas rosas al tacto de nariz/cola, arco naranja
  de propiocepción al ondular, aura violeta con feromona alta, badge de
  fase (L1…Dauer/Adulto) y ráfaga dorada al poner un huevo.
- **HUD y gráfica de población**: chip y línea de **huevos** en el mundo.

## 8. Simplificaciones honestas

1. **Senescencia comprimida ×1.4** (300 s vs 432 s proporcionales) para
   que la vida completa sea observable; todo lo demás respeta la escala
   1 s ≈ 1 h.
2. **Esperma 140** en vez de ~300 para acelerar el equilibrio poblacional.
3. **Feromona = densidad local** de gusanos (70 px) en vez de un campo
   difuso acumulativo de ascarósidos.
4. La **puesta sale por la vulva** del segmento medio, pero los huevos no
   ruedan ni son comidos (no hay canibalismo de huevos, que sí existe).
5. La dauer entra solo por hambre (sin exigir feromona alta simultánea;
   la feromona sola no provoca dauer en el real).
6. **L1 arrest** real (las L1 sin comida se detienen en vez de morir) no
   está modelado; las L1 que no comen mueren como cualquiera.
7. La meiosis (mutación) se aplica en la **puesta**, no en la fertilización
   interna — funcionalmente equivalente aquí.
8. Las uniones hueco-corporales y las 20 neuronas faríngeas no tienen
   órgano diana: participan de la dinámica de red como nodos más.
