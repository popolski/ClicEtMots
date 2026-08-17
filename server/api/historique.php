<?php
// Historique des mots consultés par un élève - centralisé côté serveur
// (voir schema-v6.sql), même principe que quiz-resultats.php.
require_once __DIR__ . '/auth.php';
configureSession();
$user = requireAuth();

if ($user['role'] !== 'student') {
    jsonResponse(403, ['error' => 'Réservé aux élèves']);
}

// Assez pour couvrir une session de travail sans devenir une longue liste
// illisible - même valeur que l'ancienne version locale (historique.ts).
const TAILLE_MAX = 30;

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare(
        'SELECT lemma_id, word, category, consulte_le FROM historique_consultation WHERE student_id = ? ORDER BY consulte_le DESC LIMIT ' . TAILLE_MAX,
    );
    $stmt->execute([$user['id']]);
    $entrees = array_map(fn($r) => [
        'lemmaId' => $r['lemma_id'],
        'word' => $r['word'],
        'category' => $r['category'],
        'consulteLe' => $r['consulte_le'],
    ], $stmt->fetchAll());
    jsonResponse(200, ['entrees' => $entrees]);
}

if ($method === 'POST') {
    $body = jsonBody();
    $lemmaId = (string) ($body['lemmaId'] ?? '');
    $word = (string) ($body['word'] ?? '');
    $category = (string) ($body['category'] ?? '');

    if ($lemmaId === '' || $word === '' || !in_array($category, ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable'], true)) {
        jsonResponse(400, ['error' => 'Entrée invalide']);
    }

    // Remonte en tête si déjà présent : on supprime l'ancienne ligne avant
    // de réinsérer, plutôt qu'un UPSERT (pas de contrainte unique ici,
    // contrairement à favoris - un même mot peut légitimement apparaître
    // plusieurs fois consulté à des moments différents, seule la plus
    // récente nous intéresse).
    $stmt = $db->prepare('DELETE FROM historique_consultation WHERE student_id = ? AND lemma_id = ?');
    $stmt->execute([$user['id'], $lemmaId]);

    $stmt = $db->prepare('INSERT INTO historique_consultation (student_id, lemma_id, word, category) VALUES (?, ?, ?, ?)');
    $stmt->execute([$user['id'], $lemmaId, $word, $category]);

    // Ne garde que les TAILLE_MAX plus récents.
    $stmt = $db->prepare(
        'DELETE FROM historique_consultation WHERE student_id = ? AND id NOT IN ('
        . 'SELECT id FROM (SELECT id FROM historique_consultation WHERE student_id = ? ORDER BY consulte_le DESC LIMIT ' . TAILLE_MAX . ') t)',
    );
    $stmt->execute([$user['id'], $user['id']]);

    jsonResponse(201, ['ok' => true]);
}

if ($method === 'DELETE') {
    $stmt = $db->prepare('DELETE FROM historique_consultation WHERE student_id = ?');
    $stmt->execute([$user['id']]);
    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
