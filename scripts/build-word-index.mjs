// Génère le lexique ClavierPhono : structure grammaticale et phonétique
// depuis Lexique383, mais le mot n'est retenu QUE s'il apparaît dans Manulex
// (54 manuels scolaires CP/CE1/cycle 3, manulex.org) avec une fréquence SFI
// combinée CP-CM2 >= FREQ_SEUIL.
//
// Historique : une version précédente croisait aussi avec EQOL (base
// québécoise). Abandonné : EQOL faisait perdre des mots bien français et
// scolaires (ex. "manivelle", "arc-en-ciel", présents dans Manulex mais pas
// testés dans EQOL) sans fiabilité en échange (des québécismes/noms propres
// canadiens comme "orignal"/"Winnipeg" n'y passaient de toute façon jamais,
// grâce au filtre Manulex lui-même). Le seuil de fréquence Manulex seul (35,
// choisi après avoir observé la distribution des SFI sur ~39 000 mots
// candidats — proche du seuil naturel du "Clavier Métalo" 2) reproduit la
// réduction de taille sans ce défaut, et récupère les mots perdus par EQOL.
//
// Le "level" (1 = déjà fréquent en CP/CE1, 2 = ne devient courant qu'en
// CE2-CM1-CM2) vient des colonnes par tranche scolaire de Manulex.xls
// (cp_sfi, ce1_sfi, ce2cm2_sfi), déjà présentes dans manulex-forms.csv mais
// jusqu'ici inexploitées (seule la colonne combinée cpcm2_sfi servait).
//
// Cas particulier des noms, adjectifs et verbes : le filtre Manulex se
// décide au niveau du LEMME, pas forme par forme. Sinon un verbe dont seule
// une forme conjuguée (ex. "huile") dépasse le seuil, mais pas l'infinitif
// ("huiler") lui-même, perdrait son infinitif ; un nom comme "renard"
// perdrait son féminin/pluriel ("renarde", "renards") simplement parce que
// ces formes précises sont un peu sous le seuil, alors que le mot est
// manifestement connu des élèves. Si au moins une forme du lemme dépasse le
// seuil, on construit la carte complète à partir de Lexique383, même pour
// les formes qui ne le dépassent pas individuellement.
//
// Prérequis :
//   third_party/manulex/manulex-forms.csv (export de Manulex.xls,
//     voir le commit "Croiser le lexique avec Manulex" pour la commande Python)
//
// Sortie :
//   src/data/words-clavier2.json    — le lexique, prêt à être importé par l'app
//   scripts/output/words-review.csv — même contenu en CSV (UTF-8 BOM, Excel/LibreOffice)
//     pour une relecture finale, allégée, par l'enseignante.
//
// Lancé à la main : node scripts/build-word-index.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { decodePhon } from './lexiquePhonemeMap.ts'

// --- Manulex : lookup mot -> fréquences par tranche scolaire (SFI) ---------
// cp_sfi/ce1_sfi/ce2cm2_sfi/cpcm2_sfi (combiné) sont les 4 colonnes de
// fréquence exportées de Manulex.xls ("FORMES ORTHO"). En cas de doublon
// (même mot, plusieurs lignes), on garde la ligne avec le plus haut cpcm2_sfi.
const manulexPath = new URL('../third_party/manulex/manulex-forms.csv', import.meta.url)
const manulexLines = readFileSync(manulexPath, 'utf8').split(/\r\n|\n/).filter(Boolean)
const manulexByWord = new Map()
for (let i = 1; i < manulexLines.length; i++) {
  const [word, cp, ce1, ce2cm2, cpcm2] = manulexLines[i].split(',')
  const record = { cp: parseFloat(cp) || 0, ce1: parseFloat(ce1) || 0, ce2cm2: parseFloat(ce2cm2) || 0, cpcm2: parseFloat(cpcm2) || 0 }
  const existing = manulexByWord.get(word)
  if (!existing || record.cpcm2 > existing.cpcm2) manulexByWord.set(word, record)
}

// Seuil de fréquence SFI combinée CP-CM2 en dessous duquel un mot est écarté
// (bruit : mots à une seule occurrence dans un seul manuel, coquilles
// scannées, etc.). Choisi en observant la distribution réelle des SFI sur
// les ~39 000 mots candidats : 35 ramène à ~18 800 mots, proche de la taille
// du Clavier Métalo 2 — voir la discussion du choix de seuil.
const FREQ_SEUIL = 35

function levelFor(word) {
  const record = manulexByWord.get(word)
  if (!record) return 2
  // Déjà fréquent dès le CP ou le CE1 (même seuil que l'inclusion, mais
  // appliqué à la tranche précoce plutôt qu'au combiné) -> level 1 ; sinon
  // le mot ne devient courant qu'à partir du CE2-CM1-CM2 -> level 2.
  return Math.max(record.cp, record.ce1) >= FREQ_SEUIL ? 1 : 2
}

const tsvPath = new URL('../third_party/lexique383/Lexique383.tsv', import.meta.url)
const text = readFileSync(tsvPath, 'utf8')
const lines = text.split(/\r\n|\n/).filter(Boolean)
const header = lines[0].split('\t')
const col = Object.fromEntries(header.map((name, i) => [name, i]))

function get(cols, name) {
  return cols[col[name]]
}

// --- Catégorie grammaticale Lexique -> notre WordCategory -----------------
function categoryFor(cgram) {
  if (cgram === 'NOM') return 'nom'
  if (cgram.startsWith('ADJ')) return 'adjectif'
  if (cgram === 'VER' || cgram === 'AUX') return 'verbe'
  if (cgram === 'ADV') return 'adverbe'
  if (['ART:def', 'ART:inf', 'CON', 'LIA', 'PRE', 'ONO'].includes(cgram) || cgram.startsWith('PRO')) {
    return 'invariable'
  }
  return null // catégorie hors périmètre (ex. cgram vide)
}

// --- Lecture + décodage phonétique -------------------------------------------
// Seuls adverbe/invariable (une forme unique, pas de variantes de genre/nombre)
// sont filtrés tout de suite : chaque forme doit justifier sa propre présence.
// Nom/adjectif/verbe gardent toutes leurs lignes ici et se décident au niveau
// du lemme plus bas (voir plus haut).
const rows = []
let droppedNotInManulex = 0
let droppedBelowThreshold = 0
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t')
  const ortho = get(cols, 'ortho')
  const phon = get(cols, 'phon')
  const cgram = get(cols, 'cgram')
  if (!ortho || !phon || !cgram) continue
  const category = categoryFor(cgram)
  if (!category) continue

  const manulexRecord = manulexByWord.get(ortho)
  const manulexSfi = manulexRecord?.cpcm2
  const filteredPerRow = category === 'adverbe' || category === 'invariable'
  if (filteredPerRow && manulexSfi === undefined) {
    droppedNotInManulex++
    continue // le mot n'apparaît dans aucun des 54 manuels scolaires étudiés
  }
  if (filteredPerRow && manulexSfi < FREQ_SEUIL) {
    droppedBelowThreshold++
    continue // fréquence Manulex trop faible (bruit probable)
  }

  let phonemes
  try {
    phonemes = decodePhon(phon)
  } catch {
    continue // ne devrait pas arriver (spike validé à 100%), filet de sécurité
  }

  rows.push({
    ortho,
    phonemes,
    cgram,
    lemme: get(cols, 'lemme'),
    genre: get(cols, 'genre'),
    nombre: get(cols, 'nombre'),
    infover: get(cols, 'infover'),
    freqlivres: parseFloat(get(cols, 'freqlivres')) || 0,
    manulexSfi, // undefined si cette forme précise n'est pas dans Manulex
    category,
  })
}

// --- Construction des WordEntry candidats, groupés par lemmaId -------------
// lemmaId préfixé par la catégorie pour ne jamais fusionner un nom et un
// verbe qui partagent la même orthographe de lemme (ex. "être" nom vs verbe).
const entriesByLemma = new Map()

function addEntry(lemmaId, category, word, phonemes, formRole, frequency, genre) {
  const key = `${lemmaId}::${formRole}::${word}`
  const list = entriesByLemma.get(lemmaId) ?? []
  const existingIdx = list.findIndex((e) => e.key === key)
  if (existingIdx !== -1) {
    // Un même mot peut apparaître sous plusieurs cgram proches (ex. "de" en
    // ART:def ET en PRE) — on garde la fréquence la plus élevée plutôt que
    // la première ligne rencontrée dans le fichier.
    if (frequency > list[existingIdx].frequency) {
      list[existingIdx] = { key, word, phonemes, frequency, category, lemmaId, formRole, genre }
    }
    return
  }
  list.push({ key, word, phonemes, frequency, category, lemmaId, formRole, genre })
  entriesByLemma.set(lemmaId, list)
}

// Qualification par lemme, commune à nom/adjectif/verbe : le lemme est
// retenu si AU MOINS une de ses formes candidates dépasse le seuil de
// fréquence Manulex.
function qualifies(candidateRows) {
  return candidateRows.some((r) => r.manulexSfi !== undefined && r.manulexSfi >= FREQ_SEUIL)
}

function representativeFrequency(candidateRows) {
  const sfis = candidateRows.map((r) => r.manulexSfi).filter((sfi) => sfi !== undefined)
  return Math.max(...sfis)
}

// Pour verbe : on garde la ligne la plus pertinente par (lemme, rôle) — en
// préférant une forme elle-même présente dans Manulex, sinon la plus
// fréquente (freqlivres) — ce qui résout au passage les doublons AUX/VER
// (ex. "être" auxiliaire vs verbe principal partagent les mêmes formes).
const verbSlotBest = new Map() // `${lemme}::${role}` -> row la plus pertinente

function isBetterVerbCandidate(candidate, current) {
  if (!current) return true
  const candidateInManulex = candidate.manulexSfi !== undefined
  const currentInManulex = current.manulexSfi !== undefined
  if (candidateInManulex !== currentInManulex) return candidateInManulex
  return candidate.freqlivres > current.freqlivres
}

const nomRowsByLemma = new Map()
const adjectifRowsByLemma = new Map()

for (const row of rows) {
  if (row.category === 'nom') {
    const formRole = row.nombre === 'p' ? 'pluriel' : 'singulier'
    const list = nomRowsByLemma.get(row.lemme) ?? []
    list.push({ ...row, role: formRole })
    nomRowsByLemma.set(row.lemme, list)
  } else if (row.category === 'adjectif') {
    if (row.nombre === 'p') continue // seules les formes au singulier (règle Clavier 1)
    const formRole = row.genre === 'f' ? 'féminin' : 'masculin'
    const list = adjectifRowsByLemma.get(row.lemme) ?? []
    list.push({ ...row, role: formRole })
    adjectifRowsByLemma.set(row.lemme, list)
  } else if (row.category === 'adverbe') {
    addEntry(`adverbe:${row.ortho}`, 'adverbe', row.ortho, row.phonemes, 'simple', row.manulexSfi)
  } else if (row.category === 'invariable') {
    addEntry(`invariable:${row.ortho}`, 'invariable', row.ortho, row.phonemes, 'simple', row.manulexSfi)
  } else if (row.category === 'verbe') {
    const infover = row.infover || ''
    let role = null
    if (infover.includes('inf')) role = 'infinitif'
    else if (infover.includes('par:pas') && (row.genre === 'm' || !row.genre) && (row.nombre === 's' || !row.nombre)) {
      role = 'participe_passé'
    } else if (infover.includes('ind:pre:3s')) role = 'il_elle_on'
    else if (infover.includes('ind:pre:3p')) role = 'ils_elles'
    if (!role) continue

    const slotKey = `${row.lemme}::${role}`
    if (isBetterVerbCandidate(row, verbSlotBest.get(slotKey))) verbSlotBest.set(slotKey, { ...row, role })
  }
}

// Qualification par lemme : le verbe est retenu si AU MOINS une de ses 4
// formes candidates est elle-même dans Manulex — auquel cas on construit la
// carte complète avec toutes les formes trouvées dans Lexique383, même
// celles qui n'ont pas individuellement de correspondance dans Manulex.
const verbRowsByLemma = new Map()
for (const [slotKey, row] of verbSlotBest) {
  const lemme = slotKey.split('::')[0]
  const list = verbRowsByLemma.get(lemme) ?? []
  list.push(row)
  verbRowsByLemma.set(lemme, list)
}

let verbLemmesRejected = 0
for (const [lemme, verbRows] of verbRowsByLemma) {
  if (!qualifies(verbRows)) {
    verbLemmesRejected++
    continue // aucune forme de ce verbe ne dépasse le seuil de fréquence Manulex
  }
  const representativeSfi = representativeFrequency(verbRows)
  for (const row of verbRows) {
    addEntry(`verbe:${lemme}`, 'verbe', row.ortho, row.phonemes, row.role, row.manulexSfi ?? representativeSfi)
  }
}

// Même qualification par lemme pour les noms (garde masculin ET féminin,
// singulier ET pluriel, dès qu'une des formes dépasse le seuil — résout le
// cas "renard" qui perdait "renarde"/"renards").
let nomLemmesRejected = 0
for (const [lemme, nomRows] of nomRowsByLemma) {
  if (!qualifies(nomRows)) {
    nomLemmesRejected++
    continue
  }
  const representativeSfi = representativeFrequency(nomRows)
  // Lexique383 laisse parfois le genre vide sur une ligne (souvent le
  // singulier) même quand une autre ligne du même lemme le précise (ex.
  // "maison" genre="" mais "maisons" genre="f") — sans ça, un nom à genre
  // unique se ferait à tort passer pour ayant féminin ET masculin. On ne
  // garde une distinction de genre que si les DEUX genres sont explicitement
  // attestés quelque part dans le lemme ; sinon, le genre unique attesté
  // (ou "m" par défaut) s'applique à toutes les formes.
  const explicitGenres = new Set(nomRows.map((r) => r.genre).filter(Boolean))
  const singleGenre = explicitGenres.size <= 1 ? [...explicitGenres][0] || 'm' : null
  for (const row of nomRows) {
    addEntry(
      `nom:${lemme}`,
      'nom',
      row.ortho,
      row.phonemes,
      row.role,
      row.manulexSfi ?? representativeSfi,
      singleGenre ?? (row.genre || 'm'),
    )
  }
}

let adjectifLemmesRejected = 0
for (const [lemme, adjectifRows] of adjectifRowsByLemma) {
  if (!qualifies(adjectifRows)) {
    adjectifLemmesRejected++
    continue
  }
  const representativeSfi = representativeFrequency(adjectifRows)
  for (const row of adjectifRows) {
    addEntry(`adjectif:${lemme}`, 'adjectif', row.ortho, row.phonemes, row.role, row.manulexSfi ?? representativeSfi)
  }
}

// --- Pas de coupure artificielle : on garde tout ce qui a passé le filtre --
// Manulex (contrairement à la version précédente, plus de cible "au moins
// 18000" — la taille finale est celle du vocabulaire réellement scolaire).
const lemmaGroups = [...entriesByLemma.values()]
const finalEntries = lemmaGroups.flat()

// --- Écriture des sorties ----------------------------------------------------
const outDir = new URL('../src/data/', import.meta.url)
const wordIndex = finalEntries
  .map((e) => ({
    word: e.word,
    phonemes: e.phonemes,
    frequency: Math.round(e.frequency * 100) / 100, // SFI Manulex (CP-CM2), pas freqlivres
    level: levelFor(e.word),
    category: e.category,
    lemmaId: e.lemmaId,
    formRole: e.formRole,
    ...(e.genre ? { genre: e.genre } : {}),
  }))
  .sort((a, b) => b.frequency - a.frequency)

writeFileSync(new URL('words-clavier2.json', outDir), JSON.stringify(wordIndex, null, 2))

const reviewDir = new URL('output/', import.meta.url)
mkdirSync(reviewDir, { recursive: true })
const csvHeader = 'mot;categorie;role;famille;sfi_manulex_cp_cm2;level\n'
const csvRows = wordIndex
  .map((e) => `${e.word};${e.category};${e.formRole};${e.lemmaId};${e.frequency};${e.level}`)
  .join('\n')
writeFileSync(new URL('words-review.csv', reviewDir), '﻿' + csvHeader + csvRows)

console.log(
  `${wordIndex.length} mots générés (Manulex seul, seuil SFI CP-CM2 >= ${FREQ_SEUIL}).`,
)
console.log(`${droppedNotInManulex} lignes adverbe/invariable écartées car absentes de Manulex.`)
console.log(`${droppedBelowThreshold} lignes adverbe/invariable écartées car sous le seuil de fréquence.`)
console.log(`${nomLemmesRejected} noms écartés car aucune forme ne dépasse le seuil de fréquence.`)
console.log(`${adjectifLemmesRejected} adjectifs écartés car aucune forme ne dépasse le seuil de fréquence.`)
console.log(`${verbLemmesRejected} verbes écartés car aucune forme ne dépasse le seuil de fréquence.`)
console.log(`Familles de mots (cartes) : ${lemmaGroups.length}`)
const byCategory = {}
for (const e of wordIndex) byCategory[e.category] = (byCategory[e.category] || 0) + 1
console.log('Répartition par catégorie:', byCategory)
console.log('\nÉcrit: src/data/words-clavier2.json')
console.log('Écrit: scripts/output/words-review.csv (pour relecture par l\'enseignante)')
