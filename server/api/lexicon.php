<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/conjugaison.php';
require_once __DIR__ . '/tts.php';
configureSession();
$user = requireAuth(); // élève ou enseignant : tout le monde peut lire les mots ajoutés

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query(
        'SELECT id, mot, categorie, phonemes, genre, conjugaison, feminin_mot, feminin_phonemes
         FROM lexicon_additions ORDER BY mot',
    );
    $rows = $stmt->fetchAll();

    // Relations de tous les mots en une requête (plutôt qu'une par mot).
    $rel = $db->query(
        'SELECT word_id, type, target_lemma_id, target_word, target_category FROM lexicon_relations',
    )->fetchAll();
    $relationsParMot = [];
    foreach ($rel as $r) {
        $relationsParMot[$r['word_id']][$r['type']][] = [
            'lemmaId' => $r['target_lemma_id'],
            'word' => $r['target_word'],
            'category' => $r['target_category'],
        ];
    }

    foreach ($rows as &$row) {
        $row['phonemes'] = json_decode($row['phonemes'], true);
        $row['conjugaison'] = $row['conjugaison'] !== null ? json_decode($row['conjugaison'], true) : null;
        $row['feminin_phonemes'] = $row['feminin_phonemes'] !== null ? json_decode($row['feminin_phonemes'], true) : null;
        $row['relations'] = [
            'synonyme' => $relationsParMot[$row['id']]['synonyme'] ?? [],
            'antonyme' => $relationsParMot[$row['id']]['antonyme'] ?? [],
            'famille' => $relationsParMot[$row['id']]['famille'] ?? [],
        ];
    }
    jsonResponse(200, ['words' => $rows]);
}

if ($method === 'POST') {
    if ($user['role'] !== 'teacher') {
        jsonResponse(403, ['error' => 'Réservé à l\'enseignant']);
    }

    // Séquence de touches valides du clavier phonétique (src/data/phonemes.json)
    // — tenue à jour manuellement ici, ne change quasiment jamais.
    $validPhonemeIds = [
        'a', 'e', 'i', 'o', 'u', 'ou', 'on', 'an', 'in', 'oi', 'eu',
        'b', 'ch', 'd', 'f', 'g', 'j', 'c', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'z',
        'gn', 'ill', 'oin', 'x', 'w', 'ui',
    ];
    $validCategories = ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable'];

    // Le client envoie un tableau déjà calculé (conjugation-fr) et vérifié
    // visuellement par l'enseignante — on ne le régénère pas, mais on ne lui
    // fait pas non plus une confiance aveugle : structure et personnes
    // attendues, sinon on retombe sur le générateur PHP (voir plus bas).
    function validerConjugaisonEnvoyee(mixed $conjugaison): ?array
    {
        if (!is_array($conjugaison)) {
            return null;
        }
        $personnes = ['je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles'];
        $temps = ['present', 'futur', 'imparfait', 'passeCompose'];

        if (!is_string($conjugaison['infinitif'] ?? null)) {
            return null;
        }
        if (!in_array($conjugaison['auxiliaire'] ?? null, ['avoir', 'être'], true)) {
            return null;
        }
        foreach ($temps as $t) {
            if (!is_array($conjugaison[$t] ?? null)) {
                return null;
            }
            foreach ($personnes as $p) {
                if (!is_string($conjugaison[$t][$p] ?? null)) {
                    return null;
                }
            }
        }

        return [
            'infinitif' => $conjugaison['infinitif'],
            'auxiliaire' => $conjugaison['auxiliaire'],
            'present' => array_intersect_key($conjugaison['present'], array_flip($personnes)),
            'futur' => array_intersect_key($conjugaison['futur'], array_flip($personnes)),
            'imparfait' => array_intersect_key($conjugaison['imparfait'], array_flip($personnes)),
            'passeCompose' => array_intersect_key($conjugaison['passeCompose'], array_flip($personnes)),
        ];
    }

    function validerSequence(array $validIds, mixed $phonemes, string $label): array
    {
        if (!is_array($phonemes) || count($phonemes) === 0) {
            jsonResponse(400, ['error' => "Séquence phonétique manquante ($label)"]);
        }
        foreach ($phonemes as $p) {
            if (!in_array($p, $validIds, true)) {
                jsonResponse(400, ['error' => "Touche inconnue ($label) : $p"]);
            }
        }
        return $phonemes;
    }

    $body = jsonBody();
    $mot = trim((string) ($body['mot'] ?? ''));
    $categorie = (string) ($body['categorie'] ?? '');
    $genre = $body['genre'] ?? null;

    if ($mot === '' || mb_strlen($mot) > 100) {
        jsonResponse(400, ['error' => 'Mot invalide']);
    }
    if (!in_array($categorie, $validCategories, true)) {
        jsonResponse(400, ['error' => 'Catégorie invalide']);
    }
    if ($genre !== null && $genre !== 'm' && $genre !== 'f') {
        jsonResponse(400, ['error' => 'Genre invalide']);
    }

    $phonemes = validerSequence($validPhonemeIds, $body['phonemes'] ?? null, 'mot');

    // Forme féminine : optionnelle, uniquement pour un adjectif. Saisie à la
    // main plutôt que générée — contrairement aux verbes en -er, les
    // exceptions de formation du féminin sont trop nombreuses et variées
    // (-eux/-euse, -er/-ère, -f/-ve, consonne doublée...) pour distinguer
    // fiablement un cas "sûr" d'un cas risqué.
    $femininMot = trim((string) ($body['femininMot'] ?? ''));
    $femininPhonemes = null;
    if ($categorie === 'adjectif' && $femininMot !== '') {
        if (mb_strlen($femininMot) > 100) {
            jsonResponse(400, ['error' => 'Forme féminine invalide']);
        }
        $femininPhonemes = validerSequence($validPhonemeIds, $body['femininPhonemes'] ?? null, 'féminin');
    }

    // Conjugaison calculée à l'ajout, une fois pour toutes. Le client peut
    // avoir déjà trouvé un tableau via conjugation-fr (base ~7000 verbes,
    // bien plus large que le générateur PHP ci-dessous limité aux -er
    // réguliers "sûrs") et l'enseignante l'a vérifié visuellement avant
    // l'envoi (voir Admin.tsx) — on lui fait confiance s'il est bien formé.
    // Sinon, repli sur le générateur PHP déterministe. null si aucun des
    // deux n'aboutit (ou si ce n'est pas un verbe) : mieux vaut pas de
    // tableau qu'un tableau inventé.
    $conjugaison = $categorie === 'verbe' ? validerConjugaisonEnvoyee($body['conjugaison'] ?? null) : null;
    if ($conjugaison === null && $categorie === 'verbe') {
        $conjugaison = genererConjugaison($mot);
    }

    $stmt = $db->prepare(
        'INSERT INTO lexicon_additions
           (mot, categorie, phonemes, genre, conjugaison, feminin_mot, feminin_phonemes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    );
    $stmt->execute([
        $mot,
        $categorie,
        json_encode($phonemes),
        $genre,
        $conjugaison !== null ? json_encode($conjugaison, JSON_UNESCAPED_UNICODE) : null,
        $femininMot !== '' ? $femininMot : null,
        $femininPhonemes !== null ? json_encode($femininPhonemes) : null,
        $user['id'],
    ]);

    // Le lemme d'un mot fraîchement ajouté est le mot lui-même (voir
    // lemmaIdAjout côté client : "ajout:{categorie}:{mot}") — le nom de
    // fichier généré ici doit correspondre à ce que le client reconstruit.
    $audioGeneree = genererAudioMot($mot, $categorie, $mot);

    jsonResponse(201, [
        'id' => (int) $db->lastInsertId(),
        // Permet à l'interface de dire si la conjugaison a pu être générée.
        'conjugaisonGeneree' => $conjugaison !== null,
        'audioGeneree' => $audioGeneree,
    ]);
}

if ($method === 'DELETE') {
    if ($user['role'] !== 'teacher') {
        jsonResponse(403, ['error' => 'Réservé à l\'enseignant']);
    }
    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(400, ['error' => 'id manquant']);
    }

    // Le lexique est COMMUN en lecture : un mot décomposé par Camille sert
    // aussi à Marion, et le redécouper chacune de son côté produirait deux
    // vérités pour le même mot. La suppression, elle, reste à l'autrice : on
    // n'efface pas le travail de sa collègue, même par erreur.
    $stmt = $db->prepare('SELECT mot, categorie, created_by FROM lexicon_additions WHERE id = ?');
    $stmt->execute([$id]);
    $mot = $stmt->fetch();
    if (!$mot) {
        jsonResponse(404, ['error' => 'Mot introuvable']);
    }
    if ((int) $mot['created_by'] !== (int) $user['id']) {
        jsonResponse(403, ['error' => 'Ce mot a été ajouté par une autre enseignante : elle seule peut le supprimer.']);
    }

    // ON DELETE CASCADE (voir schema-v2.sql) supprime les relations DE ce mot
    // (word_id), mais target_lemma_id n'est qu'un texte, pas une clé
    // étrangère : les relations DES AUTRES mots QUI POINTENT VERS celui-ci
    // survivraient sinon, orphelines — un élève cliquant sur ce lien mort
    // tomberait sur "mot introuvable". On les retire explicitement d'abord.
    $lemmaId = "ajout:{$mot['categorie']}:{$mot['mot']}";
    $stmt = $db->prepare('DELETE FROM lexicon_relations WHERE target_lemma_id = ?');
    $stmt->execute([$lemmaId]);

    $stmt = $db->prepare('DELETE FROM lexicon_additions WHERE id = ?');
    $stmt->execute([$id]);
    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
