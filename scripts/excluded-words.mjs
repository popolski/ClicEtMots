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
])
