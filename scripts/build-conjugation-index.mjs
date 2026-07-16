// Génère les tableaux de conjugaison (Présent, Futur, Imparfait, Passé
// composé) pour tous les verbes présents dans le lexique, à partir de
// Lexique383 (licence déjà validée, voir CREDITS.md). Le passé composé
// n'existe pas comme forme unique dans Lexique383 (temps composé) : il est
// construit à partir de l'auxiliaire (avoir/être, liste fixe ci-dessous) au
// présent + le participe passé, avec accord correct en genre/nombre pour
// les verbes en "être".
//
// Sortie : src/data/conjugations.json, keyé par infinitif.
// Lancé à la main : node scripts/build-conjugation-index.mjs
import { readFileSync, writeFileSync } from 'node:fs'

// Verbes se conjuguant avec "être" au passé composé (liste standard, non
// exhaustive pour les pronominaux : se laver, se souvenir, etc. ne sont pas
// couverts pour l'instant — limitation connue, verbes non pronominaux only).
const ETRE_VERBS = new Set([
  'aller',
  'arriver',
  'décéder',
  'entrer',
  'rentrer',
  'monter',
  'remonter',
  'mourir',
  'naître',
  'renaître',
  'partir',
  'repartir',
  'passer',
  'rester',
  'retourner',
  'sortir',
  'ressortir',
  'tomber',
  'retomber',
  'venir',
  'devenir',
  'revenir',
  'parvenir',
  'survenir',
  'intervenir',
  'descendre',
  'redescendre',
])

const PERSONS = ['1s', '2s', '3s', '1p', '2p', '3p']

const tsvPath = new URL('../third_party/lexique383/Lexique383.tsv', import.meta.url)
const text = readFileSync(tsvPath, 'utf8')
const lines = text.split(/\r\n|\n/).filter(Boolean)
const header = lines[0].split('\t')
const col = Object.fromEntries(header.map((name, i) => [name, i]))
const get = (cols, name) => cols[col[name]]

// Verbes réellement présents dans le lexique généré (pas la peine de
// construire des tableaux pour des verbes que personne ne pourra jamais
// trouver via une carte).
const wordIndex = JSON.parse(readFileSync(new URL('../src/data/words-clavier2.json', import.meta.url), 'utf8'))
const reachableVerbs = new Set(
  wordIndex.filter((e) => e.category === 'verbe').map((e) => e.lemmaId.replace(/^verbe:/, '')),
)

// --- Extraction : lemme -> { infinitif, présent, futur, imparfait, pp } ----
const byLemma = new Map()

function ensure(lemme) {
  let v = byLemma.get(lemme)
  if (!v) {
    v = {
      infinitif: null,
      present: {},
      futur: {},
      imparfait: {},
      participe: { ms: null, fs: null, mp: null, fp: null },
    }
    byLemma.set(lemme, v)
  }
  return v
}

function bestByFreq(current, candidateWord, candidateFreq, freqByWord) {
  if (!current) return candidateWord
  const currentFreq = freqByWord.get(current) ?? 0
  return candidateFreq > currentFreq ? candidateWord : current
}

const freqByWord = new Map()

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t')
  const cgram = get(cols, 'cgram')
  if (cgram !== 'VER' && cgram !== 'AUX') continue
  const lemme = get(cols, 'lemme')
  const ortho = get(cols, 'ortho')
  const infover = get(cols, 'infover') || ''
  const genre = get(cols, 'genre')
  const nombre = get(cols, 'nombre')
  const freq = parseFloat(get(cols, 'freqlivres')) || 0
  freqByWord.set(ortho, Math.max(freqByWord.get(ortho) ?? 0, freq))

  // On ne construit les tableaux que pour "avoir"/"être" (auxiliaires
  // nécessaires à tous les passés composés) + les verbes réellement dans le
  // lexique.
  if (lemme !== 'avoir' && lemme !== 'être' && !reachableVerbs.has(lemme)) continue

  const v = ensure(lemme)

  if (infover.includes('inf')) {
    v.infinitif = bestByFreq(v.infinitif, ortho, freq, freqByWord)
  }
  if (infover.includes('par:pas')) {
    const slot = (genre === 'f' ? 'f' : 'm') + (nombre === 'p' ? 'p' : 's')
    v.participe[slot] = bestByFreq(v.participe[slot], ortho, freq, freqByWord)
  }
  for (const person of PERSONS) {
    if (infover.includes(`ind:pre:${person}`)) {
      v.present[person] = bestByFreq(v.present[person], ortho, freq, freqByWord)
    }
    if (infover.includes(`ind:fut:${person}`)) {
      v.futur[person] = bestByFreq(v.futur[person], ortho, freq, freqByWord)
    }
    if (infover.includes(`ind:imp:${person}`)) {
      v.imparfait[person] = bestByFreq(v.imparfait[person], ortho, freq, freqByWord)
    }
  }
}

const avoir = byLemma.get('avoir')
const etre = byLemma.get('être')

// 9 personnes explicites (je/tu/il/elle/on/nous/vous/ils/elles), comme sur
// la maquette de l'enseignante — pas les 6 cases grammaticales 1s/2s/3s/1p/
// 2p/3p, car "il"/"elle" partagent la même forme conjuguée au présent/futur/
// imparfait mais PAS au passé composé avec l'auxiliaire "être"
// ("il est allé" vs "elle est allée").
const NEUF_PERSONNES = [
  ['je', '1s'],
  ['tu', '2s'],
  ['il', '3s'],
  ['elle', '3s'],
  ['on', '3s'],
  ['nous', '1p'],
  ['vous', '2p'],
  ['ils', '3p'],
  ['elles', '3p'],
]

function expandToNeuf(sixCases) {
  const out = {}
  for (const [personne, grammCase] of NEUF_PERSONNES) {
    if (sixCases[grammCase]) out[personne] = sixCases[grammCase]
  }
  return out
}

// Genre par personne pour l'accord du participe passé avec "être".
// je/tu/on/nous/vous : genre non déterminable par la conjugaison seule
// (dépend du locuteur) -> masculin par défaut.
const GENRE_PAR_PERSONNE = {
  je: 'm',
  tu: 'm',
  il: 'm',
  elle: 'f',
  on: 'm',
  nous: 'm',
  vous: 'm',
  ils: 'm',
  elles: 'f',
}

function participeAccorde(participe, personne) {
  const genre = GENRE_PAR_PERSONNE[personne]
  const nombre = personne === 'nous' || personne === 'vous' || personne === 'ils' || personne === 'elles' ? 'p' : 's'
  return participe[genre + nombre] ?? participe.ms ?? null
}

// --- Construction du passé composé (9 personnes) ----------------------------
function buildPasseCompose(verb, isEtre) {
  const aux = isEtre ? etre : avoir
  const auxNeuf = expandToNeuf(aux?.present ?? {})
  const passeCompose = {}
  for (const [personne] of NEUF_PERSONNES) {
    const auxForm = auxNeuf[personne]
    const ppForm = isEtre ? participeAccorde(verb.participe, personne) : verb.participe.ms
    if (auxForm && ppForm) passeCompose[personne] = `${auxForm} ${ppForm}`
  }
  return passeCompose
}

// --- Complétion des formes régulières manquantes ----------------------------
// Lexique383 ne contient que les formes réellement attestées dans son corpus.
// Pour un verbe rare (ex. "huiler"), beaucoup de formes conjuguées manquent.
// On génère les formes régulières manquantes, mais UNIQUEMENT pour les verbes
// en -er réguliers "simples" (conjugaison déterministe), en excluant les
// familles à changement de radical (-yer, -eler/-eter, lever/céder…) où une
// génération naïve produirait une orthographe FAUSSE — inacceptable pour un
// outil d'orthographe. Pour ces cas exclus, on garde les formes attestées
// (partielles) de Lexique383. On ne remplace jamais une forme attestée :
// on ne fait que combler les trous.
const PRESENT_ENDINGS = { '1s': 'e', '2s': 'es', '3s': 'e', '1p': 'ons', '2p': 'ez', '3p': 'ent' }
const IMPARFAIT_ENDINGS = { '1s': 'ais', '2s': 'ais', '3s': 'ait', '1p': 'ions', '2p': 'iez', '3p': 'aient' }
const FUTUR_ENDINGS = { '1s': 'ai', '2s': 'as', '3s': 'a', '1p': 'ons', '2p': 'ez', '3p': 'ont' }

function isRiskyErStem(stem) {
  if (/y$/.test(stem)) return true // -yer : payer, employer, essuyer
  // e/é + une seule consonne finale : lever, mener, semer (e_er), céder,
  // espérer (é_er), appeler (-eler), jeter (-eter) — radical variable.
  if (/[eéèê][bcdfghjklmnpqrstvwxz]$/i.test(stem)) return true
  return false
}

function regularErForms(infinitif) {
  if (!/er$/.test(infinitif) || infinitif === 'aller') return null
  const stem = infinitif.slice(0, -2)
  if (isRiskyErStem(stem)) return null
  const isGer = /g$/.test(stem) // manger -> mangeons, mangeais (e devant a/o)
  const isCer = /c$/.test(stem) // placer -> plaçons, plaçais (ç devant a/o)
  const stemAO = isGer ? stem + 'e' : isCer ? stem.slice(0, -1) + 'ç' : stem
  const startsAO = (ending) => /^[ao]/.test(ending)

  const present = {}
  const imparfait = {}
  const futur = {}
  for (const p of PERSONS) {
    present[p] = (startsAO(PRESENT_ENDINGS[p]) ? stemAO : stem) + PRESENT_ENDINGS[p]
    imparfait[p] = (startsAO(IMPARFAIT_ENDINGS[p]) ? stemAO : stem) + IMPARFAIT_ENDINGS[p]
    futur[p] = infinitif + FUTUR_ENDINGS[p] // futur régulier = infinitif + terminaison
  }
  const participe = { ms: stem + 'é', fs: stem + 'ée', mp: stem + 'és', fp: stem + 'ées' }
  return { present, imparfait, futur, participe }
}

function fillMissingRegularForms(v) {
  const gen = regularErForms(v.infinitif)
  if (!gen) return
  for (const p of PERSONS) {
    if (!v.present[p]) v.present[p] = gen.present[p]
    if (!v.futur[p]) v.futur[p] = gen.futur[p]
    if (!v.imparfait[p]) v.imparfait[p] = gen.imparfait[p]
  }
  for (const slot of ['ms', 'fs', 'mp', 'fp']) {
    if (!v.participe[slot]) v.participe[slot] = gen.participe[slot]
  }
}

// Rustines au cas par cas pour des verbes réguliers mais exclus de
// regularErForms() (radical à alternance è/é, famille céder/espérer) : la
// génération automatique reste hors de portée pour toute cette famille (voir
// isRiskyErStem), mais on peut combler les trous mot par mot quand un
// enseignant en signale un. Ne comble que les cases vides, ne remplace
// jamais une forme attestée par Lexique383 — SAUF `futurOverride`, qui
// remplace aussi les formes attestées : Lexique383 code le futur de cette
// famille en orthographe traditionnelle (é), mais les rectifications de
// l'orthographe de 1990 remplacent l'accent aigu par un accent grave au
// futur/conditionnel pour tout le modèle "céder" (je cèderai, j'allègerai —
// https://dictionnaire.lerobert.com/guide/rectifications-de-l-orthographe-de-1990-regles),
// et c'est cette graphie qu'on choisit d'enseigner ici.
const MANUAL_VERB_FORMS = {
  rouspéter: {
    present: { '1p': 'rouspétons' },
    futurOverride: {
      '1s': 'rouspèterai',
      '2s': 'rouspèteras',
      '3s': 'rouspètera',
      '1p': 'rouspèterons',
      '2p': 'rouspèterez',
      '3p': 'rouspèteront',
    },
    imparfait: { '2s': 'rouspétais', '1p': 'rouspétions', '2p': 'rouspétiez' },
    participe: { ms: 'rouspété', fs: 'rouspétée', mp: 'rouspétés', fp: 'rouspétées' },
  },
}

function applyManualForms(v, lemme) {
  const manual = MANUAL_VERB_FORMS[lemme]
  if (!manual) return
  for (const p of PERSONS) {
    if (manual.present?.[p] && !v.present[p]) v.present[p] = manual.present[p]
    if (manual.futurOverride?.[p]) v.futur[p] = manual.futurOverride[p]
    if (manual.imparfait?.[p] && !v.imparfait[p]) v.imparfait[p] = manual.imparfait[p]
  }
  for (const slot of ['ms', 'fs', 'mp', 'fp']) {
    if (manual.participe?.[slot] && !v.participe[slot]) v.participe[slot] = manual.participe[slot]
  }
}

// --- Sortie -------------------------------------------------------------------
const output = {}
for (const lemme of reachableVerbs) {
  const v = byLemma.get(lemme)
  if (!v || !v.infinitif) continue
  fillMissingRegularForms(v)
  applyManualForms(v, lemme)
  const isEtre = ETRE_VERBS.has(lemme)
  output[lemme] = {
    infinitif: v.infinitif,
    auxiliaire: isEtre ? 'être' : 'avoir',
    present: expandToNeuf(v.present),
    futur: expandToNeuf(v.futur),
    imparfait: expandToNeuf(v.imparfait),
    passeCompose: buildPasseCompose(v, isEtre),
  }
}

writeFileSync(new URL('../src/data/conjugations.json', import.meta.url), JSON.stringify(output, null, 2))
console.log(`${Object.keys(output).length} verbes conjugués sur ${reachableVerbs.size} attendus.`)
const missing = [...reachableVerbs].filter((l) => !output[l])
console.log(`${missing.length} verbes du lexique sans tableau complet (exemples: ${missing.slice(0, 10).join(', ')})`)
