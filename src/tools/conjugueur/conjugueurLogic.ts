/**
 * Groupe grammatical d'un verbe (1er/2e/3e), affiché entre parenthèses dans
 * les résultats du clavier. Règle scolaire classique :
 *   - infinitif en -er (sauf aller) -> 1er groupe. Vrai même pour les
 *     verbes qu'on ne sait pas conjuguer automatiquement (appeler, payer…
 *     "risqués" pour la génération, mais 1er groupe quand même : c'est une
 *     question d'orthographe de l'infinitif, pas de régularité de
 *     conjugaison).
 *   - infinitif en -ir ET une forme du présent porte l'infixe "-iss-"
 *     (finir/finissons, jaunir/jaunissent) -> 2e groupe. On regarde TOUTES
 *     les formes disponibles, pas seulement "nous" : Lexique383 n'attète pas
 *     toujours "nous jaunissons" (verbe rare à cette personne), alors que
 *     "ils jaunissent" (3e personne du pluriel) l'est presque toujours et
 *     porte le même infixe -iss- distinctif du 2e groupe — se limiter à
 *     "nous" faisait passer ces verbes à tort en 3e groupe faute de forme
 *     "nous" attestée.
 *   - tout le reste (aller, -re, -oir, -ir non-issant : dormir, partir,
 *     venir…) -> 3e groupe.
 */
export function verbGroup(infinitif: string, presentForms?: Record<string, string>): '1er' | '2e' | '3e' {
  if (infinitif === 'aller') return '3e'
  if (infinitif.endsWith('er')) return '1er'
  if (infinitif.endsWith('ir') && Object.values(presentForms ?? {}).some((f) => f.includes('iss'))) return '2e'
  return '3e'
}

export interface StyledForm {
  /** Partie affichée en ROUGE avant le radical (l'auxiliaire du passé composé, ex. "ai "). */
  redPrefix: string
  /** Radical, affiché en noir. */
  stem: string
  /** Terminaison, affichée en ROUGE (ex. "erai" dans "mangERAI", "é" dans "mangÉ"). */
  redEnding: string
}

// Terminaisons connues par temps (les plus longues d'abord — on colore la
// plus longue qui correspond à la fin du mot). Calibrées pour les verbes
// réguliers, majoritaires au primaire ; sur un irrégulier rare la coupe peut
// être approximative, sans conséquence sur l'orthographe affichée.
const SIMPLE_TENSE_ENDINGS: Record<string, string[]> = {
  present: ['issons', 'issent', 'issez', 'ons', 'ent', 'ez', 'es', 'e', 's', 't', 'x'],
  imparfait: ['issaient', 'issions', 'issiez', 'aient', 'ions', 'iez', 'ais', 'ait'],
  futur: [
    'erons', 'eront', 'erez', 'eras', 'erai', 'era',
    'irons', 'iront', 'irez', 'iras', 'irai', 'ira',
    'rons', 'ront', 'rez', 'ras', 'rai', 'ra',
  ],
}

// Terminaisons de participe passé (passé composé), les plus longues d'abord.
const PARTICIPE_ENDINGS = ['ées', 'és', 'ée', 'é', 'ies', 'ie', 'is', 'ues', 'ue', 'us', 'u', 'ts', 'te', 't', 's']

function splitEnding(word: string, endings: string[]): { stem: string; ending: string } {
  for (const e of endings) {
    if (word.length > e.length && word.endsWith(e)) {
      return { stem: word.slice(0, -e.length), ending: e }
    }
  }
  return { stem: word, ending: '' }
}

/**
 * Découpe une forme conjuguée pour la coloration radical (noir) / terminaison
 * (rouge). Pour le passé composé (temps composé "aux + participe"),
 * l'auxiliaire est entièrement rouge et le participe est découpé
 * radical/terminaison : "j'AI mangÉ".
 */
export function styleForm(tense: string, form: string): StyledForm {
  if (tense === 'passeCompose') {
    const spaceIdx = form.lastIndexOf(' ')
    if (spaceIdx !== -1) {
      const aux = form.slice(0, spaceIdx)
      const participe = form.slice(spaceIdx + 1)
      const { stem, ending } = splitEnding(participe, PARTICIPE_ENDINGS)
      return { redPrefix: aux + ' ', stem, redEnding: ending }
    }
  }
  const { stem, ending } = splitEnding(form, SIMPLE_TENSE_ENDINGS[tense] ?? [])
  return { redPrefix: '', stem, redEnding: ending }
}

export function styleConjugatedForms(tense: string, forms: Record<string, string>): Record<string, StyledForm> {
  const result: Record<string, StyledForm> = {}
  for (const [personne, form] of Object.entries(forms)) {
    result[personne] = styleForm(tense, form)
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
 * j'habite) — seul pronom sujet concerné parmi les 9.
 */
export function pronomAffiche(personne: string, form: StyledForm): string {
  const premiereLettre = (form.redPrefix || form.stem || form.redEnding)[0] ?? ''
  if (personne === 'je' && VOYELLE_OU_H.test(premiereLettre)) {
    return "J'"
  }
  return PRONOMS[personne]
}
