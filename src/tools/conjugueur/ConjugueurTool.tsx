import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { loadConjugations, type ConjugationIndex } from '../../lib/conjugations'
import {
  styleConjugatedForms,
  pronomAffiche,
  PERSONNES_SINGULIER,
  PERSONNES_PLURIEL,
  type StyledForm,
} from './conjugueurLogic'

const TENSES: { key: 'passeCompose' | 'imparfait' | 'present' | 'futur'; label: string }[] = [
  { key: 'passeCompose', label: 'Passé composé' },
  { key: 'imparfait', label: 'Imparfait' },
  { key: 'present', label: 'Présent' },
  { key: 'futur', label: 'Futur' },
]

function PersonRow({ personne, form }: { personne: string; form: StyledForm | undefined }) {
  if (!form) return null
  const { texte, elide } = pronomAffiche(personne, form)
  return (
    <div className="flex items-baseline gap-2 text-xl">
      <span className="w-16 shrink-0 text-gray-500">{elide ? '' : texte}</span>
      <span>
        {elide && <span className="text-gray-500">{texte}</span>}
        <span className="text-gray-500">{form.prefix}</span>
        <span className="font-medium text-gray-900">{form.stem}</span>
        <span className="font-semibold text-red-700">{form.ending}</span>
      </span>
    </div>
  )
}

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

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          {PERSONNES_SINGULIER.map((personne) => (
            <PersonRow key={personne} personne={personne} form={styled[personne]} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {PERSONNES_PLURIEL.map((personne) => (
            <PersonRow key={personne} personne={personne} form={styled[personne]} />
          ))}
        </div>
      </div>
    </ToolLayout>
  )
}
