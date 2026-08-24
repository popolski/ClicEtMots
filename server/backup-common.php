<?php
// Fonctions partagées entre backup-db.php (quotidien, base de données) et
// backup-files.php (hebdomadaire, dist/ + audio/pictos/mascottes + config.php)
// - factorisées ici pour ne pas dupliquer l'appel à l'API B2 dans les deux
// scripts. Jamais appelé directement (pas de garde CLI ici, elle vit dans
// chaque script appelant).

function echec(string $message): never {
    fwrite(STDERR, "[clicetmots-backup] ÉCHEC : $message\n");
    exit(1);
}

/**
 * Appel générique à l'API B2 (v2, JSON). Ne définit CURLOPT_POSTFIELDS que
 * si un corps est vraiment fourni : le fixer à null bascule quand même la
 * requête en POST côté cURL (même vide), alors que b2_authorize_account
 * attend un GET simple avec juste l'en-tête d'autorisation.
 */
function b2Appel(string $url, array $headers, ?string $body = null): array {
    $ch = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 120,
    ];
    if ($body !== null) {
        $options[CURLOPT_POST] = true;
        $options[CURLOPT_POSTFIELDS] = $body;
    }
    curl_setopt_array($ch, $options);
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

/** Authentifie et retrouve le bucketId à partir de son nom (B2_BUCKET_NAME). */
function b2Connexion(): array {
    $auth = b2Appel(
        'https://api.backblazeb2.com/b2api/v2/b2_authorize_account',
        ['Authorization: Basic ' . base64_encode(B2_KEY_ID . ':' . B2_APPLICATION_KEY)],
    );

    $buckets = b2Appel(
        $auth['apiUrl'] . '/b2api/v2/b2_list_buckets',
        ['Authorization: ' . $auth['authorizationToken'], 'Content-Type: application/json'],
        json_encode(['accountId' => $auth['accountId'], 'bucketName' => B2_BUCKET_NAME]),
    );
    if (empty($buckets['buckets'])) {
        echec('bucket "' . B2_BUCKET_NAME . '" introuvable sur ce compte B2.');
    }

    return [
        'apiUrl' => $auth['apiUrl'],
        'jeton' => $auth['authorizationToken'],
        'bucketId' => $buckets['buckets'][0]['bucketId'],
    ];
}

/** Envoie un fichier local vers B2 sous le nom $nomDistant. */
function b2Envoyer(array $connexion, string $cheminLocal, string $nomDistant): void {
    $urlEnvoi = b2Appel(
        $connexion['apiUrl'] . '/b2api/v2/b2_get_upload_url',
        ['Authorization: ' . $connexion['jeton'], 'Content-Type: application/json'],
        json_encode(['bucketId' => $connexion['bucketId']]),
    );

    $contenu = file_get_contents($cheminLocal);
    $ch = curl_init($urlEnvoi['uploadUrl']);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $contenu,
        CURLOPT_HTTPHEADER => [
            'Authorization: ' . $urlEnvoi['authorizationToken'],
            'X-Bz-File-Name: ' . rawurlencode($nomDistant),
            'Content-Type: b2/x-auto',
            'Content-Length: ' . strlen($contenu),
            'X-Bz-Content-Sha1: ' . sha1($contenu),
        ],
        CURLOPT_TIMEOUT => 600,
    ]);
    $reponseEnvoi = curl_exec($ch);
    $codeEnvoi = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($codeEnvoi >= 300) {
        echec("envoi vers B2 a échoué (HTTP $codeEnvoi) : " . substr((string) $reponseEnvoi, 0, 500));
    }
}

/** Supprime sur B2 les fichiers du préfixe donné plus vieux que $retentionJours. */
function b2Rotation(array $connexion, string $prefixe, int $retentionJours): int {
    $seuil = time() - $retentionJours * 86400;
    $liste = b2Appel(
        $connexion['apiUrl'] . '/b2api/v2/b2_list_file_names',
        ['Authorization: ' . $connexion['jeton'], 'Content-Type: application/json'],
        json_encode(['bucketId' => $connexion['bucketId'], 'prefix' => $prefixe, 'maxFileCount' => 1000]),
    );

    $supprimes = 0;
    foreach ($liste['files'] ?? [] as $fichier) {
        if (($fichier['uploadTimestamp'] / 1000) < $seuil) {
            b2Appel(
                $connexion['apiUrl'] . '/b2api/v2/b2_delete_file_version',
                ['Authorization: ' . $connexion['jeton'], 'Content-Type: application/json'],
                json_encode(['fileName' => $fichier['fileName'], 'fileId' => $fichier['fileId']]),
            );
            $supprimes++;
        }
    }
    return $supprimes;
}
