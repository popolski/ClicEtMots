// Historique des mots consultés, gardé UNIQUEMENT dans le navigateur
// (localStorage) — jamais envoyé au serveur ni lié au compte de l'élève. Le
// schéma de la base (voir server/schema.sql) exclut volontairement tout
// suivi d'activité côté serveur pour rester minimal en données personnelles
// (RGPD, élèves mineurs) ; cet historique reste donc local à l'appareil,
// comme le cache des définitions (voir src/lib/definition.ts).
import type { WordCategory } from '../types/phonetics'

export interface EntreeHistorique {
  lemmaId: string
  word: string
  category: WordCategory
  consulteLe: number
}

const CLE = 'clicmots:historique'
// Assez pour couvrir une session de travail sans devenir une longue liste
// illisible — un enfant qui consulte beaucoup de mots doit encore pouvoir
// retrouver les plus récents en un coup d'œil.
const TAILLE_MAX = 30

export function lireHistorique(): EntreeHistorique[] {
  try {
    const brut = localStorage.getItem(CLE)
    if (!brut) return []
    const valeur = JSON.parse(brut)
    return Array.isArray(valeur) ? valeur : []
  } catch {
    return []
  }
}

/** Ajoute (ou remonte en tête si déjà présent) le mot consulté. */
export function ajouterAuHistorique(entree: Omit<EntreeHistorique, 'consulteLe'>): void {
  try {
    const actuel = lireHistorique().filter((e) => e.lemmaId !== entree.lemmaId)
    const suivant = [{ ...entree, consulteLe: Date.now() }, ...actuel].slice(0, TAILLE_MAX)
    localStorage.setItem(CLE, JSON.stringify(suivant))
  } catch {
    // localStorage indisponible (navigation privée stricte, quota...) : l'historique est un confort, pas une nécessité.
  }
}

export function viderHistorique(): void {
  try {
    localStorage.removeItem(CLE)
  } catch {
    // idem
  }
}
