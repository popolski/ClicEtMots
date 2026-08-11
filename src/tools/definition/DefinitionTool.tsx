import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { chercherDefinition, type Definition } from '../../lib/definition'
import { loadWordLookup } from '../../lib/wordLookup'
import type { WordCategory } from '../../types/phonetics'

const CATEGORIES_VALIDES: WordCategory[] = ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable']

// Découpe le texte en mots/séparateurs (groupe capturant = les mots
// composés compris, ex. "oiseau-mouche" reste un seul token) : ceux qui
// existent dans notre lexique deviennent cliquables vers leur propre
// définition ("arbre de définitions"), pour qu'un enfant qui tombe sur un
// mot inconnu dans une définition (ex. "colibri" dans celle d'"oiseau-mouche")
// puisse cliquer dessus directement au lieu de rester bloqué.
const MOT_RE = /([a-zàâäéèêëïîôöùûüçœ]+(?:-[a-zàâäéèêëïîôöùûüçœ]+)*)/gi

function DefinitionTexteLie({ texte, motActuel, lookup }: { texte: string; motActuel: string; lookup: Map<string, WordCategory> }) {
  const morceaux = texte.split(MOT_RE)
  return (
    <>
      {morceaux.map((morceau, i) => {
        const cle = morceau.toLowerCase()
        const categorie = lookup.get(cle)
        // Impair = capturé par MOT_RE (un mot) ; pair = séparateur (ponctuation, espace).
        if (i % 2 === 1 && categorie && cle !== motActuel.toLowerCase()) {
          return (
            <Link
              key={i}
              to={`/definition/${categorie}/${encodeURIComponent(morceau)}`}
              className="text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800"
            >
              {morceau}
            </Link>
          )
        }
        return <span key={i}>{morceau}</span>
      })}
    </>
  )
}

export function DefinitionTool() {
  const { categorie, mot } = useParams<{ categorie: string; mot: string }>()
  // undefined = recherche en cours, null = aucune définition trouvée.
  const [definition, setDefinition] = useState<Definition | null | undefined>(undefined)
  const [lookup, setLookup] = useState<Map<string, WordCategory> | null>(null)

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
