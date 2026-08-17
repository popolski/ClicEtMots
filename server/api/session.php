<?php
require_once __DIR__ . '/auth.php';
configureSession();

if (empty($_SESSION['user'])) {
    jsonResponse(200, ['authenticated' => false]);
}

jsonResponse(200, [
    'authenticated' => true,
    'role' => $_SESSION['user']['role'],
    'label' => $_SESSION['user']['label'],
    // Absent pour un enseignant - seuls les élèves ont ce champ (voir login.php).
    'rechercheDirecte' => $_SESSION['user']['rechercheDirecte'] ?? null,
]);
