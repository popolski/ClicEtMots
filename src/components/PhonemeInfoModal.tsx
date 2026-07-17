import type { Phoneme } from '../types/phonetics'
import { assetUrl } from '../lib/assetUrl'

interface PhonemeInfoModalProps {
  phoneme: Phoneme
  onClose: () => void
}

function playSound(soundId: string) {
  new Audio(assetUrl(`/audio/phonemes/${encodeURIComponent(soundId)}.mp3`)).play()
}

// Deux touches "doubles" fusionnent en fait 2 sons distincts, chacun avec son
// propre geste Borel-Maisonny et son propre enregistrement — un bouton
// "écouter" unique n'aurait pas de sens pour elles, il en faut un par geste
// (dans le même ordre que gestureImages). Toutes les autres touches n'ont
// qu'un seul son, dont le fichier audio est nommé d'après phoneme.id.
const SONS_TOUCHES_DOUBLES: Record<string, { soundId: string; label: string }[]> = {
  e: [
    { soundId: 'é', label: 'é (fermé)' },
    { soundId: 'è', label: 'è (ouvert)' },
  ],
  eu: [
    { soundId: 'e', label: 'e (cheval)' },
    { soundId: 'eu', label: 'eu (beurre)' },
  ],
}

export function PhonemeInfoModal({ phoneme, onClose }: PhonemeInfoModalProps) {
  const sonsMultiples = SONS_TOUCHES_DOUBLES[phoneme.id] ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold text-gray-900">{phoneme.displaySymbol}</span>
            {!sonsMultiples && (
              <button
                type="button"
                onClick={() => playSound(phoneme.id)}
                aria-label={`Écouter le son « ${phoneme.displaySymbol} »`}
                className="rounded-full p-2 text-2xl leading-none text-gray-500 hover:bg-black/10 active:scale-95"
              >
                🔊
              </button>
            )}
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

        {phoneme.gestureImages && phoneme.gestureImages.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Geste{phoneme.gestureImages.length > 1 ? 's' : ''} Borel-Maisonny
            </h3>
            <div className="mt-2 flex gap-4">
              {phoneme.gestureImages.map((src, i) => (
                <div key={src} className="flex flex-col items-center gap-1">
                  <img
                    src={assetUrl(src)}
                    alt={`Geste Borel-Maisonny — ${sonsMultiples?.[i]?.label ?? phoneme.displaySymbol}`}
                    className="h-28 w-28 rounded-xl border border-gray-100 bg-gray-50 object-contain p-1"
                  />
                  {sonsMultiples?.[i] && (
                    <button
                      type="button"
                      onClick={() => playSound(sonsMultiples[i].soundId)}
                      aria-label={`Écouter le son « ${sonsMultiples[i].label} »`}
                      className="flex items-center gap-1 rounded-full px-2 py-1 text-sm text-gray-600 hover:bg-black/10 active:scale-95"
                    >
                      🔊 {sonsMultiples[i].label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
