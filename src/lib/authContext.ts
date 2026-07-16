import { createContext, useContext } from 'react'
import type { SessionState } from './api'

export interface AuthContextValue {
  /** null tant que l'état de session n'a pas été récupéré au premier chargement. */
  session: SessionState | null
  login: (identifiant: string, motDePasse: string) => Promise<void>
  logout: () => Promise<void>
}

// Séparé de auth.tsx (le provider) : un fichier qui exporte à la fois un
// composant et des non-composants casse le fast refresh de Vite.
export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>')
  return ctx
}
