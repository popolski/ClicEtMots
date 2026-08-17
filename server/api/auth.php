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
        'path' => '/clicmots/',
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
// Les mots de passe élèves sont probablement courts (âge CP-CM2) : on limite
// les tentatives par IP plutôt que par compte, pour ne pas révéler quels
// identifiants existent.
const MAX_ATTEMPTS = 10;
const ATTEMPT_WINDOW_MINUTES = 15;

function tooManyAttempts(string $ip): bool
{
    $stmt = getDb()->prepare(
        'SELECT COUNT(*) FROM login_attempts WHERE ip_address = ? AND attempted_at > (NOW() - INTERVAL ? MINUTE)',
    );
    $stmt->execute([$ip, ATTEMPT_WINDOW_MINUTES]);
    return (int) $stmt->fetchColumn() >= MAX_ATTEMPTS;
}

function recordFailedAttempt(string $ip): void
{
    $stmt = getDb()->prepare('INSERT INTO login_attempts (ip_address) VALUES (?)');
    $stmt->execute([$ip]);
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
    return $_SESSION['user'];
}

function requireTeacher(): array
{
    $user = requireAuth();
    if ($user['role'] !== 'teacher') {
        jsonResponse(403, ['error' => 'Réservé à l\'enseignant']);
    }
    return $user;
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

// Vide les 3 tables de données d'un élève - réutilisé par la purge
// automatique ci-dessus ET par le bouton de réinitialisation manuelle de
// l'enseignante (voir reset-donnees.php).
function reinitialiserDonneesEleve(PDO $db, int $studentId): void
{
    foreach (['quiz_resultats', 'favoris', 'historique_consultation'] as $table) {
        $stmt = $db->prepare("DELETE FROM $table WHERE student_id = ?");
        $stmt->execute([$studentId]);
    }
}
