import { useLocation, useNavigate, Link } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { session } = useAuth()

  /* Peut-on vraiment remonter d'un cran ? React Router numérote les entrées
     qu'il a lui-même empilées dans history.state.idx. À zéro, l'élève est
     arrivé directement par l'URL ou par un favori : « Retour » le ferait
     sortir du site, ce qui n'est pas un retour. Le bouton disparaît alors,
     plutôt que de mentir. Recalculé à chaque rendu, donc à chaque navigation,
     puisque useLocation en déclenche un. */
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  const peutRemonter = Boolean(onBack) || idx > 0
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
        {/* « Retour » remonte d'UN cran, la ou « Retour au clavier » ramene au
            depart : sur la definition d'un mot, l'eleve veut revenir a la fiche
            du mot, pas au clavier. Les deux coexistent donc, demande de Hugues
            le 31/08/2026 - il avait ete restreint a tort aux seules pages ayant
            un onBack, c'est-a-dire au quiz.
            Une page qui gere ses propres etapes fournit onBack : l'historique du
            navigateur ne connait pas ces etapes-la et ferait sauter l'ecran
            intermediaire. Partout ailleurs, c'est l'historique qui fait foi. */}
        {!hideBackButton && peutRemonter && (
          <button
            type="button"
            className="gx-entete-portail"
            onClick={onBack ?? (() => navigate(-1))}
          >
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
            {session.role !== 'teacher' && <span>Clic &amp; Mots</span>}
            {/* La pastille EST le lien vers l'espace enseignant. Le bouton
                « Espace enseignant » qui l'accompagnait a ete retire : a trois
                boutons de retour, il faisait passer le bandeau sur deux lignes,
                et il disait la meme chose que la pastille juste a cote.
                Idee de Hugues, le 31/08/2026.
                Sur /enseignant meme, elle redevient un simple marqueur : un
                lien vers la page ou l'on se trouve deja ne menerait nulle part.
                Le libelle visible ne dit pas ou l'on va - d'ou aria-label, qui
                l'annonce aux lecteurs d'ecran, et title pour la souris. */}
            {session.role === 'teacher' && (
              pathname === '/enseignant'
                ? <span className="gx-entete-role">Compte enseignant</span>
                : <Link
                    to="/enseignant"
                    className="gx-entete-role"
                    title="Ouvrir l'espace enseignant"
                    aria-label="Compte enseignant - ouvrir l'espace enseignant"
                  >
                    Compte enseignant
                  </Link>
            )}
          </span>
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
