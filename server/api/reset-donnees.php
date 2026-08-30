<?php
// Réinitialisation manuelle des données élève (quiz/favoris/historique) -
// en complément de la purge automatique par année scolaire (voir auth.php,
// purgerSiNouvelleAnneeScolaire) : l'enseignante peut aussi déclencher un
// nettoyage à la demande, pour un élève précis ou toute la classe.
require_once __DIR__ . '/auth.php';
configureSession();
$enseignante = contexteEnseignante(requireTeacher());

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Méthode non autorisée']);
}

$db = getDb();
$body = jsonBody();
$studentId = isset($body['studentId']) ? (int) $body['studentId'] : null;

if ($studentId !== null && $studentId > 0) {
    // Identifiant Fast Éval, comme partout depuis que la liste vient de là.
    $idLocal = eleveLocalDeLaClasse($studentId, $enseignante['fastevalId']);
    if ($idLocal !== null) {
        reinitialiserDonneesEleve($db, $idLocal);
    }
    // Un élève jamais venu n'a rien à réinitialiser : on répond quand même
    // que c'est fait, parce que du point de vue de l'enseignante, ça l'est.
    jsonResponse(200, ['ok' => true]);
}

// Pas d'id fourni : réinitialise toute SA classe. C'est l'endroit le plus
// dangereux de l'API - sans ce filtre, un clic de Marion sur « tout
// réinitialiser » effaçait le travail des élèves de Camille, sans confirmation
// possible et sans retour arrière.
$stmt = $db->prepare('SELECT id FROM students WHERE fasteval_enseignant_id = ?');
$stmt->execute([$enseignante['fastevalId']]);
$ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
foreach ($ids as $id) {
    reinitialiserDonneesEleve($db, (int) $id);
}

jsonResponse(200, ['ok' => true]);
