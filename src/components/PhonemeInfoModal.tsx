import type { Phoneme } from '../types/phonetics'

interface PhonemeInfoModalProps {
  phoneme: Phoneme
  onClose: () => void
}

export function PhonemeInfoModal({ phoneme, onClose }: PhonemeInfoModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {phoneme.gestureImage && (
              <img
                src={phoneme.gestureImage}
                alt={`Geste Borel-Maisonny — ${phoneme.displaySymbol}`}
                className="h-16 w-16 object-contain"
              />
            )}
            <span className="text-4xl font-bold text-gray-900">{phoneme.displaySymbol}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Graphies possibles</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {phoneme.graphemes.map((g) => (
            <li key={g.grapheme} className="rounded-lg bg-brand-50 px-3 py-1 text-sm text-brand-700">
              <span className="font-semibold">{g.grapheme}</span>
              <span className="ml-1 text-brand-500">({g.exampleWord})</span>
            </li>
          ))}
        </ul>

        {phoneme.note && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">⚠️ {phoneme.note}</p>
        )}
      </div>
    </div>
  )
}
