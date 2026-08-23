<?php
// Bilan de la CLASSE ENTIÈRE pour l'enseignante : agrège dictee_mots_rates
// (déjà stocké par élève, voir dictee-rates.php) pour repérer les mots que
// PLUSIEURS élèves ratent, pas juste un seul - utile pour décider de
// retravailler un mot collectivement plutôt qu'individuellement. Aucune
// donnée nouvelle collectée, uniquement une agrégation d'une table qui
// existait déjà.
require_once __DIR__ . '/auth.php';
configureSession();
requireTeacher();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(405, ['error' => 'Méthode non autorisée']);
}

$db = getDb();

// Un seul compte enseignant dans ce projet (voir server/README.md) : pas de
// filtre par enseignant, tous les élèves sont de sa classe.
$nbEleves = (int) $db->query('SELECT COUNT(*) FROM students')->fetchColumn();

// Regroupé par lemme + mot (pas juste par mot) pour ne pas mélanger deux
// lemmes homographes qui se prononceraient différemment - même principe que
// le reste de l'app (voir dictee-rates.php). Plafonné à 10 mots : au-delà,
// la liste sert moins à cibler une révision collective qu'à noyer
// l'enseignante sous des cas isolés.
$stmt = $db->query(
    'SELECT lemma_id, word, COUNT(DISTINCT student_id) AS nb_eleves_concernes '
    . 'FROM dictee_mots_rates '
    . 'GROUP BY lemma_id, word '
    . 'ORDER BY nb_eleves_concernes DESC, word ASC '
    . 'LIMIT 10',
);
$motsRates = array_map(fn($r) => [
    'lemmaId' => $r['lemma_id'],
    'word' => $r['word'],
    'nbElevesConcernes' => (int) $r['nb_eleves_concernes'],
], $stmt->fetchAll());

jsonResponse(200, ['nbEleves' => $nbEleves, 'motsRates' => $motsRates]);
