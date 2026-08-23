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

// Plus large que la limite de 20 utilisée côté élève (quiz-resultats.php) :
// ici on calcule des moyennes sur la durée, pas une liste à afficher telle
// quelle, une fenêtre plus large donne une image plus juste.
$stmt = $db->prepare(
    'SELECT mode, score, total, termine_le FROM quiz_resultats WHERE student_id = ? ORDER BY termine_le DESC LIMIT 200',
);
$stmt->execute([$studentId]);
$resultats = array_map(fn($r) => [
    'mode' => $r['mode'],
    'score' => (int) $r['score'],
    'total' => (int) $r['total'],
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
