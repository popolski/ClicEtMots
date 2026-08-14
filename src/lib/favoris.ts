// Mots mis en favori par l'élève, gardés UNIQUEMENT dans le navigateur
// (localStorage) - même principe que historique.ts : rien envoyé au
// serveur, cohérent avec le choix RGPD de server/schema.sql. Distinct de
// l'historique (qui liste tout ce qui a été consulté, sans tri) : ici,
// seulement les mots que l'élève a choisi de retenir.
import type { WordCategory } from '../types/phonetics'

export interface EntreeFavori {
  lemmaId: string
  word: string
  category: WordCategory
  ajouteLe: number
}

const CLE = 'clicmots:favoris'

export function lireFavoris(): EntreeFavori[] {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return []
    const valeur = JSON.parse(brut)
    return Array.isArray(valeur) ? valeur : []
  } catch {
    return []
  }
}

export function estFavori(lemmaId: string): boolean {
  return lireFavoris().some((f) => f.lemmaId === lemmaId)
}

export function ajouterFavori(entree: Omit<EntreeFavori, 'ajouteLe'>): void {
  try {
    const actuel = lireFavoris().filter((f) => f.lemmaId !== entree.lemmaId)
    localStorage.setItem(CLE, JSON.stringify([{ ...entree, ajouteLe: Date.now() }, ...actuel]))
  } catch {
    // localStorage indisponible : le favori n'est pas sauvegardé, sans conséquence grave.
  }
}

export function retirerFavori(lemmaId: string): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(lireFavoris().filter((f) => f.lemmaId !== lemmaId)))
  } catch {
    // idem
  }
}
