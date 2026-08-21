import { Link } from 'react-router-dom'
import type { WordCard } from '../types/phonetics'
import { pickPrimaryForm } from '../tools/clavier/clavierLogic'
import { assetUrl } from '../lib/assetUrl'
import { speak, speechSupported } from '../lib/speech'
import { affichageCategorie, CATEGORY_STYLES } from '../lib/grammaire'

interface WordCardViewProps {
  card: WordCard
}

export function WordCardView({ card }: WordCardViewProps) {
  const style = CATEGORY_STYLES[card.category]
  // Forme "de base" affichée dans les résultats — les autres formes (pluriel,
  // féminin, participe passé) n'apparaissent que dans la fiche mot (tuile
  // cliquable), pour ne pas surcharger la liste de résultats. Le groupe
  // verbal n'est affiché que sur la fiche mot elle-même (MotTool), pas ici.
  const primary = pickPrimaryForm(card.forms)
  // Mascotte "Verbe" générique ici (pas "infinitif", réservée à la fiche mot
  // et au conjugueur) : la carte résultat n'affiche que le mot, pas son rôle
  // grammatical précis - d'où l'absence de l'option `infinitif`.
  const { mascotte } = affichageCategorie({ word: primary.word, category: card.category })

  return (
    <div className={`relative flex items-center justify-between gap-2 rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${style}`}>
      {/* Recouvre toute la carte pour le clic "ouvrir la fiche" — le bouton
          haut-parleur et la mascotte, positionnés au-dessus (z-10), captent
          leurs propres clics avant qu'ils n'atteignent ce lien. Un <button>
          ne peut pas être imbriqué dans ce <Link> (deux éléments interactifs
          l'un dans l'autre = HTML invalide), d'où cette séparation en
          calque plutôt qu'une imbrication directe. */}
      <Link to={`/mot/${encodeURIComponent(card.lemmaId)}`} className="absolute inset-0" aria-label={primary.word} />
      <span className="min-w-0 truncate text-2xl font-medium">{primary.word}</span>
      {/* Haut-parleur juste à côté de la mascotte, à droite. */}
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        {speechSupported() && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              speak(primary.word, { category: card.category, lemmaId: card.lemmaId })
            }}
            aria-label={`Écouter « ${primary.word} »`}
            className="shrink-0 rounded-full p-1 text-xl leading-none hover:bg-black/10 active:scale-95"
          >
            🔊
          </button>
        )}
        <img src={assetUrl(mascotte)} alt="" className="h-10 w-10 shrink-0 object-contain" />
      </div>
    </div>
  )
}
