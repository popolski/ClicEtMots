import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { chercherDefinition, type Definition } from '../../lib/definition'
import type { WordCategory } from '../../types/phonetics'

const CATEGORIES_VALIDES: WordCategory[] = ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable']

export function DefinitionTool() {
  const { categorie, mot } = useParams<{ categorie: string; mot: string }>()
  // undefined = recherche en cours, null = aucune définition trouvée.
  const [definition, setDefinition] = useState<Definition | null | undefined>(undefined)

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
          <p className="text-xl text-gray-800">{definition.texte}</p>
          <p className="mt-4 text-xs text-gray-400">
            Source : {definition.source === 'Vikidia' ? "Vikidia, l'encyclopédie des 8-13 ans" : 'Wiktionnaire'}
          </p>
        </div>
      )}
    </ToolLayout>
  )
}
