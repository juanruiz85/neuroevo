'use client'

// Hook puente entre el motor de simulación (imperativo, 30 ticks/s) y React
// (snapshots throttled cada ~220 ms). El loop rAF vive fuera del render para
// mantener 60 fps de render y evitar re-renders por frame.

import { useCallback, useEffect, useRef, useState } from 'react'
import { World } from '@/lib/sim/world'
import {
  DEFAULT_ENV,
  type ArenaGoal,
  type EliteRecord,
  type EnvParams,
  type EvolutionRecordDTO,
  type FoodKind,
  type SimMode,
  type Species,
  type StimKind,
  type Wall,
  type WorldView,
} from '@/lib/sim/types'
import type { BrainKind } from '@/lib/sim/connectome/adapter'
import type { Creature } from '@/lib/sim/creature'

export interface SimApi {
  ui: WorldView
  paused: boolean
  speed: number
  mode: SimMode
  setMode: (m: SimMode) => void
  togglePause: () => void
  setSpeed: (v: number) => void
  reset: () => void
  setEnv: (patch: Partial<EnvParams>) => void
  selectAt: (x: number, y: number) => boolean
  deselect: () => void
  followRandom: (s: Species) => boolean
  reintroduce: (s: Species) => number
  seedFromRecord: (rec: EvolutionRecordDTO) => number
  getElite: () => EliteRecord[]
  registerRenderer: (fn: ((now: number) => void) | null) => void
  getWorld: () => World | null
  // ——— Laboratorio ———
  stimulate: (kind: StimKind, x: number, y: number) => void
  setKnockout: (species: Species, key: string, on: boolean) => void
  knockoutOn: (species: Species, key: string) => boolean
  /** Coloca comida (fruta/azúcar/detrito/veneno/cebo amargo). */
  dropFood: (kind: FoodKind, x: number, y: number) => void
  // ——— Arena / Retos ———
  arenaAddWall: (w: Wall) => void
  arenaUndoWall: () => void
  arenaSetGoal: (g: ArenaGoal | null) => void
  arenaClear: () => void
  spawnAt: (
    species: Species,
    kind: BrainKind,
    x: number,
    y: number,
    genome?: Float32Array,
  ) => Creature | null
  arenaStart: () => void
}

const EMPTY_VIEW: WorldView = {
  time: 0,
  day: 1,
  light: 0.5,
  ambientTemp: DEFAULT_ENV.temperature,
  humidity: DEFAULT_ENV.humidity,
  env: { ...DEFAULT_ENV },
  mode: 'ecosystem',
  walls: [],
  goal: null,
  runT: 0,
  arenaRunning: false,
  arenaResults: [],
  traces: [],
  counts: {
    flies: 0,
    worms: 0,
    eggs: 0,
    fruit: 0,
    detritus: 0,
    sugar: 0,
    poison: 0,
  },
  maxGen: 0,
  births: 0,
  deaths: 0,
  stats: [],
  selected: null,
  extinctFly: false,
  extinctWorm: false,
}

const TICK = 1 / 30

export function useSimulation(): SimApi {
  // El mundo se crea tras montar (evita mismatch de hidratación por Math.random).
  const worldRef = useRef<World | null>(null)
  const rendererRef = useRef<((now: number) => void) | null>(null)
  const pausedRef = useRef(false)
  const speedRef = useRef(1)
  const [ui, setUi] = useState<WorldView>(EMPTY_VIEW)
  const [paused, setPaused] = useState(false)
  const [speed, setSpeedState] = useState(1)
  const [mode, setModeState] = useState<SimMode>('ecosystem')

  useEffect(() => {
    const world = new World()
    worldRef.current = world

    let raf = 0
    let last = performance.now()
    let acc = 0
    // -Infinity fuerza que el primer frame publique el snapshot inicial
    // (dentro del callback del rAF, nunca de forma sincrónica en el efecto).
    let lastUi = -Infinity

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const frameDt = Math.min((now - last) / 1000, 0.2)
      last = now
      if (!pausedRef.current) {
        acc = Math.min(acc + frameDt * speedRef.current, 0.5)
        const maxTicks = Math.max(4, Math.ceil(speedRef.current * 2))
        let n = 0
        while (acc >= TICK && n < maxTicks) {
          world.step(TICK)
          acc -= TICK
          n++
        }
        if (acc >= TICK) acc = TICK // descartamos backlog si no da abasto
      }
      rendererRef.current?.(now)
      if (now - lastUi >= 220) {
        lastUi = now
        setUi(world.snapshot())
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      worldRef.current = null
    }
  }, [])

  const refresh = useCallback(() => {
    const w = worldRef.current
    if (w) setUi(w.snapshot())
  }, [])

  const setMode = useCallback(
    (m: SimMode) => {
      const w = worldRef.current
      if (!w || w.mode === m) return
      w.setMode(m)
      setModeState(m)
      refresh()
    },
    [refresh],
  )

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }, [])

  const setSpeed = useCallback((v: number) => {
    speedRef.current = v
    setSpeedState(v)
  }, [])

  const reset = useCallback(() => {
    worldRef.current?.reset()
    refresh()
  }, [refresh])

  const setEnv = useCallback((patch: Partial<EnvParams>) => {
    const w = worldRef.current
    if (w) Object.assign(w.env, patch)
  }, [])

  const selectAt = useCallback(
    (x: number, y: number) => {
      const w = worldRef.current
      if (!w) return false
      const hit = w.selectAt(x, y)
      if (hit) refresh()
      return hit
    },
    [refresh],
  )

  const deselect = useCallback(() => {
    worldRef.current?.deselect()
    refresh()
  }, [refresh])

  const followRandom = useCallback(
    (s: Species) => {
      const w = worldRef.current
      if (!w) return false
      const ok = w.followRandom(s)
      if (ok) refresh()
      return ok
    },
    [refresh],
  )

  const reintroduce = useCallback(
    (s: Species) => {
      const n = worldRef.current?.reintroduce(s) ?? 0
      refresh()
      return n
    },
    [refresh],
  )

  const seedFromRecord = useCallback(
    (rec: EvolutionRecordDTO) => {
      const n = worldRef.current?.seedFromRecord(rec) ?? 0
      refresh()
      return n
    },
    [refresh],
  )

  const getElite = useCallback(() => worldRef.current?.getElite() ?? [], [])

  const registerRenderer = useCallback(
    (fn: ((now: number) => void) | null) => {
      rendererRef.current = fn
    },
    [],
  )

  const getWorld = useCallback(() => worldRef.current, [])

  // ——— Laboratorio ———

  const stimulate = useCallback(
    (kind: StimKind, x: number, y: number) => {
      worldRef.current?.stimulate(kind, x, y)
      refresh()
    },
    [refresh],
  )

  const setKnockout = useCallback(
    (species: Species, key: string, on: boolean) => {
      worldRef.current?.setKnockout(species, key, on)
      refresh()
    },
    [refresh],
  )

  const knockoutOn = useCallback(
    (species: Species, key: string) => worldRef.current?.knockoutOn(species, key) ?? false,
    [],
  )

  /** Coloca comida del tipo dado (fruta/azúcar/detrito/veneno/cebo amargo). */
  const dropFood = useCallback(
    (kind: FoodKind, x: number, y: number) => {
      worldRef.current?.addFoodAt(kind, x, y)
      refresh()
    },
    [refresh],
  )

  // ——— Arena ———

  const arenaAddWall = useCallback(
    (w: Wall) => {
      worldRef.current?.arenaAddWall(w)
      refresh()
    },
    [refresh],
  )

  const arenaUndoWall = useCallback(() => {
    worldRef.current?.arenaUndoWall()
    refresh()
  }, [refresh])

  const arenaSetGoal = useCallback(
    (g: ArenaGoal | null) => {
      worldRef.current?.arenaSetGoal(g)
      refresh()
    },
    [refresh],
  )

  const arenaClear = useCallback(() => {
    worldRef.current?.arenaClear()
    refresh()
  }, [refresh])

  const spawnAt = useCallback(
    (species: Species, kind: BrainKind, x: number, y: number, genome?: Float32Array) => {
      const c = worldRef.current?.spawnAt(species, kind, x, y, genome) ?? null
      refresh()
      return c
    },
    [refresh],
  )

  const arenaStart = useCallback(() => {
    worldRef.current?.arenaStart()
    refresh()
  }, [refresh])

  return {
    ui,
    paused,
    speed,
    mode,
    setMode,
    togglePause,
    setSpeed,
    reset,
    setEnv,
    selectAt,
    deselect,
    followRandom,
    reintroduce,
    seedFromRecord,
    getElite,
    registerRenderer,
    getWorld,
    stimulate,
    setKnockout,
    knockoutOn,
    dropFood,
    arenaAddWall,
    arenaUndoWall,
    arenaSetGoal,
    arenaClear,
    spawnAt,
    arenaStart,
  }
}
