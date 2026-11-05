# STATUS — Agent A (base de composants)

Date : 2026-11-05. Branche : `agent-a/components`.

## Ce qui marche

- **Base de dimensions** : 100 composants réels, un fichier par composant dans
  `data/components/<category>/<partType>.json`.
- **`npm run db:build`** : valide chaque JSON contre le contrat `ComponentSpec`, vérifie les
  invariants de l'ICD, détecte les doublons de `partType`, écrit
  `data/components.index.json` et `data/components-report.json`
  (`{ok, checked, issues[]}`), et sort en code 1 s'il existe au moins une erreur.
- **`npm run db:coverage`** : compare l'index à `data/velxio-types.json` (120 types) et affiche
  couverts / manquants / estimés / extra.
  - Couverts : **100 / 120 (83,3 %)**
  - Estimés : 87
  - Manquants : 20
- **Service HTTP lecture seule** (`src/app/velxio/db/server.ts`, Express, port 4100 par défaut,
  `DB_PORT` surchargeable) :
  - `GET /api/parts` -> `{count, parts}`
  - `GET /api/parts/:partType` -> `ComponentSpec` ou 404 `{error:'NOT_FOUND', partType}`
  - `POST /api/parts/resolve` -> `{resolved, missing}`
  - Aucun endpoint d'écriture.
  - Lancement : `npm run db:serve`.
- **Tests** : `npm run db:test` — 8 tests verts, dont les 3 erreurs volontaires exigées :
  `NEGATIVE_DIMENSION`, `HOLE_OUTSIDE_ENVELOPE`, `DUPLICATE_PART_TYPE`, plus
  `CUTOUT_OUTSIDE_SIDE`, validation de la base réelle, build, résolution et intégration HTTP.
- **Compilation** : `npm run build` (Angular) passe ; `tsc -p tsconfig.app.json --noEmit` passe.

## Données

- 13 composants ont une provenance `datasheet` (cartes Arduino, LCD1602, SSD1306, DHT22,
  HC-SR04, DS3231, servo SG90, etc.).
- 87 composants sont `estimated` : modules génériques, passifs dérivés de KiCad, ou variantes
  dont la fiche exacte du module n'est pas disponible. Chaque entrée estimée porte une note
  explicite ; aucune valeur estimée n'est présentée comme certaine.
- Les trous de fixation des cartes Arduino sont issus des plans mécaniques mais marqués comme à
  vérifier sur la carte physique dans les notes.

## Ce qui reste

- 20 types Velxio non couverts, volontairement : 15 portes logiques `velxio-logic-*`, 3
  bascules `velxio-flip-flop-*`, `velxio-junction` et `wokwi-opamp-ideal`. Ce sont des
  composants virtuels sans empreinte physique réelle.
- Vérification physique des modules génériques (capteurs, relais, drivers) avant impression :
  les cotes de PCB varient selon les fournisseurs.
- Aucune interface d'écriture : les mises à jour passent par git, conformément à l'ICD.

## Blocages

Aucun blocage. Voir `docs/icd/REQUESTS-agent-a.md` pour les deux demandes de clarification et la
modification hors zone stricte (scripts npm + dépendance Express) nécessaire à la livraison.
