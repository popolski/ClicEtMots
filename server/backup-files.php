<?php
// Sauvegarde HEBDOMADAIRE des fichiers du site (contenu de dist/ déployé -
// audio pré-généré, pictogrammes, mascottes, assets - PLUS api/config.php),
// distincte de backup-db.php (quotidien, base de données uniquement). Ces
// fichiers pèsent nettement plus lourd (~250 Mo, dont ~230 Mo d'audio) et
// changent bien moins souvent que la base : inutile de les retransférer
// chaque nuit, une fois par semaine suffit largement.
//
// Comme backup-db.php : vit dans server/, jamais copié dans /clicetmots/api/,
// exécuté uniquement par une tâche planifiée OVH (Cron), jamais depuis le
// navigateur.
//
// tar l'intégralité de /clicetmots/ (racine du site déployé, un niveau
// au-dessus de ce script) SAUF api-src/ (ce dossier de scripts de
// sauvegarde lui-même, sans intérêt à sauvegarder) -> gzip -> envoi vers
// Backblaze B2 -> rotation. Inclut donc automatiquement tout nouveau
// dossier ajouté au build sans qu'il faille mettre ce script à jour.

require_once __DIR__ . '/backup-common.php';

// ~250 Mo à archiver : le tar seul prend une bonne minute, plus long qu'une
// limite CLI par défaut sur cet hébergement (constaté : le script s'arrêtait
// net en plein milieu du tar, sans la moindre trace d'erreur - signe d'un
// kill plutôt que d'un vrai échec applicatif).
set_time_limit(0);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Réservé à l'exécution en ligne de commande (tâche planifiée).\n");
}

require_once __DIR__ . '/../api/config.php';

const BACKUP_RETENTION_SEMAINES = 8;

// 1. Archive + compression ----------------------------------------------------

$racineSite = realpath(__DIR__ . '/..');
if ($racineSite === false) {
    echec('racine du site introuvable à partir de __DIR__/..');
}

$horodatage = date('Y-m-d_His');
$nomFichier = "clicetmots-fichiers_{$horodatage}.tar.gz";
$cheminLocal = sys_get_temp_dir() . '/' . $nomFichier;

// --exclude porte sur le nom relatif à -C, donc juste "api-src" (pas le
// chemin complet) suffit à exclure ce dossier-ci de l'archive.
$commande = sprintf(
    'tar -czf %s --exclude=api-src -C %s . 2>/tmp/clicetmots_backup_files_err.log',
    escapeshellarg($cheminLocal),
    escapeshellarg($racineSite),
);
exec($commande, $sortie, $codeRetour);

// tar renvoie parfois 1 pour un avertissement mineur (fichier modifié
// pendant l'archivage) sans que l'archive soit invalide - on ne bloque que
// sur une absence totale de fichier ou un fichier vide, pas sur le code
// retour seul.
if (!file_exists($cheminLocal) || filesize($cheminLocal) === 0) {
    $erreur = @file_get_contents('/tmp/clicetmots_backup_files_err.log') ?: '(pas de détail)';
    echec("tar a échoué (code $codeRetour) : $erreur");
}

// 2. Envoi vers B2 (même bucket que la base, préfixe différent) ---------------

$connexion = b2Connexion();
b2Envoyer($connexion, $cheminLocal, $nomFichier);
unlink($cheminLocal);
echo "[clicetmots-backup-files] OK : $nomFichier envoyé vers B2.\n";

// 3. Rotation (en semaines, pas en jours - fréquence hebdomadaire) -----------

$supprimes = b2Rotation($connexion, 'clicetmots-fichiers_', BACKUP_RETENTION_SEMAINES * 7);
echo "[clicetmots-backup-files] Rotation : $supprimes ancienne(s) sauvegarde(s) supprimée(s) (rétention " . BACKUP_RETENTION_SEMAINES . " semaines).\n";
