<?php
// Bilan d'un élève pour l'enseignante : agrège quiz_resultats et
// dictee_mots_rates, déjà stockés côté serveur, mais jusqu'ici illisibles
// pour elle (quiz-resultats.php et dictee-rates.php sont réservés à l'élève
// lui-même, sur ses propres données). Rien de nouveau n'est collecté ici :
// c'est une vue d'ensemble sur des données qui existaient déjà.
require_once __DIR__ . '/auth.php';
configureSession();
requireTeacher();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(405, ['error' => 'Méthode non autorisée']);
}

$studentId = isset($_GET['studentId']) ? (int) $_GET['studentId'] : 0;
if ($studentId <= 0) {
    jsonResponse(400, ['error' => 'studentId manquant']);
}

$db = getDb();

// Même fenêtre que côté élève (quiz-resultats.php) : assez large pour
// couvrir une année scolaire entière, nécessaire pour un bilan par période.
$stmt = $db->prepare(
    'SELECT mode, score, total, premier_coup, aide_utilisee, duree_secondes, termine_le FROM quiz_resultats WHERE student_id = ? ORDER BY termine_le DESC LIMIT 500',
);
$stmt->execute([$studentId]);
$resultats = array_map(fn($r) => [
    'mode' => $r['mode'],
    'score' => (int) $r['score'],
    'total' => (int) $r['total'],
    'premierCoup' => $r['premier_coup'] !== null ? (int) $r['premier_coup'] : null,
    'aideUtilisee' => $r['aide_utilisee'] !== null ? (int) $r['aide_utilisee'] : null,
    'dureeSecondes' => $r['duree_secondes'] !== null ? (int) $r['duree_secondes'] : null,
    'termineLe' => $r['termine_le'],
], $stmt->fetchAll());

$stmt = $db->prepare(
    'SELECT lemma_id, word, ratages FROM dictee_mots_rates WHERE student_id = ? ORDER BY ratages DESC, derniere_erreur ASC LIMIT 10',
);
$stmt->execute([$studentId]);
$motsRates = array_map(fn($r) => [
    'lemmaId' => $r['lemma_id'],
    'word' => $r['word'],
    'ratages' => (int) $r['ratages'],
], $stmt->fetchAll());

jsonResponse(200, ['resultats' => $resultats, 'motsRates' => $motsRates]);
