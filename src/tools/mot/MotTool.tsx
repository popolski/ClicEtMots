import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { loadWordIndex } from '../../lib/wordIndex'
import { loadWordFamilies } from '../../lib/wordFamilies'
import { loadWordSynonyms, loadWordAntonyms } from '../../lib/wordSynonyms'
import { pickPrimaryForm } from '../clavier/clavierLogic'
import { verbGroup } from '../conjugueur/conjugueurLogic'
import { loadConjugations } from '../../lib/conjugations'
import { assetUrl } from '../../lib/assetUrl'
import { speak, speechSupported } from '../../lib/speech'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/authContext'
import { natureInvariable } from '../../lib/natureInvariable'
import {
  CATEGORY_LABEL,
  CATEGORY_MASCOT_INFINITIF,
  CATEGORY_STYLES,
  NATURE_INVARIABLE_LABEL,
  NATURE_INVARIABLE_MASCOT,
} from '../../lib/grammaire'
import { DecompositionSonGraphie } from './DecompositionSonGraphie'
import wordPictos from '../../data/word-pictos.json'
import type {
  WordCategory,
  WordEntry,
  WordFamilyMember,
  WordFormRole,
  WordRelationMember,
} from '../../types/phonetics'

// La fiche mot est le SEUL écran qui affiche la nature précise EN PLUS du
// picto "Mot invariable" (pas à sa place : "invariable" reste vrai,
// "pronom"/"préposition" est juste plus précis) - signalé par
// l'enseignante. Elle compose donc à partir des constantes du référentiel
// plutôt que d'utiliser affichageCategorie(), qui applique le choix
// "remplace" des vues compactes.
// Le titre de la fiche affiche toujours le verbe à l'infinitif : mascotte
// dédiée plutôt que le "Verbe" générique (réservé au conjugueur, onglet
// Présent — voir ConjugueurTool.TENSE_MASCOT).

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

/**
 * Groupe affiché sous le mot de la fiche, et présence d'un tableau de
 * conjugaison complet (lexique statique ET mots ajoutés partagent le même
 * index fusionné, voir loadConjugations) — un verbe à radical variable non
 * déterministe (ex. "haleter") n'a pas de tableau complet même s'il est dans
 * le lexique statique, donc pas de lien "Voir la conjugaison" pour lui non
 * plus (avant ce contrôle unifié, seuls les mots ajoutés étaient vérifiés).
 */
function useInfosVerbe(word: string, category?: WordCategory): { groupe: string | null; peutConjuguer: boolean } {
  const [groupe, setGroupe] = useState<string | null>(null)
  const [peutConjuguer, setPeutConjuguer] = useState(false)
  useEffect(() => {
    if (category !== 'verbe' || !word) {
      setGroupe(null)
      setPeutConjuguer(false)
      return
    }
    let annule = false
    loadConjugations().then((index) => {
      if (annule) return
      const table = index[word]
      setPeutConjuguer(table !== undefined)
      const g = verbGroup(word, table?.present)
      setGroupe(g === '1er' ? '1er groupe' : g === '2e' ? '2e groupe' : '3e groupe')
    })
    return () => {
      annule = true
    }
  }, [word, category])
  return { groupe, peutConjuguer }
}

function WordChip({ member }: { member: WordRelationMember }) {
  return (
    <Link
      to={`/mot/${encodeURIComponent(member.lemmaId)}`}
      className={`rounded-lg border px-4 py-2 shadow-sm transition hover:shadow-md ${CATEGORY_STYLES[member.category]}`}
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
    Promise.all([
      loadWordIndex(),
      loadWordFamilies(),
      loadWordSynonyms(),
      loadWordAntonyms(),
    ]).then(([index, families, syn, anto]) => {
      if (cancelled) return
      setForms(index.filter((e) => e.lemmaId === lemmaId))
      setFamily(families[lemmaId ?? ''] ?? [])
      setSynonyms(syn[lemmaId ?? ''] ?? [])
      setAntonyms(anto[lemmaId ?? ''] ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [lemmaId])

  const primaryMemo = useMemo(
    () => (forms && forms.length > 0 ? pickPrimaryForm(forms) : undefined),
    [forms],
  )
  const { groupe, peutConjuguer } = useInfosVerbe(primaryMemo?.word ?? '', primaryMemo?.category)
  const { session } = useAuth()
  // Historique et favoris sont désormais centralisés côté serveur, réservés
  // aux comptes élève (voir favoris.php/historique.php) - une enseignante
  // qui consulte une fiche via RechercheMotDirecte n'a ni bouton favori ni
  // suivi d'historique, ça n'aurait pas de sens sur son propre compte.
  const estEleve = session?.role === 'student'
  const [favori, setFavori] = useState(false)
  // Décidé par l'enseignante au cas par cas (voir SectionEleves dans
  // Admin.tsx), pas par l'élève lui-même - revu après un premier essai en
  // auto-activation.
  const confort = session?.role === 'student' && session.confortLecture === true

  useEffect(() => {
    if (!primaryMemo || !estEleve) return
    api
      .ajouterAuHistorique({ lemmaId: primaryMemo.lemmaId, word: primaryMemo.word, category: primaryMemo.category })
      .catch(() => {
        // Hors ligne/serveur indisponible : l'historique est un confort, pas une nécessité.
      })
    api
      .listFavoris()
      .then((r) => setFavori(Array.isArray(r.favoris) && r.favoris.some((f) => f.lemmaId === primaryMemo.lemmaId)))
      .catch(() => setFavori(false))
  }, [primaryMemo, estEleve])

  function basculerFavori() {
    if (!primaryMemo) return
    if (favori) {
      api.retirerFavori(primaryMemo.lemmaId).catch(() => {})
    } else {
      api
        .ajouterFavori({ lemmaId: primaryMemo.lemmaId, word: primaryMemo.word, category: primaryMemo.category })
        .catch(() => {})
    }
    setFavori(!favori)
  }

  if (!forms || !family || !synonyms || !antonyms) {
    return (
      <ToolLayout title="Fiche mot" description="Chargement…" showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Chargement…</p>
      </ToolLayout>
    )
  }

  const primary = primaryMemo
  if (!primary) {
    return (
      <ToolLayout title="Fiche mot" description="Mot introuvable" showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Aucune fiche pour « {lemmaId} ».</p>
      </ToolLayout>
    )
  }

  const otherForms = forms.filter((f) => f !== primary && !ROLES_HIDDEN_FROM_FICHE.includes(f.formRole))
  const hasBothGenders = forms.some((f) => f.genre === 'm') && forms.some((f) => f.genre === 'f')
  const style = CATEGORY_STYLES[primary.category]
  const natureInvariablePrimary = primary.category === 'invariable' ? natureInvariable(primary.word) : null

  return (
    <ToolLayout
      title={primary.word}
      description=""
      showBackToKeyboard
      titleBelow={
        groupe ? (
          <p className="font-semibold text-gray-900">({groupe})</p>
        ) : primary.category === 'nom' && primary.genre ? (
          <p className="font-semibold text-gray-900">({primary.genre === 'm' ? 'masculin' : 'féminin'})</p>
        ) : null
      }
      titleIcon={
        <div className="flex items-end gap-2">
          {natureInvariablePrimary && (
            <div className="flex flex-col items-center gap-1">
              {!confort && (
                <img src={assetUrl(NATURE_INVARIABLE_MASCOT[natureInvariablePrimary])} alt="" className="h-20 w-20 object-contain" />
              )}
              <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                {NATURE_INVARIABLE_LABEL[natureInvariablePrimary]}
              </span>
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            {!confort && <img src={assetUrl(CATEGORY_MASCOT_INFINITIF[primary.category])} alt="" className="h-20 w-20 object-contain" />}
            <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {CATEGORY_LABEL[primary.category]}
            </span>
          </div>
          {/* Le picto ARASAAC reste visible même en mode confort : c'est une
              aide au sens (illustration du mot), pas une mascotte décorative
              - contrairement aux mascottes de catégorie ci-dessus. */}
          {(wordPictos as Record<string, string>)[primary.word] && (
            <img
              src={assetUrl((wordPictos as Record<string, string>)[primary.word])}
              alt=""
              className="h-20 w-20 object-contain"
            />
          )}
        </div>
      }
      titleAfter={
        <div className="flex items-center">
          {speechSupported() && (
            <button
              type="button"
              onClick={() => speak(primary.word, { category: primary.category, lemmaId: primary.lemmaId })}
              aria-label={`Écouter « ${primary.word} »`}
              className="rounded-full p-2 text-2xl leading-none text-gray-500 hover:bg-black/10 active:scale-95"
            >
              🔊
            </button>
          )}
          {estEleve && (
            <button
              type="button"
              onClick={basculerFavori}
              aria-label={favori ? `Retirer « ${primary.word} » des favoris` : `Ajouter « ${primary.word} » aux favoris`}
              className="rounded-full p-2 text-2xl leading-none text-gray-500 hover:bg-black/10 active:scale-95"
            >
              {favori ? '⭐' : '☆'}
            </button>
          )}
        </div>
      }
    >
      <DecompositionSonGraphie word={primary.word} phonemeSeq={primary.phonemes} confort={confort} />

      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          to={`/definition/${primary.category}/${encodeURIComponent(primary.word)}`}
          className="inline-flex items-center gap-2 rounded-lg border-2 border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          📖 Voir la définition
        </Link>
      </div>

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

      {/* Le lien n'a de sens que si la forme principale est bien l'infinitif
          (les tableaux sont indexés par infinitif) ET qu'un tableau existe
          vraiment. Deux cas sans tableau : les verbes rares sans infinitif
          attesté dans Lexique383 (étoiler, poêler... — leur fiche retombe sur
          le participe passé), et les verbes ajoutés à la main dont la
          conjugaison n'a pas pu être générée (irréguliers). */}
      {primary.category === 'verbe' && primary.formRole === 'infinitif' && peutConjuguer && (
        <div className="mb-8">
          <Link
            to={`/conjugueur/${encodeURIComponent(primary.word)}`}
            className="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            Voir la conjugaison
          </Link>
        </div>
      )}

      <div className="mb-6 flex items-stretch gap-4">
        <div className="flex w-48 shrink-0 items-center justify-center rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
          <img src={assetUrl('/mascottes/famille.png')} alt="" className="h-auto w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 rounded-2xl border-2 border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-3 text-xl font-bold text-gray-800">Mots de la même famille</h2>
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
                  <div key={member.lemmaId} className={`rounded-lg border px-4 py-2 opacity-70 ${CATEGORY_STYLES[member.category]}`}>
                    <div className="text-xs opacity-70">{CATEGORY_LABEL[member.category]}</div>
                    <div className="text-xl font-medium">{member.word}</div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {synonyms.length > 0 && (
        <div className="mb-6 flex items-stretch gap-4">
          <div className="flex w-48 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
            <img src={assetUrl('/mascottes/synonymes.png')} alt="" className="h-auto w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-3 text-xl font-bold text-gray-800">Synonymes</h2>
            <div className="flex flex-wrap gap-3">
              {synonyms.map((member) => (
                <WordChip key={member.lemmaId} member={member} />
              ))}
            </div>
          </div>
        </div>
      )}

      {antonyms.length > 0 && (
        <div className="flex items-stretch gap-4">
          <div className="flex w-48 shrink-0 items-center justify-center rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
            <img src={assetUrl('/mascottes/antonymes.png')} alt="" className="h-auto w-full max-w-32 object-contain" />
          </div>
          <div className="min-w-0 flex-1 rounded-2xl border-2 border-blue-200 bg-blue-50 p-5">
            <h2 className="mb-3 text-xl font-bold text-gray-800">Contraires</h2>
            <div className="flex flex-wrap gap-3">
              {antonyms.map((member) => (
                <WordChip key={member.lemmaId} member={member} />
              ))}
            </div>
          </div>
        </div>
      )}
    </ToolLayout>
  )
}
