import type { WordEntry } from '../types/phonetics'

interface WordResultsPanelProps {
  words: WordEntry[]
  hasSequence: boolean
}

export function WordResultsPanel({ words, hasSequence }: WordResultsPanelProps) {
  if (!hasSequence) {
    return <p className="mt-4 text-center text-gray-400">Les mots trouvés s'afficheront ici.</p>
  }
  if (words.length === 0) {
    return <p className="mt-4 text-center text-gray-400">Aucun mot trouvé.</p>
  }
  return (
    <ul className="mt-4 flex flex-wrap justify-center gap-3">
      {words.map((entry) => (
        <li
          key={entry.word}
          className="rounded-lg bg-white px-4 py-2 text-2xl font-medium text-gray-900 shadow-sm"
        >
          {entry.word}
        </li>
      ))}
    </ul>
  )
}
