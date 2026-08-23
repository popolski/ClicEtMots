-- Migration v8 : dictée des mots de la semaine.
-- À exécuter dans phpMyAdmin APRÈS schema-v7.sql.
--
-- Comme pour les migrations précédentes, ADD COLUMN ne peut être exécuté
-- qu'UNE FOIS - si tu le relances après un premier passage réussi, ignore
-- l'erreur "Duplicate column name". Le MODIFY, lui, est sans risque si
-- relancé.

-- Nouveau mode d'exercice : la dictée rejoint les trois autres dans
-- "Mes exercices", donc ses résultats vont dans la même table.
ALTER TABLE quiz_resultats
  MODIFY mode ENUM('qcm', 'reconstitution', 'grammaire', 'dictee') NOT NULL;

-- Filet de secours de la dictée : bouton "Je ne sais pas l'écrire" qui
-- ouvre le clavier phonétique. Utile pour un CP qui bloque, mais peut
-- devenir la porte de sortie systématique - d'où le choix laissé à
-- l'enseignante élève par élève, comme recherche_directe (v5) et
-- confort_lecture (v7).
ALTER TABLE students
  ADD COLUMN aide_dictee TINYINT(1) NOT NULL DEFAULT 0;
