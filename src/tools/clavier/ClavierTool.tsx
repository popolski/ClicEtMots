import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { PhonemeInfoModal } from '../../components/PhonemeInfoModal'
import { SequenceBar } from '../../components/SequenceBar'
import { WordResultsPanel } from '../../components/WordResultsPanel'
import { buildPhonemeTrie, getMatches, getViableNextPhonemes, groupIntoCards } from './clavierLogic'
import type { PhonemeTrieNode } from './clavierLogic'
import { loadWordIndex } from '../../lib/wordIndex'
import { phonemes } from '../../lib/phonemes'
import type { PhonemeId, WordEntry } from '../../types/phonetics'

export function ClavierTool() {
  // La séquence vit dans l'URL (?seq=ch,ou,e,t), pas dans un simple useState :
  // en cliquant un résultat on quitte cette page (fiche mot), ce qui démonte
  // le composant. Sans ça, le bouton "Retour" (navigate(-1)) revenait sur un
  // clavier vidé au lieu de retrouver la recherche en cours.
  const [searchParams, setSearchParams] = useSearchParams()
  const sequence = useMemo(() => {
    const raw = searchParams.get('seq')
    return raw ? (raw.split(',') as PhonemeId[]) : []
  }, [searchParams])
  const [infoPhonemeId, setInfoPhonemeId] = useState<PhonemeId | null>(null)
  const [trie, setTrie] = useState<PhonemeTrieNode | null>(null)
  const [words, setWords] = useState<WordEntry[] | null>(null)
  // Les résultats restent cachés tant qu'on ne les demande pas explicitement
  // (comme le bouton "résultats" du vrai Clavier Métalo) — avec 32 000 mots,
  // tout afficher dès le premier son cliqué est illisible. Se recache dès
  // qu'on ajoute/retire un son, pour ne montrer les résultats que quand la
  // séquence est vraiment celle qu'on veut consulter.
  //
  // Vit dans l'URL (?resultats=1), comme la séquence elle-même : cliquer un
  // mot quitte cette page (fiche mot), ce qui démonte le composant — un
  // simple useState retombait à false au retour (bouton "Retour", pas
  // "Retour au clavier"), obligeant à recliquer "Voir les mots" à chaque
  // fois alors que la recherche était toujours la même.
  const resultsRevealed = searchParams.get('resultats') === '1'

  useEffect(() => {
    let cancelled = false
    loadWordIndex().then((loaded) => {
      if (!cancelled) {
        setTrie(buildPhonemeTrie(loaded))
        setWords(loaded)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const phonemesById = useMemo(() => new Map(phonemes.map((p) => [p.id, p])), [])

  const viableNext = useMemo(
    () => (!trie || sequence.length === 0 ? null : getViableNextPhonemes(trie, sequence)),
    [trie, sequence],
  )
  const cards = useMemo(
    () => (!trie || sequence.length === 0 ? [] : groupIntoCards(getMatches(trie, sequence), words ?? undefined)),
    [trie, sequence, words],
  )

  const infoPhoneme = infoPhonemeId ? phonemesById.get(infoPhonemeId) : undefined

  function updateSequence(updater: (s: PhonemeId[]) => PhonemeId[]) {
    const next = updater(sequence)
    // replace (pas push) : chaque son cliqué ne doit pas créer une entrée
    // d'historique séparée, sinon "Précédent" du navigateur n'irait retirer
    // qu'un seul phonème à la fois au lieu de sortir du clavier.
    // resultats retiré : changer la séquence invalide les résultats affichés.
    setSearchParams(next.length > 0 ? { seq: next.join(',') } : {}, { replace: true })
  }

  function revealResults() {
    setSearchParams(sequence.length > 0 ? { seq: sequence.join(','), resultats: '1' } : {}, { replace: true })
  }

  return (
    <ToolLayout
      title="Clavier phonétique"
      description="Clique les sons que tu entends dans le mot, et regarde l'orthographe apparaître."
      hideBackButton
    >
      {!trie ? (
        <p className="py-10 text-center text-gray-400">Chargement du lexique…</p>
      ) : (
        <>
          <div className="mb-4 text-right">
            <Link to="/historique" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
              🕓 Mots récents
            </Link>
          </div>

          <SequenceBar
            sequence={sequence}
            phonemesById={phonemesById}
            onBackspace={() => updateSequence((s) => s.slice(0, -1))}
            onClear={() => updateSequence(() => [])}
          />

          {sequence.length > 0 && !resultsRevealed && (
            <div className="mt-4 text-center">
              {cards.length > 0 ? (
                <button
                  type="button"
                  onClick={revealResults}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
                >
                  🔍 Voir les mots
                </button>
              ) : (
                <p className="text-gray-400">Aucun mot trouvé.</p>
              )}
            </div>
          )}

          {sequence.length > 0 && resultsRevealed && (
            <WordResultsPanel key={sequence.join('-')} cards={cards} hasSequence level={2} />
          )}

          <div className="mt-6">
            <PhonemeKeyboard
              phonemes={phonemes}
              viableNext={viableNext}
              onSelect={(id) => updateSequence((s) => [...s, id])}
              onShowInfo={setInfoPhonemeId}
            />
          </div>
        </>
      )}
      {infoPhoneme && <PhonemeInfoModal phoneme={infoPhoneme} onClose={() => setInfoPhonemeId(null)} />}
    </ToolLayout>
  )
}
