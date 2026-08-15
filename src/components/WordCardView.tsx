import { Link } from 'react-router-dom'
import type { WordCard, WordCategory } from '../types/phonetics'
import { pickPrimaryForm } from '../tools/clavier/clavierLogic'
import { assetUrl } from '../lib/assetUrl'
import { speak, speechSupported } from '../lib/speech'
import { natureInvariable } from '../lib/natureInvariable'

interface WordCardViewProps {
  card: WordCard
}

// Couleurs choisies par l'enseignant (Feuille de route 2 consignes) : nom=bleu,
// adjectif=violet, verbe=rouge foncé, invariable=rouge clair, adverbe=orange.
const categoryStyles: Record<WordCategory, string> = {
  nom: 'bg-blue-50 text-blue-900 border-blue-200',
  adjectif: 'bg-violet-50 text-violet-900 border-violet-200',
  verbe: 'bg-red-200 text-red-900 border-red-400',
  invariable: 'bg-red-50 text-red-500 border-red-100',
  adverbe: 'bg-orange-50 text-orange-900 border-orange-200',
}

// Mêmes mascottes que sur la fiche mot (MotTool.CATEGORY_MASCOT) — reprises
// ici pour repérer la catégorie d'un coup d'œil directement dans la liste de
// résultats, sans attendre d'ouvrir la fiche.
const CATEGORY_MASCOT: Record<WordCategory, string> = {
  nom: '/mascottes/nom.png',
  adjectif: '/mascottes/adjectif.png',
  // Mascotte "Verbe" générique ici (pas "infinitif", réservée à la fiche mot
  // et au conjugueur) — la carte résultat n'affiche que le mot, pas son rôle
  // grammatical précis, donc pas de raison de préciser "à l'infinitif".
  verbe: '/mascottes/verbe.png',
  invariable: '/mascottes/invariable.png',
  adverbe: '/mascottes/adverbe.png',
}

// Contrairement à la fiche mot (qui garde "Mot invariable" EN PLUS du picto
// de nature, les deux affichés côte à côte), la carte résultat n'a la place
// que pour une seule mascotte : quand la nature précise est connue (pronom
// personnel, préposition — voir natureInvariable.ts), elle REMPLACE le
// générique "Mot invariable" plutôt que de s'y ajouter. Signalé à l'usage.
const NATURE_INVARIABLE_MASCOT = { pronom: '/mascottes/pronom.png', preposition: '/mascottes/preposition.png' } as const

export function WordCardView({ card }: WordCardViewProps) {
  const style = categoryStyles[card.category]
  // Forme "de base" affichée dans les résultats — les autres formes (pluriel,
  // féminin, participe passé) n'apparaissent que dans la fiche mot (tuile
  // cliquable), pour ne pas surcharger la liste de résultats. Le groupe
  // verbal n'est affiché que sur la fiche mot elle-même (MotTool), pas ici.
  const primary = pickPrimaryForm(card.forms)
  const nature = card.category === 'invariable' ? natureInvariable(primary.word) : null
  const mascotte = nature ? NATURE_INVARIABLE_MASCOT[nature] : CATEGORY_MASCOT[card.category]

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
