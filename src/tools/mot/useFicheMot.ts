import { useEffect, useMemo, useState } from 'react'
import { loadWordIndex } from '../../lib/wordIndex'
import { loadWordSynonyms, loadWordAntonyms } from '../../lib/wordSynonyms'
import { loadWordFamilies } from '../../lib/wordFamilies'
import { pickPrimaryForm } from '../clavier/clavierLogic'
import { verbGroup } from '../conjugueur/conjugueurLogic'
import { loadConjugations } from '../../lib/conjugations'
import { chercherDefinition, type Definition } from '../../lib/definition'
import type { WordEntry } from '../../types/phonetics'

export interface DonneesFicheMot {
  primary: WordEntry | undefined
  groupe: string | null
  definition: Definition | null | undefined
  synonyme: string | null
  contraire: string | null
  famille: string | null
}

/**
 * Regroupe tout ce qu'il faut pour une fiche mot imprimable (mot, groupe/
 * genre, définition, synonyme, contraire, mot de la même famille) - utilisé
 * à la fois par la fiche d'un seul mot (FicheImprimable.tsx) et par le
 * composeur de plusieurs fiches (FichesMultiples.tsx), pour ne pas dupliquer
 * ce chargement en deux endroits.
 */
export function useFicheMot(lemmaId: string | undefined): DonneesFicheMot {
  const [forms, setForms] = useState<WordEntry[] | null>(null)
  const [groupe, setGroupe] = useState<string | null>(null)
  const [definition, setDefinition] = useState<Definition | null | undefined>(undefined)
  const [synonyme, setSynonyme] = useState<string | null>(null)
  const [contraire, setContraire] = useState<string | null>(null)
  const [famille, setFamille] = useState<string | null>(null)

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
    if (!lemmaId || !primary) return
    let annule = false
    Promise.all([loadWordSynonyms(), loadWordAntonyms(), loadWordFamilies()]).then(([syn, anto, fam]) => {
      if (annule) return
      setSynonyme(syn[lemmaId]?.[0]?.word ?? null)
      setContraire(anto[lemmaId]?.[0]?.word ?? null)
      // Démonette classe parfois un homographe de catégorie différente comme
      // "même famille" (ex. "chien" nom / "chien" adjectif rare, "être
      // chien" = être avare) - correct linguistiquement, mais afficher "même
      // famille : chien" sur la fiche de "chien" n'apporte rien à un enfant.
      const membres = (fam[lemmaId] ?? []).filter((m) => m.word.toLowerCase() !== primary.word.toLowerCase())
      setFamille((membres.find((m) => m.inLexicon) ?? membres[0])?.word ?? null)
    })
    return () => {
      annule = true
    }
  }, [lemmaId, primary])

  return { primary, groupe, definition, synonyme, contraire, famille }
}
