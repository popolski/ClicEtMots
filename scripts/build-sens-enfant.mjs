// Choisit, parmi les synonymes/contraires candidats de JeuxDeMots, ceux qui
// gardent un sens pour un élève de CE1-CE2, et écrit le résultat dans
// scripts/sens-enfant.json (relu ensuite par build-word-synonyms.mjs).
//
// POURQUOI CE SCRIPT EXISTE
// JeuxDeMots ne distingue pas les sens d'un mot. Pour "chien", il donne dans
// le désordre, avec des poids tous comparables : cabot 249, clebs 229,
// sex-appeal 216, radin 211, toutou 199, charme 181, gardien 176. Quatre sens
// mélangés (l'animal, "avoir du chien", "être chien", le gardien), tous
// réellement attestés en français adulte.
//
// Deux tris automatiques ont été essayés et ne règlent rien :
//   - par poids JeuxDeMots (le tri actuel) : "cerbère" (254) passe devant
//     "cabot" (249), donc le sens gardien devance l'animal.
//   - par fréquence Manulex du mot cible : fait remonter les mots
//     passe-partout ("manger" donne prendre/déjeuner/dîner au lieu de
//     dévorer/avaler/engloutir, "voiture" donne car/tire/caisse). Déjà tenté
//     et abandonné une première fois, voir le commentaire de
//     build-word-synonyms.mjs.
// Regrouper les candidats par synonymie mutuelle sépare bien les quatre sens
// de "chien", mais rien dans les données ne dit lequel est celui qu'un enfant
// a en tête : le groupe "charme" est le plus fourni, le groupe "avare" a le
// poids cumulé le plus fort, et le plus gros poids isolé est "cerbère".
//
// D'où ce tri hors ligne, fait une fois, par un modèle de langue. Le résultat
// est un fichier figé et relisible à la main, jamais un appel en direct :
// aucun contenu produit par une IA n'est montré à un élève sans relecture.
//
// PRÉREQUIS
//   - npm install (dépendance @anthropic-ai/sdk)
//   - une clé API dans la variable d'environnement ANTHROPIC_API_KEY
//     (console.anthropic.com, section API keys)
//   - si cette clé est « liée à une identité », l'identifiant de l'espace de
//     travail dans ANTHROPIC_WORKSPACE_ID, ou --workspace=... : sans lui l'API
//     répond « anthropic-workspace-id is required ». Ce n'est pas un secret,
//     il se lit dans l'adresse de la console.
//   - les dumps third_party/jeuxdemots/r_syn|r_anto (déjà nécessaires pour
//     build-word-synonyms.mjs)
//
// USAGE
//   node scripts/build-sens-enfant.mjs --dry-run    compte et estime le coût, sans appel API
//   node scripts/build-sens-enfant.mjs              envoie le lot et attend le résultat
//   node scripts/build-sens-enfant.mjs --reprendre  récupère un lot déjà envoyé (voir batch-id.txt)
//   node scripts/build-sens-enfant.mjs --top=1000   change l'étendue (défaut 2000)
//   node scripts/build-sens-enfant.mjs --effort=high  qualité/coût (low|medium|high, défaut medium)
//
// L'API de lots (Batch) est utilisée exprès : moitié prix, et ce travail
// n'est pas pressé. Un lot met en général moins d'une heure, 24 h au maximum.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { isExcludedRelation, hasSuppressedRelations } from './excluded-relations.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

const TOP = Number(args.top ?? 2000)
const EFFORT = String(args.effort ?? 'medium')
const MODELE = 'claude-opus-5'
// Nombre de candidats soumis au modèle par mot : plus large que les 3 gardés
// au final, pour qu'il ait de quoi choisir quand les premiers par poids
// appartiennent tous au mauvais sens (le cas "chien").
const CANDIDATS_PAR_MOT = 12
// Mots regroupés par requête : réduit le nombre d'appels sans noyer le modèle.
const MOTS_PAR_REQUETE = 15
const POIDS_SEUIL = 30

const OUT_DIR = new URL('./output/', import.meta.url)
// Volontairement hors de output/, qui est ignoré par git : ce fichier est
// relu à la main et doit être versionné, sinon la relecture serait perdue au
// prochain build sur une autre machine.
const FICHIER_SORTIE = new URL('./sens-enfant.json', import.meta.url)
const FICHIER_BATCH = new URL('sens-enfant-batch-id.txt', OUT_DIR)

// --- Lexique ---------------------------------------------------------------
const BASE_ROLE = { nom: 'singulier', adjectif: 'masculin', verbe: 'infinitif', adverbe: 'simple', invariable: 'simple' }
const wordIndex = JSON.parse(readFileSync(new URL('../src/data/words-clavier2.json', import.meta.url), 'utf8'))

const baseEntriesByWord = new Map()
for (const e of wordIndex) {
  if (e.formRole !== BASE_ROLE[e.category]) continue
  const key = e.word.toLowerCase()
  baseEntriesByWord.set(key, [...(baseEntriesByWord.get(key) ?? []), e])
}

// Les mots à traiter : les plus fréquents, ceux qu'une classe consulte
// vraiment. Les mots rares gardent le comportement actuel.
//
// Deux exclusions, mesurées le 31/08/2026 avant de lancer la passe. Sans elles,
// les 25 premiers mots par fréquence sont « de, le, la, les, et, un, il, à... » :
// des mots-outils dont aucun élève ne cherche le synonyme, et qui consommaient
// pourtant des requêtes puisque JeuxDeMots leur en donne.
//   - les invariables : déterminants, prépositions, conjonctions, pronoms ;
//   - les entrées d'une seule lettre, artefacts du lexique (« l » classé nom,
//     « d » classé nom, « est » classé nom).
// Effet mesuré à budget constant : 172 entrées inutiles sortent, 172 vrais mots
// entrent à leur place - prudent, retenir, baguette, profond, billet, rivage,
// seau, engin, fortune, importance, pareil, roux.
const motCherchable = (e) =>
  e.category !== 'invariable' && e.word.replace(/['’]/g, '').length > 1

const motsCibles = wordIndex
  .filter((e) => e.formRole === BASE_ROLE[e.category] && motCherchable(e))
  .sort((a, b) => b.frequency - a.frequency)
  .slice(0, TOP)

// --- Dumps JeuxDeMots ------------------------------------------------------
// Même décodage d'entités que build-word-synonyms.mjs : les entités HTML
// contiennent un point-virgule, qui casserait le split(';') sinon.
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
  if (!file) throw new Error(`Aucun fichier .txt dans third_party/jeuxdemots/${dirName}/`)
  return new URL(file, dir)
}

function chargerRelations(dirName) {
  const parSource = new Map() // mot -> Map<mot cible, poids>
  for (const line of readFileSync(findDumpFile(dirName), 'utf8').split(/\r\n|\n/)) {
    if (line.startsWith(' ****') || !line.trim()) continue
    const parts = decodeEntities(line).split(';').map((s) => s.trim())
    if (parts.length !== 3) continue // ~0,3% de lignes avec un ";" littéral, ignorées
    const poids = parseInt(parts[2], 10)
    if (Number.isNaN(poids) || poids < POIDS_SEUIL) continue
    const [t1, t2] = [parts[0].toLowerCase(), parts[1].toLowerCase()]
    // Les raffinements de sens ("chien>mammifère") et les formes à crochets
    // ("chien [peut] aboyer") ne sont pas des mots du lexique.
    if (/[>[]/.test(t1) || /[>[]/.test(t2)) continue
    if (!parSource.has(t1)) parSource.set(t1, new Map())
    parSource.get(t1).set(t2, poids)
  }
  return parSource
}

/** Candidats retenus pour un mot : même catégorie, présents dans notre lexique. */
function candidatsPour(entree, relations) {
  const source = entree.word.toLowerCase()
  if (hasSuppressedRelations(source)) return []
  const cibles = relations.get(source)
  if (!cibles) return []
  return [...cibles]
    .sort((a, b) => b[1] - a[1])
    .filter(([cible]) => {
      if (cible === source) return false
      if (isExcludedRelation(source, cible)) return false
      if (hasSuppressedRelations(cible)) return false
      return (baseEntriesByWord.get(cible) ?? []).some((e) => e.category === entree.category)
    })
    .slice(0, CANDIDATS_PAR_MOT)
    .map(([cible]) => cible)
}

// --- Construction des requêtes ---------------------------------------------
const CONSIGNE = `Tu aides à construire un dictionnaire de synonymes et de contraires pour des élèves de CE1 et CE2 (7 à 8 ans), en France.

Pour chaque mot, on te donne une liste de candidats issus d'un réseau lexical collaboratif. Ce réseau ne distingue pas les sens d'un mot : la liste mélange donc souvent plusieurs sens sans prévenir. Exemple réel, pour "chien" les candidats contiennent à la fois "toutou" (l'animal), "charme" (avoir du chien), "radin" (être chien) et "gardien". Seul "toutou" convient.

Ta tâche : ne garder que les candidats qui conviennent vraiment.

Règles :
- Garde uniquement les candidats qui sont un synonyme (ou un contraire, selon ce qui est demandé) du mot AU SENS COURANT ET CONCRET qu'un enfant de 7 ans connaît.
- Écarte tout candidat qui relève d'un autre sens du mot que ce sens-là, même si la relation est juste en français adulte.
- Écarte le familier, l'argot, le vulgaire, le littéraire, le vieilli, le technique, le régional et le figuré.
- Écarte les candidats qu'un enfant de 7 ans ne comprendrait pas.
- N'invente jamais un mot : tu ne peux retenir que des candidats présents dans la liste fournie, orthographiés à l'identique.
- Garde 3 candidats au maximum, du plus utile au moins utile.
- Renvoyer une liste vide est une réponse normale et fréquente. Mieux vaut zéro proposition qu'une proposition fausse. Ne cherche jamais à atteindre 3.`

const SCHEMA = {
  type: 'object',
  properties: {
    resultats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mot: { type: 'string' },
          // Pas de maxItems : l'API le refuse sur un tableau, et les 193 requetes
          // du 31/08/2026 ont ete rejetees pour cette seule raison. La limite de
          // 3 tient par la consigne, et par le slice(0, 3) a la lecture.
          retenus: { type: 'array', items: { type: 'string' } },
        },
        required: ['mot', 'retenus'],
        additionalProperties: false,
      },
    },
  },
  required: ['resultats'],
  additionalProperties: false,
}

function construireRequetes(relations, genre) {
  const avecCandidats = []
  for (const entree of motsCibles) {
    const candidats = candidatsPour(entree, relations)
    if (candidats.length === 0) continue
    avecCandidats.push({ entree, candidats })
  }

  const requetes = []
  for (let i = 0; i < avecCandidats.length; i += MOTS_PAR_REQUETE) {
    const paquet = avecCandidats.slice(i, i + MOTS_PAR_REQUETE)
    const lignes = paquet
      .map((p) => `- ${p.entree.word} (${p.entree.category}) : ${p.candidats.join(', ')}`)
      .join('\n')
    requetes.push({
      custom_id: `${genre}-${i}`,
      lemmaIds: paquet.map((p) => p.entree.lemmaId),
      mots: paquet.map((p) => p.entree.word),
      params: {
        model: MODELE,
        max_tokens: 8000,
        system: [{ type: 'text', text: CONSIGNE, cache_control: { type: 'ephemeral' } }],
        thinking: { type: 'adaptive' },
        output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA } },
        messages: [
          {
            role: 'user',
            content: `Type de relation demandée : ${genre === 'syn' ? 'SYNONYMES' : 'CONTRAIRES'}.\n\nMots à traiter :\n${lignes}\n\nRéponds pour chacun des ${paquet.length} mots, dans le même ordre.`,
          },
        ],
      },
    })
  }
  return { requetes, nbMots: avecCandidats.length }
}

// --- Main ------------------------------------------------------------------
async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log(`Chargement des dumps JeuxDeMots (seuil de poids ${POIDS_SEUIL})...`)
  const syn = chargerRelations('r_syn')
  const anto = chargerRelations('r_anto')

  const lotSyn = construireRequetes(syn, 'syn')
  const lotAnto = construireRequetes(anto, 'anto')
  const toutes = [...lotSyn.requetes, ...lotAnto.requetes]

  console.log(`\nÉtendue : les ${TOP} mots les plus fréquents du lexique.`)
  console.log(`  synonymes  : ${lotSyn.nbMots} mots avec au moins un candidat, ${lotSyn.requetes.length} requêtes`)
  console.log(`  contraires : ${lotAnto.nbMots} mots avec au moins un candidat, ${lotAnto.requetes.length} requêtes`)
  console.log(`  total      : ${toutes.length} requêtes, modèle ${MODELE}, effort ${EFFORT}`)

  // Estimation grossière (~4 caractères par jeton), uniquement indicative.
  const carsEntree = toutes.reduce(
    (n, r) => n + CONSIGNE.length + r.params.messages[0].content.length,
    0,
  )
  const jetonsEntree = Math.round(carsEntree / 4)
  const jetonsSortie = toutes.length * 700 // réflexion + réponse, ordre de grandeur
  // Tarifs Opus 5 : 5 $/M en entrée, 25 $/M en sortie, moitié prix en lot.
  const cout = ((jetonsEntree / 1e6) * 5 + (jetonsSortie / 1e6) * 25) * 0.5
  console.log(`\nEstimation très approximative : ~${jetonsEntree.toLocaleString('fr-FR')} jetons d'entrée,`)
  console.log(`~${jetonsSortie.toLocaleString('fr-FR')} de sortie, soit de l'ordre de ${cout.toFixed(2)} $ (tarif lot, moitié prix).`)

  if (args['dry-run']) {
    console.log('\n--dry-run : rien n\'a été envoyé.')
    console.log('\nExemples de ce qui serait soumis :')
    for (const r of [lotSyn.requetes[0], lotAnto.requetes[0]].filter(Boolean)) {
      console.log('\n' + r.params.messages[0].content.split('\n').slice(0, 8).join('\n'))
    }
    return
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // Une cle « liee a une identite » - celle que la console propose par defaut
  // depuis 2026 - n'appartient a aucun espace de travail : l'API refuse alors
  // la requete avec « anthropic-workspace-id is required ». On transmet donc
  // l'identifiant de l'espace quand il est fourni. Une cle classique, rattachee
  // a un espace, n'en a pas besoin : la variable reste vide et rien ne change.
  const espace = process.env.ANTHROPIC_WORKSPACE_ID || args.workspace
  const client = new Anthropic(
    espace ? { defaultHeaders: { 'anthropic-workspace-id': String(espace) } } : {},
  )

  let batchId
  if (args.reprendre) {
    if (!existsSync(FICHIER_BATCH)) throw new Error(`Aucun lot en cours : ${FICHIER_BATCH.pathname} est absent.`)
    const garde = readFileSync(FICHIER_BATCH, 'utf8').trim().split(' ')
    batchId = garde[0]
    // L'étendue est gardée à côté de l'identifiant, et vérifiée à la reprise.
    //
    // Les réponses sont recollées sur les requêtes par leur custom_id, qui
    // contient le rang du mot dans la liste. Reprendre avec un --top
    // différent de celui de l'envoi reconstruit une AUTRE liste : les
    // custom_id ne correspondent plus et les réponses sont jetées en
    // silence. Le 31/08/2026, une reprise sans --top a fait tomber 13 746
    // mots triés à 1 861, sans le moindre message. Les réponses étaient
    // pourtant intactes côté serveur.
    const topEnvoi = garde[1] ? Number(garde[1]) : null
    if (topEnvoi !== null && topEnvoi !== TOP) {
      throw new Error(
        `Ce lot a été envoyé avec --top=${topEnvoi}, la reprise demande ` +
        `--top=${TOP}. Relancer avec --reprendre --top=${topEnvoi}.`,
      )
    }
    console.log(`\nReprise du lot ${batchId}.`)
  } else {
    const lot = await client.messages.batches.create({
      requests: toutes.map(({ custom_id, params }) => ({ custom_id, params })),
    })
    batchId = lot.id
    writeFileSync(FICHIER_BATCH, `${batchId} ${TOP}`)
    console.log(`\nLot envoyé : ${batchId} (identifiant gardé dans ${FICHIER_BATCH.pathname}).`)
    console.log('En cas de coupure, relancer avec --reprendre.')
  }

  // Attente : la plupart des lots aboutissent en moins d'une heure.
  let etat
  while (true) {
    etat = await client.messages.batches.retrieve(batchId)
    if (etat.processing_status === 'ended') break
    const c = etat.request_counts
    console.log(`  ${etat.processing_status} — ${c.succeeded} ok, ${c.processing} en cours, ${c.errored} en erreur`)
    await new Promise((r) => setTimeout(r, 60_000))
  }
  console.log(`\nLot terminé : ${etat.request_counts.succeeded} réussies, ${etat.request_counts.errored} en erreur.`)

  // Recolle les réponses sur les lemmaId (l'ordre de retour n'est pas garanti,
  // on retrouve la requête par son custom_id).
  const parCustomId = new Map(toutes.map((r) => [r.custom_id, r]))
  const sortie = { syn: {}, anto: {} }
  let ok = 0
  let rates = 0

  let premiereErreur = null
  for await (const resultat of await client.messages.batches.results(batchId)) {
    const requete = parCustomId.get(resultat.custom_id)
    if (!requete) continue
    if (resultat.result.type !== 'succeeded') {
      rates++
      const e = resultat.result.error?.error?.error ?? resultat.result.error?.error
      const raison = e?.message ? ` — ${e.message}` : ''
      // Le detail n'est affiche qu'une fois : quand tout un lot echoue pour la
      // meme cause, 193 lignes identiques n'aident personne.
      if (raison && !premiereErreur) {
        premiereErreur = raison
        console.error(`[${resultat.custom_id}] ${resultat.result.type}${raison}`)
      } else {
        console.error(`[${resultat.custom_id}] ${resultat.result.type}`)
      }
      continue
    }
    const bloc = resultat.result.message.content.find((b) => b.type === 'text')
    if (!bloc) { rates++; continue }
    let donnees
    try {
      donnees = JSON.parse(bloc.text)
    } catch {
      rates++
      console.error(`[${resultat.custom_id}] réponse illisible`)
      continue
    }
    const genre = resultat.custom_id.startsWith('syn-') ? 'syn' : 'anto'
    for (const item of donnees.resultats ?? []) {
      const i = requete.mots.indexOf(item.mot)
      if (i === -1) continue // le modèle a renvoyé un mot qu'on n'avait pas demandé
      sortie[genre][requete.lemmaIds[i]] = (item.retenus ?? []).slice(0, 3)
      ok++
    }
  }

  // Aucune reussite : on n'ecrit rien. Le 31/08/2026, un lot entierement
  // en erreur a tout de meme produit un fichier vide, que
  // build-word-synonyms.mjs aurait applique tel quel.
  if (ok === 0) {
    console.error('Aucun mot trié : le fichier de sortie n’est pas écrit.')
    process.exit(1)
  }
  writeFileSync(FICHIER_SORTIE, JSON.stringify(sortie, null, 2))
  console.log(`\n${ok} mots triés, ${rates} requêtes perdues.`)
  console.log(`Écrit : ${FICHIER_SORTIE.pathname}`)
  console.log('\nÀ relire avant de lancer build-word-synonyms.mjs.')
}

main().catch((err) => {
  console.error(`\nÉchec : ${err.message}`)
  if (String(err.message).includes('apiKey') || String(err.message).includes('ANTHROPIC_API_KEY')) {
    console.error('Il manque la clé API. Sous PowerShell :  $env:ANTHROPIC_API_KEY = "sk-ant-..."')
  }
  process.exit(1)
})
