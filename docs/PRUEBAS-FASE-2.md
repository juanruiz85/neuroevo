# Banco de pruebas — Fase 2 (v1.3.0)

> Metodología del plan (`docs/PLAN-FASE-2-EXPERIMENTOS.md` §8): **nada se
> declara "hecho" sin su prueba archivada**. Este documento consolida el
> banco headless ejecutable (`/home/z/calib/banco-fase2.ts`, 33 comprobaciones)
> y la verificación E2E en navegador real (agent-browser + VLM). Ejecución
> del banco: `cd /home/z/my-project && bun /home/z/calib/banco-fase2.ts`
> — resultado de esta versión: **33 ✓ / 0 ✗**.

## 1) Integridad del conectoma Drosophila (Winding 2023)

| # | Comprobación | Resultado |
|---|---|---|
| 1.1 | 2.956 neuronas completas del cerebro larvario | ✓ |
| 1.2 | 41.977 aristas reales (umbral ≥3 contactos + TODAS las salidas de sensores de primer orden) | ✓ |
| 1.3 | 257.414 sinapsis conservadas (73,0 % de 352.611; validación cruzada con la matriz densa S1) | ✓ |
| 1.4 | 462 sensores de primer orden con modalidad real anotada (olf 42 · gus 132 · gnp 110 · vis 29 · noc 6 · thc 6 · thw 4 · mec 14 · pro 8 · rsp 26 · gut 85) | ✓ |
| 1.5 | 346 neuronas descendentes de salida (DN-VNC 182 + DN-SEZ 164) | ✓ |

## 2) Dinámica LIF Drosophila

| # | Comprobación | Resultado |
|---|---|---|
| 2.1 | Reposo: actividad global dispersa, sin epilepsia | ✓ 3,40 % picos/tick |
| 2.2 | Reposo: la mosca vuela (salida de avance activa por el CPG) | ✓ avanzar 0,56 |
| 2.3 | Olfato: la actividad propaga por el conectoma | ✓ 3,42 % → 5,77 % |
| 2.4 | Olfato: el avance AUMENTA con comida cercana | ✓ avanzar 0,66 |
| 2.5 | Knockout de ORNs atenúa la respuesta olfativa | ✓ 10,6 % → 5,1 % |
| 2.6 | Genoma de 27 genes: mutate sin NaN + clone idéntico | ✓ |

## 3) Escape visual (sombra que crece / looming)

| # | Comprobación | Resultado |
|---|---|---|
| 3.1 | La mosca posada responde al looming con acelerón de escape | ✓ 13 → 43 px/s |
| 3.2 | Knockout de PRs (ceguera) elimina el reflejo | ✓ acelerón 0 |

*Nota de método: el reflejo de escape del looming es NO direCCional (salto
del circuito visual→DNs), por lo que se mide como acelerón de velocidad en
ventana de 2,5 s — la cascada visual→DN es integradora y tarda ~1,4 s.*

## 4) Circuito del tap — réplica de Rankin 1990 sobre C. elegans

Protocolo: animal de la línea isogénica de laboratorio, reposicionado al
centro del plato entre ensayos (como el experimentalista), control restado.

| # | Comprobación | Resultado |
|---|---|---|
| 4.1 | Fondo neural limpio: el animal en reposo calla (0 picos de ALM/AVM/PLM en 60 ticks) | ✓ |
| 4.2 | Reflejo tap→comando: los picos netos de PVC/AVD tras el golpe | ✓ 1,67 |
| 4.3 | Habituación: la respuesta decae con la repetición (30 taps) | ✓ → 0 % |
| 4.4 | Recuperación espontánea tras 90 s de reposo | ✓ 2,00 |
| 4.5 | Knockout ALM+PLM (ablación del circuito del tap) elimina el reflejo | ✓ 1,67 → 0,00 |

*Mecanismo: habituación por **adaptación de tasa** (fatiga de disparo,
gen 26, τ≈3,7 s) + **depresión homosináptica leve** de las aristas
mecano→comando (τ≈60 s). El tap se aplica con **electrodo virtual** sobre
ALM/AVM/PLM (el circuito real del tap-withdrawal, Wicks & Rankin 1997).*

## 5) Arena / Retos

| # | Comprobación | Resultado |
|---|---|---|
| 5.1 | 200 s de simulación contra una pared completa: ninguna criatura la cruza | ✓ (colisión círculo-segmento con rebote) |
| 5.2 | El ensayo termina y registra el desenlace de cada participante | ✓ |
| 5.3 | Tiempos de llegada válidos (0–300 s) cuando alguien llega | ✓ |
| 5.4 | El veneno mata y se registra la causa 'poison' | ✓ |

## 6) Export/Import de cerebros (roundtrip del genoma)

| # | Comprobación | Resultado |
|---|---|---|
| 6.1 | Siembra desde archivo con arquitectura correcta (elegans) | ✓ 8 individuos |
| 6.2 | El genoma sobrevive el roundtrip bit a bit (el 1er individuo es EXACTO) | ✓ |
| 6.3 | Drosophila: siembra con conectoma de 27 genes | ✓ |
| 6.4 | Registro antiguo ANN (131 pesos, sin kind) se siembra como ANN | ✓ |
| 6.5 | Genoma v1.1 del gusano (20 genes) migra a 26 sin errores | ✓ |

## 7-8) Rendimiento y balance del ecosistema (900 s, 27.000 ticks)

| # | Comprobación | Resultado |
|---|---|---|
| 7.1 | Rendimiento con ecosistema completo | ✓ **media 2,4-2,6 ms/tick** (p95 3,2-3,5; presupuesto rAF 33 ms) |
| 8.1 | Las moscas Drosophila sobreviven 15 min | ✓ 10-17 vivas |
| 8.2 | Los gusanos C. elegans mantienen población | ✓ 64-79 vivos |
| 8.3 | Huevos incubándose (reproducción neural activa) | ✓ 8-22 |
| 8.4 | La evolución avanza | ✓ G23-G28 en 15 min |
| 8.5 | Las moscas ponen huevos por su circuito DN-SEZ | ✓ 11-16 en el mundo |

## E2E en navegador real (agent-browser + VLM)

Sesión completa con **0 errores de página y 0 errores de consola**:

1. **Ecosistema**: carga con selector de modos; 42 moscas Drosophila + 38
   gusanos; huevos de mosca en el HUD a los 7 s (reproducción neural en vivo).
2. **Inspector Drosophila** (VLM verificado): ficha "Cerebro biológico en
   vivo · Drosophila · conectoma real" con los **18 sentidos en vivo**
   mapeados a grupos reales (GUT 85, ORN 42, GRN 132, PR 29, MEC 14…),
   anillo de 2.956 neuronas en tres sectores con etiquetas ORN/GRN/PR/DNV,
   crédito "41.977 sinapsis · Winding 2023" y salidas
   Girar/Avanzar/Reproducir en vivo; "Cerebro portátil" (27 genes, exportar
   + importar).
3. **Laboratorio**: soltar gusano de línea isogénica (N2), trazas en vivo a
   10 Hz con 4 series (Avante VB/DB, Reversa VA/DA, Puesta HSN+VC, Picos),
   6 estímulos con tooltips del circuito real, knockouts con la cita de
   Chalfie 1985. **Protocolo Rankin ejecutado en vivo: "Respuesta inicial
   0,006 → final 0,000 (decae 100 %)"** con gráfica por ensayo y
   exportación JSON del experimento.
4. **Retos**: guía de 3 pasos, herramientas Elegir/Pared/Meta/Fruta/Veneno/
   Borrar/Soltar, selector de especie y arquitectura (Moscón · Drosophila
   con "Conectoma real · 2.956 neuronas"), meta colocada con clic, ensayo
   cronometrado (CRONÓMETRO 00:08.9 en vivo), desenlace registrado
   ("Mosca #158 · Drosophila · 01:01.6 · Murió · inanición") y **récord
   archivado en localStorage** ("0/1 llegaron · 0 paredes").
5. **Móvil 375×812**: sin overflow horizontal.

## Calibración (12 rondas, lecciones archivadas)

El banco alcanzó el verde tras resolver en orden: auto-contacto flotante
(bug v1.2: `countNeighbors` se auto-contaba por ε de redondeo), luz
constante → ASH saturado y termo constante → AFD saturado (solución:
adaptación sensorial real, responden al CAMBIO), gen Glu bajo (el reflejo
del tap es glutamatérgico), bistabilidad/kindling del comando tras el
reflejo (solución: gen de adaptación de tasa — fatiga de disparo),
contaminación olfativa del azúcar del plato y muerte por inanición durante
el protocolo (solución: alimentación entre fases). Todos los hallazgos y
scripts intermedios están referenciados en `docs/worklog.md` (Tasks 14-17).
