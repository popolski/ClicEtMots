<?php
require_once __DIR__ . '/auth.php';
configureSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Méthode non autorisée']);
}

$ip = clientIp();
if (tooManyAttempts($ip)) {
    jsonResponse(429, ['error' => 'Trop de tentatives, réessaie dans quelques minutes']);
}

$body = jsonBody();
$identifiant = trim((string) ($body['identifiant'] ?? ''));
$motDePasse = (string) ($body['motDePasse'] ?? '');

if ($identifiant === '' || $motDePasse === '') {
    jsonResponse(400, ['error' => 'Identifiant et mot de passe requis']);
}

$db = getDb();

// On essaie d'abord la table enseignant (compte unique), puis les élèves —
// même message d'erreur générique dans les deux cas pour ne pas révéler
// quels identifiants existent.
$stmt = $db->prepare('SELECT id, username AS label, password_hash FROM teachers WHERE username = ?');
$stmt->execute([$identifiant]);
$teacher = $stmt->fetch();

if ($teacher && password_verify($motDePasse, $teacher['password_hash'])) {
    // Nouvel identifiant de session à chaque connexion réussie : sans ça,
    // un identifiant obtenu AVANT le login (ex. posé par un attaquant sur
    // le poste, puis réutilisé) resterait valable une fois la personne
    // authentifiée - c'est la fixation de session. Signalé en revue de code.
    session_regenerate_id(true);
    $_SESSION['user'] = ['id' => $teacher['id'], 'role' => 'teacher', 'label' => $teacher['label']];
    jsonResponse(200, ['role' => 'teacher', 'label' => $teacher['label']]);
}

$stmt = $db->prepare('SELECT id, prenom AS label, password_hash, recherche_directe, confort_lecture, aide_dictee FROM students WHERE prenom = ?');
$stmt->execute([$identifiant]);
$student = $stmt->fetch();

if ($student && password_verify($motDePasse, $student['password_hash'])) {
    session_regenerate_id(true); // voir le commentaire côté enseignant ci-dessus
    purgerSiNouvelleAnneeScolaire((int) $student['id']);
    $rechercheDirecte = (bool) $student['recherche_directe'];
    $confortLecture = (bool) $student['confort_lecture'];
    $aideDictee = (bool) $student['aide_dictee'];
    $_SESSION['user'] = [
        'id' => $student['id'],
        'role' => 'student',
        'label' => $student['label'],
        'rechercheDirecte' => $rechercheDirecte,
        'confortLecture' => $confortLecture,
        'aideDictee' => $aideDictee,
    ];
    jsonResponse(200, [
        'role' => 'student',
        'label' => $student['label'],
        'rechercheDirecte' => $rechercheDirecte,
        'confortLecture' => $confortLecture,
        'aideDictee' => $aideDictee,
    ]);
}

recordFailedAttempt($ip);
jsonResponse(401, ['error' => 'Identifiant ou mot de passe incorrect']);
