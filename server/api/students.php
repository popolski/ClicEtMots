<?php
require_once __DIR__ . '/auth.php';
configureSession();
$enseignante = contexteEnseignante(requireTeacher());

$db = getDb();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // LA LISTE VIENT DE FAST ÉVAL, plus de la table locale.
    //
    // Avant, students était la liste de classe : il fallait donc saisir les
    // élèves deux fois, et un élève inscrit dans Fast Éval n'apparaissait ici
    // qu'après sa première connexion. Désormais Fast Éval fait autorité, et la
    // table locale ne porte plus que ce qui appartient à Clic & Mots : les
    // réglages, et par ricochet les favoris, l'historique et les résultats.
    $fasteval = getDbFasteval();
    if ($fasteval === null) {
        jsonResponse(503, ['error' => "La liste des élèves vient de Fast Éval, momentanément injoignable. Rien n'est perdu : réessaie dans un moment."]);
    }

    $stmt = $fasteval->prepare(
        'SELECT id_eleve, prenom, nom FROM classe WHERE id_enseignant = ? AND actif = 1 ORDER BY prenom, nom',
    );
    $stmt->execute([$enseignante['fastevalId']]);
    $inscrits = $stmt->fetchAll();

    // Les réglages locaux, indexés par identifiant Fast Éval. Un élève qui ne
    // s'est jamais connecté n'a pas encore de ligne : il apparaît quand même,
    // avec les valeurs par défaut.
    $reglages = [];
    $stmt = $db->prepare(
        'SELECT id, fasteval_eleve_id, created_at, recherche_directe, confort_lecture FROM students '
        . 'WHERE fasteval_enseignant_id = ? AND fasteval_eleve_id IS NOT NULL',
    );
    $stmt->execute([$enseignante['fastevalId']]);
    foreach ($stmt->fetchAll() as $r) {
        $reglages[(int) $r['fasteval_eleve_id']] = $r;
    }

    $students = [];
    foreach ($inscrits as $e) {
        $idFasteval = (int) $e['id_eleve'];
        $local = $reglages[$idFasteval] ?? null;
        $students[] = [
            // L'identifiant exposé reste celui de Fast Éval : c'est lui qui
            // désigne l'élève, y compris avant sa première connexion.
            'id' => $idFasteval,
            'prenom' => $e['prenom'],
            'nom' => $e['nom'],
            'created_at' => $local['created_at'] ?? null,
            'recherche_directe' => (bool) ($local['recherche_directe'] ?? false),
            'confort_lecture' => (bool) ($local['confort_lecture'] ?? false),
            // Dit à l'écran si l'élève est déjà venu : sans ça, une classe
            // entière à zéro résultat ressemble à une panne.
            'deja_connecte' => $local !== null,
        ];
    }
    jsonResponse(200, ['students' => $students]);
}

// La création et la suppression d'un élève se font dans Fast Éval, et nulle
// part ailleurs. Le refus est ici, côté serveur, et pas seulement dans
// l'interface : un bouton retiré de l'écran n'empêche pas d'appeler l'adresse
// à la main.
if ($method === 'POST' || $method === 'DELETE') {
    jsonResponse(405, [
        'error' => "Les élèves s'ajoutent et se suppriment dans Fast Éval, qui fait autorité pour toute la galaxie. Clic & Mots ne garde que ses propres réglages.",
    ]);
}

if ($method === 'PATCH') {
    // L'identifiant reçu est celui de FAST ÉVAL, comme celui que renvoie le
    // GET ci-dessus. Il désigne l'élève même s'il ne s'est jamais connecté et
    // n'a donc pas encore de ligne locale.
    $idFasteval = (int) ($_GET['id'] ?? 0);
    if ($idFasteval <= 0) {
        jsonResponse(400, ['error' => 'id manquant']);
    }

    // L'appartenance se vérifie chez Fast Éval, seule source de vérité.
    $fasteval = getDbFasteval();
    if ($fasteval === null) {
        jsonResponse(503, ['error' => "Fast Éval est momentanément injoignable, le réglage n'a pas pu être enregistré."]);
    }
    $verif = $fasteval->prepare('SELECT prenom FROM classe WHERE id_eleve = ? AND id_enseignant = ? AND actif = 1');
    $verif->execute([$idFasteval, $enseignante['fastevalId']]);
    $prenom = $verif->fetchColumn();
    if ($prenom === false) {
        // 404 et non 403 : dire « interdit » confirmerait que l'élève existe.
        jsonResponse(404, ['error' => 'Élève introuvable']);
    }

    $body = jsonBody();

    // Un seul endpoint pour les réglages, chacun optionnel : le front
    // n'envoie que celui qui a changé.
    $reglages = [
        'rechercheDirecte' => 'recherche_directe',
        'confortLecture' => 'confort_lecture',
    ];
    $demandes = array_intersect_key($reglages, $body);
    if (!$demandes) {
        jsonResponse(400, ['error' => 'rechercheDirecte ou confortLecture requis']);
    }

    // La ligne locale se crée AU PREMIER RÉGLAGE, et pas avant : tant qu'il
    // n'y a rien à retenir sur un élève, Clic & Mots n'a aucune raison de lui
    // ouvrir un dossier. Le secret est aléatoire et jamais communiqué : ce
    // profil ne sert pas à se connecter, l'entrée se fait par le portail.
    $stmt = $db->prepare('SELECT id FROM students WHERE fasteval_eleve_id = ?');
    $stmt->execute([$idFasteval]);
    $idLocal = $stmt->fetchColumn();

    if ($idLocal === false) {
        try {
            $creer = $db->prepare(
                'INSERT INTO students (prenom, password_hash, fasteval_eleve_id, fasteval_enseignant_id) VALUES (?, ?, ?, ?)',
            );
            $creer->execute([
                $prenom,
                password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
                $idFasteval,
                $enseignante['fastevalId'],
            ]);
        } catch (PDOException $e) {
            // Création concurrente : la clé unique tranche, la relecture suit.
        }
        $stmt->execute([$idFasteval]);
        $idLocal = $stmt->fetchColumn();
        if ($idLocal === false) {
            jsonResponse(500, ['error' => "Le réglage n'a pas pu être enregistré."]);
        }
    }

    foreach ($demandes as $cleJson => $colonne) {
        // Nom de colonne issu de la liste fermée ci-dessus, jamais du corps de
        // la requête : pas d'interpolation d'entrée utilisateur en SQL.
        $maj = $db->prepare("UPDATE students SET $colonne = ? WHERE id = ?");
        $maj->execute([$body[$cleJson] ? 1 : 0, (int) $idLocal]);
    }

    jsonResponse(200, ['ok' => true]);
}

jsonResponse(405, ['error' => 'Méthode non autorisée']);
