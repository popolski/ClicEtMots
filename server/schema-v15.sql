-- Migration v15 : anti brute-force par IDENTIFIANT en plus de l'IP.
-- À exécuter dans phpMyAdmin APRÈS schema-v14.sql.
--
-- L'ALTER TABLE ne peut être exécuté qu'UNE FOIS - si tu le relances après
-- un premier passage réussi, ignore l'erreur "Duplicate column name" (la
-- version MySQL/MariaDB de cet hébergement ne supporte pas IF NOT EXISTS
-- sur ADD COLUMN/ADD INDEX, contrairement à ce qu'indiquaient les migrations
-- précédentes - à ne pas réutiliser cette syntaxe ici).
--
-- Jusqu'ici, la limite ne portait que sur l'IP : en école, tous les postes
-- sortent souvent avec la même IP publique, donc quelques élèves qui se
-- trompent de mot de passe pouvaient bloquer TOUTE la classe pendant 15 min.
-- La limite par identifiant cible le compte réellement attaqué, sans effet
-- de bord sur les autres. L'IP reste vérifiée en plus (seuil plus haut,
-- voir auth.php), pour couvrir une attaque distribuée sur plusieurs comptes
-- depuis un même poste.
ALTER TABLE login_attempts
  ADD COLUMN identifiant VARCHAR(191) NULL,
  ADD INDEX idx_identifiant_time (identifiant, attempted_at);
