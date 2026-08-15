// Lexique383 ne distingue pas, à l'intérieur de la catégorie "invariable",
// les pronoms personnels des prépositions (ni des conjonctions/interjections,
// non couvertes ici) - ces deux listes, choisies à la main parmi les mots
// invariables du lexique, comblent ce manque pour le quiz de grammaire
// (QuizTool) et la fiche mot (MotTool/WordCardView), qui doivent rester
// cohérents entre eux sur ce qu'ils appellent "pronom"/"préposition".
export const PRONOMS_PERSONNELS = new Set([
  'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles', 'on', 'moi', 'toi', 'eux',
])

export const PREPOSITIONS = new Set([
  'à', 'dans', 'sur', 'sous', 'avec', 'pour', 'par', 'chez', 'vers', 'entre', 'contre',
  'sans', 'depuis', 'avant', 'après', 'pendant', 'devant', 'derrière', 'malgré', 'selon', 'parmi',
])

export type NatureInvariable = 'pronom' | 'preposition'

/** null = mot invariable dont on ne connaît pas la nature précise (conjonction, interjection...). */
export function natureInvariable(word: string): NatureInvariable | null {
  const mot = word.toLowerCase()
  if (PRONOMS_PERSONNELS.has(mot)) return 'pronom'
  if (PREPOSITIONS.has(mot)) return 'preposition'
  return null
}
