import { Link } from 'react-router-dom'
import type { WordCard, WordCategory } from '../types/phonetics'
import { pickPrimaryForm } from '../tools/clavier/clavierLogic'

interface WordCardViewProps {
  card: WordCard
}

// Couleurs choisies par l'enseignante (Feuille de route 2 consignes) : nom=bleu,
// adjectif=violet, verbe=rouge foncé, invariable=rouge clair, adverbe=orange.
const categoryStyles: Record<WordCategory, string> = {
  nom: 'bg-blue-50 text-blue-900 border-blue-200',
  adjectif: 'bg-violet-50 text-violet-900 border-violet-200',
  verbe: 'bg-red-200 text-red-900 border-red-400',
  invariable: 'bg-red-50 text-red-500 border-red-100',
  adverbe: 'bg-orange-50 text-orange-900 border-orange-200',
}

export function WordCardView({ card }: WordCardViewProps) {
  const style = categoryStyles[card.category]
  // Forme "de base" affichée dans les résultats — les autres formes (pluriel,
  // féminin, participe passé) n'apparaissent que dans la fiche mot (tuile
  // cliquable), pour ne pas surcharger la liste de résultats.
  const primary = pickPrimaryForm(card.forms)

  return (
    <Link
      to={`/mot/${encodeURIComponent(card.lemmaId)}`}
      className={`block rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${style}`}
    >
      <div className="text-2xl font-medium">{primary.word}</div>
    </Link>
  )
}
