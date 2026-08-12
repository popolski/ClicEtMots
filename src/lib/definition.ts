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

// Mise en cache dans localStorage : Vikidia/Wiktionnaire sont interrogés à
// la demande (jamais pré-générés, voir plus haut), donc chaque clic sur un
// mot déjà consulté refaisait les deux appels réseau pour rien - une
// définition ne change pour ainsi dire jamais, autant la garder. Le résultat
// "aucune définition trouvée" est mis en cache aussi (valeur null) : sinon
// un mot sans définition (ex. un nom propre) redéclenchait les deux appels
// à chaque clic, sans jamais aboutir à autre chose que le même échec.
const PREFIXE_CACHE = 'clicmots:definition:'

function cleCache(mot: string, categorie: WordCategory): string {
  return `${PREFIXE_CACHE}${categorie}:${mot.toLowerCase()}`
}

function lireCache(mot: string, categorie: WordCategory): { trouve: true; valeur: Definition | null } | { trouve: false } {
  try {
    const brut = localStorage.getItem(cleCache(mot, categorie))
    if (brut === null) return { trouve: false }
    return { trouve: true, valeur: JSON.parse(brut) as Definition | null }
  } catch {
    // localStorage indisponible (navigation privée stricte, quota...) : pas grave, on retombe sur le réseau.
    return { trouve: false }
  }
}

function ecrireCache(mot: string, categorie: WordCategory, valeur: Definition | null): void {
  try {
    localStorage.setItem(cleCache(mot, categorie), JSON.stringify(valeur))
  } catch {
    // idem : échec silencieux, la mise en cache est un confort, pas une nécessité.
  }
}

/** null si aucune des deux sources n'a de définition utilisable pour ce mot. */
export async function chercherDefinition(mot: string, categorie: WordCategory): Promise<Definition | null> {
  const enCache = lireCache(mot, categorie)
  if (enCache.trouve) return enCache.valeur

  const vikidia = await fetchDefinitionVikidia(mot)
  if (vikidia) {
    const resultat: Definition = { texte: retirerParentheses(vikidia), source: 'Vikidia' }
    ecrireCache(mot, categorie, resultat)
    return resultat
  }

  const wiktionnaire = await fetchDefinitionWiktionnaire(mot, categorie)
  if (wiktionnaire) {
    const resultat: Definition = { texte: retirerParentheses(wiktionnaire), source: 'Wiktionnaire' }
    ecrireCache(mot, categorie, resultat)
    return resultat
  }

  ecrireCache(mot, categorie, null)
  return null
}
