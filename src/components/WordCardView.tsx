import { Link } from 'react-router-dom'
import type { WordCard, WordCategory } from '../types/phonetics'
import { pickPrimaryForm } from '../tools/clavier/clavierLogic'
import { assetUrl } from '../lib/assetUrl'

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

export function WordCardView({ card }: WordCardViewProps) {
  const style = categoryStyles[card.category]
  // Forme "de base" affichée dans les résultats — les autres formes (pluriel,
  // féminin, participe passé) n'apparaissent que dans la fiche mot (tuile
  // cliquable), pour ne pas surcharger la liste de résultats.
  const primary = pickPrimaryForm(card.forms)

  return (
    <Link
      to={`/mot/${encodeURIComponent(card.lemmaId)}`}
      className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${style}`}
    >
      <div className="text-2xl font-medium">{primary.word}</div>
      <img src={assetUrl(CATEGORY_MASCOT[card.category])} alt="" className="h-10 w-10 shrink-0 object-contain" />
    </Link>
  )
}
