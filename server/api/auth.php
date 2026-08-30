<?php
require_once __DIR__ . '/db.php';

// Cookie de session : HttpOnly (inaccessible en JS, protège contre le vol de
// session par XSS) + Secure (HTTPS uniquement, déjà en place sur le site) +
// SameSite=Lax (le strict minimum contre le CSRF sans gêner la navigation
// normale). À appeler avant tout session_start().
function configureSession(): void
{
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 7, // 7 jours
        'path' => '/clicetmots/',
        'httponly' => true,
        'secure' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function jsonResponse(int $status, array $data): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    // Sans ça, le navigateur peut resservir une ancienne réponse mise en
    // cache pour un fetch() déclenché par le JS (contrairement au document
    // principal, un Ctrl+F5 ne force pas forcément ces appels à recontacter
    // le serveur) - repéré sur session.php : une enseignante qui décochait
    // "Confort"/"Recherche" ne voyait le changement appliqué ni même après
    // un rechargement forcé côté élève.
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// --- Anti brute-force -------------------------------------------------------
// Deux limites combinées (schema-v15.sql) :
// - par IDENTIFIANT (seuil bas) : cible le compte réellement attaqué, sans
//   bloquer le reste de la classe - important en école, où tous les postes
//   sortent souvent avec la même IP publique. C'est la limite qui protège
//   vraiment les mots de passe élèves, probablement courts (âge CP-CM2).
// - par IP (seuil plus haut, filet de sécurité) : couvre une attaque
//   distribuée sur plusieurs comptes depuis un même poste, que la limite par
//   identifiant seule ne verrait pas (chaque compte resterait sous son
//   propre seuil).
const MAX_ATTEMPTS_IDENTIFIANT = 10;
const MAX_ATTEMPTS_IP = 30;
const ATTEMPT_WINDOW_MINUTES = 15;

function tooManyAttempts(string $ip, string $identifiant): bool
{
    $db = getDb();

    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM login_attempts WHERE identifiant = ? AND attempted_at > (NOW() - INTERVAL ? MINUTE)',
    );
    $stmt->execute([$identifiant, ATTEMPT_WINDOW_MINUTES]);
    if ((int) $stmt->fetchColumn() >= MAX_ATTEMPTS_IDENTIFIANT) {
        return true;
    }

    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM login_attempts WHERE ip_address = ? AND attempted_at > (NOW() - INTERVAL ? MINUTE)',
    );
    $stmt->execute([$ip, ATTEMPT_WINDOW_MINUTES]);
    return (int) $stmt->fetchColumn() >= MAX_ATTEMPTS_IP;
}

function recordFailedAttempt(string $ip, string $identifiant): void
{
    $stmt = getDb()->prepare('INSERT INTO login_attempts (ip_address, identifiant) VALUES (?, ?)');
    $stmt->execute([$ip, $identifiant]);
}

function clientIp(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

// --- Garde-fous pour les endpoints protégés ---------------------------------
function requireAuth(): array
{
    if (empty($_SESSION['user'])) {
        jsonResponse(401, ['error' => 'Non connecté']);
    }
    $user = $_SESSION['user'];

    // Le compte élève peut avoir été supprimé par l'enseignante depuis la
    // connexion (voir DELETE dans students.php) : sans cette vérification,
    // la session restait "authentifiée" jusqu'à son expiration naturelle
    // (7 jours, voir configureSession) même pour un compte qui n'existe
    // plus - signalé en revue de code. Pas de vérification équivalente pour
    // 'teacher' : ce compte unique n'a pas de fonctionnalité de suppression.
    if ($user['role'] === 'student') {
        $stmt = getDb()->prepare('SELECT 1 FROM students WHERE id = ?');
        $stmt->execute([$user['id']]);
        if (!$stmt->fetchColumn()) {
            session_destroy();
            jsonResponse(401, ['error' => 'Non connecté']);
        }
    }

    return $user;
}

function requireTeacher(): array
{
    $user = requireAuth();
    if ($user['role'] !== 'teacher') {
        jsonResponse(403, ['error' => 'Réservé à l\'enseignant']);
    }
    return $user;
}

// --- Cloisonnement par enseignante ------------------------------------------
// Jusqu'à la rentrée 2026, Clic & Mots n'avait qu'un seul compte enseignant :
// aucune requête ne filtrait par classe, et « tous les élèves » voulait dire
// « la classe de Camille ». Avec Marion, ce raccourci devient une fuite : sans
// filtre, chacune voit, modifie et supprime les élèves de l'autre.
//
// DEUX CLÉS, ET C'EST VOULU. Les tables ne désignent pas l'enseignante de la
// même façon :
//   - students.fasteval_enseignant_id pointe vers Fast Éval (la source des
//     comptes depuis le portail commun) ;
//   - liste_mots_semaine.updated_by et lexicon_additions.created_by pointent
//     vers teachers.id, l'identifiant LOCAL.
// On résout donc les deux d'un coup, une fois par requête, plutôt que de
// laisser chaque endpoint improviser sa jointure.
function contexteEnseignante(array $user): array
{
    $db = getDb();

    if ($user['role'] === 'teacher') {
        $stmt = $db->prepare('SELECT fasteval_enseignant_id FROM teachers WHERE id = ?');
        $stmt->execute([$user['id']]);
        $fasteval = $stmt->fetchColumn();

        // Un compte enseignant purement local, jamais relié au portail, ne
        // peut être rattaché à aucun élève : plutôt que de lui montrer toute
        // la base (le comportement d'avant) ou une classe vide sans
        // explication, on le dit.
        if ($fasteval === false || $fasteval === null) {
            jsonResponse(409, ['error' => "Ce compte enseignant n'est pas relié à Fast Éval. Connecte-toi par le portail pour l'associer."]);
        }

        return ['teacherId' => (int) $user['id'], 'fastevalId' => (int) $fasteval];
    }

    // Côté élève, l'enseignante est celle inscrite sur sa fiche. Elle sert à
    // ne lui montrer que les listes de mots de SA classe.
    $stmt = $db->prepare('SELECT fasteval_enseignant_id FROM students WHERE id = ?');
    $stmt->execute([$user['id']]);
    $fasteval = $stmt->fetchColumn();
    if ($fasteval === false || $fasteval === null) {
        return ['teacherId' => 0, 'fastevalId' => 0];
    }

    $stmt = $db->prepare('SELECT id FROM teachers WHERE fasteval_enseignant_id = ?');
    $stmt->execute([(int) $fasteval]);
    $teacherId = $stmt->fetchColumn();

    return [
        'teacherId' => $teacherId === false ? 0 : (int) $teacherId,
        'fastevalId' => (int) $fasteval,
    ];
}

// Depuis que la liste de classe vient de Fast Éval, les écrans envoient des
// identifiants FAST ÉVAL. Cette fonction fait le pont : elle vérifie que
// l'élève est bien dans la classe de l'enseignante connectée, puis rend son
// identifiant LOCAL — ou null s'il ne s'est jamais connecté et n'a donc pas
// encore de dossier ici. Un null n'est pas une erreur : c'est un élève sans
// données, dont le bilan est simplement vide.
function eleveLocalDeLaClasse(int $idFasteval, int $fastevalEnseignantId): ?int
{
    if ($idFasteval <= 0) {
        jsonResponse(400, ['error' => 'id manquant']);
    }

    $fasteval = getDbFasteval();
    if ($fasteval === null) {
        jsonResponse(503, ['error' => 'Fast Éval est momentanément injoignable.']);
    }
    $verif = $fasteval->prepare('SELECT 1 FROM classe WHERE id_eleve = ? AND id_enseignant = ? AND actif = 1');
    $verif->execute([$idFasteval, $fastevalEnseignantId]);
    if (!$verif->fetchColumn()) {
        // 404 et non 403 : dire « interdit » confirmerait que l'élève existe.
        jsonResponse(404, ['error' => 'Élève introuvable']);
    }

    $stmt = getDb()->prepare('SELECT id FROM students WHERE fasteval_eleve_id = ?');
    $stmt->execute([$idFasteval]);
    $id = $stmt->fetchColumn();
    return $id === false ? null : (int) $id;
}

// --- Purge annuelle des données élève (quiz/favoris/historique) -----------
// Miroir côté serveur de src/lib/rotationAnneeScolaire.ts : un PC de classe
// réutilisé d'un élève à l'autre ou d'une année sur l'autre ne doit jamais
// montrer les données d'un autre élève. Rentrée = 1er septembre.
function anneeScolaireActuelle(): string
{
    $mois = (int) date('n');
    $annee = (int) date('Y');
    $debut = $mois >= 9 ? $annee : $annee - 1;
    return "$debut-" . ($debut + 1);
}

// À appeler juste après une connexion élève réussie (voir login.php) :
// purge silencieusement quiz_resultats/favoris/historique_consultation de
// CET élève si l'année scolaire a changé depuis sa dernière connexion.
// Jamais au tout premier login (derniere_annee_scolaire encore NULL - rien
// à purger).
function purgerSiNouvelleAnneeScolaire(int $studentId): void
{
    $db = getDb();
    $actuelle = anneeScolaireActuelle();

    $stmt = $db->prepare('SELECT derniere_annee_scolaire FROM students WHERE id = ?');
    $stmt->execute([$studentId]);
    $derniere = $stmt->fetchColumn();

    if ($derniere && $derniere !== $actuelle) {
        reinitialiserDonneesEleve($db, $studentId);
    }

    $stmt = $db->prepare('UPDATE students SET derniere_annee_scolaire = ? WHERE id = ?');
    $stmt->execute([$actuelle, $studentId]);
}

// Vide les tables de données d'un élève - réutilisé par la purge automatique
// ci-dessus ET par le bouton de réinitialisation manuelle de l'enseignante
// (voir reset-donnees.php). dictee_mots_rates (schema-v10.sql) manquait ici :
// un élève réinitialisé gardait ses mots ratés en dictée, qui revenaient
// donc en tête de sa prochaine dictée malgré la remise à zéro demandée par
// l'enseignante.
function reinitialiserDonneesEleve(PDO $db, int $studentId): void
{
    foreach (['quiz_resultats', 'favoris', 'historique_consultation', 'dictee_mots_rates'] as $table) {
        $stmt = $db->prepare("DELETE FROM $table WHERE student_id = ?");
        $stmt->execute([$studentId]);
    }
}
