// Le backend PHP vit à côté du site déployé, dans /clicmots/api/ (voir
// server/README.md). En dev, vite proxie ce même chemin vers le serveur OVH
// réel (voir vite.config.ts) — donc le chemin est identique des deux côtés.
const API_BASE = '/clicmots/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    // Indispensable : sans ça le cookie de session n'est ni envoyé ni reçu.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error ?? 'Une erreur est survenue')
  }
  return data as T
}

export interface SessionState {
  authenticated: boolean
  role?: 'teacher' | 'student'
  label?: string
}

export interface Student {
  id: number
  prenom: string
  created_at: string
}

export interface LexiconWord {
  id: number
  mot: string
  categorie: 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'invariable'
  phonemes: string[]
  genre: 'm' | 'f' | null
}

export const api = {
  session: () => request<SessionState>('session.php'),

  login: (identifiant: string, motDePasse: string) =>
    request<{ role: 'teacher' | 'student'; label: string }>('login.php', {
      method: 'POST',
      body: JSON.stringify({ identifiant, motDePasse }),
    }),

  logout: () => request<{ ok: true }>('logout.php', { method: 'POST' }),

  listStudents: () => request<{ students: Student[] }>('students.php'),

  createStudent: (prenom: string, motDePasse: string) =>
    request<{ id: number; prenom: string }>('students.php', {
      method: 'POST',
      body: JSON.stringify({ prenom, motDePasse }),
    }),

  deleteStudent: (id: number) => request<{ ok: true }>(`students.php?id=${id}`, { method: 'DELETE' }),

  listLexicon: () => request<{ words: LexiconWord[] }>('lexicon.php'),

  addWord: (word: Omit<LexiconWord, 'id'>) =>
    request<{ id: number }>('lexicon.php', { method: 'POST', body: JSON.stringify(word) }),

  deleteWord: (id: number) => request<{ ok: true }>(`lexicon.php?id=${id}`, { method: 'DELETE' }),
}
