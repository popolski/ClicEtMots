import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ConfortLectureContext } from './confortLectureContext'

const CLE = 'clicmots:confort-lecture'

function lireInitial(): boolean {
  try {
    return localStorage.getItem(CLE) === '1'
  } catch {
    return false
  }
}

/**
 * Préférence purement locale (pas une donnée personnelle à centraliser comme
 * les quiz/favoris/historique - juste un réglage d'affichage) : activable
 * directement par l'élève, sans passer par l'enseignante, "dans un premier
 * temps" - signalé par l'enseignante. Applique une police plus aérée
 * (Lexend) et un espacement des lettres sur toute l'app (voir index.css,
 * classe .confort-lecture) ; les composants qui ont besoin de savoir si le
 * mode est actif (masquer une mascotte, colorer les sons) lisent le contexte.
 */
export function ConfortLectureProvider({ children }: { children: ReactNode }) {
  const [actif, setActif] = useState(lireInitial)

  const basculer = useCallback(() => {
    setActif((v) => {
      const suivant = !v
      try {
        localStorage.setItem(CLE, suivant ? '1' : '0')
      } catch {
        // localStorage indisponible : le réglage ne survit pas au rechargement, sans conséquence grave.
      }
      return suivant
    })
  }, [])

  const value = useMemo(() => ({ actif, basculer }), [actif, basculer])

  return (
    <ConfortLectureContext.Provider value={value}>
      <div className={actif ? 'confort-lecture' : undefined}>{children}</div>
    </ConfortLectureContext.Provider>
  )
}
