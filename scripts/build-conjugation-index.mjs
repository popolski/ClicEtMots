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
import { conjugate } from 'conjugation-fr'

// Repli pour un verbe dont les formes attestées dans Lexique383 (complétées
// par génération déterministe, voir plus bas) ne couvrent pas les 9
// personnes des 3 temps simples — ex. "haleter" (famille -eter à alternance
// accent/consonne doublée, volontairement exclue de la génération car pas
// fiable à 100% par simple règle). conjugation-fr (base Verbiste, ~7000
// verbes, tous modes/temps) sert alors d'autorité complète : même
// bibliothèque déjà utilisée côté client pour les verbes ajoutés à la main
// (src/lib/externalConjugation.ts — logique dupliquée intentionnellement,
// l'une tourne ici en Node au build, l'autre dans le navigateur à l'ajout).
const PRONOM_PAR_INDEX = ['je', 'tu', 'il', 'nous', 'vous', 'ils']

function sixVersRecord(rows) {
  const out = {}
  for (const r of rows) {
    const pronom = PRONOM_PAR_INDEX[r.pronounIndex]
    if (pronom) out[pronom] = r.verb
  }
  return out
}

function neufPersonnes(masc, fem) {
  return {
    je: masc.je, tu: masc.tu, il: masc.il, elle: fem.il, on: masc.il,
    nous: masc.nous, vous: masc.vous, ils: masc.ils, elles: fem.ils,
  }
}

function depuisConjugationFr(infinitif) {
  try {
    const presentMasc = sixVersRecord(conjugate(infinitif, 'indicative', 'present'))
    const futurMasc = sixVersRecord(conjugate(infinitif, 'indicative', 'future'))
    const imparfaitMasc = sixVersRecord(conjugate(infinitif, 'indicative', 'imperfect'))
    const passeComposeMasc = sixVersRecord(conjugate(infinitif, 'indicative', 'perfect-tense', false))
    const passeComposeFem = sixVersRecord(conjugate(infinitif, 'indicative', 'perfect-tense', true))
    return {
      infinitif,
      auxiliaire: passeComposeMasc.je?.trim().startsWith('suis') ? 'être' : 'avoir',
      present: neufPersonnes(presentMasc, presentMasc),
      futur: neufPersonnes(futurMasc, futurMasc),
      imparfait: neufPersonnes(imparfaitMasc, imparfaitMasc),
      passeCompose: neufPersonnes(passeComposeMasc, passeComposeFem),
    }
  } catch {
    return null
  }
}

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

// Garde-fou sur les formes attestées : Lexique383 contient des lignes mal
// étiquetées, et on ne peut pas les avaler telles quelles.
//   - l'infinitif "porter" est aussi tagué ind:pre:2p -> "vous porter"
//   - "donnes" est tagué ind:pre:1p -> "nous donnes"
//   - une ligne franchement corrompue donne "emmener" comme forme du lemme
//     "expliquer" -> "vous emmener"
// bestByFreq aggravait le cas : freqByWord est indexé par orthographe seule,
// donc la forme fautive héritait de la fréquence de son homographe (celle de
// l'infinitif "emmener", 26.96) et écrasait la bonne forme ("expliquez",
// 3.11). Comparer les fréquences ne peut pas trancher ici — l'infinitif est
// toujours plus fréquent que sa forme "vous".
//
// D'où ce filtre par terminaison, indépendant des fréquences : à l'imparfait
// et au futur, les terminaisons françaises sont universelles (tous groupes,
// y compris les irréguliers) ; au présent, 1p et 2p le sont à quelques
// exceptions près (sommes, êtes, faites, dites). Une forme qui n'y
// correspond pas est forcément une erreur d'étiquetage : on l'ignore, et la
// bonne forme (correctement étiquetée par ailleurs) prend sa place.
// Les autres personnes du présent (1s/2s/3s/3p) varient selon le groupe :
// pas de règle sûre, on ne filtre pas — mais les verbes réguliers en -er
// sont de toute façon couverts par la génération (voir plus bas).
const TERMINAISONS_ATTENDUES = {
  present: { '1p': /(ons|sommes)$/, '2p': /(ez|tes)$/ },
  imparfait: { '1s': /ais$/, '2s': /ais$/, '3s': /ait$/, '1p': /ions$/, '2p': /iez$/, '3p': /aient$/ },
  futur: { '1s': /rai$/, '2s': /ras$/, '3s': /ra$/, '1p': /rons$/, '2p': /rez$/, '3p': /ront$/ },
}

function formeAttesteePlausible(temps, person, forme) {
  const attendu = TERMINAISONS_ATTENDUES[temps]?.[person]
  return !attendu || attendu.test(forme)
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

  // Chez Lexique383, le lemme d'un verbe EST son infinitif : une ligne qui
  // étiquette "inf" une orthographe différente du lemme est erronée. Ex. la
  // ligne (ortho=voulez, lemme=vouler, infover=inf) invente un verbe "vouler"
  // dont l'infinitif serait "voulez" — sans ce contrôle, il finissait dans le
  // lexique avec un tableau de conjugaison vide.
  if (infover.includes('inf') && ortho === lemme) {
    v.infinitif = bestByFreq(v.infinitif, ortho, freq, freqByWord)
  }
  if (infover.includes('par:pas')) {
    const slot = (genre === 'f' ? 'f' : 'm') + (nombre === 'p' ? 'p' : 's')
    v.participe[slot] = bestByFreq(v.participe[slot], ortho, freq, freqByWord)
  }
  for (const person of PERSONS) {
    if (infover.includes(`ind:pre:${person}`) && formeAttesteePlausible('present', person, ortho)) {
      v.present[person] = bestByFreq(v.present[person], ortho, freq, freqByWord)
    }
    if (infover.includes(`ind:fut:${person}`) && formeAttesteePlausible('futur', person, ortho)) {
      v.futur[person] = bestByFreq(v.futur[person], ortho, freq, freqByWord)
    }
    if (infover.includes(`ind:imp:${person}`) && formeAttesteePlausible('imparfait', person, ortho)) {
      v.imparfait[person] = bestByFreq(v.imparfait[person], ortho, freq, freqByWord)
    }
  }
}

const avoir = byLemma.get('avoir')
const etre = byLemma.get('être')

// 9 personnes explicites (je/tu/il/elle/on/nous/vous/ils/elles), comme sur
// la maquette de l'enseignant — pas les 6 cases grammaticales 1s/2s/3s/1p/
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

// Radical en [éèê] + une seule consonne finale : céder, espérer, compléter,
// préférer, protéger, régler… ("famille de céder"). Sous-ensemble
// d'isRiskyErStem exclu de regularErForms() (radical variable), mais dont
// l'alternance est en fait parfaitement régulière et peut être générée :
// radical "faible" (é, non accentué) devant une terminaison prononcée,
// radical "fort" (è) devant une terminaison à e muet — et depuis les
// rectifications de l'orthographe de 1990, radical "fort" (è) au
// futur/conditionnel pour TOUTE la famille (je cèderai, j'allègerai) au lieu
// du é traditionnel. Contrairement à -eler/-eter, il n'y a pas d'exception
// notable ici (pas d'équivalent appeler/jeter à doublement de consonne).
function isCederStyleStem(stem) {
  return /[éèê][bcdfghjklmnpqrstvwxz]$/i.test(stem)
}

function cederStyleForms(infinitif) {
  if (!/er$/.test(infinitif) || infinitif === 'aller') return null
  const stem = infinitif.slice(0, -2)
  if (!isCederStyleStem(stem)) return null
  const isGer = /g$/.test(stem) // protéger -> protégeons, protégeais (e devant a/o)
  const isCer = /c$/.test(stem) // rapiécer -> rapiéçons, rapiéçais (ç devant a/o)
  const stemAO = isGer ? stem + 'e' : isCer ? stem.slice(0, -1) + 'ç' : stem
  const startsAO = (ending) => /^[ao]/.test(ending)

  // Radical fort : seul le dernier é/è/ê (juste avant la consonne finale) se
  // transforme en è — les é plus tôt dans le mot (référer, préférer) restent
  // é (je réfère, pas *rèfère).
  const accent = stem[stem.length - 2]
  const strongAccent = accent === 'é' ? 'è' : accent === 'É' ? 'È' : accent
  const stemStrong = stem.slice(0, -2) + strongAccent + stem.slice(-1)

  const present = {}
  const imparfait = {}
  const futur = {}
  for (const p of PERSONS) {
    const strongPersons = p === '1s' || p === '2s' || p === '3s' || p === '3p'
    present[p] = (strongPersons ? stemStrong : startsAO(PRESENT_ENDINGS[p]) ? stemAO : stem) + PRESENT_ENDINGS[p]
    imparfait[p] = (startsAO(IMPARFAIT_ENDINGS[p]) ? stemAO : stem) + IMPARFAIT_ENDINGS[p]
    futur[p] = stemStrong + 'er' + FUTUR_ENDINGS[p] // rectifications 1990 : è au futur/conditionnel
  }
  const participe = { ms: stem + 'é', fs: stem + 'ée', mp: stem + 'és', fp: stem + 'ées' }
  return { present, imparfait, futur, participe }
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

// Pour un verbe dont la conjugaison est DÉTERMINISTE (régulier en -er, ou
// famille de céder), la génération fait autorité : elle remplace les formes
// attestées au lieu de se contenter de combler les trous.
//
// C'était l'inverse avant, sur l'intuition qu'une forme réellement attestée
// dans un corpus vaut mieux qu'une forme calculée. À l'usage c'est faux :
// pour ces verbes, la règle ne souffre aucune exception (c'est la définition
// de "régulier", et isRiskyErStem écarte justement les familles à radical
// variable), alors que les étiquettes de Lexique383, elles, comportent des
// erreurs — 71 verbes en -er avaient au moins une forme fausse, dont des
// verbes très courants (vous porter, nous donnes, nous racontes...). Le
// filtre par terminaison plus haut ne peut pas tout rattraper : il ne couvre
// pas les personnes 1s/2s/3s/3p du présent, dont les terminaisons dépendent
// du groupe.
function appliquerFormesRegulieres(v) {
  const cederGen = cederStyleForms(v.infinitif)
  const gen = regularErForms(v.infinitif) ?? cederGen
  if (!gen) return
  for (const p of PERSONS) {
    v.present[p] = gen.present[p]
    v.imparfait[p] = gen.imparfait[p]
    // Pour la famille de céder, le futur généré porte en plus l'accent grave
    // des rectifications de 1990 (je cèderai) là où Lexique383 garde l'accent
    // aigu traditionnel.
    v.futur[p] = gen.futur[p]
  }
  for (const slot of ['ms', 'fs', 'mp', 'fp']) {
    v.participe[slot] = gen.participe[slot]
  }
}

// --- Sortie -------------------------------------------------------------------
const output = {}
for (const lemme of reachableVerbs) {
  const v = byLemma.get(lemme)
  if (!v) continue
  if (!v.infinitif) {
    // Verbe rare sans aucune ligne "inf" attestée dans Lexique383 (ex.
    // "pointiller" : seules des formes conjuguées y figurent). Si le lemme
    // est un -er régulier déterministe (regularErForms le confirme), son
    // orthographe fait foi pour l'infinitif — c'est la définition même du
    // lemme chez Lexique383 — et le tableau entier peut être généré sans
    // attestation, comme pour n'importe quel autre -er régulier.
    if (regularErForms(lemme)) v.infinitif = lemme
    else continue
  }
  appliquerFormesRegulieres(v)
  const isEtre = ETRE_VERBS.has(lemme)
  const present = expandToNeuf(v.present)
  const futur = expandToNeuf(v.futur)
  const imparfait = expandToNeuf(v.imparfait)

  // Un verbe à radical variable non déterministe (ex. "haleter", famille
  // -eter/-eler à alternance accent/consonne doublée non générable sans
  // risque, voir isRiskyErStem) ne reçoit que les formes RÉELLEMENT
  // attestées dans Lexique383 — souvent une poignée de personnes seulement,
  // aucune au futur. Un tableau troué (des cases vides en plein milieu du
  // conjugueur) est pire qu'utile pour un enfant : avant de renoncer
  // complètement, on tente conjugation-fr (voir plus haut) qui connaît la
  // plupart de ces verbes avec un tableau complet et fiable.
  if (NEUF_PERSONNES.some(([p]) => !present[p] || !futur[p] || !imparfait[p])) {
    const externe = depuisConjugationFr(lemme)
    if (externe) {
      output[lemme] = externe
    }
    continue
  }

  output[lemme] = {
    infinitif: v.infinitif,
    auxiliaire: isEtre ? 'être' : 'avoir',
    present,
    futur,
    imparfait,
    passeCompose: buildPasseCompose(v, isEtre),
  }
}

writeFileSync(new URL('../src/data/conjugations.json', import.meta.url), JSON.stringify(output, null, 2))
console.log(`${Object.keys(output).length} verbes conjugués sur ${reachableVerbs.size} attendus.`)
const missing = [...reachableVerbs].filter((l) => !output[l])
console.log(`${missing.length} verbes du lexique sans tableau complet (exemples: ${missing.slice(0, 10).join(', ')})`)
