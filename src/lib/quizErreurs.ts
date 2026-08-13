// Génère des "fausses" orthographes plausibles pour le quiz de révision (QCM)
// - à partir des confusions les plus courantes chez un enfant du primaire
// (sons qui s'écrivent pareil : an/en, in/ain, o/au/eau... et lettres
// doublées ou muettes). Volontairement simple (règles fixes, pas de modèle
// linguistique) : on préfère un premier jet imparfait, ajustable au cas par
// cas si un mot donne un résultat bizarre - même logique que les listes
// noires de synonymes/pictos ailleurs dans le projet.
const REGLES: [RegExp, string][] = [
  [/an/, 'en'], [/en/, 'an'],
  [/in/, 'ain'], [/ain/, 'in'],
  [/eau/, 'o'], [/au/, 'o'], [/o/, 'au'],
  [/ss/, 's'], [/s/, 'ss'],
  [/ph/, 'f'], [/f/, 'ph'],
  [/gn/, 'ni'],
  [/qu/, 'k'],
  [/y/, 'i'],
  [/[td]$/, ''],
  [/s$/, ''],
]

const CONSONNES_DOUBLABLES = ['l', 'm', 'n', 'p', 't', 'r']

function variantes(mot: string): string[] {
  const resultats = new Set<string>()

  for (const [pattern, remplacement] of REGLES) {
    if (pattern.test(mot)) {
      const variante = mot.replace(pattern, remplacement)
      if (variante && variante !== mot) resultats.add(variante)
    }
  }

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

/** Jusqu'à `nombre` fausses orthographes plausibles, différentes du mot et entre elles. */
export function genererDistracteurs(mot: string, nombre: number): string[] {
  return melanger(variantes(mot.toLowerCase())).slice(0, nombre)
}
