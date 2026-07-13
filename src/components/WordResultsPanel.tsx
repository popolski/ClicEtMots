import { useState } from 'react'
import type { WordCategory, WordEntry } from '../types/phonetics'

interface WordResultsPanelProps {
  words: WordEntry[]
  hasSequence: boolean
  /** Drives the page size (8 for Clavier 1, 16 for Clavier 2), matching the original tool. */
  level: 1 | 2
}

// Couleurs alignées sur la vraie page de résultats du Clavier Métalo (tuto officiel, p.6).
const categoryStyles: Record<WordCategory, string> = {
  nom: 'bg-green-50 text-green-900 border-green-200',
  adjectif: 'bg-yellow-50 text-yellow-900 border-yellow-200',
  verbe: 'bg-red-50 text-red-900 border-red-200',
  invariable: 'bg-blue-50 text-blue-900 border-blue-200',
}

export function WordResultsPanel({ words, hasSequence, level }: WordResultsPanelProps) {
  const [page, setPage] = useState(0)
  const pageSize = level === 1 ? 8 : 16
  const totalPages = Math.max(1, Math.ceil(words.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pageWords = words.slice(currentPage * pageSize, currentPage * pageSize + pageSize)

  if (!hasSequence) {
    return <p className="mt-4 text-center text-gray-400">Les mots trouvés s'afficheront ici.</p>
  }
  if (words.length === 0) {
    return <p className="mt-4 text-center text-gray-400">Aucun mot trouvé.</p>
  }

  return (
    <div className="mt-4">
      <ul className="flex flex-wrap justify-center gap-3">
        {pageWords.map((entry) => (
          <li
            key={entry.word}
            className={`rounded-lg border px-4 py-2 text-2xl font-medium shadow-sm ${categoryStyles[entry.category]}`}
          >
            {entry.word}
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-gray-500">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Précédent
          </button>
          <span>
            Page {currentPage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="rounded-lg border border-gray-200 px-3 py-1 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
