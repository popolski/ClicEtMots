<?php
// Listes de mots hebdomadaires, choisies par l'enseignante - visibles par
// tous les élèves (quiz : révision cumulée de toutes les listes ; fiches à
// imprimer : une liste à la fois). Contrairement à la version précédente
// (une seule "liste courante" écrasée chaque semaine), chaque semaine reste
// une liste distincte et consultable/imprimable séparément (voir
// schema-v4.sql - la table stockait déjà chaque enregistrement, seule cette
// API ne renvoyait que le plus récent).
require_once __DIR__ . '/auth.php';
configureSession();
// L'élève lit aussi cette API : on résout son enseignante pour ne lui montrer
// que les listes de SA classe. Un CE1 n'a rien à faire avec les mots du CE2.
$enseignante = contexteEnseignante(requireAuth());

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->prepare(
        'SELECT id, nom, mots, updated_at FROM liste_mots_semaine WHERE updated_by = ? ORDER BY id DESC',
    );
    $stmt->execute([$enseignante['teacherId']]);
    $rows = $stmt->fetchAll();
    $listes = array_map(fn($row) => [
        'id' => (int) $row['id'],
        'nom' => $row['nom'],
        'mots' => json_decode($row['mots'], true),
        'updatedAt' => $row['updated_at'],
    ], $rows);
    jsonResponse(200, ['listes' => $listes]);
}

if ($method === 'POST') {
    $user = requireTeacher();

    $body = jsonBody();
    $id = isset($body['id']) ? (int) $body['id'] : null;
    $nom = trim((string) ($body['nom'] ?? 'Mots de la semaine'));
    $mots = $body['mots'] ?? [];

    if ($nom === '' || mb_strlen($nom) > 200) {
        jsonResponse(400, ['error' => 'Nom de liste invalide']);
    }
    if (!is_array($mots) || count($mots) > 100) {
        jsonResponse(400, ['error' => 'Liste de mots invalide (max 100 mots)']);
    }
    foreach ($mots as $mot) {
        if (
            !is_array($mot)
            || !isset($mot['lemmaId'], $mot['word'], $mot['category'])
            || !is_string($mot['lemmaId'])
            || !is_string($mot['word'])
            || !is_string($mot['category'])
        ) {
            jsonResponse(400, ['error' => 'Format de mot invalide']);
        }
    }

    $motsJson = json_encode(array_values($mots));

    // id fourni = on modifie une liste existante (ex. corriger une erreur
    // avant impression) ; sinon on démarre une nouvelle semaine.
    if ($id !== null && $id > 0) {
        // Le WHERE porte aussi sur l'autrice : sans lui, envoyer l'identifiant
        // d'une liste de l'autre classe suffisait à la réécrire.
        $stmt = $db->prepare('UPDATE liste_mots_semaine SET nom = ?, mots = ? WHERE id = ? AND updated_by = ?');
        $stmt->execute([$nom, $motsJson, $id, $user['id']]);
        if ($stmt->rowCount() === 0) {
            // rowCount() vaut aussi 0 quand la liste existe mais n'a pas
            // changé d'un octet : on vérifie donc qu'elle est bien à elle
            // avant de crier à l'introuvable.
            $verif = $db->prepare('SELECT 1 FROM liste_mots_semaine WHERE id = ? AND updated_by = ?');
            $verif->execute([$id, $user['id']]);
            if (!$verif->fetchColumn()) {
                jsonResponse(404, ['error' => 'Liste introuvable']);
            }
        }
        jsonResponse(200, ['ok' => true, 'id' => $id]);
    }

    $stmt = $db->prepare('INSERT INTO liste_mots_semaine (nom, mots, updated_by) VALUES (?, ?, ?)');
    $stmt->execute([$nom, $motsJson, $user['id']]);

    jsonResponse(201, ['ok' => true, 'id' => (int) $db->lastInsertId()]);
}

if ($method === 'DELETE') {
    $user = requireTeacher();
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(400, ['error' => 'id manquant']);
    }
    $stmt = $db->prepare('DELETE FROM liste_mots_semaine WHERE id = ? AND updated_by = ?');
    $stmt->execute([$id, $user['id']]);
    if ($stmt->rowCount() === 0) {
        jsonResponse(404, ['error' => 'Liste introuvable']);
    }
    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
