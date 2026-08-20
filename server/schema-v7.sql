-- Migration v7 : mode confort de lecture (dys), décidé par l'enseignante au
-- cas par cas pour un élève donné - même principe que recherche_directe
-- (schema-v5.sql), pas un réglage laissé à l'élève lui-même (revu après un
-- premier essai en auto-activation côté élève).
-- À exécuter dans phpMyAdmin APRÈS schema-v6.sql.
--
-- Comme pour les migrations précédentes, ADD COLUMN ne peut être exécuté
-- qu'UNE FOIS - si tu le relances après un premier passage réussi, ignore
-- l'erreur "Duplicate column name".

ALTER TABLE students
  ADD COLUMN confort_lecture TINYINT(1) NOT NULL DEFAULT 0;
