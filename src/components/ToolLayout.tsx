import { useNavigate, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { assetUrl } from '../lib/assetUrl'
import { useAuth } from '../lib/authContext'

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
  /** Masque le "← Retour" habituel — sur /clavier, remonter dans l'historique ne sert à rien. */
  hideBackButton?: boolean
  /** Mascotte affichée à côté du titre (ex. fiche mot : icône de catégorie grammaticale). */
  titleIcon?: ReactNode
}

export function ToolLayout({
  title,
  description,
  children,
  showBackToKeyboard,
  hideBackButton,
  titleIcon,
}: ToolLayoutProps) {
  const navigate = useNavigate()
  const { session, logout } = useAuth()
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link to="/clavier" className="shrink-0">
          <img src={assetUrl('/logo.png')} alt="Clic &amp; Mots" className="h-8 w-auto" />
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          {!hideBackButton && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600"
            >
              ← Retour
            </button>
          )}
          {showBackToKeyboard && (
            <Link to="/clavier" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
              ⌨️ Retour au clavier
            </Link>
          )}
          {session?.role === 'teacher' && (
            <Link
              to="/enseignante"
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              👩‍🏫 Espace enseignant
            </Link>
          )}
          {session?.authenticated && (
            <button
              type="button"
              onClick={() => logout().then(() => navigate('/'))}
              className="text-sm text-gray-500 hover:text-brand-600"
            >
              Déconnexion ({session.label})
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {titleIcon}
        <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
      </div>
      <p className="mt-1 mb-8 text-gray-500">{description}</p>
      {children}
    </div>
  )
}
