import { useCallback, useEffect, useRef, useState } from 'react'
import { getWorkflow } from '@/lib/api'
import { hasActiveJob, type Workflow } from '@/lib/platform'

/**
 * Loads a cycle's workflow bundle and polls while a job is queued or
 * running. The worker runs in the Go API, so a reload never loses work;
 * polling only keeps the screen current.
 */
export function useWorkflow(cycleId: string, onCycleUpdated?: (workflow: Workflow) => void) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [error, setError] = useState('')
  const lastUpdated = useRef<string | null>(null)
  const notify = useRef(onCycleUpdated)
  useEffect(() => {
    notify.current = onCycleUpdated
  }, [onCycleUpdated])

  const refresh = useCallback(async () => {
    try {
      const next = await getWorkflow(cycleId)
      setWorkflow(next)
      setError('')
      if (lastUpdated.current !== null && lastUpdated.current !== next.cycle.updatedAt) {
        notify.current?.(next)
      }
      lastUpdated.current = next.cycle.updatedAt
      return next
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The AI loop could not load.')
      return null
    }
  }, [cycleId])

  // The panel is mounted per cycle (keyed by id upstream), so the first
  // load is the only one that needs to run here.
  useEffect(() => {
    void refresh()
  }, [refresh])

  const active = workflow ? hasActiveJob(workflow.jobs) : false
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => void refresh(), 1500)
    return () => window.clearInterval(timer)
  }, [active, refresh])

  return { workflow, error, refresh, active }
}
