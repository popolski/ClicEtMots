<?php
// Réinitialisation manuelle des données élève (quiz/favoris/historique) -
// en complément de la purge automatique par année scolaire (voir auth.php,
// purgerSiNouvelleAnneeScolaire) : l'enseignante peut aussi déclencher un
// nettoyage à la demande, pour un élève précis ou toute la classe.
require_once __DIR__ . '/auth.php';
configureSession();
requireTeacher();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Méthode non autorisée']);
}

$db = getDb();
$body = jsonBody();
$studentId = isset($body['studentId']) ? (int) $body['studentId'] : null;

if ($studentId !== null && $studentId > 0) {
    reinitialiserDonneesEleve($db, $studentId);
    jsonResponse(200, ['ok' => true]);
}

// Pas d'id fourni : réinitialise TOUS les élèves.
$ids = $db->query('SELECT id FROM students')->fetchAll(PDO::FETCH_COLUMN);
foreach ($ids as $id) {
    reinitialiserDonneesEleve($db, (int) $id);
}

jsonResponse(200, ['ok' => true]);
