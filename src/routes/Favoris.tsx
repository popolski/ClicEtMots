import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ToolLayout } from '../components/ToolLayout'
import { assetUrl } from '../lib/assetUrl'
import { lireFavoris, retirerFavori } from '../lib/favoris'
import type { WordCategory } from '../types/phonetics'

// Mêmes libellés/couleurs/mascottes que la fiche mot (voir MotTool.tsx) —
// petite duplication assumée, comme ailleurs dans le projet (Historique.tsx).
const CATEGORY_LABEL: Record<WordCategory, string> = {
  nom: 'Nom',
  adjectif: 'Adjectif',
  verbe: 'Verbe',
  invariable: 'Mot invariable',
  adverbe: 'Adverbe',
}

const categoryStyles: Record<WordCategory, string> = {
  nom: 'bg-blue-50 text-blue-900 border-blue-200',
  adjectif: 'bg-violet-50 text-violet-900 border-violet-200',
  verbe: 'bg-red-200 text-red-900 border-red-400',
  invariable: 'bg-red-50 text-red-500 border-red-100',
  adverbe: 'bg-orange-50 text-orange-900 border-orange-200',
}

const CATEGORY_MASCOT: Record<WordCategory, string> = {
  nom: '/mascottes/nom.png',
  adjectif: '/mascottes/adjectif.png',
  verbe: '/mascottes/verbe.png',
  invariable: '/mascottes/invariable.png',
  adverbe: '/mascottes/adverbe.png',
}

export function Favoris() {
  const [entrees, setEntrees] = useState(() => lireFavoris())

  return (
    <ToolLayout title="Mes favoris" description="Les mots que tu as choisi de retenir." showBackToKeyboard>
      {entrees.length === 0 ? (
        <p className="py-10 text-center text-gray-400">
          Aucun favori pour l'instant. Clique sur l'étoile ☆ d'une fiche mot pour l'ajouter ici.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {entrees.map((entree) => (
            <div
              key={entree.lemmaId}
              className={`relative flex items-center gap-2 rounded-lg border px-4 py-2 pr-9 shadow-sm transition hover:shadow-md ${categoryStyles[entree.category]}`}
            >
              <Link to={`/mot/${encodeURIComponent(entree.lemmaId)}`} className="flex items-center gap-2">
                <img src={assetUrl(CATEGORY_MASCOT[entree.category])} alt="" className="h-8 w-8 object-contain" />
                <div>
                  <div className="text-xs opacity-70">{CATEGORY_LABEL[entree.category]}</div>
                  <div className="text-xl font-medium">{entree.word}</div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => {
                  retirerFavori(entree.lemmaId)
                  setEntrees((e) => e.filter((f) => f.lemmaId !== entree.lemmaId))
                }}
                aria-label={`Retirer « ${entree.word} » des favoris`}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-lg leading-none opacity-60 hover:bg-black/10 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToolLayout>
  )
}
