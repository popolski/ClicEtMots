import type { Phoneme, PhonemeId } from '../types/phonetics'

interface SequenceBarProps {
  sequence: PhonemeId[]
  phonemesById: Map<PhonemeId, Phoneme>
  onBackspace: () => void
  onClear: () => void
}

export function SequenceBar({ sequence, phonemesById, onBackspace, onClear }: SequenceBarProps) {
  return (
    <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-xl bg-white p-4 shadow-sm">
      {sequence.length === 0 && (
        <span className="text-gray-400">Clique les sons du mot que tu cherches…</span>
      )}
      {sequence.map((id, index) => (
        <span
          key={index}
          className="rounded-lg bg-brand-100 px-3 py-1 text-lg font-semibold text-brand-700"
        >
          {phonemesById.get(id)?.displaySymbol ?? id}
        </span>
      ))}
      {sequence.length > 0 && (
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onBackspace}
            className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            ⌫
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
          >
            Effacer
          </button>
        </div>
      )}
    </div>
  )
}
