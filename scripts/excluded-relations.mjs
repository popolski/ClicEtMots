// Liste noire de PAIRES synonyme/antonyme (contrairement à
// excluded-words.mjs, qui retire un mot entier du lexique, ici les deux mots
// restent dans le lexique — seule LA RELATION entre eux est fausse).
//
// JeuxDeMots ne distingue pas les sens d'un mot (pas de POS/désambiguïsation) :
// pour un mot rare en synonymes réels (ex. "araignée"), le réseau mélange le
// sens principal avec d'autres sens du même mot (ex. "araignée de mer", un
// crabe) ou des associations lâches, avec parfois un poids de confiance
// aussi élevé que les relations correctes — un simple seuil de poids ne
// suffit donc pas à les filtrer. Découvert au cas par cas en testant l'appli,
// pas construit préventivement.
//
// Chaque entrée est une paire non ordonnée "mot1::mot2" (les deux sens sont
// vérifiés, pas la peine de dupliquer dans les deux ordres).
const RAW_PAIRS = [
  // araignée : "synonymes" en fait liés au crabe "araignée de mer", pas à
  // l'animal recherché par un enfant du primaire.
  ['araignée', 'galerie'],
  ['araignée', 'coussinet'],
  ['araignée', 'filet'],
  ['araignée', 'carrelet'],
  // "cageot" (registre familier, "elle est cageot" = moche) : trop familier
  // pour une classe primaire, même bien confirmé par la communauté JeuxDeMots.
  ['beauté', 'cageot'],
  // "ombre" : association figurée/littéraire (splendeur vs. ombre), pas un
  // vrai antonyme lexical de "splendeur" pour un enfant.
  ['splendeur', 'ombre'],
]

export const EXCLUDED_RELATION_PAIRS = new Set(RAW_PAIRS.map(([a, b]) => [a, b].sort().join('::')))

export function isExcludedRelation(wordA, wordB) {
  return EXCLUDED_RELATION_PAIRS.has([wordA, wordB].sort().join('::'))
}

// Mots pour lesquels ON NE MONTRE AUCUN synonyme/antonyme, quel que soit le
// poids : contrairement à "araignée" (quelques paires fausses au milieu de
// résultats sinon exploitables), certains mots ont la quasi-totalité de
// leurs "synonymes" JeuxDeMots qui sont des vulgarismes (ex. "sexe" — même
// ses meilleurs résultats par poids sont inutilisables pour une classe
// primaire). Exclure les paires une par une n'aurait pas de sens ici : on
// supprime la source entière.
export const EXCLUDED_RELATION_SOURCES = new Set([
  'sexe', // quasi tous les "synonymes" sont des vulgarismes (chatte, queue, bite...)
  // "caille" (l'oiseau) : les 3 "synonymes" les mieux confirmés sont tous à
  // côté du sens recherché - "poulette"/"biquette" sont des petits noms
  // affectueux (pas l'oiseau), "gibier" un terme bien trop large.
  'caille',
])

export function hasSuppressedRelations(word) {
  return EXCLUDED_RELATION_SOURCES.has(word)
}

// Pour certains mots, la quasi-totalité des relations JeuxDeMots (même à
// poids élevé) viennent de sens figurés (idiomes, expressions), et exclure
// les mauvaises paires une à une ne finit jamais : dès qu'on en retire une,
// la suivante dans le classement est tout aussi fausse (ex. "dent" : aiguille,
// sommet, rancune, domino, pince, arrêt, cran, broche... rejetés tour à
// tour, alors que seuls "croc" et "défense" sont de vrais synonymes reconnus,
// confirmés par le Larousse). Pour ces mots, on fige la liste à la main une
// bonne fois pour toutes plutôt que de continuer à découvrir des exceptions.
const MANUAL_SYNONYMS = {
  dent: ['croc', 'défense'],

  // Deux rattrapages demandés par Hugues le 31/08/2026, après relecture de la
  // première passe hors ligne. Ils vivent ici et non dans sens-enfant.json,
  // qui est réécrit à chaque passe : une extension au reste du lexique les
  // effacerait.
  //
  // « chien » : le modèle avait tout écarté, y compris « toutou », sans doute
  // jugé trop familier. Pour un CE1 c'est pourtant LE mot, et le seul candidat
  // de JeuxDeMots qui désigne l'animal - les autres relèvent de « avoir du
  // chien », « être chien » ou du gardien.
  chien: ['toutou'],

  // « chat » : le modèle avait retenu « minette, minou » et laissé « matou ».
  // « minette » désigne la femelle, comme « jument » pour « cheval » - le
  // modèle avait d'ailleurs écarté celui-là pour cette raison. On garde donc
  // les deux mots qui désignent l'animal sans distinction de sexe.
  chat: ['matou', 'minou'],
}

export function manualSynonymsFor(word) {
  return MANUAL_SYNONYMS[word] ?? null
}
