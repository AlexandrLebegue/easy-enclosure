# STATUS — Agent A (base de composants)

Date : 2026-11-05. Branche : `agent-a/components`.

## Ce qui marche

- **Base de dimensions** : 107 entrées (100 types Velxio observés + 7 alias/variantes
  documentés), un fichier par composant dans `data/components/<category>/<partType>.json`.
- **`npm run db:build`** : valide chaque JSON contre le contrat `ComponentSpec`, vérifie les
  invariants de l'ICD, détecte les doublons de `partType`, écrit
  `data/components.index.json` et `data/components-report.json`
  (`{ok, checked, issues[]}`).
  - Code de sortie 1 s'il existe au moins une erreur.
  - En cas d'erreur, l'index existant est retiré pour ne jamais publier un index invalide.
- **`npm run db:coverage`** : compare l'index à `data/velxio-types.json` (120 types) et affiche
  couverts / manquants / estimés / extra.
  - Couverts : **100 / 120 (83,3 %)**
  - Estimés parmi les types observés : 87
  - Manquants : 20
  - Extra (alias/variantes non observés) : 7
- **Service HTTP lecture seule** (`src/app/velxio/db/server.ts`, Express, port 4100 par défaut,
  `DB_PORT` surchargeable, CORS ouvert pour l'app Angular) :
  - `GET /api/parts` -> `{count, parts}`
  - `GET /api/parts/:partType` -> `ComponentSpec` ou 404 `{error:'NOT_FOUND', partType}`
  - `POST /api/parts/resolve` -> `{resolved, missing}`
  - Aucun endpoint d'écriture.
  - Lancement : `npm run db:serve`.
- **Tests** : `npm run db:test` — 10 tests verts, dont les 3 erreurs volontaires exigées :
  `NEGATIVE_DIMENSION`, `HOLE_OUTSIDE_ENVELOPE`, `DUPLICATE_PART_TYPE`, plus
  `CUTOUT_OUTSIDE_SIDE`, échec du build avec code 1 et retrait de l'index, validation de la
  base réelle, résolution (dont alias), intégration HTTP.
- **Compilation** : `npm run build` (Angular) passe ; `tsc -p tsconfig.app.json --noEmit` passe.

## Données

- 18 entrées ont une provenance `datasheet` (cartes Arduino, ESP32-C3, Raspberry Pi Pico,
  LCD1602, SSD1306, DHT22, HC-SR04, DS3231, servos SG90/MG996R, e-paper 2.13, etc.).
- 89 entrées sont `estimated` : modules génériques, passifs dérivés de KiCad, ou variantes
  dont la fiche exacte du module n'est pas disponible. Chaque entrée estimée porte une note
  explicite ; aucune valeur estimée n'est présentée comme certaine.
- Alias ajoutés pour l'intégration avec l'agent B et l'ICD : `board-velxio-esp32`,
  `board-velxio-arduino-uno`, plus les priorités `board-velxio-esp32-c3`,
  `board-velxio-rpi-pico`, `board-velxio-stm32`, `wokwi-servo-mg996r` et
  `velxio-epaper-2-13`. Ils apparaissent en « extra » dans la couverture car absents de
  `data/velxio-types.json`.

## Ce qui reste

- 20 types Velxio non couverts, volontairement : 15 portes logiques `velxio-logic-*`, 3
  bascules `velxio-flip-flop-*`, `velxio-junction` et `wokwi-opamp-ideal`. Ce sont des
  composants virtuels sans empreinte physique réelle.
- Vérification physique des modules génériques (capteurs, relais, drivers) avant impression :
  les cotes de PCB varient selon les fournisseurs.
- Les alias `board-velxio-*` et la variante `velxio-epaper-2-13` restent des entrées de
  transition tant que Velxio n'expose pas officiellement ces `partType`.
- Aucune interface d'écriture : les mises à jour passent par git, conformément à l'ICD.

## Blocages

Aucun blocage. Voir `docs/icd/REQUESTS-agent-a.md` pour la modification hors zone stricte
(scripts npm + dépendance Express) et les demandes de clarification sur l'e-paper et les
composants virtuels.
