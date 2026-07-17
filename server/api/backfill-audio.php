<?php
// Rattrapage ponctuel : génère le mp3 des mots ajoutés par l'enseignant AVANT
// la mise en place de la génération automatique à l'ajout (voir lexicon.php,
// genererAudioMot dans tts.php). Sans effet sur les mots qui ont déjà leur
// fichier (ne consomme pas de crédit API pour rien si relancé plusieurs
// fois) — sûr à appeler autant de fois que nécessaire.
//
// Usage : ouvrir /clicmots/api/backfill-audio.php dans le navigateur une
// fois connectée en tant qu'enseignante (le login classique suffit, pas
// besoin du SETUP_TOKEN). Peut être supprimé du serveur une fois n'importe
// quand — se relance à la main si de nouveaux mots restent orphelins.
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/tts.php';
configureSession();
requireTeacher();

$db = getDb();
$rows = $db->query('SELECT mot, categorie FROM lexicon_additions ORDER BY mot')->fetchAll();

$audioDir = __DIR__ . '/../audio/mots';
$generes = [];
$dejaPresents = [];
$echecs = [];

foreach ($rows as $row) {
    $mot = $row['mot'];
    $categorie = $row['categorie'];
    $fileName = "{$mot}_{$categorie}_{$mot}.mp3";

    if (file_exists("$audioDir/$fileName")) {
        $dejaPresents[] = $mot;
        continue;
    }
    if (genererAudioMot($mot, $categorie, $mot)) {
        $generes[] = $mot;
    } else {
        $echecs[] = $mot;
    }
}

jsonResponse(200, [
    'total' => count($rows),
    'generes' => $generes,
    'dejaPresents' => count($dejaPresents),
    'echecs' => $echecs,
]);
