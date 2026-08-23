-- Migration v3 : forme féminine d'un adjectif ajouté à la main.
-- À exécuter dans phpMyAdmin APRÈS schema-v2.sql.
--
-- Comme pour schema-v2.sql, ADD COLUMN ne peut être exécuté qu'UNE FOIS —
-- si tu le relances après un premier passage réussi, ignore l'erreur
-- "Duplicate column name".

ALTER TABLE lexicon_additions
  ADD COLUMN feminin_mot VARCHAR(100) DEFAULT NULL,
  ADD COLUMN feminin_phonemes JSON DEFAULT NULL;
