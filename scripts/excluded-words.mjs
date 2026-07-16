// Liste noire manuelle : mots qui passeraient le filtre Manulex (fréquence
// scolaire suffisante) mais qui n'ont pas leur place dans un outil pour une
// classe primaire. Découverte au cas par cas (voir les commits qui ont
// introduit ce fichier) plutôt que construite préventivement — on ajoute un
// mot ici quand on le voit réellement apparaître (ex. comme "synonyme" d'un
// mot courant), pas par précaution générale.
//
// Appliqué à TOUT le pipeline (mots-clavier2.json, familles, synonymes,
// antonymes) : un mot exclu ici disparaît partout, pas seulement des
// suggestions.
//
// Deux formes d'entrée :
//  - un mot seul ("idiot") : exclu dans TOUTES ses catégories grammaticales.
//  - "mot::catégorie" ("bête::adjectif") : exclu SEULEMENT dans cette
//    catégorie, pour les mots à double sens dans la même classe
//    grammaticale (ex. "bête" nom = l'animal, à garder ; "bête" adjectif =
//    "stupide", à retirer). Un mot sans double sens légitime (idiot,
//    crétin...) n'a pas besoin de cette nuance : nom ET adjectif y portent
//    la même insulte, donc on exclut le mot entier.
//
// Volontairement NON exclus malgré un usage argotique possible comme
// insulte : cornichon, cruche, gourde, cloche, patate, nouille — leur sens
// premier est un mot de vocabulaire courant (légume, objet du quotidien)
// nécessaire à une classe primaire (ex. "gourde" = la gourde d'eau), l'usage
// insultant n'est qu'un second sens argotique minoritaire.
export const EXCLUDED_WORDS = new Set([
  'con', // vulgaire ; repéré comme "synonyme" affiché de idiot/intelligent/chat
  'conne',
  'bâtard',
  'bâtarde',
  'idiot',
  'idiote',
  'imbécile',
  'stupide',
  'crétin',
  'crétine',
  'sot',
  'sotte',
  'niais',
  'niaise',
  'nigaud',
  'nigaude',
  'simplet',
  'simplette',
  'bête::adjectif', // garde "bête" nom (l'animal), retire l'adjectif "stupide"
  'ballot::adjectif', // garde "ballot" nom (le paquet), retire l'adjectif "sot"
  'violer', // vérifié aussi via le lemme, retire toutes les formes conjuguées

  // Prénoms sans second sens commun utile en CE1-CM2, repérés en croisant
  // notre lexique (catégorie nom) avec le fichier national des prénoms de
  // l'INSEE (prenoms-2024-nat.csv, data.gouv.fr, seuil >= 1000 naissances).
  // Scopé ::nom : un homonyme dans une autre catégorie (ex. adjectif) reste.
  // Volontairement PAS exclus malgré la coïncidence avec un prénom : les
  // vrais mots du quotidien qui se trouvent aussi être des prénoms (rose,
  // fleur, perle, olive, cerise, vanille, cannelle, myrtille, prune, dahlia,
  // lilas, loup, marin, marine, colin, colombe, hermine, ange, iris,
  // violette, noël, toussaint, saint, sainte, reine, victoire, manuel,
  // roman, don, franc, fortune, harmonie, mélodie, conception, prudence,
  // junior, marguerite, madeleine, charlotte, benjamin, aurore, ambre, jade,
  // clémentine, romaine, blanche, marianne, pierrot, julienne, anis, lino,
  // rosette, marjolaine).
  'alain::nom',
  'auguste::nom',
  'axel::nom',
  'baptiste::nom',
  'barbara::nom',
  'ben::nom',
  'berthe::nom',
  'carole::nom',
  'césar::nom',
  'claude::nom',
  'dan::nom',
  'désiré::nom',
  'florence::nom',
  'gaspard::nom',
  'guillaume::nom',
  'henry::nom',
  'isabelle::nom',
  'jack::nom',
  'jacob::nom',
  'jacques::nom',
  'jacqueline::nom',
  'joseph::nom',
  'jules::nom',
  'lise::nom',
  'luce::nom',
  'mary::nom',
  'max::nom',
  'nil::nom',
  'olympe::nom',
  'oscar::nom',
  'pascal::nom',
  'pauline::nom',
  'renaud::nom',
  'richard::nom',
  'robert::nom',
  'romain::nom',
  'serge::nom',
  'sophie::nom',
  'sylvain::nom',
  'sylvie::nom',
  'théo::nom',
  'thomas::nom',
  'tom::nom',
  'valentin::nom',
  'valentine::nom',
  'véronique::nom',
  'virginie::nom',
  'walter::nom',
  'william::nom',
  'williams::nom',
  'xavier::nom',
  // Cas limites, exclus aussi sur confirmation : mot réel mais trop rare/
  // technique pour du CE1-CM2 (amadou = matériau d'allume-feu, merlin =
  // outil de bûcheron), ou trop dominé par un autre sens propre (lorraine =
  // la région/quiche, agathe trop proche de "agate" sans en être
  // l'orthographe), ou oiseau trop peu usité seul sans le déterminant
  // habituel (martin, robin).
  'martin::nom',
  'robin::nom',
  'agathe::nom',
  'amadou::nom',
  'merlin::nom',
  'lorraine::nom',
])
