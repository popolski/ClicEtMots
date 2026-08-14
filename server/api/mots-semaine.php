<?php
// Liste de mots de la semaine, choisie par l'enseignante - visible par tous
// les élèves (quiz, fiches à imprimer). Une seule ligne "en cours" à la
// fois : on lit toujours la plus récente, on n'écrase jamais les
// précédentes (voir schema-v4.sql).
require_once __DIR__ . '/auth.php';
configureSession();
requireAuth();

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query('SELECT nom, mots, updated_at FROM liste_mots_semaine ORDER BY id DESC LIMIT 1');
    $row = $stmt->fetch();
    if (!$row) {
        jsonResponse(200, ['nom' => null, 'mots' => [], 'updatedAt' => null]);
    }
    jsonResponse(200, [
        'nom' => $row['nom'],
        'mots' => json_decode($row['mots'], true),
        'updatedAt' => $row['updated_at'],
    ]);
}

if ($method === 'POST') {
    $user = requireTeacher();

    $body = jsonBody();
    $nom = trim((string) ($body['nom'] ?? 'Mots de la semaine'));
    $mots = $body['mots'] ?? [];

    if ($nom === '' || mb_strlen($nom) > 200) {
        jsonResponse(400, ['error' => 'Nom de liste invalide']);
    }
    if (!is_array($mots) || count($mots) > 100) {
        jsonResponse(400, ['error' => 'Liste de mots invalide (max 100 mots)']);
    }
    foreach ($mots as $mot) {
        if (
            !is_array($mot)
            || !isset($mot['lemmaId'], $mot['word'], $mot['category'])
            || !is_string($mot['lemmaId'])
            || !is_string($mot['word'])
            || !is_string($mot['category'])
        ) {
            jsonResponse(400, ['error' => 'Format de mot invalide']);
        }
    }

    $stmt = $db->prepare('INSERT INTO liste_mots_semaine (nom, mots, updated_by) VALUES (?, ?, ?)');
    $stmt->execute([$nom, json_encode(array_values($mots)), $user['id']]);

    jsonResponse(201, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
