// Agrège les résultats bruts d'un élève (server/api/bilan-eleve.php) en
// statistiques par mode d'exercice, pour le bilan affiché à l'enseignante.
// Extrait pour être testable, comme les autres modules de logique du projet
// (quizLogic, graphieLogic...) - voir bilanLogic.test.ts.
import { badgePour, type Badge } from './quizBadges'
import type { ModeQuiz, ResultatQuiz } from './api'

export interface BilanMode {
  mode: ModeQuiz
  /**
   * Nombre de mots de la séance (= `total` de ResultatQuiz). Fixe à 10 pour
   * QCM/grammaire/graphie, mais choisi au lancement pour dictée (5/10/15/20)
   * et recomposition (5/10) - voir NIVEAUX_SEANCE dans QuizTool. Une ligne
   * par niveau réellement joué : moyenner un 5/5 avec un 18/20 masquerait
   * que ce n'est pas le même exercice.
   */
  niveau: number
  nbSeances: number
  /** Moyenne des scores en pourcentage, arrondie. */
  scoreMoyenPct: number
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
 * Regroupe les résultats par mode PUIS par niveau (nombre de mots de la
 * séance). Ne renvoie que les combinaisons réellement jouées - un mode ou
 * un niveau jamais essayé n'a rien d'utile à montrer dans le bilan, autant
 * ne pas afficher une ligne à zéro partout. Les niveaux sont triés du plus
 * petit au plus grand au sein d'un même mode.
 */
export function agregerParMode(resultats: ResultatQuiz[]): BilanMode[] {
  return TOUS_LES_MODES.flatMap((mode) => {
    const deCeMode = resultats.filter((r) => r.mode === mode)
    if (deCeMode.length === 0) return []

    const parNiveau = new Map<number, ResultatQuiz[]>()
    for (const r of deCeMode) {
      const groupe = parNiveau.get(r.total) ?? []
      groupe.push(r)
      parNiveau.set(r.total, groupe)
    }

    return [...parNiveau.entries()]
      .sort(([a], [b]) => a - b)
      .map(([niveau, seances]) => {
        const medailles: Record<Badge, number> = { or: 0, argent: 0, bronze: 0 }
        let sommePct = 0
        for (const r of seances) {
          sommePct += r.total > 0 ? (100 * r.score) / r.total : 0
          const badge = badgePour(r.score, r.total)
          if (badge) medailles[badge]++
        }
        return {
          mode,
          niveau,
          nbSeances: seances.length,
          scoreMoyenPct: Math.round(sommePct / seances.length),
          medailles,
        }
      })
  })
}
