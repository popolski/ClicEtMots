import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { loadConjugations, type ConjugationIndex } from '../../lib/conjugations'
import { assetUrl } from '../../lib/assetUrl'
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

// Mascotte affichée dans l'espace vide entre les colonnes singulier/pluriel,
// changeant avec l'onglet actif. Passé composé et imparfait partagent la
// même mascotte "passé" (une seule fournie pour les deux temps).
const TENSE_MASCOT: Record<(typeof TENSES)[number]['key'], string> = {
  passeCompose: '/mascottes/verbe-passe.png',
  imparfait: '/mascottes/verbe-passe.png',
  present: '/mascottes/verbe.png',
  futur: '/mascottes/verbe-futur.png',
}

function PersonRow({ personne, form }: { personne: string; form: StyledForm | undefined }) {
  if (!form) return null
  // Le pronom (« Je », « J' » élidé, « Tu »…) va toujours dans la colonne de
  // gauche, la forme conjuguée dans la colonne de droite — comme un tableau
  // de conjugaison classique. Toutes les lignes s'alignent ainsi.
  // Auxiliaire (passé composé) + terminaison en rouge, radical en noir.
  const texte = pronomAffiche(personne, form)
  return (
    <div className="flex items-baseline gap-2 text-xl">
      <span className="w-16 shrink-0 text-gray-500">{texte}</span>
      <span>
        <span className="font-semibold text-red-700">{form.redPrefix}</span>
        <span className="font-medium text-gray-900">{form.stem}</span>
        <span className="font-semibold text-red-700">{form.redEnding}</span>
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
      <ToolLayout title="Conjugueur" description="Chargement…" showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Chargement des conjugaisons…</p>
      </ToolLayout>
    )
  }

  const verb = verbe ? index[verbe] : undefined
  if (!verb) {
    return (
      <ToolLayout title="Conjugueur" description="Verbe introuvable" showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">
          Aucun tableau de conjugaison pour « {verbe} ».
        </p>
      </ToolLayout>
    )
  }

  const styled = styleConjugatedForms(tense, verb[tense])

  return (
    <ToolLayout
      title={verb.infinitif}
      description={`Verbe conjugué avec l'auxiliaire « ${verb.auxiliaire} »`}
      showBackToKeyboard
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

      <div className="mt-6 grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="flex flex-col gap-3">
          {PERSONNES_SINGULIER.map((personne) => (
            <PersonRow key={personne} personne={personne} form={styled[personne]} />
          ))}
        </div>
        {/* Comble le grand espace vide qui reste entre les deux colonnes
            (chacune n'occupe qu'une fraction de sa largeur de grille) — masqué
            sur mobile, où la place manque et les colonnes s'empilent. */}
        <div className="hidden items-center justify-center px-6 sm:flex">
          <img src={assetUrl(TENSE_MASCOT[tense])} alt="" className="h-40 w-40 object-contain" />
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
