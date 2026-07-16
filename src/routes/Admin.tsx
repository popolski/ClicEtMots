import { useEffect, useState } from 'react'
import { ToolLayout } from '../components/ToolLayout'
import { api } from '../lib/api'
import type { LexiconWord, Student } from '../lib/api'
import { phonemes } from '../lib/phonemes'
import { RelationsEditor } from './RelationsEditor'

type Categorie = LexiconWord['categorie']

const CATEGORIES: { value: Categorie; label: string }[] = [
  { value: 'nom', label: 'Nom' },
  { value: 'adjectif', label: 'Adjectif' },
  { value: 'verbe', label: 'Verbe' },
  { value: 'adverbe', label: 'Adverbe' },
  { value: 'invariable', label: 'Mot invariable' },
]

function SectionEleves() {
  const [students, setStudents] = useState<Student[] | null>(null)
  const [prenom, setPrenom] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    api
      .listStudents()
      .then((r) => setStudents(r.students))
      .catch(() => setStudents([]))
  }, [])

  async function ajouter(event: React.FormEvent) {
    event.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await api.createStudent(prenom.trim(), motDePasse)
      const r = await api.listStudents()
      setStudents(r.students)
      setPrenom('')
      setMotDePasse('')
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setEnCours(false)
    }
  }

  async function supprimer(student: Student) {
    if (!confirm(`Supprimer le compte de ${student.prenom} ? Cette action est définitive.`)) return
    await api.deleteStudent(student.id)
    const r = await api.listStudents()
    setStudents(r.students)
  }

  return (
    <section className="mb-10 rounded-2xl border-2 border-gray-200 bg-gray-50 p-5">
      <h2 className="mb-4 text-xl font-bold text-gray-800">Les élèves</h2>

      <form onSubmit={ajouter} className="mb-6 flex flex-wrap items-end gap-3">
        <label className="flex-1">
          <span className="text-sm font-semibold text-gray-700">Prénom</span>
          <input
            type="text"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="flex-1">
          <span className="text-sm font-semibold text-gray-700">Mot de passe (4 caractères min.)</span>
          <input
            type="text"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            required
            minLength={4}
            className="mt-1 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={enCours}
          className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {erreur && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

      {students === null ? (
        <p className="text-gray-400">Chargement…</p>
      ) : students.length === 0 ? (
        <p className="text-gray-400">Aucun élève pour l'instant.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {students.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2"
            >
              <span className="text-lg font-medium text-blue-900">{s.prenom}</span>
              <button
                type="button"
                onClick={() => supprimer(s)}
                aria-label={`Supprimer ${s.prenom}`}
                className="text-sm text-gray-400 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Le mot de passe n'est visible qu'au moment où vous le choisissez : il est ensuite chiffré et ne peut plus
        être relu, seulement remplacé en recréant le compte.
      </p>
    </section>
  )
}

/** Mini-clavier phonétique réutilisé pour saisir la séquence d'un mot (ou de sa forme féminine). */
function SequencePicker({
  label,
  sequence,
  onChange,
}: {
  label: string
  sequence: string[]
  onChange: (updater: (s: string[]) => string[]) => void
}) {
  return (
    <div>
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <div className="mt-1 flex min-h-12 flex-wrap items-center gap-2 rounded-lg border-2 border-gray-200 bg-white p-2">
        {sequence.length === 0 ? (
          <span className="px-2 text-gray-400">Clique les sons ci-dessous…</span>
        ) : (
          sequence.map((id, i) => (
            <span key={`${id}-${i}`} className="rounded-lg bg-brand-100 px-3 py-1 font-semibold text-brand-700">
              {phonemes.find((p) => p.id === id)?.displaySymbol ?? id}
            </span>
          ))
        )}
        {sequence.length > 0 && (
          <button
            type="button"
            onClick={() => onChange((s) => s.slice(0, -1))}
            className="ml-auto rounded-lg px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            ⌫ Effacer
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {phonemes.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange((s) => [...s, p.id])}
            className="rounded-lg border-2 border-brand-200 bg-white px-3 py-1 font-semibold text-gray-900 hover:border-brand-500 hover:bg-brand-50"
          >
            {p.displaySymbol}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionMots() {
  const [words, setWords] = useState<LexiconWord[] | null>(null)
  const [mot, setMot] = useState('')
  const [categorie, setCategorie] = useState<Categorie>('nom')
  const [genre, setGenre] = useState<'m' | 'f' | ''>('')
  const [sequence, setSequence] = useState<string[]>([])
  const [femininMot, setFemininMot] = useState('')
  const [femininSequence, setFemininSequence] = useState<string[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  /** Id du mot dont le panneau de relations est déplié (un seul à la fois). */
  const [ouvert, setOuvert] = useState<number | null>(null)

  function rafraichir() {
    return api
      .listLexicon()
      .then((r) => setWords(r.words))
      .catch(() => setWords([]))
  }

  useEffect(() => {
    rafraichir()
  }, [])

  async function ajouter(event: React.FormEvent) {
    event.preventDefault()
    setErreur(null)
    if (sequence.length === 0) {
      setErreur('Clique les sons du mot sur le clavier ci-dessous.')
      return
    }
    if (categorie === 'adjectif' && femininMot.trim() !== '' && femininSequence.length === 0) {
      setErreur('Clique les sons de la forme féminine, ou laisse son nom vide pour ne pas la renseigner.')
      return
    }
    setEnCours(true)
    try {
      await api.addWord({
        mot: mot.trim(),
        categorie,
        genre: categorie === 'nom' && genre !== '' ? genre : null,
        phonemes: sequence,
        ...(categorie === 'adjectif' && femininMot.trim() !== ''
          ? { femininMot: femininMot.trim(), femininPhonemes: femininSequence }
          : {}),
      })
      await rafraichir()
      setMot('')
      setSequence([])
      setGenre('')
      setFemininMot('')
      setFemininSequence([])
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue')
    } finally {
      setEnCours(false)
    }
  }

  async function supprimer(word: LexiconWord) {
    if (!confirm(`Supprimer le mot « ${word.mot} » ?`)) return
    await api.deleteWord(word.id)
    await rafraichir()
  }

  return (
    <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
      <h2 className="mb-1 text-xl font-bold text-gray-800">Ajouter un mot au lexique</h2>
      <p className="mb-4 text-sm text-gray-600">
        Pour les mots absents du lexique automatique. Cliquez les sons du mot dans l'ordre, comme le ferait un
        élève sur le clavier.
      </p>

      <form onSubmit={ajouter}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="text-sm font-semibold text-gray-700">Le mot</span>
            <input
              type="text"
              value={mot}
              onChange={(e) => setMot(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label>
            <span className="text-sm font-semibold text-gray-700">Catégorie</span>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as Categorie)}
              className="mt-1 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {categorie === 'nom' && (
            <label>
              <span className="text-sm font-semibold text-gray-700">Genre</span>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as 'm' | 'f' | '')}
                className="mt-1 rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
              >
                <option value="">—</option>
                <option value="m">Masculin</option>
                <option value="f">Féminin</option>
              </select>
            </label>
          )}
        </div>

        <div className="mt-4">
          <SequencePicker label="Les sons du mot" sequence={sequence} onChange={setSequence} />
        </div>

        {categorie === 'adjectif' && (
          <div className="mt-4 rounded-lg border border-amber-300 bg-white/60 p-3">
            <label>
              <span className="text-sm font-semibold text-gray-700">
                Forme féminine (facultatif — laisser vide si vous préférez ne pas la renseigner)
              </span>
              <input
                type="text"
                value={femininMot}
                onChange={(e) => setFemininMot(e.target.value)}
                placeholder="ex. « grande » pour « grand »"
                className="mt-1 w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
              />
            </label>
            {femininMot.trim() !== '' && (
              <div className="mt-3">
                <SequencePicker
                  label="Les sons de la forme féminine"
                  sequence={femininSequence}
                  onChange={setFemininSequence}
                />
              </div>
            )}
          </div>
        )}

        {erreur && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}

        <button
          type="submit"
          disabled={enCours}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          Ajouter le mot
        </button>
      </form>

      <h3 className="mt-6 mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">Mots ajoutés</h3>
      {words === null ? (
        <p className="text-gray-400">Chargement…</p>
      ) : words.length === 0 ? (
        <p className="text-gray-400">Aucun mot ajouté pour l'instant.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {words.map((w) => {
            const nbRelations =
              (w.relations?.synonyme.length ?? 0) +
              (w.relations?.antonyme.length ?? 0) +
              (w.relations?.famille.length ?? 0)
            return (
              <li key={w.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-lg font-medium">{w.mot}</span>
                  <span className="text-xs text-gray-500">
                    {CATEGORIES.find((c) => c.value === w.categorie)?.label}
                  </span>
                  {w.categorie === 'adjectif' && w.feminin_mot && (
                    <span className="text-xs text-gray-500">/ {w.feminin_mot}</span>
                  )}
                  {w.categorie === 'verbe' && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        w.conjugaison ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {w.conjugaison ? '✓ conjugaison générée' : 'verbe irrégulier : pas de conjugaison'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setOuvert(ouvert === w.id ? null : w.id)}
                    className="text-sm text-brand-700 hover:underline"
                  >
                    {ouvert === w.id ? 'Fermer' : `Synonymes, contraires, famille${nbRelations ? ` (${nbRelations})` : ''}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => supprimer(w)}
                    aria-label={`Supprimer ${w.mot}`}
                    className="ml-auto text-sm text-gray-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
                {ouvert === w.id && <RelationsEditor word={w} onChange={rafraichir} />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function Admin() {
  return (
    <ToolLayout title="Espace enseignante" description="Gérer les comptes élèves et enrichir le lexique.">
      <SectionEleves />
      <SectionMots />
    </ToolLayout>
  )
}
