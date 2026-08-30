<?php
require_once __DIR__ . '/auth.php';
configureSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Méthode non autorisée']);
}

$body = jsonBody();
$identifiant = trim((string) ($body['identifiant'] ?? ''));
$motDePasse = (string) ($body['motDePasse'] ?? '');

if ($identifiant === '' || $motDePasse === '') {
    jsonResponse(400, ['error' => 'Identifiant et mot de passe requis']);
}

$ip = clientIp();
if (tooManyAttempts($ip, $identifiant)) {
    jsonResponse(429, ['error' => 'Trop de tentatives, réessaie dans quelques minutes']);
}

$db = getDb();

// La connexion locale des ÉLÈVES a été retirée à la rentrée 2026 : ils
// entrent désormais par le portail commun (/portail/), qui les reconnaît et
// sait de quelle classe ils sont.
//
// Ce n'est pas un choix de confort. La connexion locale cherchait un élève par
// son seul prénom, sans savoir de quelle classe il était, et prenait le
// PREMIER trouvé. Avec deux classes, le Lucas de Marion n'aurait jamais pu se
// connecter : la requête aurait toujours rendu celui de Camille, dont le mot
// de passe ne correspond pas. Le portail, lui, connaît la classe.
//
// La connexion locale ENSEIGNANTE reste en place, volontairement : c'est la
// porte de secours si le portail tombe un matin de classe.
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

recordFailedAttempt($ip, $identifiant);
jsonResponse(401, ['error' => 'Identifiant ou mot de passe incorrect']);
