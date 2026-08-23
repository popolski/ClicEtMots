-- Migration v12 : trace l'usage du filet de secours de la dictée
-- ("Je ne sais pas l'écrire").
-- À exécuter dans phpMyAdmin APRÈS schema-v11.sql.
--
-- L'ALTER TABLE ne peut être exécuté qu'UNE FOIS - si tu le relances après
-- un premier passage réussi, ignore l'erreur "Duplicate column name".

-- Jusqu'ici, cliquer sur "Je ne sais pas l'écrire" pendant une dictée
-- n'était enregistré nulle part : impossible pour l'enseignante de savoir
-- si le filet aide réellement ou s'il est devenu la sortie systématique
-- d'un élève. Ce compteur enregistre, par séance, sur combien de mots le
-- filet a été ouvert - indépendamment du fait que le mot ait ensuite été
-- réussi ou non.
--
-- NULL = séance enregistrée avant cette migration, l'info n'existe pas pour
-- elle - à distinguer de 0, qui voudrait dire "jamais utilisé" mais serait
-- une vraie mesure. Même principe que premier_coup (schema-v11.sql).
ALTER TABLE quiz_resultats
  ADD COLUMN aide_utilisee INT NULL DEFAULT NULL;
