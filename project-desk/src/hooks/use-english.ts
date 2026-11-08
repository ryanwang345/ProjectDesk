import { useCallback, useEffect, useState } from 'react'
import {
  createEnglish,
  deleteEnglish,
  listEnglish,
  setEnglishReview,
  updateEnglish,
} from '@/lib/api'
import type { EnglishCard, EnglishInput } from '@/lib/english'
import type { StorageProblem } from '@/lib/projects'

export function useEnglish() {
  const [cards, setCards] = useState<EnglishCard[]>([])
  const [ready, setReady] = useState(false)
  const [problem, setProblem] = useState<StorageProblem | null>(null)

  const load = useCallback(async () => {
    try {
      setCards(await listEnglish())
      setProblem(null)
    } catch {
      setCards([])
      setProblem('unavailable')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const awaitingPronunciation = ready && cards.some((card) => !card.pronunciation)
  useEffect(() => {
    if (!awaitingPronunciation) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - started > 180_000) {
        window.clearInterval(timer)
        return
      }
      void listEnglish().then(setCards).catch(() => {})
    }, 4000)
    return () => window.clearInterval(timer)
  }, [awaitingPronunciation])

  const addCard = useCallback(async (input: EnglishInput) => {
    try {
      const created = await createEnglish(input)
      setCards((current) => [created, ...current])
      setProblem(null)
      return created
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const saveCard = useCallback(async (id: string, input: EnglishInput) => {
    try {
      const saved = await updateEnglish(id, input)
      setCards((current) => current.map((card) => (card.id === id ? saved : card)))
      setProblem(null)
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const markReview = useCallback(async (id: string, inReview: boolean) => {
    try {
      const saved = await setEnglishReview(id, inReview)
      setCards((current) => current.map((card) => (card.id === id ? saved : card)))
      setProblem(null)
    } catch (error) {
      setProblem('write-failed')
      throw error
    }
  }, [])

  const removeCard = useCallback(async (id: string) => {
    const previous = cards
    setCards((current) => current.filter((card) => card.id !== id))
    try {
      await deleteEnglish(id)
      setProblem(null)
    } catch (error) {
      setCards(previous)
      setProblem('write-failed')
      throw error
    }
  }, [cards])

  return { cards, ready, problem, addCard, saveCard, markReview, removeCard }
}
