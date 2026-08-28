import { useNavigate, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { assetUrl } from '../lib/assetUrl'
import { useAuth } from '../lib/authContext'
import { RechercheMotDirecte } from './RechercheMotDirecte'

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
  /**
   * Remplace la navigation par défaut du "← Retour" (navigate(-1), donc
   * l'historique du navigateur) par une action personnalisée — utile quand
   * la page a son propre état interne d'étapes (ex. QuizTool : une fois un
   * mode choisi, l'historique du navigateur ne connaît que l'entrée
   * précédant /quiz, donc "← Retour" ramènerait directement au clavier en
   * sautant l'écran de choix du mode).
   */
  onBack?: () => void
  /** Mascotte affichée à côté du titre (ex. fiche mot : icône de catégorie grammaticale). */
  titleIcon?: ReactNode
  /** Contenu affiché juste après le titre, sur la même ligne (ex. bouton haut-parleur). */
  titleAfter?: ReactNode
  /**
   * Contenu affiché juste sous le titre, aligné avec lui (pas avec titleIcon,
   * qui peut être plus large — ex. groupe verbal sous le mot de la fiche).
   */
  titleBelow?: ReactNode
}

export function ToolLayout({
  title,
  description,
  children,
  showBackToKeyboard,
  hideBackButton,
  onBack,
  titleIcon,
  titleAfter,
  titleBelow,
}: ToolLayoutProps) {
  const navigate = useNavigate()
  const { session, logout } = useAuth()
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* PAS de overflow-x-auto ici : ça coupe aussi le débordement vertical
          (CSS - un axe non "visible" force l'autre à "auto"), ce qui rendait
          invisible la liste déroulante de RechercheMotDirecte (positionnée
          en absolute sous la barre de recherche) sans aucune erreur console -
          signalé par l'enseignante ("la recherche ne retourne aucun mot" alors
          que les résultats étaient bien présents dans la page, juste coupés
          visuellement). shrink-0 + whitespace-nowrap suffisent à garder tout
          sur une ligne (voir commit "tout sur une seule ligne") ; le
          overflow-x-auto n'était qu'un filet de sécurité jamais nécessaire en
          pratique. */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex shrink-0 items-center gap-3">
          <Link to="/clavier">
            <img src={assetUrl('/logo.png')} alt="Clic &amp; Mots" className="h-8 w-auto" />
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-4 whitespace-nowrap">
          {/* Enseignante : toujours. Élève : seulement si autorisé au cas par
              cas (voir SectionEleves dans Admin.tsx) - les autres restent
              limités au clavier phonétique. */}
          {(session?.role === 'teacher' || (session?.role === 'student' && session.rechercheDirecte)) && (
            <RechercheMotDirecte />
          )}
          {!hideBackButton && (
            <button
              type="button"
              onClick={onBack ?? (() => navigate(-1))}
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
              to="/enseignant"
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              👩‍🏫 Espace enseignant
            </Link>
          )}
          {session?.authenticated && (
            <>
              <a
                href="/portail/"
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600"
              >
                ← Portail
              </a>
              <button
                type="button"
                onClick={() => logout().then(() => navigate('/'))}
                className="text-sm text-gray-500 hover:text-brand-600"
              >
                Déconnexion ({session.label})
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {titleIcon}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold text-gray-900">{title}</h1>
            {titleAfter}
          </div>
          {titleBelow}
        </div>
      </div>
      <p className="mt-1 mb-8 text-gray-500">{description}</p>
      {children}
    </div>
  )
}
