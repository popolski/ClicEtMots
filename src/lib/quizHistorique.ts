// Historique des scores du quiz, gardé UNIQUEMENT dans le navigateur
// (localStorage) - même principe que l'historique des mots consultés (voir
// historique.ts) : rien envoyé au serveur, cohérent avec le choix RGPD de
// server/schema.sql ("pas de suivi d'activité").
export type ModeQuiz = 'qcm' | 'reconstitution'

export interface ResultatQuiz {
  mode: ModeQuiz
  score: number
  total: number
  termineLe: number
}

const CLE = 'clicmots:quiz-historique'
const TAILLE_MAX = 20

export function lireResultatsQuiz(): ResultatQuiz[] {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return []
    const valeur = JSON.parse(brut)
    return Array.isArray(valeur) ? valeur : []
  } catch {
    return []
  }
}

export function ajouterResultatQuiz(resultat: Omit<ResultatQuiz, 'termineLe'>): void {
  try {
    const suivant = [{ ...resultat, termineLe: Date.now() }, ...lireResultatsQuiz()].slice(0, TAILLE_MAX)
    localStorage.setItem(CLE, JSON.stringify(suivant))
  } catch {
    // localStorage indisponible : l'historique de scores est un confort, pas une nécessité.
  }
}
