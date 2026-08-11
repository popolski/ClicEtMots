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
 */
export function loadWordLookup(): Promise<Map<string, WordCategory>> {
  if (!cached) {
    cached = loadWordIndex().then((entries) => {
      const map = new Map<string, WordCategory>()
      for (const e of entries) {
        const cle = e.word.toLowerCase()
        if (!map.has(cle)) map.set(cle, e.category)
      }
      return map
    })
  }
  return cached
}
