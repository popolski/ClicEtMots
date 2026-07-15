import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { loadWordIndex } from '../../lib/wordIndex'
import { loadWordFamilies } from '../../lib/wordFamilies'
import { loadWordSynonyms, loadWordAntonyms } from '../../lib/wordSynonyms'
import { pickPrimaryForm } from '../clavier/clavierLogic'
import type {
  WordCategory,
  WordEntry,
  WordFamilyMember,
  WordFormRole,
  WordRelationMember,
} from '../../types/phonetics'

const CATEGORY_LABEL: Record<WordCategory, string> = {
  nom: 'Nom',
  adjectif: 'Adjectif',
  verbe: 'Verbe',
  invariable: 'Mot invariable',
  adverbe: 'Adverbe',
}

const categoryStyles: Record<WordCategory, string> = {
  nom: 'bg-blue-50 text-blue-900 border-blue-200',
  adjectif: 'bg-violet-50 text-violet-900 border-violet-200',
  verbe: 'bg-red-200 text-red-900 border-red-400',
  invariable: 'bg-red-50 text-red-500 border-red-100',
  adverbe: 'bg-orange-50 text-orange-900 border-orange-200',
}

const FORM_ROLE_LABEL: Partial<Record<WordFormRole, string>> = {
  singulier: 'Singulier',
  pluriel: 'Pluriel',
  masculin: 'Masculin',
  féminin: 'Féminin',
  participe_passé: 'Participe passé',
}

// il_elle_on/ils_elles existent dans les données mais sont déjà couverts par
// le conjugueur (les 9 personnes) — pas la peine de les redupliquer ici.
const ROLES_HIDDEN_FROM_FICHE: WordFormRole[] = ['il_elle_on', 'ils_elles']

// Pour un nom, formRole ne porte que le nombre (singulier/pluriel) — le genre
// (chat/chatte, renard/renarde) est un champ séparé (WordEntry.genre). Cette
// fonction combine les deux, mais seulement quand le lemme a VRAIMENT les
// deux genres (chat/chatte) : un nom comme "maison" (féminin seul, pas de
// variante masculine) ne doit pas afficher "Féminin pluriel" pour "maisons",
// juste "Pluriel" — le genre n'est pertinent que par contraste.
function formLabel(f: WordEntry, hasBothGenders: boolean): string {
  if (f.category === 'nom' && f.genre === 'f' && hasBothGenders) {
    return f.formRole === 'pluriel' ? 'Féminin pluriel' : 'Féminin'
  }
  return FORM_ROLE_LABEL[f.formRole] ?? f.formRole
}

function WordChip({ member }: { member: WordRelationMember }) {
  return (
    <Link
      to={`/mot/${encodeURIComponent(member.lemmaId)}`}
      className={`rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${categoryStyles[member.category]}`}
    >
      <div className="text-xs opacity-70">{CATEGORY_LABEL[member.category]}</div>
      <div className="text-xl font-medium">{member.word}</div>
    </Link>
  )
}

export function MotTool() {
  const { lemmaId } = useParams<{ lemmaId: string }>()
  const [forms, setForms] = useState<WordEntry[] | null>(null)
  const [family, setFamily] = useState<WordFamilyMember[] | null>(null)
  const [synonyms, setSynonyms] = useState<WordRelationMember[] | null>(null)
  const [antonyms, setAntonyms] = useState<WordRelationMember[] | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadWordIndex(), loadWordFamilies(), loadWordSynonyms(), loadWordAntonyms()]).then(
      ([index, families, syn, anto]) => {
        if (cancelled) return
        setForms(index.filter((e) => e.lemmaId === lemmaId))
        setFamily(families[lemmaId ?? ''] ?? [])
        setSynonyms(syn[lemmaId ?? ''] ?? [])
        setAntonyms(anto[lemmaId ?? ''] ?? [])
      },
    )
    return () => {
      cancelled = true
    }
  }, [lemmaId])

  if (!forms || !family || !synonyms || !antonyms) {
    return (
      <ToolLayout title="Fiche mot" description="Chargement…" showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Chargement…</p>
      </ToolLayout>
    )
  }

  const primary = forms.length > 0 ? pickPrimaryForm(forms) : undefined
  if (!primary) {
    return (
      <ToolLayout title="Fiche mot" description="Mot introuvable" showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Aucune fiche pour « {lemmaId} ».</p>
      </ToolLayout>
    )
  }

  const otherForms = forms.filter((f) => f !== primary && !ROLES_HIDDEN_FROM_FICHE.includes(f.formRole))
  const hasBothGenders = forms.some((f) => f.genre === 'm') && forms.some((f) => f.genre === 'f')
  const style = categoryStyles[primary.category]

  return (
    <ToolLayout title={primary.word} description={CATEGORY_LABEL[primary.category]} showBackToKeyboard>
      {otherForms.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">Autres formes</h2>
          <div className="flex flex-wrap gap-3">
            {otherForms.map((f) => (
              <div key={f.word} className={`rounded-lg border px-4 py-2 ${style}`}>
                <div className="text-xs opacity-70">{formLabel(f, hasBothGenders)}</div>
                <div className="text-xl font-medium">{f.word}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {primary.category === 'verbe' && (
        <div className="mb-8">
          <Link
            to={`/conjugueur/${encodeURIComponent(primary.word)}`}
            className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Voir la conjugaison
          </Link>
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
          Mots de la même famille
        </h2>
        {family.length === 0 ? (
          <p className="text-gray-400">Aucun mot de la même famille trouvé dans notre lexique.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {family.map((member) =>
              member.inLexicon ? (
                <WordChip key={member.lemmaId} member={member} />
              ) : (
                // Mot scolaire (Manulex) mais sous le seuil de fréquence du
                // lexique principal : pas de fiche à ouvrir, affiché quand
                // même à titre indicatif (ex. "maisonnette").
                <div key={member.lemmaId} className={`rounded-lg border px-4 py-2 opacity-70 ${categoryStyles[member.category]}`}>
                  <div className="text-xs opacity-70">{CATEGORY_LABEL[member.category]}</div>
                  <div className="text-xl font-medium">{member.word}</div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {synonyms.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">Synonymes</h2>
          <div className="flex flex-wrap gap-3">
            {synonyms.map((member) => (
              <WordChip key={member.lemmaId} member={member} />
            ))}
          </div>
        </div>
      )}

      {antonyms.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">Contraires</h2>
          <div className="flex flex-wrap gap-3">
            {antonyms.map((member) => (
              <WordChip key={member.lemmaId} member={member} />
            ))}
          </div>
        </div>
      )}
    </ToolLayout>
  )
}
