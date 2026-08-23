import { useEffect, useMemo, useRef, useState } from 'react'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { SequenceBar } from '../../components/SequenceBar'
import { decomposerMot } from '../../lib/alignementGraphemes'
import { phonemes } from '../../lib/phonemes'
import { speak, speechSupported } from '../../lib/speech'
import { getMatches, getViableNextPhonemes } from '../clavier/clavierLogic'
import type { PhonemeTrieNode } from '../clavier/clavierLogic'
import type { MotCandidat } from './quizLogic'
import type { PhonemeId, WordEntry } from '../../types/phonetics'

/** Nombre de mots proposés dans l'aide - assez pour dépanner, pas assez pour noyer l'élève sous des choix. */
const MAX_SUGGESTIONS = 6

interface QuestionDicteeProps {
  entree: MotCandidat
  /** Entrée complète du lexique, pour la suite de sons du mot (aide + décomposition). */
  entreeCible: WordEntry | undefined
  /** Pour la liste de mots suggérés dans le filet de secours (voir plus bas) - null tant que le lexique n'est pas chargé. */
  trie: PhonemeTrieNode | null
  /**
   * `correct` = mot finalement écrit juste (à n'importe quel essai). `duPremierCoup`
   * distingue l'élève qui savait de celui qui a trouvé au 3e essai. `aideUtilisee`
   * = le filet de secours a été ouvert sur CE mot : dans ce cas, même écrit juste,
   * le mot ne compte plus comme réussi côté score (voir handleReponse dans
   * QuizTool.tsx) - demandé par Hugues, l'aide ne doit pas donner un sans-faute.
   */
  onReponse: (correct: boolean, duPremierCoup: boolean, aideUtilisee: boolean) => void
  /** Appelé une fois si l'élève ouvre le filet de secours sur ce mot (schema-v12.sql). */
  onAideUtilisee: () => void
}

/**
 * Trois essais avant de révéler l'orthographe, comme le mode "recomposer".
 * Révéler dès la première erreur court-circuite l'exercice : l'élève lit la
 * réponse au lieu de la chercher.
 */
const ESSAIS_MAX = 3

/**
 * Dictée : le mot est prononcé, jamais montré, et l'élève l'écrit au clavier
 * normal - c'est bien l'orthographe qu'on vérifie, contrairement au mode
 * "recomposer" qui travaille les sons. Réécoutable autant de fois que voulu :
 * l'exercice porte sur l'écriture, pas sur la mémoire auditive.
 *
 * Après validation, la correction montre la décomposition son par son du mot
 * attendu (même rendu que la fiche mot), pour que l'élève voie POURQUOI ça
 * s'écrit comme ça et pas seulement que c'était faux.
 *
 * Le filet de secours "Je ne sais pas l'écrire" (ouvre le clavier phonétique,
 * avec les mots correspondants suggérés au fur et à mesure - comme le
 * clavier principal) est offert à TOUS les élèves : il était réglable
 * élève par élève, mais l'enseignante a tranché pour l'ouvrir à la classe
 * entière plutôt que d'avoir à décider a priori qui en a besoin.
 *
 * Les mots suggérés sont affichés à titre indicatif SEULEMENT - cliquer
 * dessus ne remplit plus le champ de saisie (revenu en arrière sur un choix
 * antérieur, à la demande de Hugues) : l'élève doit recopier le mot
 * lui-même, sinon l'aide à la mémorisation disparaît. Utiliser l'aide sur un
 * mot lui retire aussi son statut de réussite dans le score (voir
 * QuizTool.tsx, handleReponse) - la dictée doit rester un exercice honnête.
 */
export function QuestionDictee({ entree, entreeCible, trie, onReponse, onAideUtilisee }: QuestionDicteeProps) {
  const [saisie, setSaisie] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [valide, setValide] = useState<boolean | null>(null)
  const [aideOuverte, setAideOuverte] = useState(false)
  const [essais, setEssais] = useState(0)
  // Dernière proposition fausse, gardée pour la correction : la saisie est
  // effacée entre deux essais.
  const [dernierEssai, setDernierEssai] = useState('')
  const [sequence, setSequence] = useState<PhonemeId[]>([])
  const champRef = useRef<HTMLInputElement>(null)
  const phonemesById = useMemo(() => new Map(phonemes.map((p) => [p.id, p])), [])

  useEffect(() => {
    setSaisie('')
    setErreur(null)
    setValide(null)
    setAideOuverte(false)
    setEssais(0)
    setDernierEssai('')
    setSequence([])
    champRef.current?.focus()
  }, [entree])

  // Le mot est prononcé automatiquement à l'arrivée : sans ça, l'élève doit
  // penser à cliquer avant de pouvoir commencer.
  useEffect(() => {
    if (speechSupported()) speak(entree.word, { category: entree.category, lemmaId: entree.lemmaId })
  }, [entree])

  // Même précaution que sur la fiche mot : une découpe non fiable est
  // décalée et enseignerait de fausses correspondances. Sur "histoire", le
  // "h" muet initial décalait tout et la correction affichait [i]->h,
  // [s]->i, [t]->t, [oi]->o, en laissant "ire" en muet alors que seul le
  // "e" l'est. Mieux vaut pas de découpe qu'une découpe fausse.
  const decomposition = useMemo(() => {
    if (!entreeCible) return null
    const d = decomposerMot(entree.word, entreeCible.phonemes, phonemes)
    return d.fiable ? d : null
  }, [entree.word, entreeCible])

  // Mots dont la suite de sons commence par ceux déjà cliqués - comme le
  // clavier principal, qui affiche ses résultats au fur et à mesure plutôt
  // que d'attendre la fin. Sans ça, l'aide se limitait à un clavier muet :
  // l'élève pouvait cliquer des sons sans jamais voir à quoi ça menait,
  // repéré en la comparant au clavier principal, qui les affiche déjà.
  const suggestions = useMemo(() => {
    if (!trie || sequence.length === 0) return []
    const vus = new Set<string>()
    const mots: string[] = []
    for (const candidat of getMatches(trie, sequence)) {
      const mot = candidat.word.toLowerCase()
      if (vus.has(mot)) continue
      vus.add(mot)
      mots.push(candidat.word)
      if (mots.length >= MAX_SUGGESTIONS) break
    }
    return mots
  }, [trie, sequence])

  const viableNext = useMemo(
    () => (trie ? getViableNextPhonemes(trie, sequence) : null),
    [trie, sequence],
  )

  function valider() {
    const propose = saisie.trim().toLowerCase()
    if (!propose) {
      setErreur("Écris le mot avant de valider")
      return
    }
    setErreur(null)

    if (propose === entree.word.toLowerCase()) {
      setValide(true)
      onReponse(true, essais === 0, aideOuverte)
      return
    }

    const essaisSuivant = essais + 1
    setEssais(essaisSuivant)
    if (essaisSuivant >= ESSAIS_MAX) {
      setDernierEssai(saisie.trim())
      setValide(false)
      onReponse(false, false, aideOuverte)
      return
    }
    // On efface la saisie pour que l'élève réécrive le mot en entier plutôt
    // que de corriger une lettre au hasard.
    setSaisie('')
    champRef.current?.focus()
  }

  if (valide !== null) {
    return (
      <div className="text-center">
        <p className={`mb-1 text-xl font-semibold ${valide ? 'text-green-600' : 'text-red-600'}`}>
          {valide ? "Bravo, c'est ça !" : 'Pas tout à fait.'}
        </p>
        {!valide && (
          <p className="mb-4 text-gray-500">
            Tu as écrit <span className="font-medium text-gray-700">{dernierEssai}</span>, on écrit{' '}
            <span className="font-medium text-gray-900">{entree.word}</span>
          </p>
        )}

        {decomposition && (
          <div className="mx-auto mb-4 flex max-w-lg flex-wrap items-start justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
            {decomposition.segments.map((segment, i) => (
              <div key={i} className="flex items-start gap-3">
                {/* Muettes internes (le "h" de "histoire") : présentées
                    exactement comme les muettes finales juste en dessous. */}
                {segment.muetteAvant && (
                  <span className="flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-400">muet</span>
                    <span className="px-1 py-1 text-2xl font-semibold text-gray-300">{segment.muetteAvant}</span>
                  </span>
                )}
                <span className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-400">
                    [{phonemesById.get(segment.phonemeId)?.displaySymbol ?? segment.phonemeId}]
                  </span>
                  <span className="rounded-lg bg-brand-100 px-3 py-1 text-2xl font-semibold text-brand-700">
                    {segment.grapheme}
                  </span>
                </span>
              </div>
            ))}
            {decomposition.muettes && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-400">muet</span>
                <span className="px-3 py-1 text-2xl font-semibold text-gray-300">{decomposition.muettes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center">
      {speechSupported() && (
        <button
          type="button"
          onClick={() => speak(entree.word, { category: entree.category, lemmaId: entree.lemmaId })}
          className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg text-white shadow-sm hover:bg-brand-700 active:scale-95"
        >
          🔊 Écouter le mot
        </button>
      )}

      <div>
        <input
          ref={champRef}
          type="text"
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value)
            if (erreur) setErreur(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider()
          }}
          placeholder="Écris le mot"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-64 rounded-lg border-2 border-gray-200 px-4 py-3 text-center text-2xl focus:border-brand-400 focus:outline-none"
        />
        <p className="mt-2 min-h-5 text-sm text-red-600">
          {erreur ?? (essais > 0 ? `Pas tout à fait, réessaie ! (essai ${essais}/${ESSAIS_MAX})` : '')}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={valider}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
        >
          Valider
        </button>
        {!aideOuverte && (
          <button
            type="button"
            onClick={() => {
              setAideOuverte(true)
              onAideUtilisee()
            }}
            className="text-sm text-gray-500 hover:text-brand-600"
          >
            Je ne sais pas l'écrire
          </button>
        )}
      </div>

      {/* Filet de secours : le clavier phonétique aide à retrouver
          l'orthographe. Les mots suggérés sont affichés à titre indicatif
          SEULEMENT (pas des boutons) - l'élève doit recopier lui-même le mot
          dans le champ, sinon l'aide à la mémorisation disparaît. */}
      {aideOuverte && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-gray-500">Clique les sons que tu entends.</p>
          <SequenceBar
            sequence={sequence}
            phonemesById={phonemesById}
            onBackspace={() => setSequence((s) => s.slice(0, -1))}
            onClear={() => setSequence([])}
          />

          {suggestions.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((mot) => (
                <span
                  key={mot}
                  className="rounded-full border-2 border-brand-200 bg-brand-50 px-4 py-1 text-lg text-brand-700"
                >
                  {mot}
                </span>
              ))}
            </div>
          )}

          <div className="mt-4">
            <PhonemeKeyboard
              phonemes={phonemes}
              viableNext={viableNext}
              onSelect={(id) => setSequence((s) => [...s, id])}
              onShowInfo={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  )
}
