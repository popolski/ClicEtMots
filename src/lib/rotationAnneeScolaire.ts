// Purge automatique des données locales (historique, favoris, scores de
// quiz - voir historique.ts/favoris.ts/quizHistorique.ts) au changement
// d'année scolaire, pour qu'un PC de classe réutilisé d'un élève à l'autre
// (ou d'une année sur l'autre) ne mélange pas leurs données. Alternative à
// un effacement manuel PC par PC (pas réaliste pour toute une classe) :
// chaque appareil retient discrètement la dernière année scolaire vue, et
// se purge tout seul dès qu'il détecte qu'on est passé à la suivante -
// aucune donnée n'étant envoyée au serveur, c'est la seule façon de le
// faire qui reste cohérente avec le choix RGPD de ce projet (voir
// server/schema.sql).
import { viderHistorique } from './historique'
import { viderFavoris } from './favoris'
import { viderResultatsQuiz } from './quizHistorique'

const CLE = 'clicmots:derniere-annee-scolaire'

// Rentrée le 1er septembre (convention française) : avant cette date, on
// est encore dans l'année scolaire commencée en septembre précédent.
function anneeScolaireActuelle(maintenant: Date): string {
  const annee = maintenant.getMonth() >= 8 ? maintenant.getFullYear() : maintenant.getFullYear() - 1
  return `${annee}-${annee + 1}`
}

/**
 * À appeler une fois au démarrage de l'app. Purge silencieusement si la
 * dernière année scolaire vue sur cet appareil diffère de l'actuelle -
 * jamais au tout premier lancement (rien à purger), seulement le
 * changement effectif d'une valeur connue à une autre.
 */
export function verifierRotationAnneeScolaire(maintenant: Date = new Date()): void {
  try {
    const actuelle = anneeScolaireActuelle(maintenant)
    const derniere = localStorage.getItem(CLE)
    if (derniere && derniere !== actuelle) {
      viderHistorique()
      viderFavoris()
      viderResultatsQuiz()
    }
    localStorage.setItem(CLE, actuelle)
  } catch {
    // localStorage indisponible : rien à purger, rien à retenir non plus.
  }
}
