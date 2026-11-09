import { useEffect, useSyncExternalStore } from 'react'
import { completeVocabularyLesson, getLearningProgress, importLearningProgress } from '@/lib/api'
import { loadProgress } from '@/lib/lesson'
import type { LearningProgress } from '@/lib/reading'

let snapshot: { progress: LearningProgress | null; error: boolean } = { progress: null, error: false }
let pending: Promise<LearningProgress> | null = null
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const getSnapshot = () => snapshot
function publish(progress: LearningProgress | null, error = false) {
  snapshot = { progress, error }
  for (const listener of listeners) listener()
}

export function refreshLearningProgress(): Promise<LearningProgress> {
  if (pending) return pending
  pending = (async () => {
    let progress = await getLearningProgress()
    const legacy = loadProgress()
    if (!progress.legacyImported && (legacy.xp > 0 || legacy.completed.length > 0)) progress = await importLearningProgress(legacy)
    publish(progress)
    return progress
  })().catch((error: unknown) => { publish(snapshot.progress, true); throw error }).finally(() => { pending = null })
  return pending
}

export async function recordVocabularyCompletion(lesson: number, correct: number): Promise<LearningProgress> {
  await refreshLearningProgress()
  const progress = await completeVocabularyLesson(lesson, correct)
  publish(progress)
  return progress
}

export function useLearningProgress() {
  const current = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => {
    void refreshLearningProgress().catch(() => {})
    const refresh = () => { void refreshLearningProgress().catch(() => {}) }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  return current
}
