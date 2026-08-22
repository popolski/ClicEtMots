<?php
require_once __DIR__ . '/auth.php';
configureSession();
requireTeacher();

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query('SELECT id, prenom, created_at, recherche_directe, confort_lecture FROM students ORDER BY prenom');
    $rows = $stmt->fetchAll();
    $students = array_map(fn($row) => [
        'id' => (int) $row['id'],
        'prenom' => $row['prenom'],
        'created_at' => $row['created_at'],
        'recherche_directe' => (bool) $row['recherche_directe'],
        'confort_lecture' => (bool) $row['confort_lecture'],
    ], $rows);
    jsonResponse(200, ['students' => $students]);
}

if ($method === 'POST') {
    $body = jsonBody();
    $prenom = trim((string) ($body['prenom'] ?? ''));
    $motDePasse = (string) ($body['motDePasse'] ?? '');

    if ($prenom === '' || mb_strlen($prenom) > 100) {
        jsonResponse(400, ['error' => 'Prénom invalide']);
    }
    if (mb_strlen($motDePasse) < 4) {
        jsonResponse(400, ['error' => 'Le mot de passe doit faire au moins 4 caractères']);
    }

    // Le prénom sert aussi d'identifiant de connexion (voir login.php, qui
    // ne vérifie que le PREMIER compte trouvé pour un prénom donné) : deux
    // comptes avec le même prénom rendraient le second injoignable. On ne
    // bloque que ce cas précis (rare), plutôt que d'imposer un champ
    // supplémentaire à tout le monde - le message invite à ajouter une
    // initiale, ex. "Lucas B.", comme le ferait l'enseignante à l'oral.
    $stmt = $db->prepare('SELECT COUNT(*) FROM students WHERE prenom = ?');
    $stmt->execute([$prenom]);
    if ((int) $stmt->fetchColumn() > 0) {
        jsonResponse(409, [
            'error' => "Il y a déjà un élève prénommé « $prenom ». Ajoute une initiale pour le distinguer (ex. « $prenom B. »).",
        ]);
    }

    $hash = password_hash($motDePasse, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT INTO students (prenom, password_hash) VALUES (?, ?)');
    $stmt->execute([$prenom, $hash]);

    jsonResponse(201, ['id' => (int) $db->lastInsertId(), 'prenom' => $prenom]);
}

// Réglages décidés au cas par cas par l'enseignante pour un élève :
// recherche directe par orthographe (schema-v5.sql), mode confort de
// lecture / dys (schema-v7.sql) et filet de secours de la dictée
// (schema-v8.sql). Tous choisis par elle plutôt que laissés en
// auto-activation côté élève.
if ($method === 'PATCH') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(400, ['error' => 'id manquant']);
    }
    $body = jsonBody();

    // Un seul endpoint pour les trois réglages, chacun optionnel : le
    // front n'envoie que celui qui a changé.
    $reglages = [
        'rechercheDirecte' => 'recherche_directe',
        'confortLecture' => 'confort_lecture',
    ];
    $modifies = 0;
    foreach ($reglages as $cleJson => $colonne) {
        if (!array_key_exists($cleJson, $body)) {
            continue;
        }
        // Nom de colonne issu de la liste fermée ci-dessus, jamais du corps
        // de la requête - pas d'interpolation d'entrée utilisateur en SQL.
        $stmt = $db->prepare("UPDATE students SET $colonne = ? WHERE id = ?");
        $stmt->execute([$body[$cleJson] ? 1 : 0, $id]);
        $modifies++;
    }

    if ($modifies === 0) {
        jsonResponse(400, ['error' => 'rechercheDirecte ou confortLecture requis']);
    }

    jsonResponse(200, ['ok' => true]);
}

if ($method === 'DELETE') {
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(400, ['error' => 'id manquant']);
    }
    $stmt = $db->prepare('DELETE FROM students WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
