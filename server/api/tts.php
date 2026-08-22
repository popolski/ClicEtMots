<?php
// Génère le mp3 de prononciation d'un mot ajouté par l'enseignant, via l'API
// REST Google Cloud Text-to-Speech (voix fr-FR-Neural2-A — même voix que la
// génération en masse du lexique statique, scripts/generate-word-audio.mjs,
// choisie après comparaison pour sa bonne gestion des schwas français). Non
// bloquant pour l'ajout du mot : en cas d'échec (clé absente, quota, réseau),
// le mot est quand même enregistré, et le site retombe sur la synthèse
// vocale du navigateur côté client (voir src/lib/speech.ts).
//
// Même schéma de nom que le script de génération en masse :
// {mot}_{categorie}_{lemme}.mp3, dans /clicetmots/audio/mots/ (racine du site
// statique, un niveau au-dessus de /clicetmots/api/ où vit ce fichier).

/**
 * @return bool true si le fichier a été généré, false sinon (jamais d'exception).
 */
function genererAudioMot(string $mot, string $categorie, string $lemme): bool
{
    if (!defined('GOOGLE_TTS_API_KEY') || GOOGLE_TTS_API_KEY === '') {
        return false;
    }

    // Le nom de fichier reprend mot/catégorie/lemme tels quels : déjà validés
    // en amont par lexicon.php (longueur, catégorie fermée), et la seule
    // protection qui manque ici est contre une traversée de répertoire si un
    // caractère "/" ou ".." s'y glissait malgré tout.
    $safe = static fn (string $s): bool => strpbrk($s, "/\\\0") === false;
    if (!$safe($mot) || !$safe($categorie) || !$safe($lemme)) {
        return false;
    }

    $audioDir = __DIR__ . '/../audio/mots';
    if (!is_dir($audioDir) && !mkdir($audioDir, 0755, true) && !is_dir($audioDir)) {
        return false;
    }

    $ch = curl_init('https://texttospeech.googleapis.com/v1/text:synthesize?key=' . urlencode(GOOGLE_TTS_API_KEY));
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode([
            'input' => ['text' => $mot],
            'voice' => ['languageCode' => 'fr-FR', 'name' => 'fr-FR-Neural2-A'],
            'audioConfig' => ['audioEncoding' => 'MP3'],
        ], JSON_UNESCAPED_UNICODE),
    ]);
    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $status !== 200) {
        return false;
    }

    $data = json_decode($response, true);
    $audioContent = $data['audioContent'] ?? null;
    if (!is_string($audioContent)) {
        return false;
    }

    $bytes = base64_decode($audioContent, true);
    if ($bytes === false) {
        return false;
    }

    $fileName = "{$mot}_{$categorie}_{$lemme}.mp3";
    return file_put_contents("$audioDir/$fileName", $bytes) !== false;
}
