# ICD — Base de composants (Velxio → dimensions)

Version 1, 2026-11-05. Contrat entre l'agent « base de composants » (A) et l'agent
« instanciation + boîtier » (B). Toute évolution passe par une demande au chef de projet.

## 1. Objet

Fournir, pour chaque `partType` présent dans un export Velxio, un enregistrement
dimensionnel fiable et traçable, exploitable sans ambiguïté par le générateur de boîtier.

## 2. Clé de jointure

`ComponentSpec.partType` == `parts[].type` du `diagram.json`.

Exemples réels : `wokwi-led`, `wokwi-resistor`, `wokwi-servo`, `board-velxio-esp32`,
`board-velxio-arduino-uno`, `wokwi-lcd1602`.

Aucune autre table de correspondance n'est autorisée : si un alias est nécessaire, il est
résolu dans la base (champ `partType` unique) et non dans le code appelant.

## 3. Stockage

- Un fichier par composant : `data/components/<category>/<partType>.json`.
- Index généré : `data/components.index.json` (jamais édité à la main).
- Schéma de référence : `src/app/velxio/model/component.types.ts` (`ComponentSpec`).

## 4. Invariants (vérifiés par `npm run db:build`)

1. Toutes les dimensions sont en millimètres, strictement positives.
2. `envelope.heightMm` = hauteur au-dessus de la carte (composant monté), pas l'épaisseur du PCB.
3. Coordonnées des `mountHoles` relatives au coin haut-gauche de l'empreinte, origine (0,0).
4. Chaque `mountHole` est contenu dans l'empreinte (`0 ≤ x ≤ widthMm`, `0 ≤ y ≤ depthMm`).
5. Chaque `cutout` a un `id` unique et tient dans la longueur de sa paroi.
6. `provenance.license` non vide ; `provenance.retrievedAt` au format ISO-8601.
7. `confidence` obligatoire. `verified` exige une `provenance.url` de datasheet.
8. Un `partType` ne peut apparaître que dans un seul fichier.

Violation d'un invariant = `severity: error`, l'index n'est pas publié.

## 5. Règles de remplissage

- **Discrets** (résistance, LED, diode, condensateur, transistor) : dériver de KiCad/CERN via
  l'empreinte ; conserver `provenance.library` et la licence d'origine.
- **Modules** (cartes, écrans, servos, capteurs) : saisie depuis la fiche constructeur,
  `provenance.url` obligatoire, `confidence: datasheet`.
- **Valeur non sourcée** : `confidence: estimated` et `notes` expliquant l'origine.
  Jamais de valeur silencieusement inventée.

## 6. Interface de livraison

### 6.1 CLI (obligatoire)
- `npm run db:build` : valide, génère l'index, écrit `data/components-report.json`.
- Code de sortie ≠ 0 si au moins une erreur.
- Rapport : `{ ok, checked, issues[] }` conforme à `ValidationReport`.

### 6.2 Lecture seule (obligatoire)
- `GET /api/parts` → `{ count, parts: ComponentSpec[] }`
- `GET /api/parts/:partType` → `ComponentSpec` ou 404 `{error:'NOT_FOUND', partType}`
- `POST /api/parts/resolve` body `{ partTypes: string[] }` →
  `{ resolved: ComponentSpec[], missing: string[] }`

Aucun endpoint d'écriture. Les mises à jour passent par git.

### 6.3 Couverture (obligatoire)
- `npm run db:coverage` compare l'index à une liste de types observés dans les exports
  Velxio (`data/velxio-types.json`) et affiche : couverts, manquants, estimés.

## 7. Tests d'acceptation (agent A)

1. `npm run db:build` passe sur 40 composants minimum.
2. 3 cas d'erreur provoqués volontairement (dimension négative, trou hors empreinte,
   doublon) échouent avec le bon `code`.
3. `GET /api/parts/wokwi-led` renvoie un enregistrement complet.
4. `POST /api/parts/resolve` sur 5 types dont 1 inconnu renvoie 4 resolved + 1 missing.
5. Le rapport de couverture liste les manquants sans les inventer.

## 8. Ce que B peut supposer

- Tout `partType` renvoyé par `/api/parts/resolve` est conforme au schéma et validé.
- Un `partType` absent de `resolved` n'existe pas : B doit l'afficher comme manquant,
  proposer une saisie manuelle et ne jamais extrapoler une taille.
