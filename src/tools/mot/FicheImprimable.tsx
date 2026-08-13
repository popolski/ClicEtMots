import { Link, useParams } from 'react-router-dom'
import { useFicheMot } from './useFicheMot'
import { BandeauMot } from './BandeauMot'

/**
 * Fiche compacte en forme de bandeau, pensée pour être découpée et collée
 * dans le cahier d'un élève (pas une page A4 pleine) : mot, catégorie,
 * groupe/genre, pictos, définition, synonyme/contraire/famille - l'essentiel
 * d'une fiche mot, en un format papier réduit. Route séparée de MotTool (pas
 * de ToolLayout : le bandeau du site n'a pas sa place sur une fiche destinée
 * à être imprimée puis découpée). Pour imprimer plusieurs mots d'un coup
 * (ex. liste de la semaine), voir FichesMultiples.tsx.
 */
export function FicheImprimable() {
  const { lemmaId } = useParams<{ lemmaId: string }>()
  const donnees = useFicheMot(lemmaId)

  if (!donnees.primary) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-center text-gray-400">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* @media print masque tout ce qui n'a pas la classe no-print, et
          détache la fiche de la mise en page écran (bordure nette, pas
          d'ombre) pour qu'elle imprime comme un bandeau à découper, pas
          comme une page A4 pleine. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .fiche-carte { box-shadow: none !important; margin: 0 !important; }
          @page { margin: 1cm; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <Link to={`/mot/${encodeURIComponent(lemmaId ?? '')}`} className="text-sm text-gray-500 hover:text-brand-600">
          ← Retour à la fiche
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/fiches-imprimables" className="text-sm text-gray-500 hover:text-brand-600">
            Composer une liste de mots
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>

      <BandeauMot {...donnees} />
    </div>
  )
}
