-- Migration v10 : les mots ratés en dictée reviennent d'une séance à l'autre.
-- À exécuter dans phpMyAdmin APRÈS schema-v9.sql.
--
-- CREATE TABLE IF NOT EXISTS est sans risque si relancé.

-- Jusqu'ici les mots ratés n'étaient repassés qu'en fin de séance, puis
-- oubliés : le lendemain, le tirage repartait de zéro. Ils sont maintenant
-- retenus et replacés en tête de la dictée suivante, jusqu'à ce que l'élève
-- les réussisse. C'est la révision espacée du pauvre, mais c'est ce qui
-- manquait le plus pour que la dictée serve à progresser.
--
-- On stocke le mot ET son lemmaId : le lexique peut évoluer d'une version à
-- l'autre, et un mot ajouté à la main par l'enseignante peut disparaître de
-- sa liste - dans ce cas l'entrée devient inutilisable et sera simplement
-- ignorée au tirage.
CREATE TABLE IF NOT EXISTS dictee_mots_rates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  lemma_id VARCHAR(191) NOT NULL,
  word VARCHAR(191) NOT NULL,
  -- Nombre de fois raté : sert à trier (les plus difficiles d'abord) et
  -- donnera plus tard une vraie information à l'enseignante.
  ratages INT NOT NULL DEFAULT 1,
  derniere_erreur DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_mot_eleve (student_id, lemma_id, word),
  CONSTRAINT fk_rates_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Note : la colonne students.aide_dictee (v8) n'est plus lue par personne.
-- Le filet de secours de la dictée est désormais ouvert à toute la classe,
-- l'enseignante n'a plus à décider élève par élève. La colonne est laissée
-- en place plutôt que supprimée : elle ne gêne pas, et un DROP COLUMN est
-- irréversible si on changeait d'avis.
