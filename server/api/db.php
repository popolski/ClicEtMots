<?php
require_once __DIR__ . '/config.php';

function getDb(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

// --- Lecture seule de la base de Fast Éval ---------------------------------
// Fast Éval est la source de vérité pour les enseignantes, les classes et les
// élèves. Clic & Mots n'en tient plus sa propre liste : il la lit, et ne garde
// de son côté que ce qui lui appartient (réglages, favoris, résultats).
//
// Les identifiants sont ceux du dossier /prive, hors du webroot : les trois
// applications tournent sur le même hébergement, la connexion est locale au
// serveur. Le nom d'hôte et celui de la base ne sont pas des secrets — ils se
// déduisent du nom du compte — et restent donc ici, en clair, pour qu'un seul
// endroit ait à changer le jour d'un déménagement.
const FASTEVAL_HOTE = 'coursvaneproger.mysql.db';
const FASTEVAL_BASE = 'coursvaneproger';

function getDbFasteval(): ?PDO
{
    static $pdo = null;
    static $tente = false;
    if ($tente) {
        return $pdo;
    }
    $tente = true;

    $dossier = __DIR__;
    $fichier = null;
    for ($i = 0; $i < 8; $i++) {
        if (is_file($dossier . '/prive/galaxie.php')) {
            $fichier = $dossier . '/prive/galaxie.php';
            break;
        }
        $parent = dirname($dossier);
        if ($parent === $dossier) {
            break;
        }
        $dossier = $parent;
    }
    if ($fichier === null) {
        error_log('clicetmots : /prive/galaxie.php introuvable, la liste de classe ne peut pas etre lue');
        return null;
    }
    require_once $fichier;

    try {
        $pdo = new PDO(
            'mysql:host=' . FASTEVAL_HOTE . ';dbname=' . FASTEVAL_BASE . ';charset=utf8mb4',
            GALAXIE_DB_UTILISATEUR,
            GALAXIE_DB_MOT_PASSE,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ],
        );
    } catch (PDOException $e) {
        // On ne fait pas tomber la page : l'appelant affichera un message
        // disant que la liste vient de Fast Éval et qu'elle est momentanément
        // indisponible. Une classe vide sans explication ferait croire à une
        // perte de données.
        error_log('clicetmots : connexion a Fast Eval impossible');
        $pdo = null;
    }
    return $pdo;
}
