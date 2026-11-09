export type WordSense = {
  pos: string
  en: string
  zh: string
}

export type BandNote = {
  collocations: string[]
  writing: string
  writingZh?: string
  speaking: string
  speakingZh?: string
  examples?: string[]
  examplesZh?: string[]
  weak: string
  fix: string
  fixZh?: string
  paraphrases: string[]
  zh: string
}

export type EnglishCard = {
  id: string
  word: string
  meaning: string
  examples: string[]
  inReview: boolean
  generated: boolean
  pronunciation: string
  senses: WordSense[]
  band: BandNote
  updatedAt: string
}
