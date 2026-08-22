import { useEffect, useMemo, useState } from 'react'
import { assetUrl } from '../../lib/assetUrl'
import { speak, speechSupported } from '../../lib/speech'
import { CHOIX_MUETTE, type ExerciceGraphie } from './graphieLogic'
import type { WordCategory } from '../../types/phonetics'

interface QuestionGraphieProps {
  exercice: ExerciceGraphie
  category: WordCategory
  /** Appelé une seule fois, quand le mot est terminé. `sansErreur` = aucun mauvais clic. */
  onTermine: (sansErreur: boolean) => void
}

/**
 * Atelier "choisis la bonne graphie" : le mot est prononcé, et l'élève choisit
 * son par son comment chaque son s'écrit DANS CE MOT ([o] -> o, au, eau, ô).
 * Transforme la décomposition son-par-son de la fiche mot, qui est passive,
 * en exercice d'encodage.
 *
 * Les sons à écriture unique sont posés d'office en gris : les faire cliquer
 * ne teste rien et allonge l'exercice pour rien. Les lettres muettes internes
 * ("h" de histoire, "p" de compte) le sont aussi. La dernière étape, elle,
 * porte toujours sur la lettre muette FINALE, "rien" compris - une case
 * muette qui n'apparaîtrait que lorsqu'il y en a une trahirait la réponse.
 */
export function QuestionGraphie({ exercice, category, onTermine }: QuestionGraphieProps) {
  // Graphie choisie pour chaque son (null = pas encore répondu). Les sons
  // automatiques sont pré-remplis.
  const [reponses, setReponses] = useState<(string | null)[]>([])
  const [muette, setMuette] = useState<string | null>(null)
  const [aFaux, setAFaux] = useState(false)
  const [erreur, setErreur] = useState(false)

  useEffect(() => {
    setReponses(exercice.etapes.map((e) => (e.automatique ? e.bonne : null)))
    setMuette(null)
    setAFaux(false)
    setErreur(false)
  }, [exercice])

  // Le mot est prononcé à l'arrivée : sans ça, l'élève doit penser à cliquer
  // avant de pouvoir commencer.
  useEffect(() => {
    if (speechSupported()) speak(exercice.mot, { category, lemmaId: exercice.lemmaId })
  }, [exercice, category])

  const indexActif = reponses.findIndex((r) => r === null)
  const etapeMuette = indexActif === -1 && muette === null
  const termine = indexActif === -1 && muette !== null

  // `onTermine` ne doit partir qu'une fois, et pas pendant le rendu.
  useEffect(() => {
    if (termine) onTermine(!aFaux)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termine])

  const choixCourants = useMemo(() => {
    if (etapeMuette) return [...CHOIX_MUETTE]
    return indexActif >= 0 ? exercice.etapes[indexActif].choix : []
  }, [etapeMuette, indexActif, exercice])

  function choisir(valeur: string) {
    if (etapeMuette) {
      const attendu = exercice.muette === '' ? 'rien' : exercice.muette
      if (valeur === attendu) {
        setMuette(valeur)
        setErreur(false)
      } else {
        setAFaux(true)
        setErreur(true)
      }
      return
    }
    if (indexActif < 0) return
    if (valeur === exercice.etapes[indexActif].bonne) {
      setReponses((prec) => prec.map((r, i) => (i === indexActif ? valeur : r)))
      setErreur(false)
    } else {
      setAFaux(true)
      setErreur(true)
    }
  }

  return (
    <div className="text-center">
      <div className="mb-1 flex items-center justify-center gap-3">
        {/* Pictogramme montré UNIQUEMENT sur les homophones (faire/fer,
            les/lait/laid) : sans lui le mot n'aurait pas de réponse
            déterminable. Sur un mot non ambigu il donnerait la réponse. */}
        {exercice.picto && (
          <img
            src={assetUrl(exercice.picto)}
            alt=""
            className="h-14 w-14 rounded-lg bg-gray-100 object-contain p-1"
          />
        )}
        {speechSupported() && (
          <button
            type="button"
            onClick={() => speak(exercice.mot, { category, lemmaId: exercice.lemmaId })}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-white shadow-sm hover:bg-brand-700 active:scale-95"
          >
            🔊 Écouter le mot
          </button>
        )}
      </div>

      <div className="mb-6 flex min-h-20 flex-wrap items-end justify-center gap-2">
        {exercice.etapes.map((etape, i) => {
          const repondu = reponses[i] !== null
          const actif = i === indexActif
          return (
            <div key={i} className="flex items-end gap-2">
              {/* Muette interne (le "h" de "histoire", le "p" de "compte") :
                  posée d'office en gris, jamais demandée. Une muette finale
                  suit des règles qu'un CE1 apprend ; une muette interne ne
                  s'explique par rien, la demander serait faire deviner. Sans
                  elle, l'élève reconstituait "istoire" en ayant tout juste. */}
              {etape.muetteAvant && (
                <span className="flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-gray-400">muet</span>
                  <span className="rounded-lg bg-gray-100 px-2 py-1 text-2xl font-semibold text-gray-400">
                    {etape.muetteAvant}
                  </span>
                </span>
              )}
              <span className="flex flex-col items-center gap-1">
              <span className={`text-xs font-medium ${actif ? 'text-brand-600' : 'text-gray-400'}`}>
                [{etape.symbole}]
              </span>
              {repondu ? (
                <span
                  className={`rounded-lg px-3 py-1 text-2xl font-semibold ${
                    etape.automatique ? 'bg-gray-200 text-gray-500' : 'bg-green-200 text-green-900'
                  }`}
                >
                  {reponses[i]}
                </span>
              ) : (
                <span
                  className={`border-b-4 border-dashed px-4 py-1 text-2xl font-semibold ${
                    actif ? 'border-brand-500 text-brand-600' : 'border-gray-200 text-gray-200'
                  }`}
                >
                  ?
                </span>
              )}
              </span>
            </div>
          )
        })}

        {/* Case muette toujours présente, même quand la réponse est "rien" :
            ne l'afficher que sur les mots qui en ont une trahirait la réponse. */}
        <div className="flex flex-col items-center gap-1">
          <span className={`text-xs font-medium ${etapeMuette ? 'text-orange-500' : 'text-gray-400'}`}>muet ?</span>
          {muette !== null ? (
            muette === 'rien' ? (
              <span className="px-3 py-1 text-2xl font-semibold text-gray-300">–</span>
            ) : (
              <span className="rounded-lg bg-orange-100 px-3 py-1 text-2xl font-semibold text-orange-900">{muette}</span>
            )
          ) : (
            <span
              className={`border-b-4 border-dashed px-4 py-1 text-2xl font-semibold ${
                etapeMuette ? 'border-orange-400 text-orange-500' : 'border-gray-200 text-gray-200'
              }`}
            >
              ?
            </span>
          )}
        </div>
      </div>

      {termine ? (
        <p className="text-lg font-semibold text-green-600">
          Bravo, tu as écrit {exercice.mot} !
        </p>
      ) : (
        <>
          <p className="mb-3 text-gray-500">
            {etapeMuette
              ? "Y a-t-il une lettre qu'on n'entend pas à la fin ?"
              : `Comment s'écrit le son [${exercice.etapes[indexActif]?.symbole}] dans ce mot ?`}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {choixCourants.map((choix) => (
              <button
                key={choix}
                type="button"
                onClick={() => choisir(choix)}
                className="rounded-lg border-2 border-gray-200 px-4 py-2 text-xl font-medium hover:bg-gray-50"
              >
                {choix}
              </button>
            ))}
          </div>
          <p className="mt-3 min-h-5 text-sm text-red-600">{erreur ? 'Pas celui-là, réessaie' : ''}</p>
        </>
      )}
    </div>
  )
}
