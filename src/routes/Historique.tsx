import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ToolLayout } from '../components/ToolLayout'
import { assetUrl } from '../lib/assetUrl'
import { api } from '../lib/api'
import type { EntreeHistorique } from '../lib/api'
import { affichageCategorie, CATEGORY_STYLES } from '../lib/grammaire'

export function Historique() {
  // null = pas encore chargé.
  const [entrees, setEntrees] = useState<EntreeHistorique[] | null>(null)

  useEffect(() => {
    api
      .lireHistorique()
      .then((r) => setEntrees(Array.isArray(r.entrees) ? r.entrees : []))
      .catch(() => setEntrees([]))
  }, [])

  return (
    <ToolLayout
      title="Mots récents"
      description="Les derniers mots que tu as consultés."
      showBackToKeyboard
    >
      {entrees === null ? (
        <p className="py-10 text-center text-gray-400">Chargement…</p>
      ) : entrees.length === 0 ? (
        <p className="py-10 text-center text-gray-400">Aucun mot consulté pour l'instant.</p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            {entrees.map((entree) => {
              const { libelle, mascotte } = affichageCategorie(entree)
              return (
                <Link
                  key={entree.lemmaId}
                  to={`/mot/${encodeURIComponent(entree.lemmaId)}`}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${CATEGORY_STYLES[entree.category]}`}
                >
                  <img src={assetUrl(mascotte)} alt="" className="h-8 w-8 object-contain" />
                  <div>
                    <div className="text-xs opacity-70">{libelle}</div>
                    <div className="text-xl font-medium">{entree.word}</div>
                  </div>
                </Link>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              api.viderHistorique().catch(() => {})
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
