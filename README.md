# Clic & Mots

Clic & Mots est un assistant d'écriture phonologique pour l'école primaire
qui permet aux élèves de retrouver l'orthographe d'un mot à partir de ses
sons, puis d'en explorer la prononciation, les formes grammaticales, la
conjugaison et les relations lexicales. Gratuit, conçu pour une classe du CP
au CM2 — un équivalent libre du "Clavier Métalo" payant.

**En ligne : [www.cours-vandewalle.fr/clicmots](https://www.cours-vandewalle.fr/clicmots/)**

## Fonctionnement

L'élève clique les sons qu'il entend dans un mot, un son après l'autre, sur
un clavier de 33 touches (une par son du français). Au fur et à mesure,
l'orthographe correspondante apparaît.

## Fonctionnalités

- **Clavier phonétique** : 33 touches, une par son du français, avec un
  clavier filtré dynamiquement pour ne proposer que les sons qui prolongent
  un mot existant.
- **Fiche mot** : autres formes (pluriel, féminin, participe passé), mots de
  la même famille, synonymes et contraires — chacun cliquable pour naviguer
  de fiche en fiche.
- **Conjugueur** : présent, imparfait, futur et passé composé pour les
  verbes, avec le groupe grammatical (1er/2e/3e) affiché automatiquement.
- **Prononciation audio** : chaque mot peut être écouté à voix haute (voix
  Google Cloud Neural2 pré-générée, choisie pour sa fidélité aux syllabes
  muettes du français — contrairement à la synthèse vocale des navigateurs).
- **Mascottes par catégorie grammaticale** (nom, adjectif, verbe, adverbe) et
  par temps de conjugaison, pour un repérage visuel immédiat.
- **Espace enseignant** : gestion des comptes élèves, ajout de mots absents
  du lexique (avec conjugaison et prononciation générées automatiquement) et
  saisie des relations lexicales (synonymes/contraires/famille).

## Stack technique

**Site** : React 19 + TypeScript + Vite + Tailwind CSS 4 + react-router-dom.
Déployé sur un hébergement mutualisé OVH, dans le sous-dossier `/clicmots/` —
`npm run build` produit le dossier `dist/` à uploader tel quel en FTP (le
fichier `.htaccess` inclus gère le routage côté client).

**Backend** : PHP 8 + MySQL (voir [`server/README.md`](./server/README.md)),
pour l'authentification (élèves + enseignant) et l'espace enseignant —
gestion des comptes élèves, ajout de mots absents du lexique avec conjugaison
et prononciation (Google Cloud Text-to-Speech) générées automatiquement pour
les verbes réguliers, et relations (synonymes/contraires/famille) saisies à
la main. Hébergé à côté du site sur le même mutualisé OVH.

**Audio** : les ~27 000 mots du lexique statique ont leur prononciation
pré-générée une fois pour toutes (`scripts/generate-word-audio.mjs`, voix
Google Cloud `fr-FR-Neural2-A`) et servie en fichiers mp3 statiques — aucun
appel API au moment de l'écoute. Les mots ajoutés par l'enseignant génèrent
leur mp3 à la volée côté serveur ; en son absence (échec réseau, quota), le
site retombe sur la synthèse vocale du navigateur.

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
