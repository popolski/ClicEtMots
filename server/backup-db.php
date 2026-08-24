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

const NOM_LOG = 'last-run-debug.log';

require_once __DIR__ . '/backup-common.php';

// Par précaution (voir backup-files.php, qui a révélé une limite CLI
// inattendue sur cet hébergement) - le dump seul est petit et rapide, mais
// autant écarter tout risque de kill en plein milieu.
set_time_limit(0);

trace(NOM_LOG, 'script démarré, SAPI=' . PHP_SAPI . ', max_execution_time=' . ini_get('max_execution_time'));

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Réservé à l'exécution en ligne de commande (tâche planifiée).\n");
}

// config.php n'est PAS dupliqué à côté de ce script : il vit une seule fois,
// dans le dossier /clicetmots/api/ réellement servi par le site (voir
// server/README.md "Upload FTP") - ce fichier-ci, lui, est déployé en
// dehors de ce dossier (ex. /clicetmots/api-src/), donc SIBLING de api/, pas
// à l'intérieur. D'où le "../api/" et non "/api/".
$cheminConfig = __DIR__ . '/../api/config.php';
trace(NOM_LOG, 'chargement config depuis ' . $cheminConfig . ' (existe: ' . (file_exists($cheminConfig) ? 'oui' : 'NON') . ')');
require_once $cheminConfig;
trace(NOM_LOG, 'config chargée avec succès');

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
trace(NOM_LOG, "mysqldump exécuté, code retour $codeRetour");

if ($codeRetour !== 0 || !file_exists($cheminLocal) || filesize($cheminLocal) === 0) {
    $erreur = @file_get_contents('/tmp/clicetmots_backup_err.log') ?: '(pas de détail)';
    echec(NOM_LOG, "mysqldump a échoué (code $codeRetour) : $erreur");
}
trace(NOM_LOG, 'dump créé : ' . filesize($cheminLocal) . ' octets');

// 2. Envoi vers B2 ------------------------------------------------------------

$connexion = b2Connexion(NOM_LOG);
b2Envoyer(NOM_LOG, $connexion, $cheminLocal, $nomFichier);
unlink($cheminLocal);
echo "[clicetmots-backup] OK : $nomFichier envoyé vers B2.\n";

// 3. Rotation -------------------------------------------------------------

$supprimes = b2Rotation(NOM_LOG, $connexion, 'clicetmots_', BACKUP_RETENTION_JOURS);
echo "[clicetmots-backup] Rotation : $supprimes ancienne(s) sauvegarde(s) supprimée(s) (rétention " . BACKUP_RETENTION_JOURS . " jours).\n";
