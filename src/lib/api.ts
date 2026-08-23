// Le backend PHP vit à côté du site déployé, dans /clicetmots/api/ (voir
// server/README.md). En dev, vite proxie ce même chemin vers le serveur OVH
// réel (voir vite.config.ts) — donc le chemin est identique des deux côtés.
const API_BASE = '/clicetmots/api'

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
  /** Élève uniquement - mode confort de lecture (dys) activé par l'enseignante (voir students.php). */
  confortLecture?: boolean | null
  /** Élève uniquement - filet de secours de la dictée (clavier phonétique) autorisé par l'enseignante. */
}

export interface Student {
  id: number
  prenom: string
  created_at: string
  recherche_directe: boolean
  confort_lecture: boolean
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

export interface MotRateDictee {
  lemmaId: string
  word: string
  /** Nombre de fois raté : les plus difficiles reviennent en premier. */
  ratages: number
}

export type ModeQuiz = 'qcm' | 'reconstitution' | 'grammaire' | 'dictee' | 'graphie'

export interface ResultatQuiz {
  mode: ModeQuiz
  score: number
  total: number
  /**
   * Réponses correctes obtenues DU PREMIER COUP, sur les modes qui laissent
   * plusieurs essais (dictée, recomposition) - toujours <= score. null pour
   * les séances enregistrées avant schema-v11.sql, ou si l'appelant ne l'a
   * pas envoyé.
   */
  premierCoup: number | null
  /**
   * Nombre de mots où le filet de secours de la dictée ("Je ne sais pas
   * l'écrire") a été ouvert, indépendamment de la réussite du mot ensuite.
   * Sans objet hors dictée. null pour les séances enregistrées avant
   * schema-v12.sql.
   */
  aideUtilisee: number | null
  termineLe: string
}

export interface FavoriServeur {
  lemmaId: string
  word: string
  category: 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'invariable'
  ajouteLe: string
}

export interface EntreeHistorique {
  lemmaId: string
  word: string
  category: 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'invariable'
  consulteLe: string
}

export const api = {
  session: () => request<SessionState>('session.php'),

  login: (identifiant: string, motDePasse: string) =>
    request<{
      role: 'teacher' | 'student'
      label: string
      rechercheDirecte?: boolean
      confortLecture?: boolean
    }>(
      'login.php',
      { method: 'POST', body: JSON.stringify({ identifiant, motDePasse }) },
    ),

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

  setConfortLecture: (id: number, confortLecture: boolean) =>
    request<{ ok: true }>(`students.php?id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ confortLecture }),
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

  listResultatsQuiz: () => request<{ resultats: ResultatQuiz[] }>('quiz-resultats.php'),

  ajouterResultatQuiz: (mode: ModeQuiz, score: number, total: number, premierCoup: number, aideUtilisee: number) =>
    request<{ ok: true }>('quiz-resultats.php', {
      method: 'POST',
      body: JSON.stringify({ mode, score, total, premierCoup, aideUtilisee }),
    }),

  viderResultatsQuiz: () => request<{ ok: true }>('quiz-resultats.php', { method: 'DELETE' }),

  /** Bilan d'un élève pour l'enseignante : ses résultats et ses mots les plus ratés en dictée. */
  bilanEleve: (studentId: number) =>
    request<{ resultats: ResultatQuiz[]; motsRates: MotRateDictee[] }>(`bilan-eleve.php?studentId=${studentId}`),

  /** Mots ratés en dictée, replacés en tête de la séance suivante (schema-v10.sql). */
  listMotsRatesDictee: () => request<{ mots: MotRateDictee[] }>('dictee-rates.php'),

  /** `reussi` retire le mot de la liste ; sinon il y entre ou voit son compteur monter. */
  marquerMotDictee: (lemmaId: string, word: string, reussi: boolean) =>
    request<{ ok: true }>('dictee-rates.php', {
      method: 'POST',
      body: JSON.stringify({ lemmaId, word, reussi }),
    }),

  listFavoris: () => request<{ favoris: FavoriServeur[] }>('favoris.php'),

  ajouterFavori: (entree: Omit<FavoriServeur, 'ajouteLe'>) =>
    request<{ ok: true }>('favoris.php', { method: 'POST', body: JSON.stringify(entree) }),

  retirerFavori: (lemmaId: string) =>
    request<{ ok: true }>(`favoris.php?lemmaId=${encodeURIComponent(lemmaId)}`, { method: 'DELETE' }),

  lireHistorique: () => request<{ entrees: EntreeHistorique[] }>('historique.php'),

  ajouterAuHistorique: (entree: Omit<EntreeHistorique, 'consulteLe'>) =>
    request<{ ok: true }>('historique.php', { method: 'POST', body: JSON.stringify(entree) }),

  viderHistorique: () => request<{ ok: true }>('historique.php', { method: 'DELETE' }),

  /** Réservé à l'enseignante - sans studentId, réinitialise TOUTE la classe. */
  reinitialiserDonneesEleve: (studentId?: number) =>
    request<{ ok: true }>('reset-donnees.php', { method: 'POST', body: JSON.stringify({ studentId }) }),
}
