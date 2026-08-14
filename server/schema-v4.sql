-- Migration v4 : liste de mots de la semaine, choisie par l'enseignante.
-- À exécuter dans phpMyAdmin APRÈS schema-v3.sql.
--
-- Une seule "liste courante" à la fois (pas d'historique de listes
-- multiples) : chaque enregistrement remplace le précédent côté affichage
-- (l'API ne lit toujours que la ligne la plus récente), mais on garde les
-- anciennes lignes en base plutôt que de les écraser - au cas où
-- l'enseignante voudrait un jour retrouver la liste de la semaine passée.
CREATE TABLE IF NOT EXISTS liste_mots_semaine (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(200) NOT NULL DEFAULT 'Mots de la semaine',
  -- Tableau JSON de {lemmaId, word, category} — même forme que
  -- RelationTarget/EntreeHistorique côté site, pas besoin de table à part.
  mots JSON NOT NULL,
  updated_by INT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES teachers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
