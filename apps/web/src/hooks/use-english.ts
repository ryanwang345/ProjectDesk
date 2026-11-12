import { useCallback, useEffect, useState } from 'react'
import {
  deleteEnglish,
  getCachedEnglishCards,
  listEnglish,
  setEnglishReview,
} from '@/lib/api'
import type { EnglishCard } from '@/lib/english'
import type { StorageProblem } from '@/lib/projects'

export function useEnglish() {
  const [cards, setCards] = useState<EnglishCard[]>(getCachedEnglishCards)
  const [ready, setReady] = useState(true)
  const [problem, setProblem] = useState<StorageProblem | null>(null)

  const load = useCallback(async () => {
    try {
      const fresh = await listEnglish()
      setCards(fresh)
      setProblem(null)
    } catch {
      setProblem('unavailable')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const missingDetails = cards.reduce((count, card) => count + (!card.pronunciation ? 1 : 0), 0)
  const awaitingDetail = ready && missingDetails > 0 && missingDetails <= 80
  useEffect(() => {
    if (!awaitingDetail) return
    const started = Date.now()
    const timer = window.setInterval(() => {
      if (Date.now() - started > 480_000) {
        window.clearInterval(timer)
        return
      }
      void listEnglish().then((fresh) => {
        setCards((prev) => {
          if (prev.length !== fresh.length) return fresh
          const prevMissing = prev.reduce((count, card) => count + (!card.pronunciation ? 1 : 0), 0)
          const freshMissing = fresh.reduce((count, card) => count + (!card.pronunciation ? 1 : 0), 0)
          if (prevMissing !== freshMissing) return fresh
          return prev
        })
      }).catch(() => {})
    }, 4000)
    return () => window.clearInterval(timer)
  }, [awaitingDetail])

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
    setCards((current) => {
      const idx = current.findIndex(
        (c) => c.id === saved.id || c.word.trim().toLowerCase() === saved.word.trim().toLowerCase(),
      )
      if (idx >= 0) {
        const next = [...current]
        next[idx] = saved
        return next
      }
      return [saved, ...current]
    })
  }, [])

  const adoptBatch = useCallback((newCards: EnglishCard[]) => {
    setCards((current) => {
      const existingMap = new Map(current.map((c) => [c.word.trim().toLowerCase(), c]))
      for (const card of newCards) {
        existingMap.set(card.word.trim().toLowerCase(), card)
      }
      return Array.from(existingMap.values())
    })
  }, [])

  return { cards, ready, problem, markReview, removeCard, adoptCard, adoptBatch, reload: load }
}
