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
  /** Geste Borel-Maisonny (photo/dessin), un par son — absent pour les 2 sons sans geste dédié (w, ui). */
  gestureImage?: string
  /** Piège(s) orthographique(s) ou règle (ex. "Règle du M, B, P") à afficher dans la fiche du son. */
  note?: string
}

export type PhonemeTable = Phoneme[]

/** Grammatical category, used to color-code results (matches the original tool's convention). */
export type WordCategory = 'nom' | 'adjectif' | 'verbe' | 'invariable' | 'adverbe'

/**
 * Which inflected form a WordEntry represents within its word family. Drives
 * how forms are laid out inside a WordCard (matches the original tool's
 * results page, which groups singulier/pluriel, masculin/féminin, and the
 * 4 verb forms into one card rather than listing each form separately).
 */
export type WordFormRole =
  | 'simple'
  | 'singulier'
  | 'pluriel'
  | 'masculin'
  | 'féminin'
  | 'infinitif'
  | 'participe_passé'
  | 'il_elle_on'
  | 'ils_elles'

export interface WordEntry {
  word: string
  /** Ordered sequence of our PhonemeIds — the lookup key. */
  phonemes: PhonemeId[]
  frequency: number
  level: 1 | 2
  category: WordCategory
  /** Groups forms of the same word family into one WordCard. */
  lemmaId: string
  formRole: WordFormRole
}

export type WordIndex = WordEntry[]

/** A group of WordEntry forms belonging to the same word family, rendered as one card. */
export interface WordCard {
  lemmaId: string
  category: WordCategory
  forms: WordEntry[]
  /** Highest frequency among the card's forms — drives card-level ranking/pagination. */
  frequency: number
}
