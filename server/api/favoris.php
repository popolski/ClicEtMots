<?php
// Favoris d'un élève - centralisés côté serveur (voir schema-v6.sql), même
// principe que quiz-resultats.php.
require_once __DIR__ . '/auth.php';
configureSession();
$user = requireAuth();

if ($user['role'] !== 'student') {
    jsonResponse(403, ['error' => 'Réservé aux élèves']);
}

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare('SELECT lemma_id, word, category, ajoute_le FROM favoris WHERE student_id = ? ORDER BY ajoute_le DESC');
    $stmt->execute([$user['id']]);
    $favoris = array_map(fn($r) => [
        'lemmaId' => $r['lemma_id'],
        'word' => $r['word'],
        'category' => $r['category'],
        'ajouteLe' => $r['ajoute_le'],
    ], $stmt->fetchAll());
    jsonResponse(200, ['favoris' => $favoris]);
}

if ($method === 'POST') {
    $body = jsonBody();
    $lemmaId = (string) ($body['lemmaId'] ?? '');
    $word = (string) ($body['word'] ?? '');
    $category = (string) ($body['category'] ?? '');

    if ($lemmaId === '' || $word === '' || !in_array($category, ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable'], true)) {
        jsonResponse(400, ['error' => 'Favori invalide']);
    }

    // Déjà favori : remonte juste sa date (ON DUPLICATE KEY, voir uniq_favori).
    $stmt = $db->prepare(
        'INSERT INTO favoris (student_id, lemma_id, word, category) VALUES (?, ?, ?, ?) '
        . 'ON DUPLICATE KEY UPDATE ajoute_le = CURRENT_TIMESTAMP',
    );
    $stmt->execute([$user['id'], $lemmaId, $word, $category]);

    jsonResponse(201, ['ok' => true]);
}

if ($method === 'DELETE') {
    $lemmaId = (string) ($_GET['lemmaId'] ?? '');
    if ($lemmaId === '') {
        jsonResponse(400, ['error' => 'lemmaId manquant']);
    }
    $stmt = $db->prepare('DELETE FROM favoris WHERE student_id = ? AND lemma_id = ?');
    $stmt->execute([$user['id'], $lemmaId]);
    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
