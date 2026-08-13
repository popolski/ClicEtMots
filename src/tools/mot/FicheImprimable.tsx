import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { loadWordIndex } from '../../lib/wordIndex'
import { loadWordSynonyms, loadWordAntonyms } from '../../lib/wordSynonyms'
import { pickPrimaryForm } from '../clavier/clavierLogic'
import { verbGroup } from '../conjugueur/conjugueurLogic'
import { loadConjugations } from '../../lib/conjugations'
import { chercherDefinition, type Definition } from '../../lib/definition'
import { assetUrl } from '../../lib/assetUrl'
import wordPictos from '../../data/word-pictos.json'
import type { WordCategory, WordEntry } from '../../types/phonetics'

// Mêmes libellés/mascottes que la fiche mot (MotTool.tsx) - petite
// duplication assumée, comme ailleurs dans le projet (Historique.tsx, QuizTool.tsx).
const CATEGORY_LABEL: Record<WordCategory, string> = {
  nom: 'Nom',
  adjectif: 'Adjectif',
  verbe: 'Verbe',
  invariable: 'Mot invariable',
  adverbe: 'Adverbe',
}
const CATEGORY_MASCOT: Record<WordCategory, string> = {
  nom: '/mascottes/nom.png',
  adjectif: '/mascottes/adjectif.png',
  verbe: '/mascottes/verbe-infinitif.png',
  invariable: '/mascottes/invariable.png',
  adverbe: '/mascottes/adverbe.png',
}

/**
 * Fiche compacte en forme de bandeau, pensée pour être découpée et collée
 * dans le cahier d'un élève (pas une page A4 pleine) : mot, catégorie,
 * groupe/genre, pictos, définition et un synonyme/contraire - l'essentiel
 * d'une fiche mot, en un format papier réduit. Route séparée de MotTool (pas
 * de ToolLayout : le bandeau du site n'a pas sa place sur une fiche destinée
 * à être imprimée puis découpée).
 */
export function FicheImprimable() {
  const { lemmaId } = useParams<{ lemmaId: string }>()
  const [forms, setForms] = useState<WordEntry[] | null>(null)
  const [groupe, setGroupe] = useState<string | null>(null)
  // undefined = recherche en cours, null = aucune définition trouvée.
  const [definition, setDefinition] = useState<Definition | null | undefined>(undefined)
  const [synonyme, setSynonyme] = useState<string | null>(null)
  const [contraire, setContraire] = useState<string | null>(null)

  useEffect(() => {
    let annule = false
    loadWordIndex().then((index) => {
      if (!annule) setForms(index.filter((e) => e.lemmaId === lemmaId))
    })
    return () => {
      annule = true
    }
  }, [lemmaId])

  const primary = useMemo(() => (forms && forms.length > 0 ? pickPrimaryForm(forms) : undefined), [forms])

  useEffect(() => {
    if (primary?.category !== 'verbe') {
      setGroupe(null)
      return
    }
    let annule = false
    loadConjugations().then((index) => {
      if (annule) return
      const table = index[primary.word]
      const g = verbGroup(primary.word, table?.present)
      setGroupe(g === '1er' ? '1er groupe' : g === '2e' ? '2e groupe' : '3e groupe')
    })
    return () => {
      annule = true
    }
  }, [primary])

  useEffect(() => {
    if (!primary) return
    let annule = false
    setDefinition(undefined)
    chercherDefinition(primary.word, primary.category).then((d) => {
      if (!annule) setDefinition(d)
    })
    return () => {
      annule = true
    }
  }, [primary])

  useEffect(() => {
    if (!lemmaId) return
    let annule = false
    Promise.all([loadWordSynonyms(), loadWordAntonyms()]).then(([syn, anto]) => {
      if (annule) return
      setSynonyme(syn[lemmaId]?.[0]?.word ?? null)
      setContraire(anto[lemmaId]?.[0]?.word ?? null)
    })
    return () => {
      annule = true
    }
  }, [lemmaId])

  if (!forms || !primary) {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <p className="text-center text-gray-400">Chargement…</p>
      </div>
    )
  }

  const picto = (wordPictos as Record<string, string>)[primary.word]
  const sousLigne = [
    CATEGORY_LABEL[primary.category],
    groupe,
    primary.category === 'nom' && primary.genre ? (primary.genre === 'm' ? 'masculin' : 'féminin') : null,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* @media print masque tout ce qui n'a pas la classe no-print, et
          détache la fiche de la mise en page écran (bordure nette, pas
          d'ombre) pour qu'elle imprime comme un bandeau à découper, pas
          comme une page A4 pleine. */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .fiche-carte { box-shadow: none !important; margin: 0 !important; }
          @page { margin: 1cm; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <Link to={`/mot/${encodeURIComponent(lemmaId ?? '')}`} className="text-sm text-gray-500 hover:text-brand-600">
          ← Retour à la fiche
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          🖨️ Imprimer
        </button>
      </div>

      <div className="fiche-carte mx-auto flex w-full max-w-[18cm] items-center gap-4 rounded-xl border-2 border-gray-800 p-4">
        <div className="flex shrink-0 items-center gap-1">
          <img src={assetUrl(CATEGORY_MASCOT[primary.category])} alt="" className="h-16 w-16 object-contain" />
          {picto && <img src={assetUrl(picto)} alt="" className="h-16 w-16 object-contain" />}
        </div>

        <div className="shrink-0 border-r border-gray-300 pr-4">
          <p className="text-xs font-semibold tracking-wide text-gray-600 uppercase">{sousLigne}</p>
          <p className="text-3xl font-bold whitespace-nowrap text-gray-900">{primary.word}</p>
        </div>

        <div className="min-w-0 flex-1">
          {definition === undefined ? (
            <p className="text-xs text-gray-400">Recherche de la définition…</p>
          ) : definition ? (
            <p className="text-sm text-gray-800">{definition.texte}</p>
          ) : (
            <p className="text-xs text-gray-400">Pas de définition disponible pour ce mot.</p>
          )}
          {(synonyme || contraire) && (
            <p className="mt-1 text-xs text-gray-500">
              {synonyme && (
                <>
                  Synonyme : <span className="font-medium text-gray-700">{synonyme}</span>
                </>
              )}
              {synonyme && contraire && '  ·  '}
              {contraire && (
                <>
                  Contraire : <span className="font-medium text-gray-700">{contraire}</span>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
