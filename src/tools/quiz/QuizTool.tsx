import { useEffect, useMemo, useRef, useState } from 'react'
import { ToolLayout } from '../../components/ToolLayout'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { SequenceBar } from '../../components/SequenceBar'
import { PhonemeInfoModal } from '../../components/PhonemeInfoModal'
import { assetUrl } from '../../lib/assetUrl'
import { speak, speechSupported } from '../../lib/speech'
import { genererDistracteurs } from '../../lib/quizErreurs'
import { badgePour, BADGE_EMOJI, BADGE_LABEL, type Badge } from '../../lib/quizBadges'
import { loadWordIndex } from '../../lib/wordIndex'
import { buildPhonemeTrie } from '../clavier/clavierLogic'
import { api } from '../../lib/api'
import type { MotDeListe, MotRateDictee, ModeQuiz, ResultatQuiz } from '../../lib/api'
import {
  CATEGORIES_GRAMMAIRE,
  equilibrerParNature,
  melanger,
  motsAmbigus,
  motsFrequentsPourGrammaire,
  motsFrequentsPourQuiz,
  type CategorieGrammaireQuiz,
  type MotCandidat,
} from './quizLogic'
import {
  CATEGORY_LABEL,
  CATEGORY_MASCOT,
  NATURE_INVARIABLE_LABEL,
  NATURE_INVARIABLE_MASCOT,
} from '../../lib/grammaire'
import { QuestionDictee } from './QuestionDictee'
import { QuestionGraphie } from './QuestionGraphie'
import { preparerSeance, type ExerciceGraphie } from './graphieLogic'
import { phonemes } from '../../lib/phonemes'
import wordPictos from '../../data/word-pictos.json'
import type { PhonemeId, WordEntry } from '../../types/phonetics'

// Le quiz de grammaire propose des natures que WordCategory ne connaît pas
// (pronom, préposition) : ses libellés/mascottes reprennent donc ceux du
// référentiel pour les catégories communes, et ajoutent les deux natures
// issues de natureInvariable.ts.
const LABEL_GRAMMAIRE: Record<CategorieGrammaireQuiz, string> = {
  nom: CATEGORY_LABEL.nom,
  adjectif: CATEGORY_LABEL.adjectif,
  verbe: CATEGORY_LABEL.verbe,
  adverbe: CATEGORY_LABEL.adverbe,
  pronom: NATURE_INVARIABLE_LABEL.pronom,
  preposition: NATURE_INVARIABLE_LABEL.preposition,
}

const MASCOTTE_GRAMMAIRE: Record<CategorieGrammaireQuiz, string> = {
  nom: CATEGORY_MASCOT.nom,
  adjectif: CATEGORY_MASCOT.adjectif,
  verbe: CATEGORY_MASCOT.verbe,
  adverbe: CATEGORY_MASCOT.adverbe,
  pronom: NATURE_INVARIABLE_MASCOT.pronom,
  preposition: NATURE_INVARIABLE_MASCOT.preposition,
}

const NB_MOTS_SESSION = 10

/**
 * Modes où la longueur de la séance se choisit au lancement, avec les
 * niveaux proposés. Demandé par Camille : "5, 10, 15, 20" pour la dictée,
 * "5 ou 10" pour la recomposition. Les autres modes gardent NB_MOTS_SESSION
 * fixe, sans écran de choix.
 */
const NIVEAUX_SEANCE: Partial<Record<ModeQuiz, number[]>> = {
  dictee: [5, 10, 15, 20],
  reconstitution: [5, 10],
}

const MODE_LABEL: Record<ModeQuiz, string> = {
  qcm: 'Choix multiple',
  reconstitution: 'Recomposer le mot',
  grammaire: 'Catégorie grammaticale',
  dictee: 'Dictée des mots de la semaine',
  graphie: 'Choisis la bonne graphie',
}

// Écran de choix : chaque exercice a son icône, sa couleur et une phrase qui
// dit ce qu'on va faire. Quatre boutons identiques empilés se lisaient comme
// une liste administrative, et "Recomposer le mot" ne disait pas à un CP ce
// qu'on attendait de lui.
const MODE_PRESENTATION: Record<ModeQuiz, { icone: string; resume: string; couleur: string }> = {
  qcm: { icone: '🔤', resume: 'Trouve la bonne orthographe parmi trois', couleur: 'border-l-brand-500' },
  reconstitution: { icone: '🧩', resume: 'Clique les sons que tu entends', couleur: 'border-l-accent-500' },
  grammaire: { icone: '🎭', resume: 'Nom, verbe, adjectif ?', couleur: 'border-l-violet-400' },
  dictee: { icone: '✏️', resume: 'Écoute le mot et écris-le', couleur: 'border-l-orange-400' },
  graphie: { icone: '🔡', resume: 'Le son [o] : o, au ou eau ?', couleur: 'border-l-emerald-400' },
}

// Titre court sur la carte : "Dictée des mots de la semaine" tient dans le
// bouton d'origine mais déborde d'une carte, et le résumé juste en dessous
// dit déjà de quoi il s'agit.
const MODE_TITRE_COURT: Partial<Record<ModeQuiz, string>> = {
  dictee: 'Dictée',
  graphie: 'La bonne graphie',
}

// La dictée est un exercice de classe évalué, pas un jeu : pas de médaille
// dessus (une médaille de bronze sur une dictée à 4/10 enverrait un signal
// contradictoire). Les trois autres modes les gardent.
const MODES_AVEC_BADGE: ModeQuiz[] = ['qcm', 'reconstitution', 'grammaire', 'graphie']

interface Question {
  entree: MotCandidat
  /** Uniquement en mode QCM : mot correct + distracteurs, mélangés. */
  options?: string[]
  /** Uniquement en mode grammaire : nature attendue (peut différer de entree.category - voir natureGrammaireDe). */
  nature?: CategorieGrammaireQuiz
  /** Uniquement en mode graphie : étapes son par son, préparées par graphieLogic. */
  graphie?: ExerciceGraphie
}

function QuestionCarte({ entree }: { entree: MotCandidat }) {
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

// Contrairement à QuestionCarte, n'affiche NI la mascotte/l'étiquette de
// catégorie NI le picto du mot : c'est justement la nature qu'on demande de
// deviner ici, la révéler à l'avance viderait l'exercice de son sens.
function QuestionGrammaire({
  question,
  onReponse,
}: {
  question: Question
  onReponse: (correct: boolean) => void
}) {
  const [choisi, setChoisi] = useState<CategorieGrammaireQuiz | null>(null)

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
      <div className="mx-auto grid max-w-md grid-cols-6 gap-2">
        {CATEGORIES_GRAMMAIRE.map((nature) => {
          const estCorrect = nature === question.nature
          const style =
            choisi === null
              ? 'border-gray-200 hover:bg-gray-50'
              : estCorrect
                ? 'border-green-400 bg-green-50'
                : choisi === nature
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 opacity-60'
          return (
            <button
              key={nature}
              type="button"
              disabled={choisi !== null}
              onClick={() => {
                setChoisi(nature)
                onReponse(estCorrect)
              }}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 ${style}`}
            >
              <img src={assetUrl(MASCOTTE_GRAMMAIRE[nature])} alt="" className="h-14 w-14 object-contain" />
              <span className="text-xs font-medium text-gray-600">{LABEL_GRAMMAIRE[nature]}</span>
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
  /** `duPremierCoup` : vrai si réussi dès le 1er essai (voir bilan élève, schema-v11.sql). */
  onReponse: (correct: boolean, duPremierCoup: boolean) => void
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
      onReponse(true, essais === 0)
      return
    }
    const essaisSuivant = essais + 1
    setEssais(essaisSuivant)
    if (essaisSuivant >= ESSAIS_MAX) {
      setSuccesFinal(false)
      onReponse(false, false)
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
  // Uniquement pour le filet de secours de la dictée (liste de mots
  // cliquables pendant la saisie phonétique) - construit à la demande, pas à
  // chaque partie : ~32 000 mots, inutile de payer ce coût pour les 4 autres
  // modes qui n'en ont pas besoin.
  const trieDictee = useMemo(() => (mode === 'dictee' && wordIndex ? buildPhonemeTrie(wordIndex) : null), [mode, wordIndex])
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
  // Dictée uniquement : mots ratés au premier tour, repassés une fois en fin
  // de séance. `totalSeance` fige le nombre de mots du PREMIER tour, sinon
  // le score final serait rapporté au nombre de mots du rattrapage.
  const [aRattraper, setARattraper] = useState<Question[]>([])
  // Mots ratés lors des séances PRÉCÉDENTES (schema-v10.sql), replacés en tête
  // du tirage. null = pas encore chargés.
  const [motsRates, setMotsRates] = useState<MotRateDictee[] | null>(null)
  const [enRattrapage, setEnRattrapage] = useState(false)
  const [totalSeance, setTotalSeance] = useState(0)
  // Nombre de bonnes réponses obtenues DU PREMIER COUP (schema-v11.sql) :
  // le score ne distingue pas un mot réussi au 1er essai d'un mot réussi au
  // 3e (voir dictée/recomposition), mais le bilan enseignant, lui, le peut.
  const [premierCoupCount, setPremierCoupCount] = useState(0)
  // Nombre de mots où le filet de secours de la dictée a été ouvert
  // (schema-v12.sql) - jamais incrémenté hors dictée. Compte les mots
  // DISTINCTS (voir motsAvecAide) : un même mot peut repasser en rattrapage,
  // ça ne doit pas compter deux fois côté enseignante.
  const [aideUtiliseeCount, setAideUtiliseeCount] = useState(0)
  // Mots (clé lemmaId|word) où le filet a été ouvert AU MOINS UNE FOIS dans
  // la séance - persiste du tour principal au rattrapage. Demandé par
  // Hugues : sans ça, un mot aidé au tour principal puis retapé sans aide en
  // rattrapage récupérait son point (score remonté à 5/5 alors qu'une aide a
  // été nécessaire) - l'aide doit peser sur le score de façon définitive.
  const [motsAvecAide, setMotsAvecAide] = useState<Set<string>>(new Set())
  // Mots finalement écrits juste MAIS où l'aide a servi à un moment de la
  // séance - juste pour l'afficher clairement sur l'écran de résultat
  // ("réussi avec aide"), distinct d'un mot vraiment raté.
  const [motsReussisAvecAide, setMotsReussisAvecAide] = useState<Set<string>>(new Set())
  // Longueur de la séance en cours - NB_MOTS_SESSION par défaut, ou choisie
  // au lancement pour les modes listés dans NIVEAUX_SEANCE.
  const [tailleSeance, setTailleSeance] = useState(NB_MOTS_SESSION)
  // Mode cliqué mais dont la longueur reste à choisir (voir NIVEAUX_SEANCE) -
  // écran intermédiaire entre le menu et le lancement de la séance.
  const [modeEnChoixTaille, setModeEnChoixTaille] = useState<ModeQuiz | null>(null)
  // Chrono de la séance (schema-v13.sql) - jamais affiché, réservé au bilan
  // enseignant. Démarré dès que les questions sont prêtes plutôt qu'au choix
  // du mode, pour ne pas compter le temps de préparation (chargement du
  // lexique, tirage des mots) comme si l'élève réfléchissait déjà.
  const debutSeanceRef = useRef<number | null>(null)

  useEffect(() => {
    loadWordIndex().then(setWordIndex)
  }, [])

  useEffect(() => {
    if (questions && debutSeanceRef.current === null) debutSeanceRef.current = Date.now()
  }, [questions])

  // Best-effort : hors ligne ou API en panne, la dictée se contente d'un
  // tirage aléatoire comme avant plutôt que de ne pas démarrer.
  useEffect(() => {
    api
      .listMotsRatesDictee()
      .then((r) => setMotsRates(Array.isArray(r.mots) ? r.mots : []))
      .catch(() => setMotsRates([]))
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

    const ambigus = motsAmbigus(wordIndex)
    const sansAmbigus = (source: MotCandidat[]) => source.filter((e) => !ambigus.has(e.word.toLowerCase()))

    // Complète une séance trop courte avec le vivier général. La liste de la
    // semaine ne fournit pas toujours NB_MOTS_SESSION questions valables :
    // Camille a eu une séance de graphie à 2 questions sur une liste de 9
    // mots. On ne remplaçait la liste que si elle ne donnait RIEN, alors
    // qu'il fallait la compléter. La dictée est volontairement exclue de ce
    // mécanisme : elle ne porte que sur les mots donnés en classe.
    const completer = (base: Question[], reste: () => Question[]): Question[] => {
      if (base.length >= tailleSeance) return base.slice(0, tailleSeance)
      const pris = new Set(base.map((q) => `${q.entree.lemmaId}|${q.entree.word}`))
      const complement = reste().filter((q) => !pris.has(`${q.entree.lemmaId}|${q.entree.word}`))
      return [...base, ...complement].slice(0, tailleSeance)
    }

    // La dictée porte PAR NATURE sur les mots vus en classe : pas de repli
    // sur le vivier général, contrairement aux autres modes. Sans liste
    // enregistrée, l'exercice n'est simplement pas proposé (voir l'écran de
    // choix, qui le masque dans ce cas).
    if (mode === 'dictee') {
      if (!motsSemaineCumules || !motsRates) return
      // Pas de filtre motsAmbigus ici : on dicte des mots choisis à la main
      // par l'enseignante, et écrire "bonne" reste un exercice d'orthographe
      // parfaitement valable - l'ambiguïté ne gênait que l'étiquette de
      // catégorie affichée, absente de la dictée.
      //
      // Les mots ratés aux séances précédentes ouvrent la dictée, les plus
      // ratés en premier (l'API les trie déjà). Un mot resté dans cette liste
      // alors qu'il a disparu de la liste hebdomadaire est ignoré : on ne
      // dicte que des mots que l'enseignante a effectivement donnés.
      const parCle = new Map(motsSemaineCumules.map((m) => [`${m.lemmaId}|${m.word}`, m]))
      const revisions: MotCandidat[] = []
      for (const rate of motsRates) {
        const mot = parCle.get(`${rate.lemmaId}|${rate.word}`)
        if (mot) revisions.push(mot)
      }
      const dejaPris = new Set(revisions.map((m) => `${m.lemmaId}|${m.word}`))
      const nouveaux = melanger(motsSemaineCumules.filter((m) => !dejaPris.has(`${m.lemmaId}|${m.word}`)))
      // Les révisions ne mangent pas toute la séance : la moitié au plus,
      // sinon un élève en difficulté ne verrait plus jamais de mot nouveau.
      const tirage = [
        ...revisions.slice(0, Math.ceil(tailleSeance / 2)),
        ...nouveaux,
      ].slice(0, tailleSeance)
      setQuestions(tirage.map((entree) => ({ entree })))
      setTotalSeance(tirage.length)
      return
    }

    // Beaucoup de mots ne sont pas jouables en graphie (découpe non fiable,
    // aucun son à choisir, plus de 4, homophone sans picto) : on soumet donc
    // un vivier volontairement large à preparerSeance, qui écarte au fil de
    // l'eau et s'arrête dès qu'il a ses NB_MOTS_SESSION exercices.
    if (mode === 'graphie') {
      const depuis = (source: MotCandidat[]): Question[] => {
        const parMot = new Map(source.map((m) => [`${m.lemmaId}|${m.word}`, m]))
        return preparerSeance(melanger(source), wordIndex, tailleSeance).flatMap((g) => {
          const entree = parMot.get(`${g.lemmaId}|${g.mot}`)
          return entree ? [{ entree, graphie: g }] : []
        })
      }
      const depuisListe =
        utiliserListeSemaine && motsSemaineCumules ? depuis(sansAmbigus(motsSemaineCumules)) : []
      setQuestions(completer(depuisListe, () => depuis(sansAmbigus(motsFrequentsPourQuiz(wordIndex)))))
      return
    }

    if (mode === 'grammaire') {
      const depuisListe =
        utiliserListeSemaine && motsSemaineCumules
          ? equilibrerParNature(sansAmbigus(motsSemaineCumules), tailleSeance)
          : []
      setQuestions(
        completer(depuisListe, () =>
          equilibrerParNature(sansAmbigus(motsFrequentsPourGrammaire(wordIndex)), tailleSeance),
        ),
      )
      return
    }

    function construire(source: MotCandidat[]): Question[] {
      const choisis: Question[] = []
      for (const entree of melanger(source)) {
        if (choisis.length >= tailleSeance) break
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

    const depuisListe =
      utiliserListeSemaine && motsSemaineCumules ? construire(sansAmbigus(motsSemaineCumules)) : []
    setQuestions(completer(depuisListe, () => construire(sansAmbigus(motsFrequentsPourQuiz(wordIndex)))))
  }, [wordIndex, mode, questions, utiliserListeSemaine, motsSemaineCumules, motsRates, tailleSeance])

  /**
   * `duPremierCoup` compte pour la dictée et la recomposition, qui laissent
   * 3 essais : il vaut `correct` partout ailleurs (un seul essai possible,
   * donc "du premier coup" ou pas du tout).
   *
   * `aideUtiliseeSurCeMot` (dictée uniquement, sinon toujours `false`) :
   * demandé par Hugues, ouvrir le filet de secours retire au mot son statut
   * de réussite, même s'il est finalement écrit juste - sinon l'aide
   * donnerait un sans-faute gratuit. Cette pénalité doit tenir même si le mot
   * revient juste sans aide au rattrapage - sinon le score remontait
   * (5/5 au lieu de 4/5 constaté par Hugues) et l'aide devenait gratuite dès
   * qu'on retapait le mot une 2e fois. `aideSurCeMot` regarde donc aussi
   * `motsAvecAide`, qui persiste du tour principal au rattrapage - pas
   * seulement l'argument de CET appel. `effectiveCorrect` est la vraie
   * mesure de réussite utilisée pour le score, le 1er coup ET le rattrapage :
   * un mot aidé (à un moment ou un autre) est traité comme un mot raté.
   */
  function handleReponse(correct: boolean, duPremierCoup: boolean = correct, aideUtiliseeSurCeMot: boolean = false) {
    if (aRepondu) return
    setARepondu(true)
    const cleMot = mode === 'dictee' && questions ? `${questions[index].entree.lemmaId}|${questions[index].entree.word}` : null
    const aideSurCeMot = aideUtiliseeSurCeMot || (cleMot !== null && motsAvecAide.has(cleMot))
    const effectiveCorrect = correct && !aideSurCeMot
    if (effectiveCorrect) setScore((s) => s + 1)
    // Écrit juste mais aide nécessaire à un moment : compté à part pour
    // l'écran de résultat ("réussi avec aide"), une seule fois par mot même
    // s'il repasse par le rattrapage (Set = dédupliqué par clé).
    if (correct && aideSurCeMot && cleMot !== null) {
      setMotsReussisAvecAide((s) => (s.has(cleMot) ? s : new Set(s).add(cleMot)))
    }
    if (duPremierCoup && !aideSurCeMot) setPremierCoupCount((c) => c + 1)
    // Dictée : les mots ratés (ou aidés, donc pas vraiment su) sont repassés
    // en fin de séance ET retenus pour les séances suivantes (schema-v10.sql).
    // Seul le PREMIER tour compte : un mot réussi au rattrapage reste à
    // réviser, il a bien été raté/aidé quand il a été dicté.
    //
    // Bug corrigé (repéré par Camille sur un score du genre "13/10") : le
    // rattrapage se déclenchait sur `!duPremierCoup`, pas sur `!correct`. Un
    // mot réussi au 2e ou 3e essai est CORRECT (score déjà incrémenté juste
    // au-dessus) mais pas "du premier coup" - il repassait donc quand même
    // en rattrapage, et un succès là-bas comptait un DEUXIÈME point pour le
    // même mot. Le rattrapage ne doit revoir que les mots vraiment non
    // maîtrisés (`!effectiveCorrect`), sinon son effectif dépasse le nombre
    // de mots manquants et le score final peut dépasser le total affiché.
    if (mode === 'dictee' && questions && !enRattrapage) {
      const { lemmaId, word } = questions[index].entree
      if (!effectiveCorrect) setARattraper((prec) => [...prec, questions[index]])
      // Best-effort, comme l'enregistrement des scores : une dictée doit
      // pouvoir se dérouler même si le serveur ne répond pas.
      api.marquerMotDictee(lemmaId, word, duPremierCoup && !aideSurCeMot).catch(() => {})
    }
  }

  // Une fois un mode choisi, l'historique du navigateur ne connaît que
  // l'entrée précédant /quiz — le "← Retour" par défaut de ToolLayout
  // (navigate(-1)) ramènerait donc directement au clavier en sautant l'écran
  // de choix du mode, plutôt que d'y revenir comme on s'y attend en pleine
  // partie. Signalé à l'usage.
  function revenirAuChoixDuMode() {
    setMode(null)
    setModeEnChoixTaille(null)
    setTailleSeance(NB_MOTS_SESSION)
    setQuestions(null)
    setIndex(0)
    setScore(0)
    setARepondu(false)
    setTermine(false)
    setARattraper([])
    setEnRattrapage(false)
    setTotalSeance(0)
    setPremierCoupCount(0)
    setAideUtiliseeCount(0)
    setMotsAvecAide(new Set())
    setMotsReussisAvecAide(new Set())
    debutSeanceRef.current = null
  }

  /** Lance directement un mode sans écran de choix de longueur. */
  function choisirMode(m: ModeQuiz) {
    setTailleSeance(NB_MOTS_SESSION)
    setMode(m)
  }

  function motSuivant() {
    if (!questions || !mode) return
    if (index + 1 >= questions.length) {
      // Dictée : avant de terminer, on repasse une fois sur les mots ratés.
      // Le score de la séance reste celui du premier tour - un mot réussi
      // au rattrapage n'efface pas l'erreur initiale, l'enseignante doit
      // voir ce qui a vraiment posé problème.
      if (mode === 'dictee' && aRattraper.length > 0 && !enRattrapage) {
        setQuestions(aRattraper)
        setARattraper([])
        setEnRattrapage(true)
        setIndex(0)
        setARepondu(false)
        return
      }
      // Best-effort : le score s'affiche même si l'enregistrement échoue
      // (hors ligne) - on retente juste de recharger la liste ensuite,
      // qu'il ait réussi ou non.
      // Seule la dictée a un total qui diffère de questions.length, parce
      // que le rattrapage remplace la liste en cours de route. Envoyer
      // totalSeance pour tous les modes envoyait 0 (il n'est renseigné qu'en
      // dictée) et le serveur rejetait le résultat : les scores des autres
      // exercices n'étaient plus enregistrés du tout.
      const dureeSecondes = debutSeanceRef.current !== null ? Math.round((Date.now() - debutSeanceRef.current) / 1000) : 0
      api
        .ajouterResultatQuiz(
          mode,
          score,
          mode === 'dictee' ? totalSeance : questions.length,
          premierCoupCount,
          aideUtiliseeCount,
          dureeSecondes,
        )
        .catch(() => {})
        .then(() => api.listResultatsQuiz())
        .then((r) => setResultats(Array.isArray(r.resultats) ? r.resultats : []))
        .catch(() => {})
      setTermine(true)
      return
    }
    setIndex((i) => i + 1)
    setARepondu(false)
  }

  if (!mode && modeEnChoixTaille) {
    const niveaux = NIVEAUX_SEANCE[modeEnChoixTaille] ?? []
    return (
      <ToolLayout
        title="Mes exercices"
        description="Combien de mots pour cette séance ?"
        showBackToKeyboard
        onBack={() => setModeEnChoixTaille(null)}
      >
        <div className="mx-auto flex max-w-sm flex-wrap justify-center gap-3">
          {niveaux.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setTailleSeance(n)
                setMode(modeEnChoixTaille)
              }}
              className="rounded-xl border-2 border-gray-200 bg-white px-6 py-4 text-2xl font-semibold text-gray-800 hover:border-brand-400 hover:bg-brand-50"
            >
              {n}
            </button>
          ))}
        </div>
      </ToolLayout>
    )
  }

  if (!mode) {
    // La dictée n'a de sens que s'il y a des mots de la semaine enregistrés :
    // sans liste, elle n'est pas proposée du tout plutôt que d'afficher un
    // bouton qui ne mène à rien.
    const modesProposes = (Object.keys(MODE_LABEL) as ModeQuiz[]).filter(
      (m) => m !== 'dictee' || (motsSemaineCumules?.length ?? 0) > 0,
    )
    return (
      <ToolLayout title="Mes exercices" description="Choisis un exercice pour réviser." showBackToKeyboard>
        {motsSemaineCumules && (
          <div className="mb-5 flex justify-center">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-brand-100 bg-white px-4 py-2 text-sm text-brand-700">
              <input
                type="checkbox"
                checked={utiliserListeSemaine}
                onChange={(e) => setUtiliserListeSemaine(e.target.checked)}
                className="accent-brand-600"
              />
              📋 Réviser les mots vus en classe
              <span className="rounded-full bg-brand-100 px-2 text-xs">{motsSemaineCumules.length}</span>
            </label>
          </div>
        )}
        <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
          {modesProposes.map((m, i) => {
            // Nombre impair de cartes : la dernière se retrouverait seule à
            // gauche d'une ligne à deux colonnes. On lui fait occuper la ligne
            // entière puis on la recentre en lui gardant la largeur d'une
            // colonne (la moitié, moins la moitié de l'écart entre colonnes).
            const orpheline = modesProposes.length % 2 === 1 && i === modesProposes.length - 1
            const centrage = orpheline ? 'sm:col-span-2 sm:w-[calc(50%-0.375rem)] sm:justify-self-center' : ''
            return (
              <button
                key={m}
                type="button"
                onClick={() => (NIVEAUX_SEANCE[m] ? setModeEnChoixTaille(m) : choisirMode(m))}
                className={`flex items-start gap-3 rounded-xl border border-gray-200 border-l-5 bg-white px-4 py-3 text-left transition hover:shadow-md ${MODE_PRESENTATION[m].couleur} ${centrage}`}
              >
                <span className="text-2xl leading-none">{MODE_PRESENTATION[m].icone}</span>
                <span>
                  <span className="block font-medium text-gray-900">{MODE_TITRE_COURT[m] ?? MODE_LABEL[m]}</span>
                  <span className="block text-sm text-gray-500">{MODE_PRESENTATION[m].resume}</span>
                </span>
              </button>
            )
          })}
        </div>
      </ToolLayout>
    )
  }

  if (!questions) {
    return (
      <ToolLayout
        title="Mes exercices"
        description="Choisis un exercice pour réviser."
        showBackToKeyboard
        onBack={revenirAuChoixDuMode}
      >
        <p className="py-10 text-center text-gray-400">Préparation du quiz…</p>
      </ToolLayout>
    )
  }

  // Garde-fou : un double-clic rapide sur "Mot suivant" (fréquent chez un
  // enfant) peut faire passer l'index au-delà de la liste avant que React
  // n'ait re-rendu, notamment au basculement vers le rattrapage de la
  // dictée, qui remplace `questions` et remet l'index à 0 en même temps.
  const question = questions[index] as Question | undefined
  if (!question) {
    return (
      <ToolLayout
        title="Mes exercices"
        description="Choisis un exercice pour réviser."
        showBackToKeyboard
        onBack={revenirAuChoixDuMode}
      >
        <p className="py-10 text-center text-gray-400">Préparation du quiz…</p>
      </ToolLayout>
    )
  }

  const entreeCible = wordIndex?.find(
    (e) => e.lemmaId === question.entree.lemmaId && e.word === question.entree.word,
  )
  // Voir le commentaire au-dessus du rendu des composants Question* : inclut
  // le tour (principal/rattrapage) pour forcer un remount à la transition.
  const cleQuestion = `${enRattrapage}-${index}`

  if (termine) {
    // En dictée, le total est celui du PREMIER tour (voir motSuivant) - le
    // rattrapage change questions.length mais pas le nombre de mots dictés.
    const total = mode === 'dictee' ? totalSeance : questions.length
    const badge = MODES_AVEC_BADGE.includes(mode) ? badgePour(score, total) : null
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
      <ToolLayout
        title="Mes exercices"
        description="Choisis un exercice pour réviser."
        showBackToKeyboard
        onBack={revenirAuChoixDuMode}
      >
        <div className="py-6 text-center">
          {badge && <p className="mb-2 text-6xl">{BADGE_EMOJI[badge]}</p>}
          <p className="mb-1 text-2xl font-semibold text-gray-800">
            Score : {score} / {total}
          </p>
          {mode === 'dictee' && motsReussisAvecAide.size > 0 && (
            <p className="mb-1 text-sm text-gray-500">
              dont {motsReussisAvecAide.size} mot{motsReussisAvecAide.size > 1 ? 's' : ''} réussi
              {motsReussisAvecAide.size > 1 ? 's' : ''} avec l'aide (non comptabilisé
              {motsReussisAvecAide.size > 1 ? 's' : ''} dans le score)
            </p>
          )}
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
                api.viderResultatsQuiz().catch(() => {})
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
    <ToolLayout
      title="Mes exercices"
      description="Choisis un exercice pour réviser."
      showBackToKeyboard
      onBack={revenirAuChoixDuMode}
    >
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {enRattrapage ? 'On refait les mots ratés — ' : ''}Mot {index + 1} sur {questions.length}
        </span>
        <span className="text-sm font-medium text-brand-600">Score : {score}</span>
      </div>

      {/* `key` doit changer au passage en rattrapage même si l'index reste le
          même (dictée) : le rattrapage réutilise le MÊME objet Question que
          le tour principal pour un mot raté/aidé. Avec `key={index}` seul,
          si ce mot était déjà à l'index 0 du tour principal, React ne
          remonte pas le composant en passant à l'index 0 du rattrapage - son
          `useEffect(..., [entree])` ne se redéclenche pas (même référence
          d'objet) et l'écran de correction du tour précédent reste affiché
          au lieu du champ de saisie. Repéré en testant le nouveau blocage du
          score sur mot aidé (une séance à 1 mot le reproduit à coup sûr),
          mais existait déjà avant pour un mot vraiment raté en 1re position. */}
      {mode === 'qcm' ? (
        <QuestionQCM key={cleQuestion} question={question} onReponse={handleReponse} />
      ) : mode === 'reconstitution' ? (
        <QuestionReconstitution
          key={cleQuestion}
          question={question}
          entreeCible={entreeCible}
          onReponse={handleReponse}
        />
      ) : mode === 'dictee' ? (
        <QuestionDictee
          key={cleQuestion}
          entree={question.entree}
          entreeCible={entreeCible}
          trie={trieDictee}
          onReponse={handleReponse}
          onAideUtilisee={() => {
            const cle = `${question.entree.lemmaId}|${question.entree.word}`
            if (motsAvecAide.has(cle)) return
            setMotsAvecAide((s) => new Set(s).add(cle))
            setAideUtiliseeCount((c) => c + 1)
          }}
        />
      ) : mode === 'graphie' && question.graphie ? (
        <QuestionGraphie
          key={cleQuestion}
          exercice={question.graphie}
          category={question.entree.category}
          onTermine={handleReponse}
        />
      ) : (
        <QuestionGrammaire key={cleQuestion} question={question} onReponse={handleReponse} />
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
