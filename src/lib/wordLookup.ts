import { loadWordIndex } from './wordIndex'
import type { WordCategory } from '../types/phonetics'

export interface WordLookup {
  /** Mots à lier directement (dans le lexique, catégorie de sens, pas trop courants) -> leur catégorie. */
  linkable: Map<string, WordCategory>
  /** TOUS les mots du lexique, quels que soient catégorie/fréquence — sert à ne PAS relier "le"/"plus"
   *  via le repli "mot absent du lexique" (voir plus bas), eux sont bien présents mais volontairement exclus. */
  connu: Set<string>
}

let cached: Promise<WordLookup> | null = null

/**
 * Un même mot peut apparaître dans plusieurs catégories (homographes) : la
 * première rencontrée est gardée pour `linkable` — sans grande importance
 * ici, chercherDefinition retombe de toute façon sur la recherche pleine
 * page côté Wiktionnaire si la section de la catégorie indiquée ne
 * correspond pas (voir wiktionnaire.ts).
 *
 * Catégorie "invariable" volontairement exclue de `linkable` : articles,
 * pronoms, conjonctions, prépositions ("le", "et", "dans"...) n'ont aucun
 * intérêt à être cliquables — ce sont les mots de liaison les plus
 * fréquents de n'importe quelle phrase, les inclure noierait les vrais mots
 * de sens (noms, adjectifs, verbes, adverbes) sous une quantité de liens
 * inutiles.
 *
 * Un seuil de fréquence complète ce premier filtre : certains mots-outils
 * héritent à tort d'une fréquence très haute et d'une catégorie nom/adverbe/
 * verbe dans Lexique383 à cause d'un homographe rare (ex. "plus" tagué nom
 * au sens du signe mathématique, mais avec la fréquence de "plus" adverbe de
 * comparaison, omniprésent) — invisibles à un simple filtre par catégorie.
 * Au-delà de ce seuil, le mot est de toute façon déjà bien connu d'un enfant
 * de primaire : pas besoin qu'il soit cliquable, seuls les mots plus rares
 * (ex. "colibri", "rongeur") ont vraiment besoin de ce lien.
 */
const SEUIL_FREQUENCE_LIEN = 60

export function loadWordLookup(): Promise<WordLookup> {
  if (!cached) {
    cached = loadWordIndex().then((entries) => {
      const linkable = new Map<string, WordCategory>()
      const connu = new Set<string>()
      for (const e of entries) {
        const cle = e.word.toLowerCase()
        connu.add(cle)
        if (e.category === 'invariable' || e.frequency > SEUIL_FREQUENCE_LIEN) continue
        if (!linkable.has(cle)) linkable.set(cle, e.category)
      }
      return { linkable, connu }
    })
  }
  return cached
}
