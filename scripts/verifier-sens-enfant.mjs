// Verification ponctuelle, pas un script du pipeline : pour chaque mot retenu
// par build-sens-enfant.mjs, on verifie qu'il faisait bien partie des
// candidats reellement proposes au modele (meme calcul que candidatsPour()
// dans build-sens-enfant.mjs). La consigne du lot dit explicitement "tu ne
// peux retenir que des candidats presents dans la liste fournie, orthographies
// a l'identique" - ce script mesure si c'est vraiment le cas.
import { readFileSync, readdirSync } from 'node:fs'
import { isExcludedRelation, hasSuppressedRelations } from './excluded-relations.mjs'

const CANDIDATS_PAR_MOT = 12
const POIDS_SEUIL = 30
const BASE_ROLE = { nom: 'singulier', adjectif: 'masculin', verbe: 'infinitif', adverbe: 'simple', invariable: 'simple' }

const wordIndex = JSON.parse(readFileSync(new URL('../src/data/words-clavier2.json', import.meta.url), 'utf8'))
const baseEntriesByWord = new Map()
for (const e of wordIndex) {
  if (e.formRole !== BASE_ROLE[e.category]) continue
  const key = e.word.toLowerCase()
  baseEntriesByWord.set(key, [...(baseEntriesByWord.get(key) ?? []), e])
}
// La forme DE BASE du lemme (infinitif pour un verbe, singulier pour un nom,
// etc.) : prendre n'importe quelle entree du lemme aurait pu tomber sur une
// forme conjuguee/flechie ("attarde" au lieu de "attarder"), absente en tant
// que telle du dump JeuxDeMots - source d'un premier essai de ce script qui
// rapportait des centaines de faux positifs.
const lemmaToEntry = new Map()
for (const e of wordIndex) {
  if (e.formRole !== BASE_ROLE[e.category]) continue
  if (!lemmaToEntry.has(e.lemmaId)) lemmaToEntry.set(e.lemmaId, e)
}

const NAMED_ENTITIES = {
  aacute: 'á', acirc: 'â', aelig: 'æ', agrave: 'à', aring: 'å', atilde: 'ã', auml: 'ä',
  ccedil: 'ç', eacute: 'é', ecirc: 'ê', egrave: 'è', euml: 'ë', iacute: 'í', icirc: 'î',
  igrave: 'ì', iuml: 'ï', ntilde: 'ñ', oacute: 'ó', ocirc: 'ô', oelig: 'œ', ograve: 'ò',
  oslash: 'ø', otilde: 'õ', ouml: 'ö', szlig: 'ß', uacute: 'ú', ucirc: 'û', ugrave: 'ù',
  uuml: 'ü', yacute: 'ý', yuml: 'ÿ', amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ',
  laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°', middot: '·',
}
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (name in NAMED_ENTITIES ? NAMED_ENTITIES[name] : m))
}
function findDumpFile(dirName) {
  const dir = new URL(`../third_party/jeuxdemots/${dirName}/`, import.meta.url)
  const [file] = readdirSync(dir).filter((f) => f.endsWith('.txt'))
  return new URL(file, dir)
}
function chargerRelations(dirName) {
  const parSource = new Map()
  for (const line of readFileSync(findDumpFile(dirName), 'utf8').split(/\r\n|\n/)) {
    if (line.startsWith(' ****') || !line.trim()) continue
    const parts = decodeEntities(line).split(';').map((s) => s.trim())
    if (parts.length !== 3) continue
    const poids = parseInt(parts[2], 10)
    if (Number.isNaN(poids) || poids < POIDS_SEUIL) continue
    const [t1, t2] = [parts[0].toLowerCase(), parts[1].toLowerCase()]
    if (/[>[]/.test(t1) || /[>[]/.test(t2)) continue
    if (!parSource.has(t1)) parSource.set(t1, new Map())
    parSource.get(t1).set(t2, poids)
  }
  return parSource
}
function candidatsPour(mot, categorie, relations) {
  if (hasSuppressedRelations(mot)) return []
  const cibles = relations.get(mot)
  if (!cibles) return []
  return [...cibles]
    .sort((a, b) => b[1] - a[1])
    .filter(([cible]) => {
      if (cible === mot) return false
      if (isExcludedRelation(mot, cible)) return false
      if (hasSuppressedRelations(cible)) return false
      return (baseEntriesByWord.get(cible) ?? []).some((e) => e.category === categorie)
    })
    .slice(0, CANDIDATS_PAR_MOT)
    .map(([cible]) => cible)
}

const relSyn = chargerRelations('r_syn')
const relAnto = chargerRelations('r_anto')
const sensEnfant = JSON.parse(readFileSync(new URL('../scripts/sens-enfant.json', import.meta.url), 'utf8'))

const anomalies = []
let total = 0
for (const genre of ['syn', 'anto']) {
  const relations = genre === 'syn' ? relSyn : relAnto
  for (const [lemmaId, retenus] of Object.entries(sensEnfant[genre] ?? {})) {
    const entry = lemmaToEntry.get(lemmaId)
    if (!entry) { anomalies.push({ genre, lemmaId, mot: '?', probleme: 'lemmaId introuvable dans le lexique' }); continue }
    const mot = entry.word.toLowerCase()
    const candidats = candidatsPour(mot, entry.category, relations)
    for (const r of retenus) {
      total++
      if (!candidats.includes(r.toLowerCase())) {
        anomalies.push({ genre, lemmaId, mot: entry.word, retenu: r, candidats })
      }
    }
  }
}

console.log(`${total} mots retenus verifies (syn+anto).`)
console.log(`${anomalies.length} n'etaient PAS dans la liste de candidats fournie au modele.\n`)

// Combien de ces anomalies sont REELLEMENT visibles en ligne aujourd'hui : le
// mot hallucine doit encore exister dans le lexique, dans la bonne categorie
// (build-word-synonyms.mjs le filtre sinon), pour apparaitre a l'ecran.
const compiledSyn = JSON.parse(readFileSync(new URL('../src/data/word-synonyms.json', import.meta.url), 'utf8'))
const compiledAnto = JSON.parse(readFileSync(new URL('../src/data/word-antonyms.json', import.meta.url), 'utf8'))
let visiblesEnLigne = 0
const listeVisibles = []
for (const a of anomalies) {
  const compiled = a.genre === 'syn' ? compiledSyn : compiledAnto
  const mots = (compiled[a.lemmaId] ?? []).map((e) => e.word.toLowerCase())
  if (mots.includes(a.retenu.toLowerCase())) {
    visiblesEnLigne++
    listeVisibles.push(a)
  }
}
console.log(`Dont visibles en ligne aujourd'hui (le mot existe dans le lexique, categorie ok) : ${visiblesEnLigne}\n`)

if (process.argv.includes('--visibles-seulement')) {
  for (const a of listeVisibles) {
    console.log(`[${a.genre}] ${a.mot} -> "${a.retenu}"  (candidats reels: ${a.candidats.join(', ') || '(aucun)'})`)
  }
} else {
  for (const a of anomalies) {
    console.log(`[${a.genre}] ${a.mot} -> "${a.retenu}"  (candidats reels: ${a.candidats.join(', ') || '(aucun)'})`)
  }
}
