import { useEffect, useMemo, useState } from 'react'
import { ToolLayout } from '../../components/ToolLayout'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { SequenceBar } from '../../components/SequenceBar'
import { PhonemeInfoModal } from '../../components/PhonemeInfoModal'
import { assetUrl } from '../../lib/assetUrl'
import { speak, speechSupported } from '../../lib/speech'
import type { EntreeHistorique } from '../../lib/historique'
import { genererDistracteurs } from '../../lib/quizErreurs'
import {
  ajouterResultatQuiz,
  lireResultatsQuiz,
  viderResultatsQuiz,
  type ModeQuiz,
  type ResultatQuiz,
} from '../../lib/quizHistorique'
import { badgePour, BADGE_EMOJI, BADGE_LABEL, type Badge } from '../../lib/quizBadges'
import { loadWordIndex } from '../../lib/wordIndex'
import { api } from '../../lib/api'
import type { MotDeListe } from '../../lib/api'
import { LEMMA_IDS_DETERMINANTS, LEMMA_IDS_HOMOGRAPHES_FANTOMES } from '../clavier/clavierLogic'
import { phonemes } from '../../lib/phonemes'
import wordPictos from '../../data/word-pictos.json'
import type { PhonemeId, WordCategory, WordEntry } from '../../types/phonetics'

// Mêmes libellés/mascottes que la fiche mot (MotTool.tsx) - petite
// duplication assumée, comme ailleurs dans le projet (Historique.tsx).
const CATEGORY_LABEL: Record<WordCategory, string> = {
  nom: 'Nom',
  adjectif: 'Adjectif',
  verbe: 'Verbe',
  invariable: 'Mot invariable',
  adverbe: 'Adverbe',
}
const CATEGORY_MASCOT: Record<WordCategory, string> = {
  nom: '/mascottes/nom.png',
  adjectif: '/mascottes/adjectif.png',
  verbe: '/mascottes/verbe.png',
  invariable: '/mascottes/invariable.png',
  adverbe: '/mascottes/adverbe.png',
}

const NB_MOTS_SESSION = 10

const MODE_LABEL: Record<ModeQuiz, string> = {
  qcm: 'Choix multiple',
  reconstitution: 'Recomposer le mot',
  grammaire: 'Catégorie grammaticale',
}

// Rôle "de base" par catégorie (même logique que ROLE_DE_BASE dans
// wordIndex.ts) : pour piocher dans les mots les plus fréquents du lexique,
// on ne veut que la forme de base de chaque mot (pas "chevaux" séparément de
// "cheval").
const ROLE_DE_BASE: Record<WordCategory, WordEntry['formRole']> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

// Piochés parmi les mots les plus fréquents du lexique - pas l'historique de
// consultation de l'élève (trop court/répétitif pour donner une vraie
// variété d'une partie à l'autre). Les mots les plus fréquents "bruts" sont
// presque tous des mots-outils (le, de, un, il, pas...) plutôt que du
// vocabulaire à réviser - on se limite aux noms/verbes/adjectifs (les
// adverbes/invariables les plus fréquents sont quasi exclusivement des
// mots-outils), aux mots d'au moins 3 lettres, et on retire les mêmes listes
// noires que le clavier (déterminants, homographes mal étiquetés par le
// corpus). Vivier large (1000 mots) pour qu'un tirage aléatoire donne une
// vraie variété d'une partie à l'autre.
const TAILLE_VIVIER = 1000

function motsFrequentsPourQuiz(wordIndex: WordEntry[]): EntreeHistorique[] {
  return wordIndex
    .filter(
      (e) =>
        e.formRole === ROLE_DE_BASE[e.category] &&
        (e.category === 'nom' || e.category === 'verbe' || e.category === 'adjectif') &&
        e.word.length >= 3 &&
        !LEMMA_IDS_DETERMINANTS.has(e.lemmaId) &&
        !LEMMA_IDS_HOMOGRAPHES_FANTOMES.has(e.lemmaId),
    )
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, TAILLE_VIVIER)
    .map((e) => ({ lemmaId: e.lemmaId, word: e.word, category: e.category, consulteLe: 0 }))
}

// Adverbes réels d'usage courant (pas des mots-outils comme "pas"/"y"/
// "comme", qui dominent le classement par fréquence brute) - liste choisie
// à la main, seule façon fiable de proposer de vrais adverbes au quiz de
// grammaire sans reprendre tout le bruit du corpus (même logique que
// EXCLUDED_WORDS/HOMOGRAPHES_FANTOMES ailleurs dans le projet, en positif
// cette fois : une liste blanche plutôt qu'une liste noire).
const ADVERBES_SURS = new Set([
  'bien', 'mal', 'vite', 'souvent', 'toujours', 'jamais', 'encore', 'beaucoup', 'trop', 'peu',
  'aussi', 'ainsi', 'dehors', 'dedans', 'ici', 'là', 'loin', 'près', "aujourd'hui", 'demain',
  'hier', 'ensuite', 'enfin', 'vraiment', 'gentiment', 'doucement', 'lentement', 'rapidement',
  'joyeusement', 'tristement', 'fortement', 'calmement', 'simplement', 'parfaitement',
  'heureusement', 'malheureusement', 'exactement', 'certainement', 'probablement', 'autrefois',
  'longtemps', 'partout', 'ailleurs', 'dessus', 'dessous', 'maintenant', 'bientôt', 'tard', 'tôt',
])

// Vivier du quiz de grammaire : comme motsFrequentsPourQuiz, mais inclut
// aussi les adverbes de la liste blanche ci-dessus - sans ça, seuls noms/
// verbes/adjectifs sont proposables, et le tri par fréquence brute favorise
// nettement les noms (signalé comme déséquilibré). Le tirage lui-même est
// équilibré ensuite par equilibrerParCategorie, catégorie par catégorie.
function motsFrequentsPourGrammaire(wordIndex: WordEntry[]): EntreeHistorique[] {
  const base = motsFrequentsPourQuiz(wordIndex)
  const adverbes = wordIndex
    .filter((e) => e.category === 'adverbe' && e.formRole === 'simple' && ADVERBES_SURS.has(e.word))
    .map((e) => ({ lemmaId: e.lemmaId, word: e.word, category: e.category, consulteLe: 0 }))
  return [...base, ...adverbes]
}

// Répartit le tirage à peu près également entre les catégories présentes
// dans `source` (un tour par catégorie, dans un ordre mélangé), plutôt que
// de piocher au hasard dans un tas dominé par les noms.
function equilibrerParCategorie(source: EntreeHistorique[], count: number): EntreeHistorique[] {
  const parCategorie = new Map<WordCategory, EntreeHistorique[]>()
  for (const entree of melanger(source)) {
    const liste = parCategorie.get(entree.category) ?? []
    liste.push(entree)
    parCategorie.set(entree.category, liste)
  }
  const categories = melanger([...parCategorie.keys()])
  const resultat: EntreeHistorique[] = []
  let progression = true
  while (resultat.length < count && progression) {
    progression = false
    for (const categorie of categories) {
      if (resultat.length >= count) break
      const liste = parCategorie.get(categorie)
      const suivant = liste?.shift()
      if (suivant) {
        resultat.push(suivant)
        progression = true
      }
    }
  }
  return resultat
}

// Pour le quiz "catégorie grammaticale" uniquement : un mot qui existe
// réellement dans plusieurs catégories ("grand" nom ET adjectif, "pouvoir"
// verbe ET nom...) n'a pas de bonne réponse unique tant qu'il est montré
// seul, sans phrase - contrairement aux erreurs de corpus déjà nettoyées
// (LEMMA_IDS_HOMOGRAPHES_FANTOMES), ici les deux catégories sont vraies. On
// écarte ces mots plutôt que de pénaliser un élève qui répond juste mais
// "pas la bonne case attendue". Vérifié sur le lexique complet (pas
// seulement le vivier de 1000), une même orthographe pouvant partager sa
// fréquence avec une catégorie hors du top 1000.
function motsAmbigusPourGrammaire(wordIndex: WordEntry[]): Set<string> {
  const categoriesParMot = new Map<string, Set<WordCategory>>()
  for (const e of wordIndex) {
    if (e.formRole !== ROLE_DE_BASE[e.category]) continue
    const cle = e.word.toLowerCase()
    const categories = categoriesParMot.get(cle) ?? new Set()
    categories.add(e.category)
    categoriesParMot.set(cle, categories)
  }
  const ambigus = new Set<string>()
  for (const [mot, categories] of categoriesParMot) {
    if (categories.size > 1) ambigus.add(mot)
  }
  return ambigus
}

function melanger<T>(items: T[]): T[] {
  const copie = [...items]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

interface Question {
  entree: EntreeHistorique
  /** Uniquement en mode QCM : mot correct + distracteurs, mélangés. */
  options?: string[]
}

function QuestionCarte({ entree }: { entree: EntreeHistorique }) {
  const picto = (wordPictos as Record<string, string>)[entree.word]
  return (
    <div className="mb-6 flex flex-col items-center">
      <div className="mb-2 flex items-end gap-2">
        <div className="flex flex-col items-center gap-1">
          <img src={assetUrl(CATEGORY_MASCOT[entree.category])} alt="" className="h-16 w-16 object-contain" />
          <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {CATEGORY_LABEL[entree.category]}
          </span>
        </div>
        {picto && <img src={assetUrl(picto)} alt="" className="h-16 w-16 object-contain" />}
      </div>
      {speechSupported() && (
        <button
          type="button"
          onClick={() => speak(entree.word, { category: entree.category, lemmaId: entree.lemmaId })}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-white shadow-sm hover:bg-brand-700 active:scale-95"
        >
          🔊 Écouter le mot
        </button>
      )}
    </div>
  )
}

function QuestionQCM({
  question,
  onReponse,
}: {
  question: Question
  onReponse: (correct: boolean) => void
}) {
  const [choisi, setChoisi] = useState<string | null>(null)

  useEffect(() => setChoisi(null), [question])

  return (
    <>
      <QuestionCarte entree={question.entree} />
      <p className="mb-3 text-center text-gray-500">Quelle est la bonne orthographe ?</p>
      <div className="mx-auto grid max-w-sm gap-3">
        {question.options?.map((option) => {
          const estCorrect = option === question.entree.word
          const style =
            choisi === null
              ? 'border-gray-200 hover:bg-gray-50'
              : estCorrect
                ? 'border-green-400 bg-green-50'
                : choisi === option
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 opacity-60'
          return (
            <button
              key={option}
              type="button"
              disabled={choisi !== null}
              onClick={() => {
                setChoisi(option)
                onReponse(estCorrect)
              }}
              className={`rounded-lg border-2 px-4 py-3 text-xl font-medium ${style}`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </>
  )
}

// Les 5 catégories sont toujours proposées comme réponses possibles.
// motsFrequentsPourGrammaire pioche des noms/verbes/adjectifs/adverbes (voir
// plus haut - liste blanche pour les adverbes, "invariable" reste écarté :
// dans ce lexique, les invariables les plus fréquents sont quasiment tous
// des mots-outils, sans équivalent utilisable pour un exercice de
// reconnaissance). "Mot invariable" reste un vrai choix parmi les "5
// personnages" même s'il ne sera jamais la bonne réponse pour l'instant.
const CATEGORIES: WordCategory[] = ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable']

// Contrairement à QuestionCarte, n'affiche NI la mascotte/l'étiquette de
// catégorie NI le picto du mot : c'est justement la catégorie qu'on demande
// de deviner ici, la révéler à l'avance viderait l'exercice de son sens.
function QuestionGrammaire({
  question,
  onReponse,
}: {
  question: Question
  onReponse: (correct: boolean) => void
}) {
  const [choisi, setChoisi] = useState<WordCategory | null>(null)

  useEffect(() => setChoisi(null), [question])

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-3">
        <p className="text-3xl font-semibold text-gray-900">{question.entree.word}</p>
        {speechSupported() && (
          <button
            type="button"
            onClick={() => speak(question.entree.word, { category: question.entree.category, lemmaId: question.entree.lemmaId })}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-white shadow-sm hover:bg-brand-700 active:scale-95"
          >
            🔊 Écouter le mot
          </button>
        )}
      </div>
      <p className="mb-3 text-center text-gray-500">Quelle est sa catégorie grammaticale ?</p>
      <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
        {CATEGORIES.map((categorie) => {
          const estCorrect = categorie === question.entree.category
          const style =
            choisi === null
              ? 'border-gray-200 hover:bg-gray-50'
              : estCorrect
                ? 'border-green-400 bg-green-50'
                : choisi === categorie
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 opacity-60'
          return (
            <button
              key={categorie}
              type="button"
              disabled={choisi !== null}
              onClick={() => {
                setChoisi(categorie)
                onReponse(estCorrect)
              }}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 ${style}`}
            >
              <img src={assetUrl(CATEGORY_MASCOT[categorie])} alt="" className="h-14 w-14 object-contain" />
              <span className="text-xs font-medium text-gray-600">{CATEGORY_LABEL[categorie]}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// On cherche le SON, pas l'orthographe : révéler le mot dès la 1re erreur
// court-circuiterait l'exercice. On laisse 3 essais avant de révéler et de
// passer au mot suivant - signalé comme plus formateur.
const ESSAIS_MAX = 3

function QuestionReconstitution({
  question,
  entreeCible,
  onReponse,
}: {
  question: Question
  entreeCible: WordEntry | undefined
  onReponse: (correct: boolean) => void
}) {
  const [sequence, setSequence] = useState<PhonemeId[]>([])
  // undefined = pas encore validé pour de bon (peut encore réessayer).
  const [succesFinal, setSuccesFinal] = useState<boolean | undefined>(undefined)
  const [essais, setEssais] = useState(0)
  const [dernierEssaiFaux, setDernierEssaiFaux] = useState(false)
  const [infoPhonemeId, setInfoPhonemeId] = useState<PhonemeId | null>(null)
  const phonemesById = useMemo(() => new Map(phonemes.map((p) => [p.id, p])), [])

  useEffect(() => {
    setSequence([])
    setSuccesFinal(undefined)
    setEssais(0)
    setDernierEssaiFaux(false)
  }, [question])

  const infoPhoneme = infoPhonemeId ? phonemesById.get(infoPhonemeId) : undefined
  const valide = succesFinal !== undefined

  function valider() {
    if (!entreeCible) return
    const correct = JSON.stringify(sequence) === JSON.stringify(entreeCible.phonemes)
    if (correct) {
      setSuccesFinal(true)
      onReponse(true)
      return
    }
    const essaisSuivant = essais + 1
    setEssais(essaisSuivant)
    if (essaisSuivant >= ESSAIS_MAX) {
      setSuccesFinal(false)
      onReponse(false)
    } else {
      setDernierEssaiFaux(true)
      setSequence([])
    }
  }

  return (
    <>
      <QuestionCarte entree={question.entree} />
      <p className="mb-3 text-center text-gray-500">Recompose le mot avec les sons du clavier.</p>
      <SequenceBar
        sequence={sequence}
        phonemesById={phonemesById}
        onBackspace={() => {
          setDernierEssaiFaux(false)
          setSequence((s) => s.slice(0, -1))
        }}
        onClear={() => {
          setDernierEssaiFaux(false)
          setSequence([])
        }}
      />
      {!valide ? (
        <>
          {dernierEssaiFaux && (
            <p className="mt-3 text-center font-medium text-red-600">
              Pas tout à fait, réessaie ! (essai {essais}/{ESSAIS_MAX})
            </p>
          )}
          <div className="mt-4 text-center">
            <button
              type="button"
              disabled={sequence.length === 0 || !entreeCible}
              onClick={valider}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95 disabled:opacity-40"
            >
              Valider
            </button>
          </div>
        </>
      ) : (
        <div className="mt-4 text-center">
          <p className={`text-lg font-semibold ${succesFinal ? 'text-green-600' : 'text-red-600'}`}>
            {succesFinal
              ? `Bravo, c'est ça : ${question.entree.word} !`
              : `Pas tout à fait. La bonne orthographe : ${question.entree.word}`}
          </p>
          {!succesFinal && (
            <p className="mt-1 text-sm text-gray-500">Les touches en jaune sont les sons de ce mot.</p>
          )}
        </div>
      )}
      <div className="mt-6">
        <PhonemeKeyboard
          phonemes={phonemes}
          viableNext={null}
          misEnAvant={valide && !succesFinal && entreeCible ? new Set(entreeCible.phonemes) : undefined}
          onSelect={(id) => {
            if (valide) return
            setDernierEssaiFaux(false)
            setSequence((s) => [...s, id])
          }}
          onShowInfo={setInfoPhonemeId}
        />
      </div>
      {infoPhoneme && <PhonemeInfoModal phoneme={infoPhoneme} onClose={() => setInfoPhonemeId(null)} />}
    </>
  )
}

export function QuizTool() {
  const [wordIndex, setWordIndex] = useState<WordEntry[] | null>(null)
  // null = pas encore choisi, écran de départ. Fixé pour toute la partie -
  // changer de mode en cours de route mélangerait une question déjà
  // comptabilisée avec une nouvelle tentative dans l'autre mode.
  const [mode, setMode] = useState<ModeQuiz | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [aRepondu, setARepondu] = useState(false)
  const [termine, setTermine] = useState(false)
  const [resultats, setResultats] = useState<ResultatQuiz[]>([])
  // null = pas encore chargés (ou aucune liste enregistrée par l'enseignante).
  // Cumule TOUTES les listes hebdomadaires enregistrées (pas seulement la
  // plus récente) - la liste à réviser grossit semaine après semaine, comme
  // le vocabulaire réellement vu en classe depuis la rentrée.
  const [motsSemaineCumules, setMotsSemaineCumules] = useState<MotDeListe[] | null>(null)
  const [utiliserListeSemaine, setUtiliserListeSemaine] = useState(true)

  useEffect(() => {
    loadWordIndex().then(setWordIndex)
  }, [])

  useEffect(() => {
    api
      .listListesMotsSemaine()
      .then((r) => {
        const vus = new Map<string, MotDeListe>()
        for (const liste of Array.isArray(r.listes) ? r.listes : []) {
          for (const mot of Array.isArray(liste.mots) ? liste.mots : []) vus.set(mot.lemmaId, mot)
        }
        if (vus.size > 0) setMotsSemaineCumules([...vus.values()])
      })
      .catch(() => {
        // Pas de liste dispo (hors ligne, pas encore créée...) : on retombe
        // silencieusement sur le vivier de mots fréquents, comme avant.
      })
  }, [])

  useEffect(() => {
    if (questions || !wordIndex || !mode) return

    if (mode === 'grammaire') {
      const ambigus = motsAmbigusPourGrammaire(wordIndex)
      const sansAmbigus = (source: EntreeHistorique[]) => source.filter((e) => !ambigus.has(e.word.toLowerCase()))

      const depuisListe =
        utiliserListeSemaine && motsSemaineCumules
          ? equilibrerParCategorie(sansAmbigus(motsSemaineCumules.map((m) => ({ ...m, consulteLe: 0 }))), NB_MOTS_SESSION)
          : []
      // Liste trop courte/peu variée pour fournir des questions équilibrées : on retombe sur le vivier général.
      const choisis =
        depuisListe.length > 0
          ? depuisListe
          : equilibrerParCategorie(sansAmbigus(motsFrequentsPourGrammaire(wordIndex)), NB_MOTS_SESSION)
      setQuestions(choisis.map((entree) => ({ entree })))
      return
    }

    function construire(source: EntreeHistorique[]): Question[] {
      const choisis: Question[] = []
      for (const entree of melanger(source)) {
        if (choisis.length >= NB_MOTS_SESSION) break
        if (mode !== 'qcm') {
          choisis.push({ entree })
          continue
        }
        // Toujours 3 options (le mot + 2 vraies confusions), jamais moins et
        // jamais une orthographe inventée pour compléter - un mot qui n'a pas
        // 2 confusions de son plausibles est simplement écarté du tirage, on
        // en pioche un autre dans le vivier.
        const distracteurs = genererDistracteurs(entree.word, 2)
        if (distracteurs.length < 2) continue
        choisis.push({ entree, options: melanger([entree.word, ...distracteurs]) })
      }
      return choisis
    }

    if (utiliserListeSemaine && motsSemaineCumules) {
      const depuisListe = construire(motsSemaineCumules.map((m) => ({ ...m, consulteLe: 0 })))
      // Liste trop courte ou trop d'homographes/confusions manquantes pour
      // fournir des questions valables : on retombe sur le vivier général
      // plutôt que de bloquer le quiz.
      if (depuisListe.length > 0) {
        setQuestions(depuisListe)
        return
      }
    }
    setQuestions(construire(motsFrequentsPourQuiz(wordIndex)))
  }, [wordIndex, mode, questions, utiliserListeSemaine, motsSemaineCumules])

  function handleReponse(correct: boolean) {
    if (aRepondu) return
    setARepondu(true)
    if (correct) setScore((s) => s + 1)
  }

  function motSuivant() {
    if (!questions || !mode) return
    if (index + 1 >= questions.length) {
      ajouterResultatQuiz({ mode, score, total: questions.length })
      setResultats(lireResultatsQuiz())
      setTermine(true)
      return
    }
    setIndex((i) => i + 1)
    setARepondu(false)
  }

  if (!mode) {
    return (
      <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
        {motsSemaineCumules && (
          <label className="mx-auto mb-4 flex max-w-sm items-center justify-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={utiliserListeSemaine}
              onChange={(e) => setUtiliserListeSemaine(e.target.checked)}
            />
            📋 Réviser les mots vus en classe ({motsSemaineCumules.length} mots)
          </label>
        )}
        <p className="mb-4 text-center text-gray-500">Choisis comment tu veux jouer :</p>
        <div className="mx-auto flex max-w-sm flex-col gap-3">
          {(Object.keys(MODE_LABEL) as ModeQuiz[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="rounded-lg border-2 border-gray-200 px-4 py-3 text-lg font-medium hover:bg-gray-50"
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </ToolLayout>
    )
  }

  if (!questions) {
    return (
      <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Préparation du quiz…</p>
      </ToolLayout>
    )
  }

  const question = questions[index]
  const entreeCible = wordIndex?.find(
    (e) => e.lemmaId === question.entree.lemmaId && e.word === question.entree.word,
  )

  if (termine) {
    const badge = badgePour(score, questions.length)
    // Décompte des médailles déjà gagnées (collection, pas un classement -
    // ne compare jamais à d'autres élèves, voir quizBadges.ts).
    const collection = resultats.reduce(
      (acc, r) => {
        const b = badgePour(r.score, r.total)
        if (b) acc[b]++
        return acc
      },
      { or: 0, argent: 0, bronze: 0 } as Record<Badge, number>,
    )

    return (
      <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
        <div className="py-6 text-center">
          {badge && <p className="mb-2 text-6xl">{BADGE_EMOJI[badge]}</p>}
          <p className="mb-1 text-2xl font-semibold text-gray-800">
            Score : {score} / {questions.length}
          </p>
          {badge && <p className="mb-4 text-gray-500">{BADGE_LABEL[badge]} !</p>}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
          >
            Recommencer
          </button>
        </div>

        {(collection.or > 0 || collection.argent > 0 || collection.bronze > 0) && (
          <p className="mb-6 text-center text-sm text-gray-500">
            Ta collection : {collection.or > 0 && `${BADGE_EMOJI.or} × ${collection.or}`}
            {collection.or > 0 && (collection.argent > 0 || collection.bronze > 0) && '  '}
            {collection.argent > 0 && `${BADGE_EMOJI.argent} × ${collection.argent}`}
            {collection.argent > 0 && collection.bronze > 0 && '  '}
            {collection.bronze > 0 && `${BADGE_EMOJI.bronze} × ${collection.bronze}`}
          </p>
        )}

        {resultats.length > 1 && (
          <div className="mx-auto max-w-sm">
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">Parties précédentes</h2>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {resultats.slice(1).map((r) => {
                const b = badgePour(r.score, r.total)
                return (
                  <li key={r.termineLe} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-500">
                      {new Date(r.termineLe).toLocaleDateString('fr-FR')} · {MODE_LABEL[r.mode]}
                    </span>
                    <span className="font-medium text-gray-800">
                      {b && `${BADGE_EMOJI[b]} `}
                      {r.score} / {r.total}
                    </span>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() => {
                viderResultatsQuiz()
                setResultats([])
              }}
              className="mt-3 text-sm text-gray-500 hover:text-brand-600"
            >
              Effacer l'historique des scores
            </button>
          </div>
        )}
      </ToolLayout>
    )
  }

  return (
    <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Mot {index + 1} sur {questions.length}
        </span>
        <span className="text-sm font-medium text-brand-600">Score : {score}</span>
      </div>

      {mode === 'qcm' ? (
        <QuestionQCM key={index} question={question} onReponse={handleReponse} />
      ) : mode === 'reconstitution' ? (
        <QuestionReconstitution key={index} question={question} entreeCible={entreeCible} onReponse={handleReponse} />
      ) : (
        <QuestionGrammaire key={index} question={question} onReponse={handleReponse} />
      )}

      {aRepondu && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={motSuivant}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
          >
            Mot suivant →
          </button>
        </div>
      )}
    </ToolLayout>
  )
}
