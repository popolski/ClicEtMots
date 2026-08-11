import { loadWordIndex } from './wordIndex'
import type { WordCategory } from '../types/phonetics'

let cached: Promise<Map<string, WordCategory>> | null = null

/**
 * Table mot (minuscule) -> catégorie, pour repérer quels mots d'un texte
 * libre (ex. une définition) existent dans notre lexique et peuvent devenir
 * cliquables. Un même mot peut apparaître dans plusieurs catégories
 * (homographes) : la première rencontrée est gardée — sans grande
 * importance ici, chercherDefinition retombe de toute façon sur la
 * recherche pleine page côté Wiktionnaire si la section de la catégorie
 * indiquée ne correspond pas (voir wiktionnaire.ts).
 *
 * Catégorie "invariable" volontairement exclue : articles, pronoms,
 * conjonctions, prépositions ("le", "et", "dans"...) n'ont aucun intérêt à
 * être cliquables — ce sont les mots de liaison les plus fréquents de
 * n'importe quelle phrase, les inclure noierait les vrais mots de sens
 * (noms, adjectifs, verbes, adverbes) sous une quantité de liens inutiles.
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

export function loadWordLookup(): Promise<Map<string, WordCategory>> {
  if (!cached) {
    cached = loadWordIndex().then((entries) => {
      const map = new Map<string, WordCategory>()
      for (const e of entries) {
        if (e.category === 'invariable' || e.frequency > SEUIL_FREQUENCE_LIEN) continue
        const cle = e.word.toLowerCase()
        if (!map.has(cle)) map.set(cle, e.category)
      }
      return map
    })
  }
  return cached
}
