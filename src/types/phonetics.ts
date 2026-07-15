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
  /**
   * Geste(s) Borel-Maisonny (photo/dessin). Un seul élément pour la plupart
   * des touches ; deux pour les "touches doubles" qui fusionnent 2 sons
   * ayant chacun leur propre geste (ex. é/è). Absent pour w et ui (pas de
   * geste dédié dans la méthode). Affiché dans la fiche du son, pas sur la
   * touche elle-même (pour ne pas surcharger le clavier).
   */
  gestureImages?: string[]
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
  /**
   * Uniquement pour les noms dont le lemme a un féminin distinct (ex. chat/
   * chatte, renard/renarde) : genre de CETTE forme précise. formRole ne
   * porte que le nombre (singulier/pluriel) pour les noms, donc sans ce
   * champ deux formes de genre différent au même nombre (ex. "chat" et
   * "chatte", toutes deux "singulier") seraient indiscernables.
   */
  genre?: 'm' | 'f'
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

/** One "mot de la même famille" (Démonette), shown on the fiche mot. */
export interface WordFamilyMember {
  word: string
  category: WordCategory
  lemmaId: string
  /**
   * false pour un mot qui est dans Manulex (donc scolaire) mais sous le
   * seuil de fréquence du lexique principal (words-clavier2.json) — il n'a
   * pas sa propre fiche mot, donc pas cliquable, juste affiché à titre
   * indicatif (ex. "maisonnette", famille de "maison").
   */
  inLexicon: boolean
}

/** src/data/word-families.json : lemmaId -> ses mots de la même famille présents dans notre lexique. */
export type WordFamilyIndex = Record<string, WordFamilyMember[]>
