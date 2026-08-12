import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ToolLayout } from '../components/ToolLayout'
import { assetUrl } from '../lib/assetUrl'
import { lireHistorique, viderHistorique } from '../lib/historique'
import type { WordCategory } from '../types/phonetics'

// Mêmes libellés/couleurs/mascottes que la fiche mot (voir MotTool.tsx) —
// petite duplication assumée plutôt qu'une abstraction partagée pour trois
// constantes déjà dupliquées ailleurs (voir aussi WordCardView.tsx).
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

export function Historique() {
  const [entrees, setEntrees] = useState(() => lireHistorique())

  return (
    <ToolLayout
      title="Mots récents"
      description="Les derniers mots que tu as consultés sur cet appareil."
      showBackToKeyboard
    >
      {entrees.length === 0 ? (
        <p className="py-10 text-center text-gray-400">Aucun mot consulté pour l'instant.</p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            {entrees.map((entree) => (
              <Link
                key={entree.lemmaId}
                to={`/mot/${encodeURIComponent(entree.lemmaId)}`}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${categoryStyles[entree.category]}`}
              >
                <img src={assetUrl(CATEGORY_MASCOT[entree.category])} alt="" className="h-8 w-8 object-contain" />
                <div>
                  <div className="text-xs opacity-70">{CATEGORY_LABEL[entree.category]}</div>
                  <div className="text-xl font-medium">{entree.word}</div>
                </div>
              </Link>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              viderHistorique()
              setEntrees([])
            }}
            className="text-sm text-gray-500 hover:text-brand-600"
          >
            Effacer l'historique
          </button>
        </>
      )}
    </ToolLayout>
  )
}
