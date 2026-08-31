# Clic & Mots

Assistant d'écriture phonologique libre et gratuit pour le primaire, en production.
L'élève écrit, l'application décompose les mots son par son.

Construit pour une enseignante de primaire, qui le teste en classe et fait remonter
les retours. **Sa classe est un CE1** : l'outil vise CP-CM2, mais c'est du CE1 qui
remonte du terrain, et c'est ce niveau qu'il faut avoir en tête pour juger si un
exercice est trop long ou trop dur.

- En production : https://www.cours-vandewalle.fr/clicetmots/
- Licence CC BY-NC-SA 4.0, imposée par les sources lexicales Manulex et ARASAAC

## Comment c'est fait

- **Front** : React 19, TypeScript, Vite 8, Tailwind 4, react-router-dom 7. oxlint et vitest.
- **Serveur** : PHP 8 et MySQL, dans `server/`. Ce n'est pas une application seulement cliente.
- Serveur de développement : `clicmots-dev`, port 5174.

Le chemin `/clicetmots/` apparaît dans `vite.config.ts`, `api.ts`, `public/.htaccess`,
`auth.php` et `setup.html` : **tout doit bouger ensemble** si on le change. Les clés
`localStorage` gardent volontairement l'ancien préfixe `clicmots:` ; les renommer
effacerait le cache des définitions et la liste de fiches en cours.

## Mise en ligne

Le transfert se fait **par FTP**, vers OVH. La session WinSCP enregistrée sous
`OVH cours-vandewalle` atteint bien `/www/clicetmots` : vérifié le 31/08/2026.
Une version antérieure de ce fichier affirmait qu'il n'y avait aucun accès serveur,
c'était faux.

1. `npm run release` : lance lint, tests et build, puis affiche ce qu'il faut
   transférer, dans l'ordre. Ne modifie rien sur le serveur.
2. Le transfert, par WinSCP en script ou à la main.
3. `npm run release:done`, **seulement après confirmation** que le transfert a eu lieu.

**Le `npm run build` est lancé par Claude, jamais par l'utilisateur.** Consigne
explicite.

**Un transfert au mauvais endroit ne se voit pas.** WinSCP rend un code de sortie
0 et affiche « 100% » pour chaque fichier même quand la destination est fausse.
Le dossier de session est `/www`, donc un `put` vers `/clicetmots/...` crée un
dossier parasite hors du site et la production ne reçoit rien. Écrire le chemin
complet `/www/clicetmots/...`, et contrôler par HTTP plutôt que par le code de
sortie : les empreintes servies doivent être celles du build local.

```
curl -s https://www.cours-vandewalle.fr/clicetmots/ | grep -o 'assets/index-[^"]*'
```

**Comparer un fichier au sien avant de l'écraser.** Le `index.html` en ligne
portait un `<link>` vers `/galaxie-tokens.css`, le socle visuel commun aux trois
sites, ajouté à la main sur le serveur et absent du dépôt : le premier build
l'aurait supprimé sans que rien ne le signale. Il est désormais dans le
`index.html` du dépôt. Trouvé le 31/08/2026, en comparant avant d'écraser.

**Un changement visuel se montre avant d'être mis en ligne, et on vérifie qu'on a
compris la demande.** Le 31/08/2026, l'entête de l'accueil a été harmonisé avec
Fast Éval et School Monsters puis transféré sans être soumis. Hugues a écrit
« revenu à un état antérieur » ; c'était compris comme un reproche fait à
l'harmonisation, alors qu'il constatait l'inverse - que le bandeau des pages
internes, lui, n'était toujours pas harmonisé. L'harmonisation a donc été annulée,
puis rétablie dans la même matinée. L'aller-retour a coûté deux transferts et
trois builds.

Ce qu'il fallait faire : demander sur quelle page et quel écran, avant de toucher
au code. Une phrase d'un utilisateur qui décrit un symptôme n'est pas un
diagnostic. **L'accueil harmonisé est en ligne**, la question portait sur le
bandeau interne, traité plus bas.

Pour ce genre de lot : capture avant, capture après, accord, puis transfert.

**Vérifier avant de transférer, pas après.** Le `dist/` construit se sert en local
et se mesure comme n'importe quelle page : serveur statique, navigateur sans
fenêtre, sonde JavaScript qui relève les dimensions. Une session peut être simulée
par un build local à l'authentification court-circuitée, **jamais transféré**, pour
voir les écrans qui sont derrière la connexion. Même principe que le
`_amorce_session.php` utilisé côté PHP.

**Garder le `dist/` précédent** dans `RETOUR-ARRIERE` avant d'écraser : le retour en
arrière devient alors un simple transfert, et non une reconstruction.

**Ordre à respecter quand il y a une migration** : le SQL dans phpMyAdmin, puis les
fichiers PHP, puis `dist/`. L'inverser casse le site, parce que le PHP référence les
nouvelles colonnes.

Dossiers à exclure du transfert quand ils n'ont pas changé : `audio/` (environ 230 Mo),
`pictos/`, `pictos-mots/`, `mascottes/`.

**L'automatisation du déploiement a été écartée le 29/08/2026. Ne pas la
reproposer.** Le FTP manuel reste la méthode.

## Le bandeau des pages internes

**Fast Éval est la référence de design des trois sites.** Décision de Hugues,
31/08/2026. En cas de doute sur une couleur, une largeur ou une composition, on
regarde ce que fait Fast Éval et on s'aligne.

`ToolLayout` porte le bandeau commun depuis le 31/08/2026 : conteneur `.gx-page`
(1068 px, 32 px de retrait haut, donc aligné en haut comme chez Fast Éval), puis
`.gx-entete` et `.gx-cartouche` du socle `/galaxie-tokens.css`. La variante
`.gx-app-clicetmots` existait déjà dans le socle, inutilisée jusque-là.

Composition, dans l'ordre, et **elle doit tenir sur une seule ligne** :

| Élément | Remarque |
|---|---|
| logo | 46 px, mène au clavier |
| ← Portail | |
| ← Retour au clavier | sur toutes les pages sauf le clavier lui-même |
| ← Retour | **seulement** si la page passe un `onBack` (le quiz, entre ses étapes) |
| recherche directe | reste dans le bandeau, l'enseignante s'en sert sans arrêt |
| identité | nom, puis « Clic & Mots » |
| Espace enseignant | tout à droite |

**Pas de bouton Déconnexion** : la session appartient au portail, on s'y déconnecte.

Le bandeau mesure **72 px** : 46 de logo, 12 en haut, 12 en bas, plus les bordures.
C'est la mesure des deux autres sites, et tout écart est un défaut.

**La place est comptée.** Mesuré à 1150, 1280 et 1440 px : la ligne tient tout
juste. Ajouter un bouton fait passer « Espace enseignant » à la ligne suivante et
le bandeau à 140 px. C'est ce qui a fait retirer le « ← Retour » générique, qui
faisait doublon avec « Retour au clavier ». Avant d'ajouter quoi que ce soit ici,
mesurer à 1150 px.

## Connexion : le portail est la porte d'entrée

Depuis août 2026, les trois sites partagent une session ouverte par le portail.
Côté Clic & Mots, trois fichiers la reconnaissent :

| Fichier | Rôle |
|---|---|
| `server/api/sso.php` | reçoit la session venue du portail |
| `server/api/sso-lib.php` | les fonctions communes de vérification |
| `server/api/fasteval-auth.php` | le pont vers les comptes de Fast Éval |

`auth.php` ouvre ensuite la session locale à partir de celle-là.

**Le secret partagé n'est pas dans ce dépôt.** `server/api/auth-commune-secret.php`
vit uniquement sur le serveur OVH, à côté de `config.php`, et le `.gitignore`
l'exclut explicitement. Ce dépôt est public : ne jamais y déposer ce fichier, même
le temps d'un essai. Il se récupère depuis le serveur quand on en a besoin.

**Ne jamais mener de front une modification du SSO et une modification visuelle du
front.** Le SSO d'abord, un build et un tag entre les deux. Un seul build qui
embarquerait les deux rendrait impossible de savoir lequel a cassé la connexion.

## L'entête d'accueil est commun aux trois sites

Les pages d'entrée des trois sites partagent un gabarit, au pixel près. Si l'un
bouge, les deux autres doivent suivre.

| | valeur |
|---|---|
| conteneur | `min(940px, calc(100% - 32px))`, centré |
| marges | `42px` en haut, `55px` en bas, `25px` en haut sous 768 px |
| bouton retour portail | texte 13 px, rayon 9 px, bordure `rgba(48,52,61,.14)`, fond `rgba(255,255,255,.58)` |
| baseline sous le logo | 4 px au-dessus, 30 px en dessous |

Côté Fast Éval c'est `.connexion-page`, côté School Monsters `.page-connexion`,
côté Clic & Mots le `<main>` de `src/routes/Home.tsx`.

**Le logo s'aligne sur la HAUTEUR rendue, environ 263 px, pas sur la largeur.**
Les trois logos n'ont pas les mêmes proportions : 649x261 pour Fast Éval,
1920x819 pour School Monsters, 1024x350 pour Clic & Mots. Aligner les largeurs
donnerait trois bandeaux de hauteurs différentes. D'où 769 px de large chez
nous, contre 649 et 620 ailleurs.

## La classe vient de Fast Éval

Elle n'appartient plus à Clic & Mots. **Fast Éval en est la source de vérité** :
`students.php` répond 405 à un POST comme à un DELETE, et l'écran Admin ne garde que
les réglages propres à Clic & Mots, la recherche directe et le confort de lecture.

Deux conséquences dans les données : `created_at` peut être nul, et `deja_connecte`
existe. Un élève peut figurer dans Fast Éval sans avoir jamais ouvert Clic & Mots.
Sans ce drapeau, une classe entière à zéro résultat ressemblait à une panne.

Ne pas réintroduire la création ni la suppression d'élèves ici.

## Base de données

Quinze migrations à passer **dans l'ordre** : `schema.sql`, puis `schema-v2` à `-v15`.
Il n'y a volontairement pas de fichier tout-en-un, pour éviter une deuxième source
de vérité. Voir `server/README.md`.

- `teachers` : les comptes enseignantes. `students` : les élèves, le prénom sert
  d'identifiant, les doublons sont bloqués à la création.
- Depuis la v6, les données élève sont **centralisées côté serveur**
  (`quiz_resultats`, `favoris`, `historique_consultation`), plus en localStorage.
  Changement assumé, demandé par l'enseignante.
- Purge automatique au changement d'année scolaire, la rentrée étant le 1er septembre.
- `ON DELETE CASCADE` : supprimer un élève efface ses données.

**Le schéma du dépôt est en retard sur la production.** Vérifier avant de supposer.

## Sources lexicales

Dans `third_party/`, **non versionnées**. Reconstruites par le pipeline
`build-word-index.mjs`, puis `build-conjugation-index.mjs`,
`build-word-families.mjs`, `build-word-synonyms.mjs`.

| Source | Ce qu'elle apporte |
|---|---|
| Lexique383 | structure grammaticale et phonétique |
| Manulex | la seule source de filtrage et de fréquence, seuil SFI >= 35 |
| Démonette 2.0 | familles dérivationnelles |
| JeuxDeMots | synonymes et antonymes, poids >= 30 |
| ARASAAC | environ 3 300 pictogrammes, résolus au build, jamais d'appel API depuis le navigateur |

Piège de parsing sur JeuxDeMots : décoder les entités HTML **avant** le `split(';')`.

### Les mots à plusieurs sens

JeuxDeMots ne distingue pas les sens. Pour « chien », il propose toutou (l'animal),
charme (« avoir du chien ») et gardien avec des poids comparables, et seul le premier
convient en CE1.

**Deux tris automatiques ont été mesurés et écartés. Ne pas les reproposer.** Par poids
JeuxDeMots : « cerbère » (254) passe devant « cabot » (249). Par fréquence d'usage :
« manger » donne prendre/déjeuner/dîner au lieu de dévorer/avaler/engloutir. Écartées
aussi la réciprocité de la relation, les raffinements de sens du dump, et le
regroupement des candidats par synonymie mutuelle, qui sépare bien les sens mais ne
désigne pas le bon.

D'où `build-sens-enfant.mjs` (31/08/2026) : une passe hors ligne, faite une fois, qui
soumet les candidats des 2000 mots les plus fréquents à un modèle via l'API de lots
(environ 2 $). Sa sortie est `scripts/sens-enfant.json`, **versionnée et relue à la
main** ; `build-word-synonyms.mjs` l'applique quand elle existe et garde le
comportement d'avant sinon. Une liste vide y veut dire « aucun candidat ne convient »
et retire la rubrique. Rien n'est produit en direct côté élève.

Le script demande `ANTHROPIC_API_KEY`. **Il n'a pas encore été lancé.**

EQOL a été abandonné : il faisait perdre des mots français légitimes sans bénéfice réel.

## Façon de travailler attendue

- **Tenir ce fichier à jour.** À chaque livraison, avant de considérer le travail
  fini : ce qui a changé dans le projet, une décision prise, un piège découvert.
  Consigne de Hugues, 31/08/2026. Un CLAUDE.md qui ment coûte plus cher que pas de
  CLAUDE.md du tout.
- Le code et les commentaires sont **en français**. Les commentaires disent
  *pourquoi*, pas *quoi*.
- Dans le texte écrit pour l'utilisateur : **des tirets classiques, jamais de tiret
  cadratin**.
- **Ne jamais afficher un identifiant ni un mot de passe.** Masquer par défaut avant
  tout `cat` ou `grep` sur un fichier de connexion.
- Toujours **pousser après un commit** : sans cela, la CI ne tourne pas et le travail
  n'est nulle part.
- Vérifier `git status` avant de construire : le dossier peut contenir du code non
  commité qui n'est pas de vous, et qui partirait en ligne avec le build.
- **Et `git log --oneline -5` en revenant dans le dépôt**, pas seulement au premier
  contact. Hugues ouvre couramment **plusieurs sessions en parallèle sur ce dépôt** :
  le 31/08/2026, l'une d'elles a poussé trois commits et en a ajouté un quatrième
  pendant que je travaillais ailleurs. Tous les commits de cette machine sont signés
  « Hugues », l'auteur ne distingue donc rien ; ce sont l'heure et le message qui le
  disent. Conséquence pratique : modification ciblée plutôt que réécriture complète
  d'un fichier, sinon deux sessions s'écrasent.

## Une confusion possible

Le site **déployé** de Clic & Mots existe aussi dans la copie locale du serveur, à
côté des autres sites. C'est le **résultat** du build, pas la source. Ne jamais y
modifier un fichier directement : la modification serait écrasée au prochain build,
et elle ne serait dans aucun dépôt.
