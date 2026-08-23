-- Migration v6 : centralise côté serveur les résultats de quiz, favoris et
-- historique de consultation, jusque-là gérés uniquement en localStorage
-- (choix RGPD initial - voir schema.sql, "pas de suivi d'activité").
-- Décision explicite de l'enseignante pour faciliter son suivi, en échange
-- d'une purge automatique par année scolaire (même logique que la version
-- locale, voir src/lib/rotationAnneeScolaire.ts côté client - purgerSiNouvelleAnneeScolaire
-- côté serveur) + un bouton de réinitialisation manuelle dans Espace enseignant.
-- À exécuter dans phpMyAdmin APRÈS schema-v5.sql.
--
-- Comme pour les migrations précédentes, ADD COLUMN ne peut être exécuté
-- qu'UNE FOIS - si tu le relances après un premier passage réussi, ignore
-- l'erreur "Duplicate column name".

-- Dernière année scolaire vue par CET élève (pas par appareil, contrairement
-- à la version locale) : comparée à l'année scolaire actuelle à chaque
-- connexion pour déclencher la purge de ses 3 tables ci-dessous si besoin.
ALTER TABLE students
  ADD COLUMN derniere_annee_scolaire VARCHAR(9) DEFAULT NULL;

CREATE TABLE IF NOT EXISTS quiz_resultats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  mode ENUM('qcm', 'reconstitution', 'grammaire') NOT NULL,
  score INT NOT NULL,
  total INT NOT NULL,
  termine_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Supprimer un élève emporte ses résultats.
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favoris (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  lemma_id VARCHAR(160) NOT NULL,
  word VARCHAR(100) NOT NULL,
  category ENUM('nom', 'adjectif', 'verbe', 'adverbe', 'invariable') NOT NULL,
  ajoute_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  -- Pas deux fois le même mot en favori pour un même élève.
  UNIQUE KEY uniq_favori (student_id, lemma_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS historique_consultation (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  lemma_id VARCHAR(160) NOT NULL,
  word VARCHAR(100) NOT NULL,
  category ENUM('nom', 'adjectif', 'verbe', 'adverbe', 'invariable') NOT NULL,
  consulte_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
