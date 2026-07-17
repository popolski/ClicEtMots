# Clic & Mots

Clavier phonétique gratuit pour aider les élèves du CP au CM2 à trouver
l'orthographe des mots qu'ils veulent écrire — un équivalent libre du
"Clavier Métalo" payant, conçu pour une classe primaire.

**En ligne : [www.cours-vandewalle.fr/clicmots](https://www.cours-vandewalle.fr/clicmots/)**

## Fonctionnement

L'élève clique les sons qu'il entend dans un mot, un son après l'autre, sur
un clavier de 33 touches (une par son du français). Au fur et à mesure,
l'orthographe correspondante apparaît. Chaque mot trouvé ouvre une fiche
détaillée : autres formes (pluriel, féminin, participe passé), mots de la
même famille, synonymes et contraires. Les verbes ont en plus un conjugueur
(présent, imparfait, futur, passé composé).

## Stack technique

**Site** : React 19 + TypeScript + Vite + Tailwind CSS 4 + react-router-dom.
Déployé sur un hébergement mutualisé OVH, dans le sous-dossier `/clicmots/` —
`npm run build` produit le dossier `dist/` à uploader tel quel en FTP (le
fichier `.htaccess` inclus gère le routage côté client).

**Backend** : PHP 8 + MySQL (voir [`server/README.md`](./server/README.md)),
pour l'authentification (élèves + enseignant) et l'espace enseignant —
gestion des comptes élèves, ajout de mots absents du lexique avec conjugaison
générée automatiquement pour les verbes réguliers, et relations
(synonymes/contraires/famille) saisies à la main. Hébergé à côté du site sur
le même mutualisé OVH.

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production (tsc + vite)
npm run lint     # oxlint
npm run test     # vitest
```

## Origine des données

Le lexique n'est pas écrit à la main : il est généré par des scripts Node
(`scripts/build-*.mjs`) qui croisent plusieurs bases de données lexicales
ouvertes, avec un filtre de contenu adapté à une classe primaire. Voir
[CREDITS.md](./CREDITS.md) pour le détail des sources et licences
(Lexique383, Manulex, Démonette 2.0, JeuxDeMots, ARASAAC).

Ces sources tierces (`third_party/`) ne sont pas versionnées — voir les
en-têtes de chaque script `build-*.mjs` pour savoir où les récupérer et
comment relancer la génération.

## Licence

Projet non commercial à usage pédagogique. Le lexique généré est dérivé de
plusieurs sources sous licences Creative Commons (voir CREDITS.md) ; toute
réutilisation doit respecter les termes cumulés de ces licences.
