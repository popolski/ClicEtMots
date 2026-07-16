<?php
// Relations (synonymes / contraires / mots de la même famille) rattachées à
// la main par l'enseignante à un mot qu'elle a ajouté. Ces mots étant absents
// des bases lexicales, aucune relation ne peut être déduite automatiquement.
require_once __DIR__ . '/auth.php';
configureSession();
requireTeacher();

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

$TYPES = ['synonyme', 'antonyme', 'famille'];
$CATEGORIES = ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable'];

if ($method === 'POST') {
    $body = jsonBody();
    $wordId = (int) ($body['wordId'] ?? 0);
    $type = (string) ($body['type'] ?? '');
    $targetLemmaId = trim((string) ($body['targetLemmaId'] ?? ''));
    $targetWord = trim((string) ($body['targetWord'] ?? ''));
    $targetCategory = (string) ($body['targetCategory'] ?? '');

    if ($wordId <= 0) {
        jsonResponse(400, ['error' => 'wordId manquant']);
    }
    if (!in_array($type, $TYPES, true)) {
        jsonResponse(400, ['error' => 'Type de relation invalide']);
    }
    if ($targetLemmaId === '' || mb_strlen($targetLemmaId) > 160) {
        jsonResponse(400, ['error' => 'Mot cible invalide']);
    }
    if ($targetWord === '' || mb_strlen($targetWord) > 100) {
        jsonResponse(400, ['error' => 'Mot cible invalide']);
    }
    if (!in_array($targetCategory, $CATEGORIES, true)) {
        jsonResponse(400, ['error' => 'Catégorie cible invalide']);
    }

    // Le mot source doit exister (la clé étrangère le garantirait, mais un
    // message clair vaut mieux qu'une erreur SQL brute).
    $stmt = $db->prepare('SELECT categorie FROM lexicon_additions WHERE id = ?');
    $stmt->execute([$wordId]);
    $source = $stmt->fetch();
    if (!$source) {
        jsonResponse(404, ['error' => 'Mot introuvable']);
    }

    // Même règle que le lexique généré (build-word-synonyms.mjs) : un
    // synonyme/contraire ne relie que des mots de même catégorie grammaticale
    // — un nom n'a pour synonymes que des noms. Évite les rapprochements
    // bizarres que l'enseignante avait justement signalés.
    //
    // "famille" n'a PAS cette contrainte : dans le lexique généré, 75% des
    // liens de famille changent de catégorie (trouille/nom, trouillard/
    // adjectif) — c'est le principe même d'une famille de mots, pas une
    // exception.
    if ($type !== 'famille' && $source['categorie'] !== $targetCategory) {
        jsonResponse(400, [
            'error' => "Le mot lié doit être de la même catégorie ({$source['categorie']}).",
        ]);
    }

    // INSERT IGNORE : rattacher deux fois le même mot ne doit pas être une
    // erreur (contrainte uniq_relation).
    $stmt = $db->prepare(
        'INSERT IGNORE INTO lexicon_relations (word_id, type, target_lemma_id, target_word, target_category)
         VALUES (?, ?, ?, ?, ?)',
    );
    $stmt->execute([$wordId, $type, $targetLemmaId, $targetWord, $targetCategory]);

    jsonResponse(201, ['ok' => true]);
}

if ($method === 'DELETE') {
    $wordId = (int) ($_GET['wordId'] ?? 0);
    $type = (string) ($_GET['type'] ?? '');
    $targetLemmaId = (string) ($_GET['targetLemmaId'] ?? '');

    if ($wordId <= 0 || !in_array($type, $TYPES, true) || $targetLemmaId === '') {
        jsonResponse(400, ['error' => 'Paramètres manquants']);
    }

    $stmt = $db->prepare('DELETE FROM lexicon_relations WHERE word_id = ? AND type = ? AND target_lemma_id = ?');
    $stmt->execute([$wordId, $type, $targetLemmaId]);

    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
