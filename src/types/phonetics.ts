/** Curated, pedagogically-reviewed phoneme identifier (our own ID space — NOT Lexique383's phon alphabet). */
export type PhonemeId = string

export interface GraphemeExample {
  /** Spelling variant, e.g. "eau", "au", "o" for the phoneme /o/. */
  grapheme: string
  exampleWord: string
  /** Absent in v1 (text placeholder); swappable to an image path later without a breaking change. */
  exampleImage?: string
}

export interface Phoneme {
  id: PhonemeId
  /** Large symbol shown on the tile itself (usually the most common grapheme). */
  displaySymbol: string
  graphemes: GraphemeExample[]
  /** Position in the keyboard grid. */
  order: number
  level: 1 | 2 | 'both'
}

export type PhonemeTable = Phoneme[]

export interface WordEntry {
  word: string
  /** Ordered sequence of our PhonemeIds — the lookup key. */
  phonemes: PhonemeId[]
  frequency: number
  level: 1 | 2
}

export type WordIndex = WordEntry[]
