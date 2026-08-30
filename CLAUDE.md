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

Le transfert se fait **par FTP, à la main**. Il n'y a aucun accès serveur depuis le
dépôt.

1. `npm run release` : lance lint, tests et build, puis affiche ce qu'il faut
   transférer, dans l'ordre. Ne modifie rien sur le serveur.
2. Le transfert est fait à la main.
3. `npm run release:done`, **seulement après confirmation** que le transfert a eu lieu.

**Le `npm run build` est lancé par Claude, jamais par l'utilisateur.** Consigne
explicite : lui ne fait que le transfert.

**Ordre à respecter quand il y a une migration** : le SQL dans phpMyAdmin, puis les
fichiers PHP, puis `dist/`. L'inverser casse le site, parce que le PHP référence les
nouvelles colonnes.

Dossiers à exclure du transfert quand ils n'ont pas changé : `audio/` (environ 230 Mo),
`pictos/`, `pictos-mots/`, `mascottes/`.

**L'automatisation du déploiement a été écartée le 29/08/2026. Ne pas la
reproposer.** Le FTP manuel reste la méthode.

## Base de données

Dix migrations à passer **dans l'ordre** : `schema.sql`, puis `schema-v2` à `-v10`.
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

EQOL a été abandonné : il faisait perdre des mots français légitimes sans bénéfice réel.

## Façon de travailler attendue

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

## Une confusion possible

Le site **déployé** de Clic & Mots existe aussi dans la copie locale du serveur, à
côté des autres sites. C'est le **résultat** du build, pas la source. Ne jamais y
modifier un fichier directement : la modification serait écrasée au prochain build,
et elle ne serait dans aucun dépôt.
