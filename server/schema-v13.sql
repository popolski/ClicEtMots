-- Migration v13 : durée d'une séance de quiz, pour le bilan enseignant
-- uniquement (jamais affiché à l'élève ni aux parents).
-- À exécuter dans phpMyAdmin APRÈS schema-v12.sql.
--
-- Sans risque à rejouer (IF NOT EXISTS).

-- Chronométré côté client entre l'affichage de la 1re question et la fin de
-- la séance (voir QuizTool.tsx). NULL = séance enregistrée avant cette
-- migration, à ne pas confondre avec 0 (mesure impossible pour une autre
-- raison - en pratique n'arrive pas, mais même principe que premier_coup et
-- aide_utilisee).
ALTER TABLE quiz_resultats
  ADD COLUMN IF NOT EXISTS duree_secondes INT NULL DEFAULT NULL;
