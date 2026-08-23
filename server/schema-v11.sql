-- Migration v11 : distingue, dans une séance, les réponses réussies du
-- premier coup de celles réussies après un ou plusieurs essais.
-- À exécuter dans phpMyAdmin APRÈS schema-v10.sql.
--
-- Sans risque à rejouer (IF NOT EXISTS).

-- "Recomposer le mot" et la dictée laissent 3 essais par mot : jusqu'ici,
-- réussir au 3e essai comptait un point plein, exactement comme réussir du
-- premier coup - le score final ne distinguait pas les deux. On ne change
-- pas ce calcul (un mot fini juste doit rester compté juste), mais le bilan
-- affiché à l'enseignante peut désormais montrer, en plus du score, combien
-- de réponses ont demandé un ou plusieurs essais.
--
-- NULL = séance enregistrée avant cette migration, l'info n'existe pas pour
-- elle - à distinguer de 0, qui voudrait dire "aucune réponse du premier
-- coup" mais serait une vraie mesure.
ALTER TABLE quiz_resultats
  ADD COLUMN IF NOT EXISTS premier_coup INT NULL DEFAULT NULL;
