-- Schéma de la base "espace enseignant" (comptes élèves + mots ajoutés au
-- lexique). À exécuter une fois dans phpMyAdmin (OVH manager -> Bases de
-- données -> Adminer/phpMyAdmin) sur la base créée pour ce projet.
--
-- Volontairement minimal côté données personnelles (RGPD, élèves mineurs) :
-- prénom seul, pas de nom de famille, pas d'email. Depuis schema-v6.sql, la
-- progression (quiz/favoris/historique) est centralisée ici aussi, à la
-- demande explicite de l'enseignante pour faciliter son suivi - en échange
-- d'une purge automatique par année scolaire (voir purgerSiNouvelleAnneeScolaire
-- dans api/auth.php) et d'un bouton de réinitialisation manuelle.

CREATE TABLE IF NOT EXISTS teachers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prenom VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mots ajoutés manuellement par l'enseignant, absents du lexique généré.
-- "phonemes" stocke la séquence sous forme JSON (ex. ["b","a","t","o"]),
-- même format que src/data/words-clavier2.json, pour rester compatible avec
-- le décodage phonétique déjà utilisé côté site.
CREATE TABLE IF NOT EXISTS lexicon_additions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mot VARCHAR(100) NOT NULL,
  categorie ENUM('nom', 'adjectif', 'verbe', 'adverbe', 'invariable') NOT NULL,
  phonemes JSON NOT NULL,
  genre ENUM('m', 'f') DEFAULT NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES teachers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Limite les tentatives de connexion par IP (mots de passe élèves
-- probablement courts vu l'âge — protection anti-brute-force basique).
CREATE TABLE IF NOT EXISTS login_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ip_address VARCHAR(45) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
