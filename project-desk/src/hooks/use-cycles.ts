import { useCallback, useEffect, useState } from 'react'
import {
  createCycle as createCycleRequest,
  deleteCycle as deleteCycleRequest,
  listCycles,
  loadSampleCycle,
  updateCycle as updateCycleRequest,
} from '@/lib/api'
import type { Cycle, CycleInput } from '@/lib/loop'
import type { StorageProblem } from '@/lib/projects'

export function useCycles() {
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState<StorageProblem | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await listCycles()
      setCycles(next)
      setProblem(null)
    } catch {
      setCycles([])
      setProblem('unavailable')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const addCycle = useCallback(async (input: CycleInput) => {
    try {
      const created = await createCycleRequest(input)
      setCycles((current) => [created, ...current.filter((cycle) => cycle.id !== created.id)])
      setProblem(null)
      return created
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const saveCycle = useCallback(async (id: string, input: CycleInput) => {
    try {
      const saved = await updateCycleRequest(id, input)
      setCycles((current) => current.map((cycle) => (cycle.id === id ? saved : cycle)))
      setProblem(null)
      return saved
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const removeCycle = useCallback(async (id: string) => {
    const previous = cycles
    setCycles((current) => current.filter((cycle) => cycle.id !== id))
    try {
      await deleteCycleRequest(id)
      setProblem(null)
    } catch (error) {
      setCycles(previous)
      setProblem('write-failed')
      throw error
    }
  }, [cycles])

  const addSample = useCallback(async () => {
    try {
      const created = await loadSampleCycle()
      setCycles((current) => [created, ...current])
      setProblem(null)
      return created
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  /** Merge a cycle the server changed outside the editor (AI loop steps). */
  const absorbCycle = useCallback((cycle: Cycle) => {
    setCycles((current) =>
      current.some((item) => item.id === cycle.id)
        ? current.map((item) => (item.id === cycle.id ? cycle : item))
        : [cycle, ...current],
    )
  }, [])

  return { cycles, ready, problem, addCycle, saveCycle, removeCycle, addSample, absorbCycle, reload: load }
}
