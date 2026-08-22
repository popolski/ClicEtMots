<?php
// Mots ratés en dictée, retenus d'une séance à l'autre (voir schema-v10.sql).
// Même principe que favoris.php : données d'élève, centralisées côté serveur.
//
// Jusqu'ici les mots ratés n'étaient repassés qu'en fin de séance puis
// oubliés. Ils reviennent maintenant en tête de la dictée suivante, jusqu'à
// ce que l'élève les réussisse.
require_once __DIR__ . '/auth.php';
configureSession();
$user = requireAuth();

if ($user['role'] !== 'student') {
    jsonResponse(403, ['error' => 'Réservé aux élèves']);
}

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Les plus ratés d'abord : ce sont ceux qui méritent le plus de revenir.
    $stmt = $db->prepare(
        'SELECT lemma_id, word, ratages FROM dictee_mots_rates WHERE student_id = ? '
        . 'ORDER BY ratages DESC, derniere_erreur ASC',
    );
    $stmt->execute([$user['id']]);
    $mots = array_map(fn($r) => [
        'lemmaId' => $r['lemma_id'],
        'word' => $r['word'],
        'ratages' => (int) $r['ratages'],
    ], $stmt->fetchAll());
    jsonResponse(200, ['mots' => $mots]);
}

if ($method === 'POST') {
    $body = jsonBody();
    $lemmaId = (string) ($body['lemmaId'] ?? '');
    $word = (string) ($body['word'] ?? '');
    $reussi = (bool) ($body['reussi'] ?? false);

    if ($lemmaId === '' || $word === '') {
        jsonResponse(400, ['error' => 'lemmaId et word requis']);
    }

    if ($reussi) {
        // Réussi : le mot sort de la liste. Un seul succès suffit - exiger
        // plusieurs réussites d'affilée serait plus rigoureux, mais on
        // commence simple, quitte à durcir après un vrai usage en classe.
        $stmt = $db->prepare('DELETE FROM dictee_mots_rates WHERE student_id = ? AND lemma_id = ? AND word = ?');
        $stmt->execute([$user['id'], $lemmaId, $word]);
        jsonResponse(200, ['ok' => true]);
    }

    $stmt = $db->prepare(
        'INSERT INTO dictee_mots_rates (student_id, lemma_id, word) VALUES (?, ?, ?) '
        . 'ON DUPLICATE KEY UPDATE ratages = ratages + 1, derniere_erreur = CURRENT_TIMESTAMP',
    );
    $stmt->execute([$user['id'], $lemmaId, $word]);
    jsonResponse(201, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
