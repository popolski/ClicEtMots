/** Plus longue chaîne commune en préfixe à un ensemble de mots (le "radical" approximatif). */
function longestCommonPrefixLength(words: string[]): number {
  if (words.length === 0) return 0
  let prefix = words[0]
  for (const w of words.slice(1)) {
    let i = 0
    while (i < prefix.length && i < w.length && prefix[i] === w[i]) i++
    prefix = prefix.slice(0, i)
  }
  return prefix.length
}

export interface StyledForm {
  /** Mot(s) affichés tels quels devant la forme conjuguée (ex. l'auxiliaire "a" pour "a mangé"). */
  prefix: string
  /** Radical de la forme conjuguée. */
  stem: string
  /** Terminaison de la forme conjuguée. */
  ending: string
}

/**
 * Découpe chaque forme d'un temps en (préfixe éventuel, radical, terminaison)
 * pour la coloration radical/terminaison — le radical est approximé par le
 * plus long préfixe commun aux formes du dernier mot (le participe, pour un
 * temps composé). Approximation raisonnable pour les verbes réguliers ;
 * moins pertinente pour les verbes très irréguliers (aller, être...).
 */
export function styleConjugatedForms(forms: Record<string, string>): Record<string, StyledForm> {
  const lastWords = Object.values(forms).map((f) => f.split(' ').at(-1) ?? f)
  const stemLength = longestCommonPrefixLength(lastWords)

  const result: Record<string, StyledForm> = {}
  for (const [personne, form] of Object.entries(forms)) {
    const words = form.split(' ')
    const lastWord = words.at(-1) ?? form
    const prefix = words.slice(0, -1).join(' ')
    result[personne] = {
      prefix: prefix ? prefix + ' ' : '',
      stem: lastWord.slice(0, stemLength),
      ending: lastWord.slice(stemLength),
    }
  }
  return result
}

export const PERSONNES_SINGULIER = ['je', 'tu', 'il', 'elle', 'on']
export const PERSONNES_PLURIEL = ['nous', 'vous', 'ils', 'elles']

export const PRONOMS: Record<string, string> = {
  je: 'Je',
  tu: 'Tu',
  il: 'Il',
  elle: 'Elle',
  on: 'On',
  nous: 'Nous',
  vous: 'Vous',
  ils: 'Ils',
  elles: 'Elles',
}

const VOYELLE_OU_H = /^[aeiouyàâäéèêëïîôöùûüh]/i

/**
 * "Je" s'élide en "J'" devant une voyelle ou un h muet (j'ai, j'aime,
 * j'habite) — seul pronom sujet concerné parmi les 9 (il/elle/on/nous/
 * vous/ils/elles ne s'élident pas : "il a", "on a").
 */
export function pronomAffiche(personne: string, form: StyledForm): { texte: string; elide: boolean } {
  const premiereLettre = (form.prefix || form.stem || form.ending)[0] ?? ''
  if (personne === 'je' && VOYELLE_OU_H.test(premiereLettre)) {
    return { texte: "J'", elide: true }
  }
  return { texte: PRONOMS[personne], elide: false }
}
