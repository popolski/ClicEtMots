import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ToolLayout } from '../components/ToolLayout'
import { assetUrl } from '../lib/assetUrl'
import { api } from '../lib/api'
import type { ListeMotsSemaine, MotDeListe } from '../lib/api'
import { affichageCategorie, CATEGORY_STYLES } from '../lib/grammaire'

function ChipMot({ mot }: { mot: MotDeListe }) {
  const { libelle, mascotte } = affichageCategorie(mot)
  return (
    <Link
      to={`/mot/${encodeURIComponent(mot.lemmaId)}`}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${CATEGORY_STYLES[mot.category]}`}
    >
      <img src={assetUrl(mascotte)} alt="" className="h-8 w-8 object-contain" />
      <div>
        <div className="text-xs opacity-70">{libelle}</div>
        <div className="text-xl font-medium">{mot.word}</div>
      </div>
    </Link>
  )
}

type Vue = 'alphabetique' | 'semaine'

/**
 * Consultation seule des listes de mots hebdomadaires composées par
 * l'enseignante (voir Admin.tsx SectionMotsSemaine) - un élève peut les
 * revoir à tout moment, mais pas les imprimer (ça reste une action de
 * l'enseignante, sur les listes exactes qu'elle a validées).
 */
export function MotsSemaine() {
  // undefined = chargement, null = pas de liste dispo (hors ligne, aucune liste enregistrée...).
  const [listes, setListes] = useState<ListeMotsSemaine[] | null | undefined>(undefined)
  const [vue, setVue] = useState<Vue>('semaine')

  useEffect(() => {
    api
      .listListesMotsSemaine()
      .then((r) => setListes(r.listes))
      .catch(() => setListes(null))
  }, [])

  // Une liste à plat, sans doublon (un mot peut revenir d'une semaine à
  // l'autre) - triée par ordre alphabétique en tenant compte des accents.
  const motsAlphabetique = useMemo(() => {
    if (!listes) return []
    const vus = new Map<string, MotDeListe>()
    for (const liste of listes) for (const mot of liste.mots) vus.set(mot.lemmaId, mot)
    return [...vus.values()].sort((a, b) => a.word.localeCompare(b.word, 'fr'))
  }, [listes])

  return (
    <ToolLayout title="Mots de la semaine" description="Les mots vus en classe." showBackToKeyboard>
      {listes === undefined ? (
        <p className="py-10 text-center text-gray-400">Chargement…</p>
      ) : !listes || listes.length === 0 ? (
        <p className="py-10 text-center text-gray-400">Aucune liste enregistrée par l'enseignante pour l'instant.</p>
      ) : (
        <>
          <div className="mb-6 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setVue('semaine')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                vue === 'semaine' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Semaine par semaine
            </button>
            <button
              type="button"
              onClick={() => setVue('alphabetique')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                vue === 'alphabetique' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Par ordre alphabétique
            </button>
          </div>

          {vue === 'alphabetique' ? (
            <div className="flex flex-wrap gap-3">
              {motsAlphabetique.map((mot) => (
                <ChipMot key={mot.lemmaId} mot={mot} />
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {listes.map((liste) => (
                <div key={liste.id}>
                  <h2 className="mb-1 text-lg font-bold text-gray-800">{liste.nom}</h2>
                  <p className="mb-3 text-xs text-gray-400">
                    Enregistrée le {new Date(liste.updatedAt).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {liste.mots.map((mot) => (
                      <ChipMot key={mot.lemmaId} mot={mot} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </ToolLayout>
  )
}
