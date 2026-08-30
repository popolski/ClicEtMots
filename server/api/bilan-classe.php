<?php
// Bilan de la CLASSE ENTIÈRE pour l'enseignante : agrège dictee_mots_rates
// (déjà stocké par élève, voir dictee-rates.php) pour repérer les mots que
// PLUSIEURS élèves ratent, pas juste un seul - utile pour décider de
// retravailler un mot collectivement plutôt qu'individuellement. Aucune
// donnée nouvelle collectée, uniquement une agrégation d'une table qui
// existait déjà.
require_once __DIR__ . '/auth.php';
configureSession();
$enseignante = contexteEnseignante(requireTeacher());

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(405, ['error' => 'Méthode non autorisée']);
}

$db = getDb();

// Il y a désormais plusieurs comptes enseignants : « tous les élèves » ne veut
// plus dire « sa classe ». Sans ce filtre, le bilan de Marion comptait les
// élèves de Camille.
// Le nombre d'élèves vient de Fast Éval, et non de la table locale : sinon
// il ne compterait que ceux qui se sont déjà connectés, et une classe de 25
// s'afficherait à 3 en début d'année.
$fasteval = getDbFasteval();
if ($fasteval === null) {
    jsonResponse(503, ['error' => 'Fast Éval est momentanément injoignable.']);
}
$stmt = $fasteval->prepare('SELECT COUNT(*) FROM classe WHERE id_enseignant = ? AND actif = 1');
$stmt->execute([$enseignante['fastevalId']]);
$nbEleves = (int) $stmt->fetchColumn();

// Regroupé par lemme + mot (pas juste par mot) pour ne pas mélanger deux
// lemmes homographes qui se prononceraient différemment - même principe que
// le reste de l'app (voir dictee-rates.php). Plafonné à 10 mots : au-delà,
// la liste sert moins à cibler une révision collective qu'à noyer
// l'enseignante sous des cas isolés.
// La jointure sur students fait tout le cloisonnement : un mot raté par un
// élève de l'autre classe ne peut plus entrer dans le compte.
$stmt = $db->prepare(
    'SELECT d.lemma_id, d.word, COUNT(DISTINCT d.student_id) AS nb_eleves_concernes '
    . 'FROM dictee_mots_rates d '
    . 'JOIN students s ON s.id = d.student_id '
    . 'WHERE s.fasteval_enseignant_id = ? '
    . 'GROUP BY d.lemma_id, d.word '
    . 'ORDER BY nb_eleves_concernes DESC, d.word ASC '
    . 'LIMIT 10',
);
$stmt->execute([$enseignante['fastevalId']]);
$motsRates = array_map(fn($r) => [
    'lemmaId' => $r['lemma_id'],
    'word' => $r['word'],
    'nbElevesConcernes' => (int) $r['nb_eleves_concernes'],
], $stmt->fetchAll());

jsonResponse(200, ['nbEleves' => $nbEleves, 'motsRates' => $motsRates]);
