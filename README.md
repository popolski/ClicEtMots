# Clic & Mots

Clic & Mots est un assistant d'écriture phonologique pour l'école primaire
qui permet aux élèves de retrouver l'orthographe d'un mot à partir de ses
sons, puis d'en explorer la prononciation, les formes grammaticales, la
conjugaison et les relations lexicales. Gratuit, conçu pour une classe du CP
au CM2.

**En ligne : [www.cours-vandewalle.fr/clicmots](https://www.cours-vandewalle.fr/clicmots/)**

## Fonctionnement

L'élève clique les sons qu'il entend dans un mot, un son après l'autre, sur
un clavier de 33 touches (une par son du français). Au fur et à mesure,
l'orthographe correspondante apparaît.

## Fonctionnalités

- **Clavier phonétique** : 33 touches, une par son du français, avec un
  clavier filtré dynamiquement pour ne proposer que les sons qui prolongent
  un mot existant. Résultats regroupés par catégorie grammaticale (noms,
  adjectifs, verbes...) et débarrassés des déterminants (articles,
  possessifs, démonstratifs), sans intérêt pour l'exercice.
- **Fiche mot** : autres formes (pluriel, féminin, participe passé), mots de
  la même famille, synonymes et contraires — chacun cliquable pour naviguer
  de fiche en fiche. Pictogramme illustratif (ARASAAC) pour les noms les
  plus fréquents, à côté de la mascotte de catégorie.
- **Définitions** : recherche automatique chez Vikidia (encyclopédie pour
  les 8-13 ans) puis, si elle n'a rien, chez Wiktionnaire (nettoyé de sa
  syntaxe wiki) — pour couvrir aussi bien les noms concrets que les verbes
  et adjectifs. Les mots de la définition qui existent dans le lexique (ou
  qui en sont absents, souvent signe d'un mot technique/rare) sont à leur
  tour cliquables, pour naviguer de définition en définition.
- **Conjugueur** : présent, imparfait, futur et passé composé pour les
  verbes, avec le groupe grammatical (1er/2e/3e) affiché automatiquement.
- **Prononciation audio** : chaque mot peut être écouté à voix haute (voix
  Google Cloud Neural2 pré-générée, choisie pour sa fidélité aux syllabes
  muettes du français — contrairement à la synthèse vocale des navigateurs).
  Les 33 sons du clavier ont eux aussi leur propre enregistrement (voix de
  l'enseignante), écoutable depuis la fiche de chaque son.
- **Mascottes par catégorie grammaticale** (nom, adjectif, verbe, adverbe) et
  par temps de conjugaison, pour un repérage visuel immédiat.
- **Mots récents et favoris** : historique automatique des mots consultés, et
  possibilité de marquer volontairement des mots à retrouver plus tard (⭐) —
  liés au compte élève, purgés automatiquement à chaque changement d'année
  scolaire.
- **Petit quiz de révision**, trois modes au choix : choix multiple (mauvaises
  réponses générées à partir de vraies confusions de son du français — jamais
  une orthographe inventée), recomposition au clavier phonétique (3 essais
  avant de révéler la solution, sons corrects mis en surbrillance), et
  reconnaissance de la catégorie grammaticale (tirage équilibré entre les
  natures de mots). Petites médailles bronze/argent/or selon le score d'une
  partie, sans classement ni comparaison entre élèves.
- **Fiches imprimables** : une fiche compacte par mot (mot, catégorie,
  définition, synonyme/contraire, famille) au format bandeau, pensée pour
  être découpée et collée dans un cahier — un seul mot ou une liste composée
  à la main.
- **Mots de la semaine** : l'enseignante compose une liste de mots par
  semaine (visible et révisable par les élèves dans le quiz, qui cumule
  toutes les semaines enregistrées), imprimable séparément d'une semaine à
  l'autre.
- **Espace enseignant** : gestion des comptes élèves, ajout de mots absents
  du lexique avec prononciation générée automatiquement et conjugaison
  proposée en aperçu (base de ~7000 verbes, tous groupes confondus), saisie
  des relations lexicales (synonymes/contraires/famille), gestion des listes
  de mots de la semaine, et recherche directe par orthographe (en plus du
  clavier phonétique, pensé pour l'élève).

## Stack technique

**Site** : React 19 + TypeScript + Vite + Tailwind CSS 4 + react-router-dom.
Déployé sur un hébergement mutualisé OVH, dans le sous-dossier `/clicmots/` —
`npm run build` produit le dossier `dist/` à uploader tel quel en FTP (le
fichier `.htaccess` inclus gère le routage côté client).

**Backend** : PHP 8 + MySQL (voir [`server/README.md`](./server/README.md)),
pour l'authentification (élèves + enseignant) et l'espace enseignant —
gestion des comptes élèves, ajout de mots absents du lexique avec
prononciation (Google Cloud Text-to-Speech) générée automatiquement, et
relations (synonymes/contraires/famille) saisies à la main. Hébergé à côté
du site sur le même mutualisé OVH.

**Conjugaison des verbes ajoutés** : générée côté client via
[`conjugation-fr`](https://www.npmjs.com/package/conjugation-fr) (base
Verbiste, ~7000 verbes, tous groupes) dans le formulaire d'ajout, affichée en
aperçu avant validation. Repli sur un générateur PHP maison (déterministe,
limité aux -er réguliers "sûrs") si le verbe est absent de cette base.

**Définitions** : appelées à la demande (clic), jamais pré-générées —
contrairement à l'audio. Vikidia en premier (contenu déjà calibré pour des
enfants), repli sur une extraction ciblée et nettoyée de la première ligne
de définition Wiktionnaire si Vikidia n'a rien (fréquent pour les verbes/
adjectifs, Vikidia étant une encyclopédie et non un dictionnaire). Contenu
entre parenthèses (noms scientifiques latins, renvois techniques) retiré à
l'affichage.

**Pictogrammes de mots** : ARASAAC (mêmes licence et principe que les
pictogrammes du clavier, voir plus bas), pour les ~2400 noms les plus
fréquents du lexique — couverture partielle assumée, ARASAAC ciblant le
vocabulaire concret du quotidien plutôt que tout le vocabulaire scolaire.

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
