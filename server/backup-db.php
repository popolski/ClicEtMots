<?php
// Sauvegarde QUOTIDIENNE de la base MySQL, déclenchée par une tâche
// planifiée OVH (Cron) qui exécute ce fichier directement - jamais appelé
// depuis le navigateur : ce fichier vit dans server/, PAS server/api/, donc
// il n'est jamais copié dans /clicetmots/api/ (le seul dossier web-accessible,
// voir server/README.md "Upload FTP") - il reste uniquement accessible en
// ligne de commande sur le serveur.
//
// Étapes : mysqldump -> gzip -> envoi vers Backblaze B2 (API native, pas de
// dépendance Composer, voir backup-common.php) -> suppression des
// sauvegardes B2 plus vieilles que BACKUP_RETENTION_JOURS -> suppression du
// fichier temporaire local.
//
// Configuration requise dans api/config.php (voir api/config.php.example) :
// B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME.
//
// Sauvegarde SÉPARÉE des fichiers du site (dist/, audio, pictos, config.php) :
// voir backup-files.php, en tâche hebdomadaire distincte - ces fichiers
// pèsent bien plus lourd (~250 Mo) et changent bien moins souvent que la
// base, inutile de les retransférer chaque nuit.

require_once __DIR__ . '/backup-common.php';

// Par précaution (le dump seul est petit et rapide, mais un hébergement
// mutualisé peut appliquer une limite de temps même en CLI - vu sur
// backup-files.php, qui manipule des fichiers bien plus gros).
set_time_limit(0);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Réservé à l'exécution en ligne de commande (tâche planifiée).\n");
}

// config.php n'est PAS dupliqué à côté de ce script : il vit une seule fois,
// dans le dossier /clicetmots/api/ réellement servi par le site (voir
// server/README.md "Upload FTP") - ce fichier-ci, lui, est déployé en
// dehors de ce dossier (ex. /clicetmots/api-src/), donc SIBLING de api/, pas
// à l'intérieur. D'où le "../api/" et non "/api/".
require_once __DIR__ . '/../api/config.php';

const BACKUP_RETENTION_JOURS = 30;

// 1. Dump + compression -----------------------------------------------------

$horodatage = date('Y-m-d_His');
$nomFichier = "clicetmots_{$horodatage}.sql.gz";
$cheminLocal = sys_get_temp_dir() . '/' . $nomFichier;

$commande = sprintf(
    'mysqldump --single-transaction --no-tablespaces -h %s -u %s -p%s %s | gzip -9 > %s 2>/tmp/clicetmots_backup_err.log',
    escapeshellarg(DB_HOST),
    escapeshellarg(DB_USER),
    escapeshellarg(DB_PASS),
    escapeshellarg(DB_NAME),
    escapeshellarg($cheminLocal),
);
exec($commande, $sortie, $codeRetour);

if ($codeRetour !== 0 || !file_exists($cheminLocal) || filesize($cheminLocal) === 0) {
    $erreur = @file_get_contents('/tmp/clicetmots_backup_err.log') ?: '(pas de détail)';
    echec("mysqldump a échoué (code $codeRetour) : $erreur");
}

// 2. Envoi vers B2 ------------------------------------------------------------

$connexion = b2Connexion();
b2Envoyer($connexion, $cheminLocal, $nomFichier);
unlink($cheminLocal);
echo "[clicetmots-backup] OK : $nomFichier envoyé vers B2.\n";

// 3. Rotation -------------------------------------------------------------

$supprimes = b2Rotation($connexion, 'clicetmots_', BACKUP_RETENTION_JOURS);
echo "[clicetmots-backup] Rotation : $supprimes ancienne(s) sauvegarde(s) supprimée(s) (rétention " . BACKUP_RETENTION_JOURS . " jours).\n";
