import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { chercherDefinition, type Definition } from '../../lib/definition'
import { loadWordLookup, type WordLookup } from '../../lib/wordLookup'
import type { WordCategory } from '../../types/phonetics'

const CATEGORIES_VALIDES: WordCategory[] = ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable']

// Découpe le texte en mots/séparateurs (groupe capturant = les mots
// composés compris, ex. "oiseau-mouche" reste un seul token). Deux cas
// rendent un mot cliquable vers sa propre définition ("arbre de
// définitions") :
//  - il est dans notre lexique, en dehors des mots-outils très courants
//    (voir wordLookup.ts) ;
//  - OU il est absent de notre lexique — souvent le signe d'un mot technique/
//    rare (ex. "endémique"), justement celui qu'un enfant ne connaît pas et
//    qui mérite le plus d'être expliqué. Categorie "nom" utilisée par
//    défaut pour l'URL dans ce cas : sans conséquence, chercherDefinition
//    retombe sur la recherche pleine page si la section ne correspond pas.
// Seuls les mots courts (< 4 lettres) sont exclus de ce second cas, pour
// éviter de relier des bouts de mots ou des mots-outils qu'on n'aurait pas
// reconnus.
const MOT_RE = /([a-zàâäéèêëïîôöùûüçœ]+(?:-[a-zàâäéèêëïîôöùûüçœ]+)*)/gi

function DefinitionTexteLie({ texte, motActuel, lookup }: { texte: string; motActuel: string; lookup: WordLookup }) {
  const morceaux = texte.split(MOT_RE)
  return (
    <>
      {morceaux.map((morceau, i) => {
        // Impair = capturé par MOT_RE (un mot) ; pair = séparateur (ponctuation, espace).
        if (i % 2 !== 1) return <span key={i}>{morceau}</span>
        const cle = morceau.toLowerCase()
        if (cle === motActuel.toLowerCase()) return <span key={i}>{morceau}</span>

        const categorieConnue = lookup.linkable.get(cle)
        const categorie = categorieConnue ?? (morceau.length >= 4 && !lookup.connu.has(cle) ? 'nom' : null)
        if (!categorie) return <span key={i}>{morceau}</span>

        return (
          <Link
            key={i}
            to={`/definition/${categorie}/${encodeURIComponent(morceau)}`}
            className={
              categorieConnue
                ? 'text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800'
                : 'text-brand-700 underline decoration-dotted decoration-brand-300 underline-offset-2 hover:text-brand-800'
            }
          >
            {morceau}
          </Link>
        )
      })}
    </>
  )
}

export function DefinitionTool() {
  const { categorie, mot } = useParams<{ categorie: string; mot: string }>()
  // undefined = recherche en cours, null = aucune définition trouvée.
  const [definition, setDefinition] = useState<Definition | null | undefined>(undefined)
  const [lookup, setLookup] = useState<WordLookup | null>(null)

  const categorieValide = CATEGORIES_VALIDES.includes(categorie as WordCategory)
    ? (categorie as WordCategory)
    : null

  useEffect(() => {
    if (!mot || !categorieValide) return
    let annule = false
    setDefinition(undefined)
    chercherDefinition(mot, categorieValide).then((d) => {
      if (!annule) setDefinition(d)
    })
    return () => {
      annule = true
    }
  }, [mot, categorieValide])

  useEffect(() => {
    let annule = false
    loadWordLookup().then((m) => {
      if (!annule) setLookup(m)
    })
    return () => {
      annule = true
    }
  }, [])

  if (!mot || !categorieValide) {
    return (
      <ToolLayout title="Définition" description="" showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Mot introuvable.</p>
      </ToolLayout>
    )
  }

  return (
    <ToolLayout title={mot} description="Définition" showBackToKeyboard>
      {definition === undefined ? (
        <p className="py-10 text-center text-gray-400">Recherche de la définition…</p>
      ) : definition === null ? (
        <div className="rounded-2xl border-2 border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-gray-500">Pas de définition disponible pour ce mot.</p>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
          <p className="text-xl text-gray-800">
            {lookup ? (
              <DefinitionTexteLie texte={definition.texte} motActuel={mot} lookup={lookup} />
            ) : (
              definition.texte
            )}
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Source : {definition.source === 'Vikidia' ? "Vikidia, l'encyclopédie des 8-13 ans" : 'Wiktionnaire'}
          </p>
        </div>
      )}
    </ToolLayout>
  )
}
