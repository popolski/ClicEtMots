import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadWordIndex } from '../lib/wordIndex'
import type { WordCategory, WordEntry } from '../types/phonetics'

const ROLE_DE_BASE: Record<WordCategory, WordEntry['formRole']> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

/**
 * Recherche directe par orthographe - réservée à l'enseignante, et aux
 * élèves que l'enseignante a autorisés au cas par cas (voir ToolLayout.tsx,
 * SectionEleves dans Admin.tsx) : contrairement au clavier phonétique (le
 * cœur pédagogique de l'outil, pensé pour retrouver l'orthographe à partir
 * des sons), une personne qui connaît déjà l'orthographe tape plus vite
 * qu'elle ne cliquerait les sons un par un.
 */
export function RechercheMotDirecte() {
  const navigate = useNavigate()
  const [wordIndex, setWordIndex] = useState<WordEntry[] | null>(null)
  const [recherche, setRecherche] = useState('')

  const terme = recherche.trim().toLowerCase()
  // Le lexique complet (~8 Mo) se charge en différé au premier focus (voir
  // wordIndex.ts) - sur une connexion lente (PC d'école), taper avant la fin
  // du chargement donnait juste un champ vide, indiscernable d'une absence
  // de résultat ("bug" signalé par l'enseignante). Ce message rend le
  // chargement visible au lieu de le laisser silencieux.
  const enChargement = terme !== '' && !wordIndex

  const suggestions = useMemo(() => {
    if (!terme || !wordIndex) return []
    return wordIndex
      .filter((e) => e.formRole === ROLE_DE_BASE[e.category] && e.word.toLowerCase().startsWith(terme))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8)
  }, [terme, wordIndex])

  function aller(entry: WordEntry) {
    setRecherche('')
    navigate(`/mot/${encodeURIComponent(entry.lemmaId)}`)
  }

  return (
    <div className="relative w-full max-w-[220px]">
      <input
        type="text"
        value={recherche}
        onFocus={() => {
          if (!wordIndex) loadWordIndex().then(setWordIndex)
        }}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="🔍 Chercher un mot…"
        className="w-full rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-brand-400 focus:outline-none"
      />
      {enChargement ? (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-400 shadow-lg">
          Chargement du lexique…
        </div>
      ) : (
        suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
            {suggestions.map((e) => (
              <button
                key={e.lemmaId}
                type="button"
                onClick={() => aller(e)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {e.word} <span className="text-xs text-gray-400">({e.category})</span>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  )
}
