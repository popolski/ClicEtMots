<?php
require_once __DIR__ . '/auth.php';
configureSession();

if (empty($_SESSION['user'])) {
    jsonResponse(200, ['authenticated' => false]);
}

$user = $_SESSION['user'];
$rechercheDirecte = $user['rechercheDirecte'] ?? null;
$confortLecture = $user['confortLecture'] ?? null;

// Relit ces deux réglages en base à chaque appel plutôt que de se fier au
// cache de session (rempli une seule fois à la connexion, voir login.php) :
// sans ça, une enseignante qui décoche "Recherche" ou "Confort" pendant
// qu'un élève est déjà connecté n'a aucun effet tant qu'il ne se
// reconnecte pas - signalé à l'usage. session() est déjà appelé à chaque
// chargement de l'app (voir auth.tsx), donc ce n'est jamais plus vieux que
// la page en cours.
if ($user['role'] === 'student') {
    $stmt = getDb()->prepare('SELECT recherche_directe, confort_lecture FROM students WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        // Compte supprimé entre-temps par l'enseignante (voir DELETE dans
        // students.php) : jusqu'ici la session restait "authentifiée"
        // jusqu'à son expiration naturelle (7 jours, voir configureSession)
        // même si le compte n'existait plus - signalé en revue de code.
        // Déconnexion immédiate plutôt que de laisser un compte fantôme
        // accéder au site.
        session_destroy();
        jsonResponse(200, ['authenticated' => false]);
    }
    $rechercheDirecte = (bool) $row['recherche_directe'];
    $confortLecture = (bool) $row['confort_lecture'];
}

jsonResponse(200, [
    'authenticated' => true,
    'role' => $user['role'],
    'label' => $user['label'],
    // Absents pour un enseignant - seuls les élèves ont ces champs (voir login.php).
    'rechercheDirecte' => $rechercheDirecte,
    'confortLecture' => $confortLecture,
]);
