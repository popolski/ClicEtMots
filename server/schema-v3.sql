-- Migration v3 : forme féminine d'un adjectif ajouté à la main.
-- À exécuter dans phpMyAdmin APRÈS schema-v2.sql.
--
-- Comme schema-v2.sql, sans risque à rejouer grâce à IF NOT EXISTS.

ALTER TABLE lexicon_additions
  ADD COLUMN IF NOT EXISTS feminin_mot VARCHAR(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feminin_phonemes JSON DEFAULT NULL;
