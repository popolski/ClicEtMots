import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import type { SessionState } from './api'
import { AuthContext } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState | null>(null)

  // La session vit dans un cookie HttpOnly : impossible de la lire en JS, il
  // faut demander au serveur qui on est au démarrage (et après un F5).
  useEffect(() => {
    let cancelled = false
    api
      .session()
      .then((s) => {
        if (!cancelled) setSession(s)
      })
      .catch(() => {
        if (!cancelled) setSession({ authenticated: false })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (identifiant: string, motDePasse: string) => {
    const { role, label } = await api.login(identifiant, motDePasse)
    setSession({ authenticated: true, role, label })
  }, [])

  const logout = useCallback(async () => {
    await api.logout().catch(() => {}) // même si l'appel échoue, on déconnecte côté client
    setSession({ authenticated: false })
  }, [])

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
