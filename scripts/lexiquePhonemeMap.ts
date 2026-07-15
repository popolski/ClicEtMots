// Correspondance entre l'alphabet phonétique de Lexique383 (colonne "phon",
// documenté dans Manuel_Lexique.3.pdf, Tableau 2) et nos identifiants de
// touches (src/data/phonemes.json). Construit et validé par le spike de
// décodage — voir le plan, section "Risque technique principal".
//
// Deux catégories de règles :
// 1. Motifs multi-caractères (vérifiés en premier, priorité à la séquence la
//    plus longue) pour les sons composés que Lexique code en plusieurs
//    symboles mais que notre clavier traite comme une seule touche
//    ("oi" = w+a, "oin" = w+5, "ui" = 8+i, "x" = k+s).
// 2. Symboles simples, correspondance 1 pour 1.

export interface PhonemePattern {
  /** Séquence de symboles Lexique à consommer ensemble. */
  match: string
  /** Notre PhonemeId correspondant. */
  id: string
}

// Ordre important : les motifs les plus longs/spécifiques d'abord.
export const multiCharPatterns: PhonemePattern[] = [
  { match: 'w5', id: 'oin' }, // coin, loin, point -> kw5, lw5, pw5
  { match: 'wa', id: 'oi' }, // oiseau, moi, roi -> wazo, mwa, Rwa
  { match: '8i', id: 'ui' }, // huit, lui, pluie, fruit -> 8it, l8i, pl8i, fR8i
  { match: 'ks', id: 'x' }, // taxi -> taksi
  // Quand un [i] voyelle précède immédiatement le yod, ils forment la graphie
  // "ill" (fille = f+ij -> f+ill, brillant = bR+ij+@ -> b+r+ill+an). C'est le
  // seul cas où le yod se code sur la touche "ill".
  { match: 'ij', id: 'ill' }, // fille -> fij, brillant -> bRij@
]

// Symboles voyelles/nasales de Lexique383 : servent à savoir si un yod [j] est
// suivi d'une voyelle (auquel cas il se code touche "i", ex. avion = a-v-i-on)
// ou non (yod final/pré-consonne -> touche "ill", ex. paille, réveil).
const VOWEL_SYMBOLS = new Set(['a', 'i', 'y', 'u', 'o', 'O', 'e', 'E', '°', '2', '9', '5', '1', '@', '§'])

// Symboles Lexique -> notre PhonemeId, un pour un.
export const singleCharMap: Record<string, string> = {
  // Voyelles
  a: 'a',
  i: 'i',
  y: 'u', // "lu" /y/ -> notre touche "u" (usine)
  u: 'ou', // "roue" /u/ -> notre touche "ou" (ours)
  o: 'o',
  O: 'o', // o ouvert (fort) -> même touche que o fermé
  e: 'e', // é fermé
  E: 'e', // è ouvert -> même touche double é/è
  '°': 'eu', // schwa élidable (abordera) -> touche double e/eu
  '3': 'eu', // schwa non élidable (n'apparaît pas dans Lexique383, gardé par sécurité)
  '2': 'eu', // eu fermé (deux)
  '9': 'eu', // eu ouvert (œuf)
  '5': 'in', // in nasal (cinq) -> touche double in/un
  '1': 'in', // un nasal (parfum)
  '@': 'an',
  '§': 'on',
  // Semi-voyelles (le yod 'j' est traité au cas par cas dans decodePhon selon
  // ce qui le suit — voir plus bas ; il n'a pas d'entrée fixe ici).
  '8': 'u', // /ɥ/ isolé (nuage = n+8+a+Z), sauf si suivi de "i" (voir motifs)
  w: 'w', // isolé (wifi, week-end), sauf si suivi de "a"/"5" (voir motifs)
  // Consonnes
  p: 'p',
  b: 'b',
  t: 't',
  d: 'd',
  k: 'c', // notre touche "k/c" a pour id 'c' (carotte)
  g: 'g',
  f: 'f',
  v: 'v',
  s: 's',
  z: 'z',
  S: 'ch',
  Z: 'j', // /ʒ/ (gilet) -> notre touche "j" (jaune)
  m: 'm',
  n: 'n',
  N: 'gn',
  l: 'l',
  R: 'r',
  x: 'c', // jota espagnole, très rare — approximé sur notre touche [k]
  G: 'gn', // ng anglais (camping), très rare — approximé sur notre touche [ɲ]
}

/** Découpe une chaîne phon Lexique383 en séquence de nos PhonemeId. */
export function decodePhon(phon: string): string[] {
  const result: string[] = []
  let i = 0
  while (i < phon.length) {
    const matched = multiCharPatterns.find((p) => phon.startsWith(p.match, i))
    if (matched) {
      result.push(matched.id)
      i += matched.match.length
      continue
    }
    const ch = phon[i]
    // Yod [j] : touche "i" s'il est suivi d'une voyelle (avion = a-v-i-on,
    // illusion = i-l-u-z-i-on, chien = ch-i-in), touche "ill" sinon, c.-à-d.
    // yod final ou devant une consonne (paille = p-a-ill, réveil = r-é-v-è-ill).
    // Le cas [i]+yod (fille, brillant) est déjà capté par le motif 'ij' -> ill.
    if (ch === 'j') {
      const next = phon[i + 1]
      result.push(next !== undefined && VOWEL_SYMBOLS.has(next) ? 'i' : 'ill')
      i += 1
      continue
    }
    const id = singleCharMap[ch]
    if (id) {
      result.push(id)
    } else {
      throw new Error(`Symbole Lexique inconnu: '${ch}' dans "${phon}"`)
    }
    i += 1
  }
  return result
}
