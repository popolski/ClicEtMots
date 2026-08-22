<?php
// Résultats de quiz d'un élève - centralisés côté serveur (voir
// schema-v6.sql) pour que l'enseignante puisse s'appuyer dessus, en échange
// d'une purge automatique par année scolaire (purgerSiNouvelleAnneeScolaire,
// déclenchée à la connexion - voir login.php) et d'un bouton de
// réinitialisation manuelle (voir reset-donnees.php).
require_once __DIR__ . '/auth.php';
configureSession();
$user = requireAuth();

if ($user['role'] !== 'student') {
    jsonResponse(403, ['error' => 'Réservé aux élèves']);
}

// Assez pour couvrir plusieurs semaines sans devenir une longue liste
// illisible - même valeur que l'ancienne version locale (quizHistorique.ts).
const TAILLE_MAX = 20;

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare(
        'SELECT mode, score, total, termine_le FROM quiz_resultats WHERE student_id = ? ORDER BY termine_le DESC LIMIT ' . TAILLE_MAX,
    );
    $stmt->execute([$user['id']]);
    $resultats = array_map(fn($r) => [
        'mode' => $r['mode'],
        'score' => (int) $r['score'],
        'total' => (int) $r['total'],
        'termineLe' => $r['termine_le'],
    ], $stmt->fetchAll());
    jsonResponse(200, ['resultats' => $resultats]);
}

if ($method === 'POST') {
    $body = jsonBody();
    $mode = (string) ($body['mode'] ?? '');
    $score = (int) ($body['score'] ?? -1);
    $total = (int) ($body['total'] ?? -1);

    if (!in_array($mode, ['qcm', 'reconstitution', 'grammaire', 'dictee'], true) || $score < 0 || $total <= 0 || $score > $total) {
        jsonResponse(400, ['error' => 'Résultat de quiz invalide']);
    }

    $stmt = $db->prepare('INSERT INTO quiz_resultats (student_id, mode, score, total) VALUES (?, ?, ?, ?)');
    $stmt->execute([$user['id'], $mode, $score, $total]);

    // Ne garde que les TAILLE_MAX plus récents (même principe que
    // l'ancienne version locale) - évite une table qui grossit sans fin.
    $stmt = $db->prepare(
        'DELETE FROM quiz_resultats WHERE student_id = ? AND id NOT IN ('
        . 'SELECT id FROM (SELECT id FROM quiz_resultats WHERE student_id = ? ORDER BY termine_le DESC LIMIT ' . TAILLE_MAX . ') t)',
    );
    $stmt->execute([$user['id'], $user['id']]);

    jsonResponse(201, ['ok' => true]);
}

if ($method === 'DELETE') {
    $stmt = $db->prepare('DELETE FROM quiz_resultats WHERE student_id = ?');
    $stmt->execute([$user['id']]);
    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
