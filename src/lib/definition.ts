// Combine les deux sources de définition : Vikidia en premier (contenu déjà
// pensé pour des enfants, mais couverture partielle - encyclopédie, pas
// dictionnaire), repli sur Wiktionnaire nettoyé si Vikidia n'a rien (couvre
// verbes/adjectifs/mots courants que Vikidia n'a pas). Les deux sont
// interrogées à la demande (clic), jamais pré-générées.
import type { WordCategory } from '../types/phonetics'
import { fetchDefinitionVikidia } from './vikidia'
import { fetchDefinitionWiktionnaire } from './wiktionnaire'

export interface Definition {
  texte: string
  source: 'Vikidia' | 'Wiktionnaire'
}

// Les deux sources ajoutent parfois des précisions entre parenthèses (noms
// scientifiques latins, renvois type "(wp)") jamais utiles ni compréhensibles
// pour un enfant de primaire - retirées de l'affichage plutôt que laissées
// (et a fortiori jamais transformées en lien, un nom latin n'a aucune
// définition à proposer).
function retirerParentheses(texte: string): string {
  return texte
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+([,.;:])/g, '$1') // espace laissé avant la ponctuation par la parenthèse retirée
    .replace(/\s+/g, ' ')
    .trim()
}

/** null si aucune des deux sources n'a de définition utilisable pour ce mot. */
export async function chercherDefinition(mot: string, categorie: WordCategory): Promise<Definition | null> {
  const vikidia = await fetchDefinitionVikidia(mot)
  if (vikidia) return { texte: retirerParentheses(vikidia), source: 'Vikidia' }

  const wiktionnaire = await fetchDefinitionWiktionnaire(mot, categorie)
  if (wiktionnaire) return { texte: retirerParentheses(wiktionnaire), source: 'Wiktionnaire' }

  return null
}
