-- Migration v5 : autoriser la recherche directe par orthographe pour un
-- élève donné (jusque là réservée à l'enseignante - voir
-- RechercheMotDirecte.tsx). Décidé au cas par cas par l'enseignante pour
-- ses meilleurs élèves : les autres restent limités au clavier phonétique,
-- le cœur pédagogique de l'outil.
-- À exécuter dans phpMyAdmin APRÈS schema-v4.sql.
--
-- Comme les migrations précédentes, sans risque à rejouer (IF NOT EXISTS).

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS recherche_directe TINYINT(1) NOT NULL DEFAULT 0;
