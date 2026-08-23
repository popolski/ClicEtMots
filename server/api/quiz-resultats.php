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

// Assez pour couvrir une année scolaire entière (purge déjà faite par
// purgerSiNouvelleAnneeScolaire à chaque rentrée) sans devenir sans fin - le
// bilan par période a besoin de tout l'historique de l'année, pas juste des
// dernières séances.
const TAILLE_MAX = 500;

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare(
        'SELECT mode, score, total, premier_coup, aide_utilisee, duree_secondes, termine_le FROM quiz_resultats WHERE student_id = ? ORDER BY termine_le DESC LIMIT ' . TAILLE_MAX,
    );
    $stmt->execute([$user['id']]);
    $resultats = array_map(fn($r) => [
        'mode' => $r['mode'],
        'score' => (int) $r['score'],
        'total' => (int) $r['total'],
        'premierCoup' => $r['premier_coup'] !== null ? (int) $r['premier_coup'] : null,
        'aideUtilisee' => $r['aide_utilisee'] !== null ? (int) $r['aide_utilisee'] : null,
        'dureeSecondes' => $r['duree_secondes'] !== null ? (int) $r['duree_secondes'] : null,
        'termineLe' => $r['termine_le'],
    ], $stmt->fetchAll());
    jsonResponse(200, ['resultats' => $resultats]);
}

if ($method === 'POST') {
    $body = jsonBody();
    $mode = (string) ($body['mode'] ?? '');
    $score = (int) ($body['score'] ?? -1);
    $total = (int) ($body['total'] ?? -1);
    // Optionnel : absent (mots-clé non envoyé par un ancien build en cache)
    // -> NULL, comme les séances enregistrées avant schema-v11.sql/v12.sql.
    $premierCoup = isset($body['premierCoup']) ? (int) $body['premierCoup'] : null;
    $aideUtilisee = isset($body['aideUtilisee']) ? (int) $body['aideUtilisee'] : null;
    $dureeSecondes = isset($body['dureeSecondes']) ? (int) $body['dureeSecondes'] : null;

    if (!in_array($mode, ['qcm', 'reconstitution', 'grammaire', 'dictee', 'graphie'], true) || $score < 0 || $total <= 0 || $score > $total) {
        jsonResponse(400, ['error' => 'Résultat de quiz invalide']);
    }
    if ($dureeSecondes !== null && $dureeSecondes < 0) {
        jsonResponse(400, ['error' => 'dureeSecondes invalide']);
    }
    // Ne peut pas y avoir plus de réponses "du premier coup" que de bonnes
    // réponses tout court - une réponse ratée n'est jamais "du premier coup".
    if ($premierCoup !== null && ($premierCoup < 0 || $premierCoup > $score)) {
        jsonResponse(400, ['error' => 'premierCoup invalide']);
    }
    // Le filet de secours peut être ouvert sur un mot fini juste ou faux :
    // seule borne sûre, il ne peut pas avoir servi sur plus de mots qu'il n'y
    // en avait dans la séance.
    if ($aideUtilisee !== null && ($aideUtilisee < 0 || $aideUtilisee > $total)) {
        jsonResponse(400, ['error' => 'aideUtilisee invalide']);
    }

    $stmt = $db->prepare('INSERT INTO quiz_resultats (student_id, mode, score, total, premier_coup, aide_utilisee, duree_secondes) VALUES (?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$user['id'], $mode, $score, $total, $premierCoup, $aideUtilisee, $dureeSecondes]);

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
