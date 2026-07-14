import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { loadConjugations, type ConjugationIndex } from '../../lib/conjugations'
import { styleConjugatedForms, PERSONNES_ORDRE, PRONOMS } from './conjugueurLogic'

const TENSES: { key: 'passeCompose' | 'imparfait' | 'present' | 'futur'; label: string }[] = [
  { key: 'passeCompose', label: 'Passé composé' },
  { key: 'imparfait', label: 'Imparfait' },
  { key: 'present', label: 'Présent' },
  { key: 'futur', label: 'Futur' },
]

export function ConjugueurTool() {
  const { verbe } = useParams<{ verbe: string }>()
  const [index, setIndex] = useState<ConjugationIndex | null>(null)
  const [tense, setTense] = useState<(typeof TENSES)[number]['key']>('present')

  useEffect(() => {
    let cancelled = false
    loadConjugations().then((data) => {
      if (!cancelled) setIndex(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!index) {
    return (
      <ToolLayout title="Conjugueur" description="Chargement…">
        <p className="py-10 text-center text-gray-400">Chargement des conjugaisons…</p>
      </ToolLayout>
    )
  }

  const verb = verbe ? index[verbe] : undefined
  if (!verb) {
    return (
      <ToolLayout title="Conjugueur" description="Verbe introuvable">
        <p className="py-10 text-center text-gray-400">
          Aucun tableau de conjugaison pour « {verbe} ».
        </p>
      </ToolLayout>
    )
  }

  const styled = styleConjugatedForms(verb[tense])

  return (
    <ToolLayout
      title={verb.infinitif}
      description={`Verbe conjugué avec l'auxiliaire « ${verb.auxiliaire} »`}
    >
      <div className="flex flex-wrap gap-2">
        {TENSES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTense(t.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tense === t.key
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {PERSONNES_ORDRE.map((personne) => {
          const form = styled[personne]
          if (!form) return null
          return (
            <div key={personne} className="flex items-baseline gap-2 text-xl">
              <span className="w-16 shrink-0 text-gray-500">{PRONOMS[personne]}</span>
              <span>
                <span className="text-gray-500">{form.prefix}</span>
                <span className="font-medium text-gray-900">{form.stem}</span>
                <span className="font-semibold text-red-700">{form.ending}</span>
              </span>
            </div>
          )
        })}
      </div>
    </ToolLayout>
  )
}
