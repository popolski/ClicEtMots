<?php
// Entrée dans Clic & Mots depuis le portail commun (/portail/).
//
// Le portail dépose un jeton signé qui dit qui arrive : une enseignante
// (role=teacher, tid = son id Fast Éval) ou un élève (role=student, sid = son
// id Fast Éval, tid = celui de son enseignante). Ce fichier traduit ce jeton
// en session locale, en créant le compte local s'il n'existe pas encore.
//
// Depuis la rentrée 2026, c'est le SEUL chemin d'entrée pour les élèves : la
// connexion locale par prénom a été retirée (voir login.php).

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/sso-lib.php';
configureSession();
$identity = ssoRequireIdentity();

// Le portail transmet le nom complet, « Prénom NOM », construit depuis les
// colonnes prenom et nom de Fast Éval. C'est ce que les bandeaux des trois
// sites affichent. Les colonnes locales n'en gardent qu'un morceau -
// teachers.username vaut « Camille », students.prenom vaut le prénom seul -
// et le bandeau affichait donc un nom tronqué par rapport aux deux autres
// sites. Elles ne servent plus que de secours si le portail n'envoyait rien.
$nomAffiche = trim((string) $identity['label']);
$db = getDb();

// LA SESSION PRECEDENTE EST JETEE DES L'ARRIVEE, avant meme de savoir qui
// arrive. C'est la correction d'un bogue observe : Marion se connectait au
// portail, cliquait sur Clic & Mots, et atterrissait sur le compte de
// Camille. L'ancien code, ne trouvant pas de compte local pour elle,
// redirigeait sans toucher a la session - donc celle de Camille, encore
// ouverte dans ce navigateur, restait en place et c'est elle qui s'affichait.
//
// Sur un poste de classe partage, c'est la difference entre « je n'ai pas pu
// entrer » et « je suis entree chez ma collegue ». Aucun chemin de ce fichier
// ne doit pouvoir laisser en place une session qui n'est pas celle du jeton
// qu'on vient de lire.
unset($_SESSION['user']);

// Secret local jamais communiqué : le compte existe pour porter les données,
// pas pour être utilisé en connexion directe. Même procédé pour les
// enseignantes créées automatiquement et pour les élèves.
function secretInutilisable(): string
{
    return password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
}

if ($identity['role'] === 'teacher') {
    $fastevalId = (int) $identity['tid'];

    $stmt = $db->prepare('SELECT id, username AS label FROM teachers WHERE fasteval_enseignant_id = ?');
    $stmt->execute([$fastevalId]);
    $row = $stmt->fetch();

    if (!$row) {
        // Première venue d'une enseignante Fast Éval inconnue ici. Avant, on
        // la renvoyait sur /clicetmots/?sso=liaison et il fallait créer son
        // compte à la main. Elle entre maintenant toute seule.
        //
        // teachers.username est UNIQUE : si son identifiant Fast Éval est déjà
        // pris par quelqu'un d'autre, on suffixe plutôt que d'échouer, ce qui
        // la laisserait devant une page d'erreur sans explication. Le cas est
        // rare, mais il n'a pas de solution qu'elle puisse trouver seule.
        $base = trim((string) $identity['label']);
        if ($base === '') {
            $base = 'enseignante-' . $fastevalId;
        }
        $base = mb_substr($base, 0, 90);

        $username = $base;
        for ($suffixe = 2; $suffixe <= 50; $suffixe++) {
            $verif = $db->prepare('SELECT 1 FROM teachers WHERE username = ?');
            $verif->execute([$username]);
            if (!$verif->fetchColumn()) {
                break;
            }
            $username = $base . '-' . $suffixe;
        }

        try {
            $insert = $db->prepare(
                'INSERT INTO teachers (username, password_hash, fasteval_enseignant_id) VALUES (?, ?, ?)',
            );
            $insert->execute([$username, secretInutilisable(), $fastevalId]);
        } catch (PDOException $e) {
            // Deux onglets ouverts en même temps peuvent tenter la création
            // ensemble : la contrainte d'unicité tranche, et la relecture
            // ci-dessous donne le gagnant sans exposer l'erreur SQL.
        }

        $stmt->execute([$fastevalId]);
        $row = $stmt->fetch();
    }

    if (!$row) {
        // Session deja videe plus haut : on repart au portail sans laisser
        // l'identite de quelqu'un d'autre derriere soi.
        header('Location: /portail/?erreur=liaison-clic');
        exit;
    }

    session_regenerate_id(true);
    $_SESSION['user'] = ['id' => (int) $row['id'], 'role' => 'teacher', 'label' => $nomAffiche !== '' ? $nomAffiche : $row['label']];
    header('Location: /clicetmots/enseignant');
    exit;
}

// ---------------------------------------------------------------- élève ----
$eleveId = (int) $identity['sid'];
$fastevalId = (int) $identity['tid'];

// On cherche l'élève par son SEUL identifiant Fast Éval, et non par le couple
// (élève, enseignante) comme auparavant. La raison est concrète : students
// porte un index UNIQUE sur fasteval_eleve_id seul. Un élève qui change de
// classe - un CE1 de Camille qui passe en CE2 chez Marion - n'était donc plus
// trouvé (l'enseignante avait changé), l'insertion de secours se heurtait à
// cette contrainte d'unicité, et il se retrouvait devant une page d'erreur le
// jour de la rentrée. Ici, on le retrouve et on met simplement à jour son
// enseignante.
$stmt = $db->prepare(
    'SELECT id, prenom AS label, recherche_directe, confort_lecture, fasteval_enseignant_id '
    . 'FROM students WHERE fasteval_eleve_id = ?',
);
$stmt->execute([$eleveId]);
$row = $stmt->fetch();

if (!$row) {
    // Clic & Mots comptait initialement moins d'élèves que Fast Éval. Au
    // premier passage, on crée le profil minimal lié.
    try {
        $insert = $db->prepare(
            'INSERT INTO students (prenom, password_hash, fasteval_eleve_id, fasteval_enseignant_id) VALUES (?, ?, ?, ?)',
        );
        $insert->execute([(string) $identity['label'], secretInutilisable(), $eleveId, $fastevalId]);
    } catch (PDOException $e) {
        // Création concurrente : la relecture ci-dessous tranche.
    }
    $stmt->execute([$eleveId]);
    $row = $stmt->fetch();
}

if (!$row) {
    header('Location: /portail/?erreur=liaison-clic');
    exit;
}

// Changement de classe : on suit ce que dit Fast Éval, qui fait autorité sur
// les inscriptions. Ses données personnelles (favoris, historique, résultats)
// le suivent, et la purge de rentrée ci-dessous s'occupe de l'année écoulée.
if ((int) $row['fasteval_enseignant_id'] !== $fastevalId) {
    $maj = $db->prepare('UPDATE students SET fasteval_enseignant_id = ? WHERE id = ?');
    $maj->execute([$fastevalId, (int) $row['id']]);
}

session_regenerate_id(true);
purgerSiNouvelleAnneeScolaire((int) $row['id']);
$_SESSION['user'] = [
    'id' => (int) $row['id'],
    'role' => 'student',
    'label' => $nomAffiche !== '' ? $nomAffiche : $row['label'],
    'rechercheDirecte' => (bool) $row['recherche_directe'],
    'confortLecture' => (bool) $row['confort_lecture'],
];
header('Location: /clicetmots/');
exit;
