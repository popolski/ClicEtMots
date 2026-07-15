import { useNavigate, Link } from 'react-router-dom'
import type { ReactNode } from 'react'

interface ToolLayoutProps {
  title: string
  description: string
  children: ReactNode
  /**
   * Ajoute un lien direct vers /clavier, à côté du "← Retour" habituel. Utile
   * sur les fiches mot/conjugueur, atteignables en plusieurs clics depuis une
   * chaîne de familles/synonymes — "Retour" ne remonte alors que d'un cran,
   * pas jusqu'au clavier.
   */
  showBackToKeyboard?: boolean
}

export function ToolLayout({ title, description, children, showBackToKeyboard }: ToolLayoutProps) {
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600"
        >
          ← Retour
        </button>
        {showBackToKeyboard && (
          <Link to="/clavier" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
            ⌨️ Retour au clavier
          </Link>
        )}
      </div>
      <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 mb-8 text-gray-500">{description}</p>
      {children}
    </div>
  )
}
