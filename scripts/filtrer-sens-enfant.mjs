// Corrige scripts/sens-enfant.json : retire les mots que la passe du
// 31/08/2026 a retenus SANS qu'ils figurent dans la liste de candidats
// reellement soumise au modele (violation de la consigne du lot, voir
// build-sens-enfant.mjs - "tu ne peux retenir que des candidats presents
// dans la liste fournie, orthographies a l'identique"). Trouve par Hugues le
// 02/09/2026 sur "dauphin" -> "princesse" (jamais propose), confirme
// systematique par scripts/verifier-sens-enfant.mjs : 862 mots sur 18 613
// (4,6 %), dont 215 reellement affiches en ligne aujourd'hui.
//
// AUCUN NOUVEL APPEL API : purement un retrait. Un lemme qui perd tous ses
// mots retenus finit avec une liste vide, ce qui est deja le sens etabli de
// ce fichier ("aucun candidat ne convient", voir build-sens-enfant.mjs) -
// build-word-synonyms.mjs retire alors la rubrique plutot que de la laisser
// vide a l'ecran.
//
// Usage : node scripts/filtrer-sens-enfant.mjs
// Puis : node scripts/build-word-synonyms.mjs (recompile les JSON compiles)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
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
const fichierSensEnfant = new URL('./sens-enfant.json', import.meta.url)
const sensEnfant = JSON.parse(readFileSync(fichierSensEnfant, 'utf8'))

let retires = 0
let lemmesVides = 0
const exemplesRetires = []

for (const genre of ['syn', 'anto']) {
  const relations = genre === 'syn' ? relSyn : relAnto
  for (const [lemmaId, retenus] of Object.entries(sensEnfant[genre] ?? {})) {
    const entry = lemmaToEntry.get(lemmaId)
    if (!entry) continue // lemme introuvable dans le lexique actuel : laisse tel quel, hors sujet de ce correctif
    const mot = entry.word.toLowerCase()
    const candidats = candidatsPour(mot, entry.category, relations)
    const candidatsSet = new Set(candidats)
    const gardes = retenus.filter((r) => candidatsSet.has(r.toLowerCase()))
    if (gardes.length !== retenus.length) {
      const perdus = retenus.filter((r) => !candidatsSet.has(r.toLowerCase()))
      retires += perdus.length
      if (exemplesRetires.length < 20) {
        exemplesRetires.push(`[${genre}] ${entry.word} : retire "${perdus.join('", "')}" - garde [${gardes.join(', ') || 'rien'}]`)
      }
      if (gardes.length === 0) lemmesVides++
      sensEnfant[genre][lemmaId] = gardes
    }
  }
}

writeFileSync(fichierSensEnfant, JSON.stringify(sensEnfant, null, 2))
console.log(`${retires} mot(s) retire(s) de scripts/sens-enfant.json (hors liste de candidats d'origine).`)
console.log(`${lemmesVides} lemme(s) se retrouvent avec une liste vide (aucun candidat valide restant).`)
console.log(`Ecrit : ${fichierSensEnfant.pathname}\n`)
console.log('Exemples :')
console.log(exemplesRetires.join('\n'))
console.log('\nProchaine etape : node scripts/build-word-synonyms.mjs')
