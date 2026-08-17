# Backend "espace enseignant" (PHP + MySQL, OVH)

API pour l'authentification (élèves + enseignant), la gestion des comptes
élèves, et l'ajout de mots au lexique — hébergée à côté du site statique,
dans `/clicmots/api/` sur le même hébergement OVH. Nécessite PHP 8.x
(`password_hash`) et une base MySQL.

## Installation (à faire toi-même, une seule fois)

1. **Base de données** : dans le manager OVH, section "Bases de données",
   crée une base (ou utilise-en une existante). Note l'hôte, le nom, le
   user et le mot de passe.
2. **Tables** : ouvre phpMyAdmin/Adminer depuis le manager OVH sur cette
   base, et exécute le contenu de [`schema.sql`](./schema.sql) (colle-le
   dans l'onglet SQL, "Exécuter"), puis celui de
   [`schema-v2.sql`](./schema-v2.sql) (conjugaison générée + relations
   saisies à la main ; sans risque si relancé).
3. **Config** : copie `api/config.php.example` en `api/config.php`, remplis
   `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASS` avec les infos de l'étape 1, et
   choisis un `SETUP_TOKEN` — une longue chaîne aléatoire à toi (par
   exemple générée avec `openssl rand -hex 32` dans un terminal, ou avec ton
   gestionnaire de mots de passe). Ce fichier ne doit **jamais** être commité
   dans Git (déjà dans `.gitignore`).

   Optionnel : `GOOGLE_TTS_API_KEY` génère automatiquement la prononciation
   d'un mot ajouté par l'enseignant (Google Cloud Console -> "API et
   services" -> "Identifiants" -> "Créer des identifiants" -> "Clé API",
   puis restreins-la à l'API "Cloud Text-to-Speech" uniquement). Laissée
   vide, l'ajout de mot fonctionne quand même — seule la prononciation
   retombe sur la synthèse vocale du navigateur (voir `api/tts.php`).
4. **Upload FTP** : envoie tout le dossier `server/` sur OVH, dans
   `/clicmots/api-src/` par exemple, PUIS place le contenu du sous-dossier
   `api/` dans `/clicmots/api/` (à la racine de `/clicmots/`, à côté du site
   déployé) — c'est ce chemin `/clicmots/api/...` que le frontend appelle.
   `setup.html` peut rester où tu veux (ex. directement dans `/clicmots/`),
   tu n'en as besoin qu'une fois.
5. **Créer le compte enseignant** : ouvre `setup.html` dans ton navigateur
   (ex. `https://www.cours-vandewalle.fr/clicmots/setup.html`), remplis le
   jeton (celui mis dans `config.php`), un identifiant et un mot de passe
   pour ta compagne. Une fois le compte créé, **supprime** `setup.html` et
   `api/setup.php` du serveur (sécurité : empêche quiconque de retenter la
   création d'un compte, même si ça échouerait de toute façon tant qu'un
   compte enseignant existe déjà).

## Sécurité

- Mots de passe jamais stockés en clair (`password_hash`/`password_verify`).
- Sessions HttpOnly + Secure + SameSite=Lax.
- Anti brute-force basique : 10 tentatives / 15 min par IP (voir `auth.php`).
- Toutes les requêtes SQL intégrant des entrées utilisateur utilisent des
  requêtes préparées PDO afin de prévenir les injections SQL.
- Le lexique ajouté manuellement valide la catégorie et chaque touche
  phonétique contre une liste fermée côté serveur — impossible d'y glisser
  autre chose que des données conformes au format attendu par le site.

## Endpoints

| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| POST | `/api/login.php` | public | `{identifiant, motDePasse}` → session |
| POST | `/api/logout.php` | connecté | détruit la session |
| GET | `/api/session.php` | public | état de connexion actuel |
| GET | `/api/students.php` | enseignant | liste des élèves |
| POST | `/api/students.php` | enseignant | `{prenom, motDePasse}` → crée un élève |
| DELETE | `/api/students.php?id=` | enseignant | supprime un élève |
| GET | `/api/lexicon.php` | connecté | mots ajoutés, avec conjugaison et relations |
| POST | `/api/lexicon.php` | enseignant | `{mot, categorie, genre?, phonemes}` |
| DELETE | `/api/lexicon.php?id=` | enseignant | supprime un mot ajouté (et ses relations) |
| POST | `/api/relations.php` | enseignant | `{wordId, type, targetLemmaId, targetWord, targetCategory}` |
| DELETE | `/api/relations.php?wordId=&type=&targetLemmaId=` | enseignant | retire une relation |

## Conjugaison des verbes ajoutés

`api/conjugaison.php` génère le tableau (4 temps × 9 personnes) à l'ajout
d'un verbe, et le stocke en base. C'est un port de la logique de
`scripts/build-conjugation-index.mjs` : mêmes règles, mêmes exclusions —
les deux sorties ont été comparées verbe à verbe (1571 identiques sur 1572
comparables) et doivent le rester si l'une des deux évolue.

Un verbe dont la conjugaison n'est pas déterministe (irrégulier, -yer,
-eler/-eter) ne reçoit **aucun** tableau, volontairement : mieux vaut pas
de conjugaison qu'une orthographe inventée montrée à un enfant.

## Relations (synonymes / contraires / famille)

Elles ne sont pas déductibles pour un mot ajouté : Démonette et JeuxDeMots
ne le connaissent pas, et ces bases (~400 Mo) ne sont pas embarquées — elles
ne servent qu'au build. L'enseignant les saisit donc à la main, en piochant
dans le lexique existant. Elles sont symétriques : déclarer "wapiti"
synonyme de "cerf" fait aussi apparaître "wapiti" sur la fiche de "cerf".
