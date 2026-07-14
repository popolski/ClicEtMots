export interface VerbConjugation {
  infinitif: string
  auxiliaire: 'avoir' | 'être'
  present: Record<string, string>
  futur: Record<string, string>
  imparfait: Record<string, string>
  passeCompose: Record<string, string>
}

export type ConjugationIndex = Record<string, VerbConjugation>

let cached: Promise<ConjugationIndex> | null = null

/** Charge le tableau de conjugaisons (lazy import, ~2,5 Mo). */
export function loadConjugations(): Promise<ConjugationIndex> {
  if (!cached) {
    cached = import('../data/conjugations.json').then((m) => m.default as ConjugationIndex)
  }
  return cached
}
