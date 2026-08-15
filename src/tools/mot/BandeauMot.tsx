import { assetUrl } from '../../lib/assetUrl'
import wordPictos from '../../data/word-pictos.json'
import { natureInvariable } from '../../lib/natureInvariable'
import type { WordCategory } from '../../types/phonetics'
import type { DonneesFicheMot } from './useFicheMot'

// Mêmes libellés/mascottes que la fiche mot (MotTool.tsx) - petite
// duplication assumée, comme ailleurs dans le projet (Historique.tsx, QuizTool.tsx).
const CATEGORY_LABEL: Record<WordCategory, string> = {
  nom: 'Nom',
  adjectif: 'Adjectif',
  verbe: 'Verbe',
  invariable: 'Mot invariable',
  adverbe: 'Adverbe',
}
const CATEGORY_MASCOT: Record<WordCategory, string> = {
  nom: '/mascottes/nom.png',
  adjectif: '/mascottes/adjectif.png',
  verbe: '/mascottes/verbe-infinitif.png',
  invariable: '/mascottes/invariable.png',
  adverbe: '/mascottes/adverbe.png',
}

// Remplace "Mot invariable" par la nature précise quand on la connaît (même
// choix que WordCardView.tsx - voir natureInvariable.ts) : le bandeau
// imprimable n'a la place que pour une seule mascotte.
const NATURE_INVARIABLE_LABEL = { pronom: 'Pronom personnel', preposition: 'Préposition' } as const
const NATURE_INVARIABLE_MASCOT = { pronom: '/mascottes/pronom.png', preposition: '/mascottes/preposition.png' } as const

/** Le rectangle imprimable lui-même - un bandeau, pas une carte carrée (voir FicheImprimable.tsx). */
export function BandeauMot({ primary, groupe, definition, synonyme, contraire, famille }: DonneesFicheMot) {
  if (!primary) return null
  const picto = (wordPictos as Record<string, string>)[primary.word]
  const nature = primary.category === 'invariable' ? natureInvariable(primary.word) : null
  const sousLigne = [
    nature ? NATURE_INVARIABLE_LABEL[nature] : CATEGORY_LABEL[primary.category],
    groupe,
    primary.category === 'nom' && primary.genre ? (primary.genre === 'm' ? 'masculin' : 'féminin') : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="fiche-carte mx-auto flex w-full max-w-[18cm] items-center gap-4 rounded-xl border-2 border-gray-800 p-4">
      <div className="flex shrink-0 items-center gap-1">
        <img
          src={assetUrl(nature ? NATURE_INVARIABLE_MASCOT[nature] : CATEGORY_MASCOT[primary.category])}
          alt=""
          className="h-16 w-16 object-contain"
        />
        {picto && <img src={assetUrl(picto)} alt="" className="h-16 w-16 object-contain" />}
      </div>

      <div className="shrink-0 border-r border-gray-300 pr-4">
        <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">{sousLigne}</p>
        <p className="text-3xl font-bold whitespace-nowrap text-gray-900">{primary.word}</p>
      </div>

      <div className="min-w-0 flex-1">
        {definition === undefined ? (
          <p className="text-xs text-gray-400">Recherche de la définition…</p>
        ) : definition ? (
          <p className="text-sm text-gray-800">{definition.texte}</p>
        ) : (
          <p className="text-xs text-gray-400">Pas de définition disponible pour ce mot.</p>
        )}
        {(synonyme || contraire || famille) && (
          <p className="mt-1 text-xs text-gray-500">
            {famille && (
              <>
                Même famille : <span className="font-medium text-gray-700">{famille}</span>
              </>
            )}
            {famille && (synonyme || contraire) && '  ·  '}
            {synonyme && (
              <>
                Synonyme : <span className="font-medium text-gray-700">{synonyme}</span>
              </>
            )}
            {synonyme && contraire && '  ·  '}
            {contraire && (
              <>
                Contraire : <span className="font-medium text-gray-700">{contraire}</span>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
