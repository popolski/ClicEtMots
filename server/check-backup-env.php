<?php
// Script de diagnostic TEMPORAIRE, à supprimer du serveur juste après usage
// (même esprit que setup.html) : vérifie si l'environnement OVH permet de
// mettre en place des sauvegardes automatiques de la base de données
// (exec() disponible ? mysqldump joignable ? cURL dispo pour l'envoi vers
// un stockage externe ?). Ne révèle aucun secret, juste des booléens et des
// chemins - mais mieux vaut ne pas le laisser en ligne indéfiniment.
//
// Usage : uploade ce fichier à côté de config.php (donc dans /clicetmots/api/),
// ouvre https://www.cours-vandewalle.fr/clicetmots/api/check-backup-env.php
// dans ton navigateur, note le résultat, PUIS SUPPRIME LE FICHIER.

header('Content-Type: text/plain; charset=utf-8');

function ligne(string $label, $valeur): void {
    echo str_pad($label, 40) . ': ' . (is_bool($valeur) ? ($valeur ? 'OUI' : 'NON') : $valeur) . "\n";
}

echo "=== Diagnostic sauvegarde - Clic & Mots ===\n\n";

ligne('Version PHP', PHP_VERSION);

$disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));
$execDisponible = function_exists('exec') && !in_array('exec', $disabled, true);
$shellExecDisponible = function_exists('shell_exec') && !in_array('shell_exec', $disabled, true);

ligne('exec() disponible', $execDisponible);
ligne('shell_exec() disponible', $shellExecDisponible);
ligne('Fonctions désactivées (disable_functions)', ini_get('disable_functions') ?: '(aucune)');

if ($execDisponible) {
    // Cherche mysqldump dans quelques emplacements plausibles sans jamais
    // exécuter quoi que ce soit d'autre qu'une recherche de chemin.
    $sortie = [];
    @exec('which mysqldump 2>&1', $sortie, $code);
    ligne('mysqldump trouvé (which)', $code === 0 && !empty($sortie) ? implode(' ', $sortie) : 'introuvable');
} else {
    ligne('mysqldump', 'non testable (exec indisponible)');
}

ligne('cURL disponible (envoi vers stockage externe)', function_exists('curl_init'));
ligne('PDO MySQL disponible', extension_loaded('pdo_mysql'));
ligne('allow_url_fopen', ini_get('allow_url_fopen') ? true : false);
ligne('Mémoire max (memory_limit)', ini_get('memory_limit'));
ligne('Temps d\'exécution max (max_execution_time)', ini_get('max_execution_time') . ' s');
ligne('Dossier temporaire (sys_get_temp_dir)', sys_get_temp_dir());
ligne('Ce dossier est-il inscriptible', is_writable(sys_get_temp_dir()));

echo "\n=== Fin du diagnostic - pense à supprimer ce fichier du serveur ===\n";
