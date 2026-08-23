-- Migration v5 : autoriser la recherche directe par orthographe pour un
-- élève donné (jusque là réservée à l'enseignante - voir
-- RechercheMotDirecte.tsx). Décidé au cas par cas par l'enseignante pour
-- ses meilleurs élèves : les autres restent limités au clavier phonétique,
-- le cœur pédagogique de l'outil.
-- À exécuter dans phpMyAdmin APRÈS schema-v4.sql.
--
-- Comme pour les migrations précédentes, ADD COLUMN ne peut être exécuté
-- qu'UNE FOIS - si tu le relances après un premier passage réussi, ignore
-- l'erreur "Duplicate column name".

ALTER TABLE students
  ADD COLUMN recherche_directe TINYINT(1) NOT NULL DEFAULT 0;
