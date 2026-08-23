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
  /**
   * Bonnes réponses obtenues DU PREMIER COUP (schema-v11.sql), en effectif
   * brut (pas en pourcentage - jugé peu parlant, demandé par Hugues) - null
   * si aucune séance de ce groupe ne porte cette donnée (enregistrée avant
   * la migration) ou si aucune réponse n'était correcte. Seuls la dictée et
   * "Recomposer le mot" laissent plusieurs essais : pour les autres modes
   * `obtenu` vaut toujours `sur`, sans intérêt à afficher.
   */
  premierCoup: { obtenu: number; sur: number } | null
  /**
   * Mots de la séance où le filet de secours de la dictée a été ouvert
   * (schema-v12.sql), en effectif brut (pas en pourcentage) - null si aucune
   * séance de ce groupe ne porte cette donnée. Sans objet hors dictée
   * (toujours null ailleurs, le filet n'existant pas dans les autres modes).
   */
  aideUtilisee: { obtenu: number; sur: number } | null
  /**
   * Durée moyenne d'une séance en secondes (schema-v13.sql), arrondie - null
   * si aucune séance de ce groupe ne porte cette donnée. Réservé au bilan
   * enseignant (Admin.tsx) : absent du bilan imprimable pour les parents,
   * sans intérêt pédagogique pour eux.
   */
  dureeMoyenneSec: number | null
}

const TOUS_LES_MODES: ModeQuiz[] = ['qcm', 'reconstitution', 'grammaire', 'dictee', 'graphie']

/**
 * Modes où `premierCoup` a un sens (plusieurs essais possibles par mot).
 * Sur les autres, `obtenu` vaut toujours `sur` - vrai mais sans intérêt à afficher.
 */
export const MODES_AVEC_ESSAIS: ReadonlySet<ModeQuiz> = new Set(['dictee', 'reconstitution'])

/** Seul mode où le filet de secours existe. */
export const MODES_AVEC_AIDE: ReadonlySet<ModeQuiz> = new Set(['dictee'])

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
 * Une phrase par mode pour le bilan imprimable destiné aux parents, en
 * référence aux compétences du programme officiel de français cycle 2
 * (projet de programme CSP, français cycle 2) : correspondances
 * grapho-phonémiques (CGP), conscience phonologique, nature des mots,
 * écriture sous dictée, régularités orthographiques lexicales.
 */
export const MODE_DESCRIPTION: Record<ModeQuiz, string> = {
  qcm: "Reconnaître la bonne écriture d'un son parmi plusieurs, pour automatiser les correspondances entre les sons et les lettres (correspondances grapho-phonémiques).",
  reconstitution:
    "Reconstituer un mot son par son, pour travailler la conscience phonologique et l'encodage à l'écrit.",
  grammaire: 'Identifier la nature des mots (nom, verbe, adjectif...), une compétence clé du vocabulaire et de la grammaire.',
  dictee: "Écrire un mot sous la dictée, pour mémoriser son orthographe et vérifier l'acquisition des correspondances grapho-phonémiques déjà étudiées.",
  graphie: "Choisir la bonne orthographe entre plusieurs graphies possibles pour un même son, pour travailler les régularités de l'orthographe lexicale.",
}

/** Statistiques communes à agregerParMode et agregerParModeGlobal - factorisées pour ne calculer qu'une fois. */
function calculerStats(seances: ResultatQuiz[]) {
  const medailles: Record<Badge, number> = { or: 0, argent: 0, bronze: 0 }
  let sommePct = 0
  // Sommés séparément : seules les séances enregistrées après
  // schema-v11.sql portent premierCoup (sinon null), on ne peut
  // calculer une part fiable que sur celles-là.
  let sommeScoreMesure = 0
  let sommePremierCoup = 0
  // Même logique que premierCoup, mais rapportée au TOTAL de mots de
  // la séance (pas au score) : le filet peut être ouvert sur un mot
  // ensuite réussi ou raté, sa fréquence d'usage ne dépend pas de ça.
  let sommeTotalMesureAide = 0
  let sommeAideUtilisee = 0
  let nbSeancesMesureesDuree = 0
  let sommeDuree = 0
  for (const r of seances) {
    sommePct += r.total > 0 ? (100 * r.score) / r.total : 0
    const badge = badgePour(r.score, r.total)
    if (badge) medailles[badge]++
    if (r.premierCoup !== null) {
      sommeScoreMesure += r.score
      sommePremierCoup += r.premierCoup
    }
    if (r.aideUtilisee !== null) {
      sommeTotalMesureAide += r.total
      sommeAideUtilisee += r.aideUtilisee
    }
    if (r.dureeSecondes !== null) {
      nbSeancesMesureesDuree++
      sommeDuree += r.dureeSecondes
    }
  }
  return {
    nbSeances: seances.length,
    scoreMoyenPct: Math.round(sommePct / seances.length),
    medailles,
    premierCoup: sommeScoreMesure > 0 ? { obtenu: sommePremierCoup, sur: sommeScoreMesure } : null,
    aideUtilisee: sommeTotalMesureAide > 0 ? { obtenu: sommeAideUtilisee, sur: sommeTotalMesureAide } : null,
    dureeMoyenneSec: nbSeancesMesureesDuree > 0 ? Math.round(sommeDuree / nbSeancesMesureesDuree) : null,
  }
}

/**
 * Ne garde que les résultats terminés dans l'intervalle [debut, fin]
 * (dates ISO "AAAA-MM-JJ"), bornes incluses - fin de journée comprise pour
 * que le jour choisi comme borne de fin compte. Partagé entre le bilan
 * enseignant (Admin.tsx) et le bilan imprimable pour les parents
 * (BilanEleveImprimable.tsx), tous deux filtrables par période pédagogique.
 */
export function resultatsDeLaPeriode(resultats: ResultatQuiz[], debut: string, fin: string): ResultatQuiz[] {
  const finJournee = `${fin}T23:59:59`
  return resultats.filter((r) => r.termineLe >= `${debut}T00:00:00` && r.termineLe <= finJournee)
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
      .map(([niveau, seances]) => ({ mode, niveau, ...calculerStats(seances) }))
  })
}

/**
 * Même chose que agregerParMode, mais TOUS niveaux confondus pour un même
 * mode - demandé par Hugues pour le bilan imprimable des parents : sur une
 * période ou une année entière, une dictée à 9 mots et une à 10 mots (la
 * liste de la semaine ne fournit pas toujours le même nombre de mots
 * valables) affichaient deux lignes quasi identiques, illisible pour un
 * parent. Contrairement au bilan enseignant (agregerParMode), qui garde
 * les niveaux séparés à dessein pour ne pas moyenner un 5/5 avec un
 * 10/20 - ici on assume la perte de cette distinction au profit de la
 * lisibilité, le parent n'ayant pas besoin de savoir combien de mots
 * faisait chaque séance.
 */
export function agregerParModeGlobal(resultats: ResultatQuiz[]): Omit<BilanMode, 'niveau'>[] {
  return TOUS_LES_MODES.flatMap((mode) => {
    const deCeMode = resultats.filter((r) => r.mode === mode)
    if (deCeMode.length === 0) return []
    return [{ mode, ...calculerStats(deCeMode) }]
  })
}
