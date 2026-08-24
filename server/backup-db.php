<?php
// Sauvegarde quotidienne de la base MySQL, déclenchée par une tâche
// planifiée OVH (Cron) qui exécute ce fichier directement - jamais appelé
// depuis le navigateur : ce fichier vit dans server/, PAS server/api/, donc
// il n'est jamais copié dans /clicetmots/api/ (le seul dossier web-accessible,
// voir server/README.md "Upload FTP") - il reste uniquement accessible en
// ligne de commande sur le serveur.
//
// Étapes : mysqldump -> gzip -> envoi vers Backblaze B2 (API native, pas de
// dépendance Composer) -> suppression des sauvegardes B2 plus vieilles que
// BACKUP_RETENTION_JOURS -> suppression du fichier temporaire local.
//
// Configuration requise dans api/config.php (voir api/config.php.example) :
// B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME.

// Trace TEMPORAIRE de débogage : écrit dans un fichier à côté de ce script
// (visible directement en FTP), pour vérifier si la tâche planifiée
// exécute vraiment ce script - indépendamment des logs OVH, dont on n'est
// plus certains qu'ils capturent tout de façon fiable. À retirer une fois
// la sauvegarde confirmée fonctionnelle.
function trace(string $message): void {
    @file_put_contents(__DIR__ . '/last-run-debug.log', date('c') . " - $message\n", FILE_APPEND);
}

trace('script démarré, SAPI=' . PHP_SAPI);

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
trace('chargement config depuis ' . $cheminConfig . ' (existe: ' . (file_exists($cheminConfig) ? 'oui' : 'NON') . ')');
require_once $cheminConfig;
trace('config chargée avec succès');

const BACKUP_RETENTION_JOURS = 30;

function echec(string $message): never {
    trace("ÉCHEC : $message");
    fwrite(STDERR, "[clicetmots-backup] ÉCHEC : $message\n");
    exit(1);
}

function b2Appel(string $url, array $headers, ?string $body = null): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POST => $body !== null,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 120,
    ]);
    $reponse = curl_exec($ch);
    if ($reponse === false) {
        echec('cURL - ' . curl_error($ch));
    }
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $donnees = json_decode($reponse, true);
    if ($code >= 300 || !is_array($donnees)) {
        echec("appel B2 $url a échoué (HTTP $code) : " . substr((string) $reponse, 0, 500));
    }
    return $donnees;
}

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
trace("mysqldump exécuté, code retour $codeRetour");

if ($codeRetour !== 0 || !file_exists($cheminLocal) || filesize($cheminLocal) === 0) {
    $erreur = @file_get_contents('/tmp/clicetmots_backup_err.log') ?: '(pas de détail)';
    echec("mysqldump a échoué (code $codeRetour) : $erreur");
}
trace('dump créé : ' . filesize($cheminLocal) . ' octets');

// 2. Autorisation B2 ----------------------------------------------------------

$auth = b2Appel(
    'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
    ['Authorization: Basic ' . base64_encode(B2_KEY_ID . ':' . B2_APPLICATION_KEY)],
);
$apiUrl = $auth['apiUrl'];
$jetonAuth = $auth['authorizationToken'];

// Le bucket doit exister au préalable (créé une fois à la main sur
// backblaze.com) - on retrouve juste son bucketId à partir de son nom.
$buckets = b2Appel(
    "$apiUrl/b2api/v2/b2_list_buckets",
    ["Authorization: $jetonAuth", 'Content-Type: application/json'],
    json_encode(['accountId' => $auth['accountId'], 'bucketName' => B2_BUCKET_NAME]),
);
if (empty($buckets['buckets'])) {
    echec('bucket "' . B2_BUCKET_NAME . '" introuvable sur ce compte B2.');
}
$bucketId = $buckets['buckets'][0]['bucketId'];

// 3. Envoi du fichier ---------------------------------------------------------

$urlEnvoi = b2Appel(
    "$apiUrl/b2api/v2/b2_get_upload_url",
    ["Authorization: $jetonAuth", 'Content-Type: application/json'],
    json_encode(['bucketId' => $bucketId]),
);

$contenu = file_get_contents($cheminLocal);
$ch = curl_init($urlEnvoi['uploadUrl']);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $contenu,
    CURLOPT_HTTPHEADER => [
        'Authorization: ' . $urlEnvoi['uploadAuthToken'],
        'X-Bz-File-Name: ' . rawurlencode($nomFichier),
        'Content-Type: application/gzip',
        'Content-Length: ' . strlen($contenu),
        'X-Bz-Content-Sha1: ' . sha1($contenu),
    ],
    CURLOPT_TIMEOUT => 300,
]);
$reponseEnvoi = curl_exec($ch);
$codeEnvoi = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($codeEnvoi >= 300) {
    echec("envoi vers B2 a échoué (HTTP $codeEnvoi) : " . substr((string) $reponseEnvoi, 0, 500));
}

unlink($cheminLocal);
trace("envoyé vers B2 avec succès : $nomFichier");
echo "[clicetmots-backup] OK : $nomFichier envoyé vers B2 (" . strlen($contenu) . " octets)\n";

// 4. Rotation : supprime les sauvegardes plus vieilles que la rétention ------

$seuil = time() - BACKUP_RETENTION_JOURS * 86400;
$liste = b2Appel(
    "$apiUrl/b2api/v2/b2_list_file_names",
    ["Authorization: $jetonAuth", 'Content-Type: application/json'],
    json_encode(['bucketId' => $bucketId, 'prefix' => 'clicetmots_', 'maxFileCount' => 1000]),
);

$supprimes = 0;
foreach ($liste['files'] ?? [] as $fichier) {
    if (($fichier['uploadTimestamp'] / 1000) < $seuil) {
        b2Appel(
            "$apiUrl/b2api/v2/b2_delete_file_version",
            ["Authorization: $jetonAuth", 'Content-Type: application/json'],
            json_encode(['fileName' => $fichier['fileName'], 'fileId' => $fichier['fileId']]),
        );
        $supprimes++;
    }
}

echo "[clicetmots-backup] Rotation : $supprimes ancienne(s) sauvegarde(s) supprimée(s) (rétention " . BACKUP_RETENTION_JOURS . " jours).\n";
