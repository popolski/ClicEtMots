// Agrège le vocabulaire vu en classe sur une période donnée, à partir des
// listes de mots de la semaine déjà enregistrées - pour l'export PDF "bilan
// lexique" de l'espace enseignant. Extrait pour être testable, comme les
// autres modules de logique du projet - voir bilanLexiqueLogic.test.ts.
//
// Distinct de bilanLogic.ts : celui-ci porte sur le VOCABULAIRE vu (mots de
// la semaine), pas sur les résultats de quiz.
import { natureInvariable } from './natureInvariable'
import type { ListeMotsSemaine, MotDeListe } from './api'

export type CategorieBilan = 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'pronom' | 'preposition' | 'autre-invariable'

export const CATEGORIE_BILAN_LABEL: Record<CategorieBilan, string> = {
  nom: 'Noms',
  adjectif: 'Adjectifs',
  verbe: 'Verbes',
  adverbe: 'Adverbes',
  pronom: 'Pronoms personnels',
  preposition: 'Prépositions',
  'autre-invariable': 'Autres mots invariables',
}

// Ordre d'affichage du bilan - les natures majoritaires d'abord, puis le
// détail de ce que Lexique383 regroupe sous "invariable" (voir
// natureInvariable.ts, déjà utilisé par le quiz de grammaire pour la même
// distinction).
const ORDRE_CATEGORIES: CategorieBilan[] = ['nom', 'adjectif', 'verbe', 'adverbe', 'pronom', 'preposition', 'autre-invariable']

function categorieBilan(mot: MotDeListe): CategorieBilan {
  if (mot.category !== 'invariable') return mot.category
  const nature = natureInvariable(mot.word)
  return nature ?? 'autre-invariable'
}

export interface GroupeCategorie {
  categorie: CategorieBilan
  label: string
  mots: MotDeListe[]
}

export interface BilanLexique {
  /** Nombre de listes hebdomadaires retenues dans la période. */
  nbListes: number
  /** Nombre de mots distincts (un mot vu deux semaines de suite ne compte qu'une fois). */
  totalMots: number
  parCategorie: GroupeCategorie[]
}

/**
 * Une liste est retenue si sa date d'enregistrement (updatedAt - fixée à la
 * création, jamais modifiée par une correction ultérieure, voir
 * mots-semaine.php) tombe dans la période [debut, fin], bornes incluses.
 */
export function listesDeLaPeriode(listes: ListeMotsSemaine[], debut: Date, fin: Date): ListeMotsSemaine[] {
  return listes.filter((l) => {
    const date = new Date(l.updatedAt)
    return date >= debut && date <= fin
  })
}

/**
 * Agrège le vocabulaire des listes fournies, dédupliqué par lemmaId (un mot
 * revu plusieurs semaines de suite ne doit pas gonfler artificiellement le
 * compte), groupé par nature grammaticale, mots triés alphabétiquement dans
 * chaque groupe. Ne renvoie que les catégories réellement présentes.
 */
export function agregerVocabulaire(listes: ListeMotsSemaine[]): BilanLexique {
  const parLemme = new Map<string, MotDeListe>()
  for (const liste of listes) {
    for (const mot of liste.mots) {
      if (!parLemme.has(mot.lemmaId)) parLemme.set(mot.lemmaId, mot)
    }
  }

  const parCategorieMap = new Map<CategorieBilan, MotDeListe[]>()
  for (const mot of parLemme.values()) {
    const cat = categorieBilan(mot)
    const groupe = parCategorieMap.get(cat) ?? []
    groupe.push(mot)
    parCategorieMap.set(cat, groupe)
  }

  const parCategorie = ORDRE_CATEGORIES.flatMap((categorie) => {
    const mots = parCategorieMap.get(categorie)
    if (!mots || mots.length === 0) return []
    return [
      {
        categorie,
        label: CATEGORIE_BILAN_LABEL[categorie],
        mots: [...mots].sort((a, b) => a.word.localeCompare(b.word, 'fr')),
      },
    ]
  })

  return { nbListes: listes.length, totalMots: parLemme.size, parCategorie }
}
