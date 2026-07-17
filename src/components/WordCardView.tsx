import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { WordCard, WordCategory } from '../types/phonetics'
import { pickPrimaryForm } from '../tools/clavier/clavierLogic'
import { verbGroup } from '../tools/conjugueur/conjugueurLogic'
import { loadConjugations } from '../lib/conjugations'
import { assetUrl } from '../lib/assetUrl'
import { speak, speechSupported } from '../lib/speech'

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

/** « (1er groupe) » à côté d'un verbe dans les résultats — null tant que non déterminé/non applicable. */
function useGroupeVerbe(word: string, category: WordCategory): string | null {
  const [groupe, setGroupe] = useState<string | null>(null)
  useEffect(() => {
    if (category !== 'verbe') {
      setGroupe(null)
      return
    }
    let annule = false
    loadConjugations().then((index) => {
      if (annule) return
      const g = verbGroup(word, index[word]?.present.nous)
      setGroupe(g === '1er' ? '1er groupe' : g === '2e' ? '2e groupe' : '3e groupe')
    })
    return () => {
      annule = true
    }
  }, [word, category])
  return groupe
}

export function WordCardView({ card }: WordCardViewProps) {
  const style = categoryStyles[card.category]
  // Forme "de base" affichée dans les résultats — les autres formes (pluriel,
  // féminin, participe passé) n'apparaissent que dans la fiche mot (tuile
  // cliquable), pour ne pas surcharger la liste de résultats.
  const primary = pickPrimaryForm(card.forms)
  const groupe = useGroupeVerbe(primary.word, card.category)

  return (
    <div className={`relative flex items-center justify-between gap-2 rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${style}`}>
      {/* Recouvre toute la carte pour le clic "ouvrir la fiche" — le bouton
          haut-parleur et la mascotte, positionnés au-dessus (z-10), captent
          leurs propres clics avant qu'ils n'atteignent ce lien. Un <button>
          ne peut pas être imbriqué dans ce <Link> (deux éléments interactifs
          l'un dans l'autre = HTML invalide), d'où cette séparation en
          calque plutôt qu'une imbrication directe. */}
      <Link to={`/mot/${encodeURIComponent(card.lemmaId)}`} className="absolute inset-0" aria-label={primary.word} />
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-2xl font-medium">{primary.word}</span>
        {groupe && <span className="shrink-0 text-sm opacity-70">({groupe})</span>}
        {/* Juste à côté du mot, pas groupé avec la mascotte à droite. */}
        {speechSupported() && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              speak(primary.word)
            }}
            aria-label={`Écouter « ${primary.word} »`}
            className="relative z-10 shrink-0 rounded-full p-1 text-xl leading-none hover:bg-black/10 active:scale-95"
          >
            🔊
          </button>
        )}
      </div>
      <img
        src={assetUrl(CATEGORY_MASCOT[card.category])}
        alt=""
        className="relative z-10 h-10 w-10 shrink-0 object-contain"
      />
    </div>
  )
}
