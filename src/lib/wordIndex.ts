import type { WordCategory, WordEntry, WordFormRole } from '../types/phonetics'
import { lemmaIdAjout, loadAddedWords } from './addedLexicon'

export { estMotAjoute, LEMMA_PREFIXE_AJOUT } from './addedLexicon'

let cached: Promise<WordEntry[]> | null = null

// Fréquence attribuée aux mots ajoutés à la main par l'enseignante. Le tri
// des résultats se fait par fréquence décroissante : une valeur haute les
// place en tête des mots trouvés, ce qui est le comportement voulu (si elle
// a pris la peine d'ajouter un mot, c'est qu'il manquait et qu'on le cherche).
const FREQUENCE_MOT_AJOUTE = 100

// L'enseignante ne saisit qu'une seule forme par mot ; on la déclare dans le
// rôle "de base" de sa catégorie, celui que pickPrimaryForm cherche en
// premier (clavierLogic.BASE_ROLE) — sinon la fiche mot retomberait sur un
// fallback au lieu de reconnaître la forme principale.
const ROLE_DE_BASE: Record<WordCategory, WordFormRole> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

/**
 * Charge le lexique complet (~32 000 mots, ~8 Mo) en lazy import — pas
 * inclus dans le bundle principal, pour ne pas alourdir le chargement
 * initial sur des PC scolaires potentiellement peu puissants.
 *
 * Y fusionne les mots ajoutés à la main par l'enseignante (API, base MySQL) :
 * ils sont ainsi trouvables au clavier immédiatement, sans regénérer le
 * lexique statique ni redéployer. Si l'API échoue (hors ligne, serveur
 * indisponible), loadAddedWords renvoie une liste vide et on retombe sur le
 * seul lexique statique — mieux vaut un clavier amputé de quelques mots
 * ajoutés qu'un clavier mort.
 */
export function loadWordIndex(): Promise<WordEntry[]> {
  if (!cached) {
    cached = Promise.all([
      import('../data/words-clavier2.json').then((m) => m.default as WordEntry[]),
      loadAddedWords(),
    ]).then(([statiques, ajoutes]) => [
      ...statiques,
      ...ajoutes.flatMap<WordEntry>((w) => {
        const lemmaId = lemmaIdAjout(w.mot, w.categorie)
        const masculin: WordEntry = {
          word: w.mot,
          phonemes: w.phonemes,
          frequency: FREQUENCE_MOT_AJOUTE,
          level: 1,
          category: w.categorie,
          // Préfixe "ajout:" : évite toute collision de lemmaId avec le
          // lexique généré, et permet de reconnaître ces mots plus tard.
          lemmaId,
          formRole: ROLE_DE_BASE[w.categorie],
          ...(w.genre ? { genre: w.genre } : {}),
        }
        // Forme féminine d'un adjectif, saisie à la main (aucune génération :
        // trop d'exceptions pour la deviner sûrement) — partage le lemmaId du
        // masculin pour apparaître dans ses "Autres formes".
        if (w.categorie === 'adjectif' && w.feminin_mot && w.feminin_phonemes) {
          const feminin: WordEntry = {
            word: w.feminin_mot,
            phonemes: w.feminin_phonemes,
            frequency: FREQUENCE_MOT_AJOUTE,
            level: 1,
            category: 'adjectif',
            lemmaId,
            formRole: 'féminin',
          }
          return [masculin, feminin]
        }
        return [masculin]
      }),
    ])
  }
  return cached
}
