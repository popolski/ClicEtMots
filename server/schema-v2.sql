-- Migration v2 : conjugaison générée + relations saisies à la main.
-- À exécuter dans phpMyAdmin APRÈS schema.sql (qui, lui, a déjà été passé).
--
-- La ligne ALTER TABLE ne peut être exécutée qu'UNE FOIS (pas de clause
-- "IF NOT EXISTS" ici, non supportée par cet hébergement) : si tu la
-- relances après un premier passage réussi, phpMyAdmin affichera une
-- erreur "Duplicate column name" sur cette ligne précise — sans gravité,
-- ignore-la et continue (la table lexicon_relations, elle, peut être
-- relancée sans risque).

-- Conjugaison générée à l'ajout d'un verbe régulier (voir api/conjugaison.php).
-- NULL pour les verbes irréguliers (non générables sans risque d'erreur) et
-- pour toutes les autres catégories.
ALTER TABLE lexicon_additions
  ADD COLUMN conjugaison JSON DEFAULT NULL;

-- Relations saisies par l'enseignant pour un mot ajouté : elles ne peuvent
-- pas être déduites (Démonette/JeuxDeMots ne connaissent pas ces mots, et ces
-- bases ne sont pas embarquées dans le site de toute façon).
-- La cible est un mot du lexique généré (target_lemma_id = "nom:cerf") ou un
-- autre mot ajouté ("ajout:nom:wapiti") ; on stocke aussi son orthographe et
-- sa catégorie pour éviter au site d'avoir à les rechercher.
CREATE TABLE IF NOT EXISTS lexicon_relations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  word_id INT NOT NULL,
  type ENUM('synonyme', 'antonyme', 'famille') NOT NULL,
  target_lemma_id VARCHAR(160) NOT NULL,
  target_word VARCHAR(100) NOT NULL,
  target_category ENUM('nom', 'adjectif', 'verbe', 'adverbe', 'invariable') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Supprimer un mot ajouté emporte ses relations.
  FOREIGN KEY (word_id) REFERENCES lexicon_additions(id) ON DELETE CASCADE,
  -- Pas deux fois la même relation sur le même mot.
  UNIQUE KEY uniq_relation (word_id, type, target_lemma_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
