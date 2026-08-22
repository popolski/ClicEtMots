-- Migration v9 : atelier "choisis la bonne graphie".
-- À exécuter dans phpMyAdmin APRÈS schema-v8.sql.
--
-- Un MODIFY est sans risque si relancé, contrairement aux ADD COLUMN des
-- migrations précédentes : tu peux l'exécuter deux fois sans conséquence.

-- Cinquième exercice de "Mes exercices" : l'élève entend un mot et choisit,
-- son par son, comment chaque son s'écrit dans ce mot ([o] -> o, au, eau).
-- Ses résultats vont dans la même table que les quatre autres.
ALTER TABLE quiz_resultats
  MODIFY mode ENUM('qcm', 'reconstitution', 'grammaire', 'dictee', 'graphie') NOT NULL;
