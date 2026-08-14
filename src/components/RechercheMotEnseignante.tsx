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
 * Recherche directe par orthographe, réservée à l'enseignante (voir
 * ToolLayout.tsx - affichée seulement si session.role === 'teacher') :
 * contrairement au clavier phonétique (pensé pour l'élève qui ne sait pas
 * encore écrire le mot), une adulte qui connaît déjà l'orthographe tape
 * plus vite qu'elle ne cliquerait les sons un par un.
 */
export function RechercheMotEnseignante() {
  const navigate = useNavigate()
  const [wordIndex, setWordIndex] = useState<WordEntry[] | null>(null)
  const [recherche, setRecherche] = useState('')

  const suggestions = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    if (!terme || !wordIndex) return []
    return wordIndex
      .filter((e) => e.formRole === ROLE_DE_BASE[e.category] && e.word.toLowerCase().startsWith(terme))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8)
  }, [recherche, wordIndex])

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
      {suggestions.length > 0 && (
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
      )}
    </div>
  )
}
