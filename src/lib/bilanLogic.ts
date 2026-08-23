// Agrège les résultats bruts d'un élève (server/api/bilan-eleve.php) en
// statistiques par mode d'exercice, pour le bilan affiché à l'enseignante.
// Extrait pour être testable, comme les autres modules de logique du projet
// (quizLogic, graphieLogic...) - voir bilanLogic.test.ts.
import { badgePour, type Badge } from './quizBadges'
import type { ModeQuiz, ResultatQuiz } from './api'

export interface BilanMode {
  mode: ModeQuiz
  nbSeances: number
  /** Moyenne des scores en pourcentage, arrondie - null si aucune séance. */
  scoreMoyenPct: number | null
  medailles: Record<Badge, number>
}

const TOUS_LES_MODES: ModeQuiz[] = ['qcm', 'reconstitution', 'grammaire', 'dictee', 'graphie']

// Dupliqué à dessein depuis QuizTool.tsx plutôt qu'importé : ce module est
// aussi chargé par l'espace enseignant (Admin.tsx), et QuizTool.tsx est un
// gros composant lazy-loadé pour une tout autre route - l'importer ferait
// gonfler le chunk de l'espace enseignant pour cinq libellés.
export const MODE_LABEL: Record<ModeQuiz, string> = {
  qcm: 'Choix multiple',
  reconstitution: 'Recomposer le mot',
  grammaire: 'Catégorie grammaticale',
  dictee: 'Dictée',
  graphie: 'La bonne graphie',
}

/**
 * Regroupe les résultats par mode. Ne renvoie que les modes avec au moins
 * une séance - un mode jamais joué n'a rien d'utile à montrer dans le
 * bilan, autant ne pas afficher une ligne à zéro partout.
 */
export function agregerParMode(resultats: ResultatQuiz[]): BilanMode[] {
  return TOUS_LES_MODES.flatMap((mode) => {
    const deCeMode = resultats.filter((r) => r.mode === mode)
    if (deCeMode.length === 0) return []

    const medailles: Record<Badge, number> = { or: 0, argent: 0, bronze: 0 }
    let sommePct = 0
    for (const r of deCeMode) {
      sommePct += r.total > 0 ? (100 * r.score) / r.total : 0
      const badge = badgePour(r.score, r.total)
      if (badge) medailles[badge]++
    }

    return [
      {
        mode,
        nbSeances: deCeMode.length,
        scoreMoyenPct: Math.round(sommePct / deCeMode.length),
        medailles,
      },
    ]
  })
}
