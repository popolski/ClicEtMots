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

/** null si aucune des deux sources n'a de définition utilisable pour ce mot. */
export async function chercherDefinition(mot: string, categorie: WordCategory): Promise<Definition | null> {
  const vikidia = await fetchDefinitionVikidia(mot)
  if (vikidia) return { texte: vikidia, source: 'Vikidia' }

  const wiktionnaire = await fetchDefinitionWiktionnaire(mot, categorie)
  if (wiktionnaire) return { texte: wiktionnaire, source: 'Wiktionnaire' }

  return null
}
