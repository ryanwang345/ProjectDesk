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

  const missingDetails = cards.reduce((count, card) => count + (!card.pronunciation || (card.senses ?? []).length === 0 ? 1 : 0), 0)
  const awaitingDetail = ready && missingDetails > 0 && missingDetails <= 80
  useEffect(() => {
    if (!awaitingDetail) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - started > 480_000) {
        window.clearInterval(timer)
        return
      }
      void listEnglish().then(setCards).catch(() => {})
    }, 4000)
    return () => window.clearInterval(timer)
  }, [awaitingDetail])

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

  const adoptCard = useCallback((saved: EnglishCard) => {
    setCards((current) => current.map((card) => (card.id === saved.id ? saved : card)))
  }, [])

  return { cards, ready, problem, addCard, saveCard, markReview, removeCard, adoptCard }
}
