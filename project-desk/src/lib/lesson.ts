import type { EnglishCard } from '@/lib/english'

export const WORDS_PER_LESSON = 5
export const LESSONS_PER_UNIT = 4
export const HEARTS = 5
export const XP_PER_CORRECT = 10

const STORAGE_KEY = 'projectdesk.english.progress'

export type LessonProgress = {
  xp: number
  streak: number
  lastDay: string
  completed: number[]
}

export type MeaningQuestion = {
  id: string
  kind: 'meaning'
  prompt: string
  answer: string
  choices: string[]
  why: string
  chinese: string
}

export type ClozeQuestion = {
  id: string
  kind: 'cloze'
  before: string
  after: string
  answer: string
  choices: string[]
  why: string
  chinese: string
}

export type DefinitionQuestion = {
  id: string
  kind: 'definition'
  prompt: string
  answer: string
  choices: string[]
  why: string
  chinese: string
}

export type Question = MeaningQuestion | ClozeQuestion | DefinitionQuestion

export function matchesLessonAnswer(choice: string, answer: string): boolean {
  return choice.trim().toLowerCase() === answer.trim().toLowerCase()
}

const emptyProgress = (): LessonProgress => ({ xp: 0, streak: 0, lastDay: '', completed: [] })

export function loadProgress(): LessonProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyProgress()
    const parsed = JSON.parse(raw) as Partial<LessonProgress>
    return {
      xp: Number(parsed.xp) || 0,
      streak: Number(parsed.streak) || 0,
      lastDay: typeof parsed.lastDay === 'string' ? parsed.lastDay : '',
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((n) => Number.isInteger(n)) : [],
    }
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(progress: LessonProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
}

export function localDay(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function previousDay(day: string): string {
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() - 1)
  return localDay(date)
}

export function lessonCount(total: number): number {
  return Math.ceil(total / WORDS_PER_LESSON)
}

export function sortedCards(cards: EnglishCard[]): EnglishCard[] {
  return [...cards].sort((a, b) => a.word.localeCompare(b.word))
}

export function lessonWords(cards: EnglishCard[], index: number): EnglishCard[] {
  const start = index * WORDS_PER_LESSON
  return sortedCards(cards).slice(start, start + WORDS_PER_LESSON)
}

export function currentLesson(completed: number[], count: number): number {
  for (let index = 0; index < count; index += 1) {
    if (!completed.includes(index)) return index
  }
  return Math.max(0, count - 1)
}

export function isLessonOpen(index: number, completed: number[]): boolean {
  return index === 0 || completed.includes(index - 1)
}

export function recordCompletion(progress: LessonProgress, lesson: number, correct: number, day = localDay()): LessonProgress {
  const completed = progress.completed.includes(lesson) ? progress.completed : [...progress.completed, lesson]
  let streak = progress.streak
  if (progress.lastDay !== day) {
    streak = progress.lastDay === previousDay(day) ? progress.streak + 1 : 1
  }
  const next = {
    xp: progress.xp + correct * XP_PER_CORRECT,
    streak,
    lastDay: day,
    completed,
  }
  saveProgress(next)
  return next
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const item = copy[index]
    copy[index] = copy[swap]
    copy[swap] = item
  }
  return copy
}

function others(values: string[], answer: string, random: () => number): string[] {
  const unique = [...new Set(values.filter((value) => value && value !== answer))]
  return shuffle(unique, random)
}

function blank(sentence: string, word: string): { before: string; after: string } | null {
  const match = sentence.toLowerCase().indexOf(word.toLowerCase())
  if (match < 0) return null
  return { before: sentence.slice(0, match), after: sentence.slice(match + word.length) }
}

export function buildQuestions(words: EnglishCard[], pool: EnglishCard[], random: () => number = Math.random): Question[] {
  const questions: Question[] = []
  const poolMeanings = pool.map((item) => item.meaning)
  const poolWords = pool.map((item) => item.word)

  for (const card of words) {
    const meanings = others(poolMeanings, card.meaning, random)
    if (meanings.length >= 3) {
      questions.push({
        id: `${card.id}-meaning`,
        kind: 'meaning',
        prompt: card.word,
        answer: card.meaning,
        choices: shuffle([card.meaning, ...meanings.slice(0, 3)], random),
        why: `${card.word} 的核心考点释义为：${card.meaning}`,
        chinese: card.meaning,
      })
    }

    // Look for sentence in examples or band writing
    const allExamples: string[] = [
      ...(card.examples || []),
      ...(card.band?.examples || []),
      ...(card.band?.writing ? [card.band.writing] : []),
    ]
    const sentence = allExamples.find((example) => example.toLowerCase().includes(card.word.toLowerCase()))
    const parts = sentence ? blank(sentence, card.word) : null
    const otherWords = others(poolWords, card.word, random)

    if (parts && otherWords.length >= 3) {
      questions.push({
        id: `${card.id}-cloze`,
        kind: 'cloze',
        before: parts.before,
        after: parts.after,
        answer: card.word,
        choices: shuffle([card.word, ...otherWords.slice(0, 3)], random),
        why: `考点填空解析：在真题语境中，“${card.word}”作为正解填入，句意完整贴切。`,
        chinese: card.meaning,
      })
    } else if (otherWords.length >= 3) {
      // Fallback definition question to ensure 100% question availability
      questions.push({
        id: `${card.id}-def`,
        kind: 'definition',
        prompt: `下列哪个词表示：“${card.meaning}”？`,
        answer: card.word,
        choices: shuffle([card.word, ...otherWords.slice(0, 3)], random),
        why: `精准对应词义：“${card.meaning}” 对应的目标学术词汇是 ${card.word}。`,
        chinese: card.meaning,
      })
    }
  }

  // Pick up to 5 questions
  const shuffled = shuffle(questions, random)
  return shuffled.slice(0, 5)
}
