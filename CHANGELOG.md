# Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/)
y el proyecto se adhiere al [Versionado Semántico](https://semver.org/lang/es/).

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

[1.0.0]: https://github.com/juanruiz85/neuroevo/releases/tag/v1.0.0
