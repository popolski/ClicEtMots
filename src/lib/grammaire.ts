// Référentiel unique des libellés, couleurs et mascottes de catégorie
// grammaticale. Ces constantes étaient auparavant recopiées dans chaque
// composant qui affiche un mot (fiche, résultats, historique, favoris, mots
// de la semaine, fiches imprimables, quiz) : "petite duplication assumée"
// qui a fini par coûter un vrai bug - l'ajout de "Pronom personnel" et
// "Préposition" n'avait été fait que dans deux fichiers sur six, et les
// autres écrans continuaient d'afficher "Mot invariable" pour "elle" ou
// "avec".
import { natureInvariable, type NatureInvariable } from './natureInvariable'
import type { WordCategory } from '../types/phonetics'

export const CATEGORY_LABEL: Record<WordCategory, string> = {
  nom: 'Nom',
  adjectif: 'Adjectif',
  verbe: 'Verbe',
  invariable: 'Mot invariable',
  adverbe: 'Adverbe',
}

// Couleurs choisies par l'enseignante : nom=bleu, adjectif=violet,
// verbe=rouge foncé, invariable=rouge clair, adverbe=orange.
export const CATEGORY_STYLES: Record<WordCategory, string> = {
  nom: 'bg-blue-50 text-blue-900 border-blue-200',
  adjectif: 'bg-violet-50 text-violet-900 border-violet-200',
  verbe: 'bg-red-200 text-red-900 border-red-400',
  invariable: 'bg-red-50 text-red-500 border-red-100',
  adverbe: 'bg-orange-50 text-orange-900 border-orange-200',
}

export const CATEGORY_MASCOT: Record<WordCategory, string> = {
  nom: '/mascottes/nom.png',
  adjectif: '/mascottes/adjectif.png',
  verbe: '/mascottes/verbe.png',
  invariable: '/mascottes/invariable.png',
  adverbe: '/mascottes/adverbe.png',
}

// Variante utilisée là où le verbe est TOUJOURS affiché à l'infinitif : la
// fiche mot et le bandeau imprimable. Ailleurs (résultats, historique,
// quiz), seul le mot est montré sans son rôle précis, donc la mascotte
// "Verbe" générique convient. La mascotte "infinitif" reste par ailleurs
// celle du conjugueur, onglet Présent (voir ConjugueurTool.TENSE_MASCOT).
export const CATEGORY_MASCOT_INFINITIF: Record<WordCategory, string> = {
  ...CATEGORY_MASCOT,
  verbe: '/mascottes/verbe-infinitif.png',
}

export const NATURE_INVARIABLE_LABEL: Record<NatureInvariable, string> = {
  pronom: 'Pronom personnel',
  preposition: 'Préposition',
}

export const NATURE_INVARIABLE_MASCOT: Record<NatureInvariable, string> = {
  pronom: '/mascottes/pronom.png',
  preposition: '/mascottes/preposition.png',
}

/**
 * Libellé et mascotte à afficher pour un mot, dans les vues COMPACTES
 * (résultats de recherche, historique, favoris, mots de la semaine, bandeau
 * imprimable) : quand la nature précise d'un mot invariable est connue
 * (pronom personnel, préposition), elle REMPLACE le générique "Mot
 * invariable", faute de place pour les deux.
 *
 * La fiche mot fait exception et affiche les deux côte à côte ("invariable"
 * reste vrai, "pronom" est juste plus précis) : elle compose donc
 * elle-même à partir des constantes ci-dessus plutôt que d'utiliser cette
 * fonction.
 */
export function affichageCategorie(
  entree: { word: string; category: WordCategory },
  options: { infinitif?: boolean } = {},
): { libelle: string; mascotte: string } {
  const nature = entree.category === 'invariable' ? natureInvariable(entree.word) : null
  if (nature) {
    return { libelle: NATURE_INVARIABLE_LABEL[nature], mascotte: NATURE_INVARIABLE_MASCOT[nature] }
  }
  const mascottes = options.infinitif ? CATEGORY_MASCOT_INFINITIF : CATEGORY_MASCOT
  return { libelle: CATEGORY_LABEL[entree.category], mascotte: mascottes[entree.category] }
}
