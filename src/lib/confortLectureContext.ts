import { createContext, useContext } from 'react'

export interface ConfortLectureState {
  actif: boolean
  basculer: () => void
}

export const ConfortLectureContext = createContext<ConfortLectureState>({
  actif: false,
  basculer: () => {},
})

export function useConfortLecture(): ConfortLectureState {
  return useContext(ConfortLectureContext)
}
