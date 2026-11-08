export const EXAMPLE_COUNT = 10

export type EnglishCard = {
  id: string
  word: string
  meaning: string
  examples: string[]
  inReview: boolean
  generated: boolean
  updatedAt: string
}

export type EnglishInput = {
  word: string
  meaning: string
  examples: string[]
}

export type EnglishErrors = Partial<{
  word: string
  meaning: string
  form: string
  examples: Array<string | undefined>
}>

export function emptyExamples(): string[] {
  return Array.from({ length: EXAMPLE_COUNT }, () => '')
}

export function hasEnglishErrors(errors: EnglishErrors): boolean {
  return Boolean(errors.word || errors.meaning || errors.form || errors.examples?.some(Boolean))
}

export function validateEnglish(input: EnglishInput): EnglishErrors {
  const errors: EnglishErrors = {}
  const word = input.word.trim()
  const meaning = input.meaning.trim()
  const examples = input.examples.map((sentence) => sentence.trim())

  if (!word) errors.word = 'Enter a word.'
  else if ([...word].length > 80) errors.word = 'Keep the word under 80 characters.'

  if (!meaning) errors.meaning = 'Enter a meaning.'
  else if ([...meaning].length > 160) errors.meaning = 'Keep the meaning under 160 characters.'

  if (examples.length !== EXAMPLE_COUNT) {
    errors.form = 'Write ten examples.'
    return errors
  }

  examples.forEach((example, index) => {
    let message: string | undefined
    if (!example) message = 'Enter an example.'
    else if ([...example].length > 280) message = 'Keep the example under 280 characters.'
    else if (word && !example.toLowerCase().includes(word.toLowerCase())) {
      message = 'Use the word in the example sentence.'
    }
    if (message) {
      errors.examples ??= Array.from({ length: EXAMPLE_COUNT })
      errors.examples[index] = message
    }
  })

  return errors
}
