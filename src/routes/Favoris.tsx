import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ToolLayout } from '../components/ToolLayout'
import { assetUrl } from '../lib/assetUrl'
import { api } from '../lib/api'
import type { FavoriServeur } from '../lib/api'
import { affichageCategorie, CATEGORY_STYLES } from '../lib/grammaire'

export function Favoris() {
  // null = pas encore chargé.
  const [entrees, setEntrees] = useState<FavoriServeur[] | null>(null)

  useEffect(() => {
    api
      .listFavoris()
      .then((r) => setEntrees(Array.isArray(r.favoris) ? r.favoris : []))
      .catch(() => setEntrees([]))
  }, [])

  return (
    <ToolLayout title="Mes favoris" description="Les mots que tu as choisi de retenir." showBackToKeyboard>
      {entrees === null ? (
        <p className="py-10 text-center text-gray-400">Chargement…</p>
      ) : entrees.length === 0 ? (
        <p className="py-10 text-center text-gray-400">
          Aucun favori pour l'instant. Clique sur l'étoile ☆ d'une fiche mot pour l'ajouter ici.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {entrees.map((entree) => {
            const { libelle, mascotte } = affichageCategorie(entree)
            return (
              <div
                key={entree.lemmaId}
                className={`relative flex items-center gap-2 rounded-lg border px-4 py-2 pr-9 shadow-sm transition hover:shadow-md ${CATEGORY_STYLES[entree.category]}`}
              >
                <Link to={`/mot/${encodeURIComponent(entree.lemmaId)}`} className="flex items-center gap-2">
                  <img src={assetUrl(mascotte)} alt="" className="h-8 w-8 object-contain" />
                  <div>
                    <div className="text-xs opacity-70">{libelle}</div>
                    <div className="text-xl font-medium">{entree.word}</div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    api.retirerFavori(entree.lemmaId).catch(() => {})
                    setEntrees((e) => e?.filter((f) => f.lemmaId !== entree.lemmaId) ?? null)
                  }}
                  aria-label={`Retirer « ${entree.word} » des favoris`}
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-lg leading-none opacity-60 hover:bg-black/10 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            )
          })}
        </div>
      )}
    </ToolLayout>
  )
}
