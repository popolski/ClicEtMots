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
  /** Élève uniquement - recherche directe par orthographe autorisée par l'enseignante (voir students.php). */
  rechercheDirecte?: boolean | null
}

export interface Student {
  id: number
  prenom: string
  created_at: string
  recherche_directe: boolean
}

export type RelationType = 'synonyme' | 'antonyme' | 'famille'

export interface RelationTarget {
  lemmaId: string
  word: string
  category: 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'invariable'
}

/** Tableau de conjugaison généré côté serveur (api/conjugaison.php). */
export interface AddedConjugation {
  infinitif: string
  auxiliaire: 'avoir' | 'être'
  present: Record<string, string>
  futur: Record<string, string>
  imparfait: Record<string, string>
  passeCompose: Record<string, string>
}

export interface LexiconWord {
  id: number
  mot: string
  categorie: 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'invariable'
  phonemes: string[]
  genre: 'm' | 'f' | null
  /** null si le verbe n'est pas régulier (non générable), ou si ce n'est pas un verbe. */
  conjugaison?: AddedConjugation | null
  relations?: Record<RelationType, RelationTarget[]>
  /** Forme féminine d'un adjectif, saisie à la main — null si non renseignée. */
  feminin_mot?: string | null
  feminin_phonemes?: string[] | null
}

export interface MotDeListe {
  lemmaId: string
  word: string
  category: 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'invariable'
}

export interface ListeMotsSemaine {
  id: number
  nom: string
  mots: MotDeListe[]
  updatedAt: string
}

export const api = {
  session: () => request<SessionState>('session.php'),

  login: (identifiant: string, motDePasse: string) =>
    request<{ role: 'teacher' | 'student'; label: string; rechercheDirecte?: boolean }>('login.php', {
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

  setRechercheDirecte: (id: number, rechercheDirecte: boolean) =>
    request<{ ok: true }>(`students.php?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ rechercheDirecte }),
    }),

  deleteStudent: (id: number) => request<{ ok: true }>(`students.php?id=${id}`, { method: 'DELETE' }),

  listLexicon: () => request<{ words: LexiconWord[] }>('lexicon.php'),

  addWord: (
    word: Pick<LexiconWord, 'mot' | 'categorie' | 'phonemes' | 'genre'> & {
      femininMot?: string
      femininPhonemes?: string[]
      /** Conjugaison trouvée côté client (conjugation-fr), vérifiée visuellement avant envoi — voir Admin.tsx. */
      conjugaison?: AddedConjugation
    },
  ) =>
    request<{ id: number; conjugaisonGeneree: boolean; audioGeneree: boolean }>('lexicon.php', {
      method: 'POST',
      body: JSON.stringify(word),
    }),

  deleteWord: (id: number) => request<{ ok: true }>(`lexicon.php?id=${id}`, { method: 'DELETE' }),

  addRelation: (wordId: number, type: RelationType, target: RelationTarget) =>
    request<{ ok: true }>('relations.php', {
      method: 'POST',
      body: JSON.stringify({
        wordId,
        type,
        targetLemmaId: target.lemmaId,
        targetWord: target.word,
        targetCategory: target.category,
      }),
    }),

  deleteRelation: (wordId: number, type: RelationType, targetLemmaId: string) =>
    request<{ ok: true }>(
      `relations.php?wordId=${wordId}&type=${type}&targetLemmaId=${encodeURIComponent(targetLemmaId)}`,
      { method: 'DELETE' },
    ),

  listListesMotsSemaine: () => request<{ listes: ListeMotsSemaine[] }>('mots-semaine.php'),

  saveListeMotsSemaine: (nom: string, mots: MotDeListe[], id?: number) =>
    request<{ ok: true; id: number }>('mots-semaine.php', {
      method: 'POST',
      body: JSON.stringify({ nom, mots, id }),
    }),

  deleteListeMotsSemaine: (id: number) => request<{ ok: true }>(`mots-semaine.php?id=${id}`, { method: 'DELETE' }),
}
