// Génère des "fausses" orthographes plausibles pour le quiz de révision (QCM)
// - à partir des confusions les plus courantes chez un enfant du primaire :
// des graphies différentes pour le MÊME son (an/en, ch/sh, g/j, o/au/eau,
// er/é...), reprises du catalogue de graphies du clavier phonétique
// (src/data/phonemes.json - même vérité pédagogique que le reste du site).
// Volontairement simple (règles fixes, pas de modèle linguistique) : on
// préfère un premier jet imparfait, ajustable au cas par cas si un mot donne
// un résultat bizarre - même logique que les listes noires de synonymes/
// pictos ailleurs dans le projet.
const REGLES: [RegExp, string][] = [
  [/an/, 'en'], [/en/, 'an'],
  // am/em : seulement devant b/p, où an/en s'écrivent am/en (règle du
  // "m devant b/p/m") - "champ"/"tomber", pas "chan"/"tonber".
  [/an(?=[bpm])/, 'am'], [/am(?=[bpm])/, 'an'],
  [/en(?=[bpm])/, 'em'], [/em(?=[bpm])/, 'en'],
  [/in/, 'ain'], [/ain/, 'in'],
  [/in/, 'ein'], [/ein/, 'in'],
  [/in/, 'un'], [/un/, 'in'],
  [/in(?=[bpm])/, 'im'], [/im(?=[bpm])/, 'in'],
  [/ain(?=[bpm])/, 'aim'], [/aim(?=[bpm])/, 'ain'],
  [/eau/, 'o'], [/au/, 'o'], [/o/, 'au'],
  [/ai/, 'è'], [/è/, 'ai'],
  [/eu/, 'œu'], [/œu/, 'eu'],
  [/on(?=[bpm])/, 'om'], [/om(?=[bpm])/, 'on'],
  [/oi/, 'oy'], [/oy/, 'oi'],
  [/ch/, 'sh'], [/sh/, 'ch'],
  // g/j : seulement devant e/i/y, là où les deux graphies se prononcent
  // pareil ([ʒ]) - devant a/o/u, "g" se prononce [g] (dur), une confusion
  // n'aurait aucun sens ("jardin" -> "gardin" changerait le son).
  [/g(?=[eiy])/, 'j'], [/j(?=[eiy])/, 'g'],
  // gu/g : le "u" de "gu" est muet devant e/i (sert juste à garder le son
  // dur) - "guerre"/"gerre" se prononcent pareil, contrairement à "gu/g"
  // devant a/o/u.
  [/gu(?=[ei])/, 'g'], [/g(?=[ei])/, 'gu'],
  [/ss/, 's'], [/s/, 'ss'],
  [/ph/, 'f'], [/f/, 'ph'],
  [/gn/, 'ni'],
  [/qu/, 'k'],
  [/cc/, 'c'],
  [/ç/, 's'],
  [/x/, 'ks'], [/ks/, 'x'],
  [/c(?=[^eiy]|$)/, 'k'], [/k/, 'c'],
  [/y/, 'i'],
  [/[td]$/, ''],
  [/s$/, ''],
]

// Famille de finales homophones en [e] : infinitif ("manger"), participe/
// adjectif ("mangé"), féminin d'un nom ("allée"), 2e personne du pluriel
// ("mangez"), nom en "-et" ("jouet") - toutes se prononcent pareil,
// confusion classique CE1-CM2. Génère des mots RÉELS (juste la mauvaise
// terminaison), contrairement à un simple ajout de lettre ("allerr" n'existe
// pas, "allée" si).
const FINALES_E = ['er', 'ée', 'ez', 'é', 'et']

function variantesFinaleE(mot: string): string[] {
  const suffixe = FINALES_E.filter((s) => mot.endsWith(s)).sort((a, b) => b.length - a.length)[0]
  if (!suffixe) return []
  const racine = mot.slice(0, -suffixe.length)
  return FINALES_E.filter((s) => s !== suffixe).map((s) => racine + s)
}

function variantesPhonetiques(mot: string): string[] {
  const resultats = new Set<string>()
  for (const [pattern, remplacement] of REGLES) {
    if (pattern.test(mot)) {
      const variante = mot.replace(pattern, remplacement)
      if (variante && variante !== mot) resultats.add(variante)
    }
  }
  for (const variante of variantesFinaleE(mot)) resultats.add(variante)
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
 * entre elles - toujours de vraies confusions de son (an/en, ch/sh, x/ks,
 * finales en [e]...). Peut renvoyer moins que `nombre` si le mot n'a pas
 * assez de confusions possibles : mieux vaut deux bonnes options qu'une
 * troisième inventée (lettre doublée/ajoutée), signalé comme peu utile.
 */
export function genererDistracteurs(mot: string, nombre: number): string[] {
  return melanger(variantesPhonetiques(mot.toLowerCase())).slice(0, nombre)
}
