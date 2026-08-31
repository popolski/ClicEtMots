import { useLocation, Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { assetUrl } from '../lib/assetUrl'
import { useAuth } from '../lib/authContext'
import { RechercheMotDirecte } from './RechercheMotDirecte'

interface ToolLayoutProps {
  title: string
  description: string
  children: ReactNode
  /* Le retour au clavier n'est plus une option : depuis le 31/08/2026 il est
     dans le bandeau sur toutes les pages sauf le clavier lui-même. La propriété
     showBackToKeyboard, qui l'ajoutait au cas par cas, a donc disparu. */
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
  hideBackButton,
  onBack,
  titleIcon,
  titleAfter,
  titleBelow,
}: ToolLayoutProps) {
  const { pathname } = useLocation()
  const { session } = useAuth()
  return (
    // Gabarit repris de Fast Eval, qui sert de reference de design aux trois
    // sites. .gx-page pose la meme largeur (1068 px) et le meme retrait haut
    // (32 px) : le bandeau est donc aligne en haut, comme chez lui.
    <div className="gx-typo gx-app-clicetmots gx-page">
      <header className="gx-entete">
        <Link to="/clavier">
          <img className="gx-entete-logo" src={assetUrl('/logo.png')} alt="Clic &amp; Mots" />
        </Link>
        <a href="/portail/" className="gx-entete-portail">← Portail</a>
        {/* Demande de Hugues : un retour direct au clavier depuis n'importe
            quelle page. Inutile sur le clavier lui-meme. */}
        {pathname !== '/clavier' && (
          <Link to="/clavier" className="gx-entete-portail">← Retour au clavier</Link>
        )}
        {/* Le « Retour » generique faisait doublon avec « Retour au clavier » et
            poussait « Espace enseignant » a la ligne. Il ne reste que la ou une
            page a sa propre navigation interne (le quiz, entre ses etapes) : la,
            remonter d'un cran n'est pas la meme chose que revenir au clavier. */}
        {onBack && !hideBackButton && (
          <button type="button" className="gx-entete-portail" onClick={onBack}>
            ← Retour
          </button>
        )}
        {(session?.role === 'teacher' || (session?.role === 'student' && session.rechercheDirecte)) && (
          <RechercheMotDirecte />
        )}
        {/* Sous le nom, le role plutot que le nom du site : celui-ci est deja dit
            par le logo a gauche et par le lisere colore. Meme regle que sur Fast
            Eval et School Monsters, ou elle vit dans /galaxie-role.php.
            Clic & Mots ne distingue pas l'administratrice de l'enseignante : le
            jeton signe du portail ne transporte pas est_admin, et l'espace
            enseignant est le meme pour Camille et pour Marion. */}
        {session?.authenticated && (
          <span className="gx-entete-identite">
            <strong>{session.label}</strong>
            {session.role === 'teacher'
              ? <span className="gx-entete-role">Compte enseignant</span>
              : <span>Clic &amp; Mots</span>}
          </span>
        )}
        {/* Tout a droite, a la place de l'ancien bouton de deconnexion : on se
            deconnecte depuis le portail, qui detient la session des trois sites. */}
        {session?.role === 'teacher' && (
          <Link to="/enseignant" className="gx-entete-portail">Espace enseignant</Link>
        )}
      </header>
      <div className="gx-cartouche">
        <div className="flex items-center justify-center gap-3">
          {titleIcon}
          <h1>{title}</h1>
          {titleAfter}
        </div>
        {titleBelow}
        <p>{description}</p>
      </div>
      {children}
    </div>
  )
}
