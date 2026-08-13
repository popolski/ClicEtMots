// Génère des "fausses" orthographes plausibles pour le quiz de révision (QCM)
// - à partir des confusions les plus courantes chez un enfant du primaire
// (sons qui s'écrivent pareil : an/en, in/ain, o/au/eau, x/ks, c/k...).
// Volontairement simple (règles fixes, pas de modèle linguistique) : on
// préfère un premier jet imparfait, ajustable au cas par cas si un mot donne
// un résultat bizarre - même logique que les listes noires de synonymes/
// pictos ailleurs dans le projet.
const REGLES: [RegExp, string][] = [
  [/an/, 'en'], [/en/, 'an'],
  [/in/, 'ain'], [/ain/, 'in'],
  [/eau/, 'o'], [/au/, 'o'], [/o/, 'au'],
  [/ai/, 'è'], [/è/, 'ai'],
  [/ss/, 's'], [/s/, 'ss'],
  [/ph/, 'f'], [/f/, 'ph'],
  [/gn/, 'ni'],
  [/qu/, 'k'],
  [/x/, 'ks'], [/ks/, 'x'],
  [/c(?=[^eiy]|$)/, 'k'], [/k/, 'c'],
  [/y/, 'i'],
  [/[td]$/, ''],
  [/s$/, ''],
]

// Filet de secours seulement (lettre doublée/dédoublée) : un vrai changement
// de son (ci-dessus) est toujours préféré quand il existe - une simple
// lettre en plus/en moins n'apprend pas grand-chose ("boxeurr" plutôt que
// "bokseur", signalé comme peu utile par l'enseignant).
const CONSONNES_DOUBLABLES = ['l', 'm', 'n', 'p', 't', 'r']

function variantesPhonetiques(mot: string): string[] {
  const resultats = new Set<string>()
  for (const [pattern, remplacement] of REGLES) {
    if (pattern.test(mot)) {
      const variante = mot.replace(pattern, remplacement)
      if (variante && variante !== mot) resultats.add(variante)
    }
  }
  resultats.delete(mot)
  return [...resultats]
}

function variantesStructurelles(mot: string): string[] {
  const resultats = new Set<string>()

  const dedouble = mot.replace(/(.)\1/, '$1')
  if (dedouble !== mot) resultats.add(dedouble)

  for (const lettre of CONSONNES_DOUBLABLES) {
    if (mot.includes(lettre) && !mot.includes(lettre + lettre)) {
      resultats.add(mot.replace(lettre, lettre + lettre))
    }
  }

  resultats.delete(mot)
  return [...resultats]
}

function melanger<T>(items: T[]): T[] {
  const copie = [...items]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

/**
 * Jusqu'à `nombre` fausses orthographes plausibles, différentes du mot et
 * entre elles. Les confusions phonétiques (an/en, x/ks, c/k...) sont
 * toujours préférées ; les variantes "lettre doublée" ne comblent que ce
 * qu'il manque, quand un mot n'a pas assez de vraies confusions possibles.
 */
export function genererDistracteurs(mot: string, nombre: number): string[] {
  const motMinuscule = mot.toLowerCase()
  const phonetiques = melanger(variantesPhonetiques(motMinuscule))
  if (phonetiques.length >= nombre) return phonetiques.slice(0, nombre)

  const structurelles = melanger(variantesStructurelles(motMinuscule)).filter((v) => !phonetiques.includes(v))
  return [...phonetiques, ...structurelles].slice(0, nombre)
}
