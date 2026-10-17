# Conectoma de *C. elegans* en NeuroEvo — Fase 1

> Los gusanos de NeuroEvo no usan una red neuronal inventada: cada uno
> **simula el conectoma biológico real** del nemátodo *Caenorhabditis
> elegans* con un modelo **LIF** (Integración y Disparo con Fugas), a 30
> ticks por segundo dentro del bucle `requestAnimationFrame` del Canvas.

---

## 1. Dataset y procedencia

| Archivo | Papel |
|---|---|
| `src/lib/sim/data/c_elegans_connectome.json` | Dataset compacto (55 KB) usado por el motor |
| OpenWorm — `herm_full_edgelist.csv` (repo `CElegansNeuroML`) | Lista completa de aristas del hermafrodita |
| OpenWorm — `CElegansNeuronTables.xls` | Neurotransmisores, 86 neuronas sensoriales con función, uniones neurona↔músculo |

**Contenido del dataset:**

| Métrica | Valor |
|---|---|
| Neuronas | **300 de 302** (CANL/R no tienen sinapsis; incluye las 20 faríngeas) |
| Sinapsis químicas (neurona→neurona) | 3.638 |
| Uniones en gap | 1.093 |
| Contactos sinápticos totales | ≈24.900 (≈25.000 con las uniones a músculo excluidas del grafo) |
| Clasificación | 86 sensoriales · 164 interneuronas · 50 motoras |

La clasificación se derivó de los propios datos: sensoriales = hoja
*Sensory* de OpenWorm; motoras = neuronas con uniones neuromusculares
(hoja *NeuronsToMuscle*); interneuronas = el resto. Los neurotransmisores
del cordón ventral (AS/DA/DB/VA/VB/VC = acetilcolina; DD/VD = GABA) y de
la faringe se completaron con la literatura estándar, al no figurar en
las hojas de OpenWorm.

## 2. Modelo neuronal (LIF)

Cada neurona `i` tiene un potencial de membrana `V[i]` (typed arrays
`Float32Array`). Por tick (dt normalizado a 1):

```
V[i] ← V[i]·e^(−1/τ)                 fuga (τ del genoma, ~7.5 ticks)
V[sensorial] ← I_ssensorial          inyección del entorno (ver §3)
si V[i] ≥ V_th y refractario = 0:    disparo
    V[i] ← 0.12 (reset) · refractario ← 2-3 ticks
    para cada sinapsis química i→j: V[j] += w(i,j)·escala_tx(i)·voltaje
para cada gap (a,b):
    difusión: V[a] += ½·g·(V[b]−V[a]);  V[b] −= ½·g·(V[b]−V[a])
    pico transmitido: si a disparó → V[b] += 2.4·g (y viceversa)
```

- **Peso químico**: `signo · mín(1.1, 0.085·log₂(1+contactos))`, con
  signo negativo si la neurona **presináptica** es GABAérgica.
- **El glutamato se modela como excitador** (simplificación documentada;
  en el animal algunas sinapsis glutaminérgicas son inhibitorias).
- **Picos por gap junction**: las sinapsis eléctricas pasan transitorios
  despolarizantes — es como los comandos AVA/AVB activan los pools
  motores A/B en el animal real.
- **Una sola pasada de cascada por tick** (las cadenas continúan en el
  tick siguiente): evita espirales de activación en un grafo recurrente.
- **Frío extremo (`voltage < 1`)**: escala la entrega sináptica — el
  equivalente del coeficiente **Q10** térmico: el nemátodo real se vuelve
  torpe y letárgico bajo 10 °C.

## 3. Mapeo sensorial (12 canales del mundo → neuronas reales)

| Canal del mundo | Neurona(s) del conectoma | Justificación biológica |
|---|---|---|
| Sesgo / tónico | AVB (comando B) + RMDD/RMDV (cabeza) | Impulso endógeno tipo CPG: exploración de base |
| Energía (hambre = 1−E) | ADF + ASE | ADF integra el estado interno de alimentación |
| **Térmico (con signo)** | **AFD (primario)** + AWC (secundario) | AFD es EL termosensor de *C. elegans* (respuesta ON/OFF a gradientes) |
| Luz | ASH | Fotofobia: el animal evita la luz vía nocicepción |
| Humedad | BAG | Sensor ambiental (CO₂/O₂ en el animal) |
| Comida X (cos) | AWC^L / −AWC^R | Asimetría quimiosensorial contralateral real |
| Comida Y (sin) | AWA^L / −AWA^R | Ídem (olfato) |
| Comida cercanía | ASE (+AWC) | ASE = neurona gustatoria por excelencia |
| Veneno X/Y | PHA / PHB | Fásmidos: quimiorrecepción aversiva posterior |
| Veneno cercanía | ASH (fuerte) | Nociceptor polimodal (osmótico/mecánico/olfativo) |
| Multitud | PVD + ALM | Tacto brusco/nocicepción mecánica + tacto suave |

## 4. Mapeo motor (pools reales → 3 salidas del Canvas)

| Salida | Pool | Nota |
|---|---|---|
| **Avanzar** | VB01-11, DB01-07, AVB, PVC | Comando B de avance (depolarización → avance) |
| **Girar** | Asimetría **dorso-ventral** de RMD/SM/SMB, amplificada ×2.2 durante reversas | El vaivén cefálico del nemátodo; en reversa (VA/DA/AVA/AVD/AVE) el animal re-orienta |
| **Reproducir** | VC01-06 + HSN | El circuito real de puesta de huevos |

## 5. Genoma evolutivo (20 genes)

El **algoritmo genético no toca la estructura del conectoma** (es
biología). La selección natural actúa sobre la **neuromodulación** y la
**excitabilidad**, como en el animal real:

| Genes | Significado | Rango |
|---|---|---|
| 0-11 | Ganancia sensorial por canal | 0.15 - 2.4 |
| 12-15 | Escala de transmisión ACh / Glu / GABA / monoaminas+neuropéptidos | 0.45 - 1.9 |
| 16 | Constante de fuga τ | 3.5 - 14 |
| 17 | Umbral de disparo | 1.0 - 1.8 |
| 18 | Periodo refractario | 1 - 5 |
| 19 | Impulso tónico | 0.05 - 0.9 |

Serialización: el genoma plano vive en `brain.weights` (20 floats) +
`brain.kind: 'elegans'`, compatible con el Museo de la Evolución (API y
localStorage). Los registros antiguos de gusanos (131 pesos ANN) se
siembran como ANN clásica — retrocompatible.

## 6. Rendimiento

- Grafo compartido (CSR + listas de gap) construido **una vez** por
  sesión; cada gusano solo porta su estado (`V`, picos, refractario) y
  su genoma.
- **~1.2 ms/tick** para el mundo completo (≈60 gusanos × 300 neuronas +
  60 moscas ANN) en un hilo del navegador: 3-4 % del presupuesto de
  frame a 60 FPS.
- Verificado: 3 min simulados con poblaciones estables (G8, 0 gusanos
  paralizados, 24 reproductores).

## 7. Simplificaciones honestas

1. Neuronas puntuales sin morfología ni dinámica de canales iónicos.
2. Glutamato siempre excitador (en el animal hay excepciones).
3. Un solo paso de cascada sináptica por tick.
4. Las uniones a músculo (148 destinos) se excluyen del grafo: los
   pools motores controlan directamente el movimiento en el Canvas.
5. La faringe se simula (20 neuronas incluidas) pero no genera
   comportamiento propio: su masa sináptica participa en la dinámica
   global.

## 8. Referencias

- OpenWorm — https://openworm.org
- Cook, S. J. et al. (2019). *Whole-animal connectomes of both C. elegans
  sexes*. Nature 571.
- White, J. G. et al. (1986). The structure of the nervous system of the
  nematode C. elegans. Phil. Trans. R. Soc. B.
- WormAtlas — https://www.wormatlas.org
