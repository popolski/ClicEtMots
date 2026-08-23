-- Migration v14 : 3 catégories de réussite en dictée (pédagogie bienveillante
-- demandée par Camille) - réussite du premier coup, réussite avec reprise en
-- fin de séance, réussite avec aide. Un échec (vrai) n'existe désormais que
-- si le mot est raté aux DEUX chances (tour principal + reprise).
-- À exécuter dans phpMyAdmin APRÈS schema-v13.sql.
--
-- Sans risque à rejouer (IF NOT EXISTS).

-- Mots réussis à la reprise de fin de séance (1 seul essai, sans aide) -
-- distinct de premier_coup (réussite au tour principal). NULL = séance
-- d'avant cette migration, même principe que les autres colonnes nullables.
ALTER TABLE quiz_resultats
  ADD COLUMN IF NOT EXISTS rattrapage_reussi INT NULL DEFAULT NULL;

-- Mots finalement écrits juste MAIS où le filet de secours a servi à un
-- moment (tour principal ou reprise) - sous-ensemble de aide_utilisee, qui
-- comptait tous les mots où le filet a été ouvert, réussis ou non.
ALTER TABLE quiz_resultats
  ADD COLUMN IF NOT EXISTS aide_reussi INT NULL DEFAULT NULL;
