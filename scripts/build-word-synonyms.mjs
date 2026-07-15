// Génère src/data/word-synonyms.json et src/data/word-antonyms.json : pour
// chaque mot de notre lexique, ses synonymes/antonymes eux-mêmes présents
// dans notre lexique, d'après JeuxDeMots (jeuxdemots.org, LIRMM/CNRS,
// licence CC0 - domaine public), un réseau lexical construit par un jeu
// collaboratif grand public.
//
// Format source (voir third_party/jeuxdemots/*.txt) : "terme1;terme2;poids"
// par ligne, poids = nombre de joueurs ayant confirmé (positif) ou infirmé
// (négatif) la relation. On ne garde que les poids >= POIDS_SEUIL (relation
// bien confirmée), ET les deux mots doivent être dans notre lexique
// principal (Manulex, voir build-word-index.mjs) : comme pour Démonette,
// c'est ce croisement qui sert de filtre de contenu — un mot d'argot ou
// inapproprié pour une classe primaire n'a normalement pas franchi le
// filtre Manulex de toute façon, donc n'est jamais candidat ici.
//
// Piège de format : les entités HTML (&eacute;, &agrave;...) utilisées par
// l'export contiennent elles-mêmes un point-virgule final, ce qui casse un
// split(';') naïf — il faut décoder les entités AVANT de découper la ligne.
//
// Limite connue : ce fichier ne porte pas la catégorie grammaticale du mot
// (contrairement à Démonette), donc un mot homographe entre catégories
// (ex. "chat" animal vs "chat" conversation en ligne) peut mélanger des
// relations des deux sens. Accepté en v1, comme le filtre Manulex/EQOL
// laisse passer occasionnellement un nom propre mal catégorisé.
//
// Prérequis : third_party/jeuxdemots/r_syn/*.txt et r_anto/*.txt (dumps
// téléchargés depuis jeuxdemots.org/JDM-LEXICALNET-FR/, non versionnés).
//
// Lancé à la main, après build-word-index.mjs : node scripts/build-word-synonyms.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { isExcludedRelation, hasSuppressedRelations, manualSynonymsFor } from './excluded-relations.mjs'

const wordIndexPath = new URL('../src/data/words-clavier2.json', import.meta.url)
const wordIndex = JSON.parse(readFileSync(wordIndexPath, 'utf8'))

const BASE_ROLE = { nom: 'singulier', adjectif: 'masculin', verbe: 'infinitif', adverbe: 'simple', invariable: 'simple' }

// mot (minuscules) -> TOUTES ses entrées de base dans notre lexique (un mot
// comme "grand" existe chez nous en adjectif, nom ET adverbe à la fois — si
// on n'en gardait qu'une, les antonymes/synonymes de "grand" ne seraient
// attribués qu'à une seule de ces trois fiches, et les deux autres
// resteraient vides sans raison). JeuxDeMots ne porte pas la catégorie
// grammaticale, donc on ne peut pas trancher laquelle est "la bonne" : on
// diffuse la relation à toutes les catégories homographes du mot source.
const baseEntriesByWord = new Map()
for (const e of wordIndex) {
  if (e.formRole !== BASE_ROLE[e.category]) continue
  const key = e.word.toLowerCase()
  const list = baseEntriesByWord.get(key) ?? []
  list.push(e)
  baseEntriesByWord.set(key, list)
}

// --- Décodage des entités HTML de l'export JeuxDeMots ----------------------
const NAMED_ENTITIES = {
  aacute: 'á', Aacute: 'Á', acirc: 'â', Acirc: 'Â', aelig: 'æ', AElig: 'Æ', agrave: 'à', Agrave: 'À',
  aring: 'å', Aring: 'Å', atilde: 'ã', auml: 'ä', Auml: 'Ä', ccedil: 'ç', Ccedil: 'Ç', eacute: 'é', Eacute: 'É',
  ecirc: 'ê', Ecirc: 'Ê', egrave: 'è', Egrave: 'È', eth: 'ð', euml: 'ë', Euml: 'Ë', iacute: 'í', Iacute: 'Í',
  icirc: 'î', Icirc: 'Î', igrave: 'ì', iuml: 'ï', Iuml: 'Ï', ntilde: 'ñ', Ntilde: 'Ñ', oacute: 'ó', Oacute: 'Ó',
  ocirc: 'ô', Ocirc: 'Ô', oelig: 'œ', OElig: 'Œ', ograve: 'ò', oslash: 'ø', Oslash: 'Ø', otilde: 'õ', ouml: 'ö', Ouml: 'Ö',
  scaron: 'š', szlig: 'ß', thorn: 'þ', THORN: 'Þ', uacute: 'ú', Uacute: 'Ú', ucirc: 'û', ugrave: 'ù', uuml: 'ü', Uuml: 'Ü',
  yacute: 'ý', yuml: 'ÿ',
  amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', copy: '©', reg: '®', deg: '°', middot: '·', times: '×',
  laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', rsquo: '’', lsquo: '‘',
  beta: 'β', gamma: 'γ', Delta: 'Δ', omega: 'ω', micro: 'µ', ordf: 'ª', frac14: '¼', sup1: '¹', sup2: '²', shy: '',
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m))
}

function findDumpFile(dirName) {
  const dir = new URL(`../third_party/jeuxdemots/${dirName}/`, import.meta.url)
  const [file] = readdirSync(dir).filter((f) => f.endsWith('.txt'))
  if (!file) throw new Error(`Aucun fichier .txt trouvé dans third_party/jeuxdemots/${dirName}/`)
  return new URL(file, dir)
}

// --- Lecture d'un dump de relations JeuxDeMots ------------------------------
function parseRelations(dirName, poidsSeuil) {
  const path = findDumpFile(dirName)
  const lines = readFileSync(path, 'utf8').split(/\r\n|\n/)
  const relations = []
  for (const line of lines) {
    if (line.startsWith(' ****') || !line.trim()) continue
    const decoded = decodeEntities(line)
    const parts = decoded.split(';').map((s) => s.trim())
    if (parts.length !== 3) continue // ~0,3% de lignes avec un ";" littéral dans le terme, ignorées
    const weight = parseInt(parts[2], 10)
    if (Number.isNaN(weight) || weight < poidsSeuil) continue
    relations.push({ t1: parts[0].toLowerCase(), t2: parts[1].toLowerCase(), weight })
  }
  return relations
}

// Poids choisi après avoir observé la distribution réelle (médiane ~28-29,
// 90e percentile ~70-95) : garde une confirmation nette de la communauté
// sans se limiter aux seuls tout premiers résultats.
const POIDS_SEUIL = 30
// Volontairement bas : JeuxDeMots n'a pas de vrais synonymes pour certains
// mots (ex. "araignée"), et au-delà de 2-3 la qualité chute vite vers des
// relations trop techniques ou hors-sujet pour un enfant.
const MAX_PAR_MOT = 3

function buildIndex(dirName) {
  const relations = parseRelations(dirName, POIDS_SEUIL)
  const byLemma = new Map() // lemmaId -> Map<lemmaId cible, {member, weight}>

  for (const { t1, t2, weight } of relations) {
    if (t1 === t2) continue
    if (isExcludedRelation(t1, t2)) continue
    if (hasSuppressedRelations(t1) || hasSuppressedRelations(t2)) continue
    const entries1 = baseEntriesByWord.get(t1)
    const entries2 = baseEntriesByWord.get(t2)
    if (!entries1 || !entries2) continue // l'un des deux mots n'est pas dans notre lexique

    for (const entry1 of entries1) {
      // Pour la cible, on préfère la même catégorie grammaticale que la
      // source ("grand" adjectif -> "petit" adjectif plutôt que "petit"
      // adverbe) quand elle existe, sinon la forme la plus fréquente.
      const entry2 = entries2.find((e) => e.category === entry1.category) ?? entries2[0]
      if (entry1.lemmaId === entry2.lemmaId) continue

      let targets = byLemma.get(entry1.lemmaId)
      if (!targets) {
        targets = new Map()
        byLemma.set(entry1.lemmaId, targets)
      }
      const existing = targets.get(entry2.lemmaId)
      if (!existing || weight > existing.weight) {
        targets.set(entry2.lemmaId, {
          weight,
          frequency: entry2.frequency,
          member: { word: entry2.word, category: entry2.category, lemmaId: entry2.lemmaId },
        })
      }
    }
  }

  // Essayé et abandonné : trier par fréquence Manulex du mot cible plutôt
  // que par poids JeuxDeMots, dans l'idée de privilégier le sens premier.
  // Résultat pire en pratique — pour "manger", ça faisait remonter "prendre"/
  // "cuisine" (mots très fréquents mais synonymes faibles/hors-sujet) devant
  // "dévorer"/"avaler"/"engloutir" (poids 504/479/459, bien plus pertinents
  // mais un peu moins fréquents en tant que mots). Le poids JeuxDeMots reste
  // le meilleur signal de qualité disponible ; les cas résiduels
  // (littéraire/hors-sujet malgré un poids élevé, ex. "araignée"/"sexe")
  // se traitent au cas par cas via excluded-relations.mjs.
  const index = {}
  for (const [lemmaId, targets] of byLemma) {
    index[lemmaId] = [...targets.values()]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_PAR_MOT)
      .map((t) => t.member)
  }

  // Remplace entièrement le calcul JeuxDeMots pour les quelques mots figés à
  // la main (voir MANUAL_SYNONYMS dans excluded-relations.mjs) — seulement
  // pertinent pour les synonymes, jamais pour les antonymes.
  if (dirName === 'r_syn') {
    for (const [word, entries] of baseEntriesByWord) {
      const manualWords = manualSynonymsFor(word)
      if (!manualWords) continue
      for (const entry of entries) {
        index[entry.lemmaId] = manualWords
          .map((w) => baseEntriesByWord.get(w)?.[0])
          .filter((e) => e !== undefined)
          .map((e) => ({ word: e.word, category: e.category, lemmaId: e.lemmaId }))
      }
    }
  }

  return index
}

const synonyms = buildIndex('r_syn')
const antonyms = buildIndex('r_anto')

writeFileSync(new URL('../src/data/word-synonyms.json', import.meta.url), JSON.stringify(synonyms))
writeFileSync(new URL('../src/data/word-antonyms.json', import.meta.url), JSON.stringify(antonyms))

console.log(`${Object.keys(synonyms).length} mots avec au moins un synonyme.`)
console.log(`${Object.keys(antonyms).length} mots avec au moins un antonyme.`)
console.log('Écrit: src/data/word-synonyms.json, src/data/word-antonyms.json')
