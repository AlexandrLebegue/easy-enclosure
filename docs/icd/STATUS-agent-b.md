# STATUS — Agent B (import Velxio + génération de boîtier)

Branche : `agent-b/enclosure`, basée sur `velxio` (`0dd8354`), avec merge de
`agent-a/components` (`27b15a6`, commit de merge `5aff747`).
Date : 2026-11-05 (mise à jour après merge de la base Agent A).

## Ce qui marche

- **Import zip Velxio** (`src/app/velxio/import/`)
  - lecture de `diagram.json` et `sketch.ino` via JSZip ;
  - conversion en `BoardModel` (`PlacedPart[]`, `Connection[]`, `warnings`, `complete`) ;
  - coordonnées `top`/`left` conservées uniquement comme topologie, avec warning
    `CANVAS_SCALE_IGNORED` (aucune conversion pixels → mm) ;
  - résolution des `partType` par l'API locale `POST /api/parts/resolve` si elle répond,
    puis repli sur `data/components.index.json` et les fichiers de `data/components/**` ;
  - `partType` inconnu → `spec = null` + warning `UNKNOWN_PART_TYPE`, aucune dimension inventée.
- **Layout** (`src/app/velxio/layout/`)
  - mode `flat` : une couche, boîtier large, ordre dérivé de la topologie du canevas ;
  - mode `stacked` : un étage par composant, entretoises verticales entre étages ;
  - dimensions extérieures calculées à partir des enveloppes réelles + `rules` ;
  - contrôle de collision par boîte englobante avec `rules.clearanceMm`
    (`findCollisions`) ; les composants sans spec sont exclus du placement physique.
- **Découpes** (`src/app/velxio/cutouts/`)
  - projection des `ComponentSpec.cutouts` et des `keepouts` de paroi sur les parois,
    rotation du composant prise en compte, clearance d'impression
    (`rules.printClearanceMm`) appliquée sur largeur et hauteur.
- **Supports** (`src/app/velxio/supports/`)
  - type par composant : `standoff-screw` (boards), `cradle` (écrans/actionneurs),
    `clip` (capteurs), `pocket` (passifs/modules) ;
  - un standoff par trou de fixation pour les boards, sinon un support centré ;
  - géométrie imprimable réelle par type (`support-geometry.ts`), pas seulement des données.
- **Spec finale** (`buildEnclosureSpec`)
  - `EnclosureSpec` complet avec règles par défaut : paroi 2 mm, jeu 0,3 mm, marge haute 3 mm,
    congés 3 mm, plancher 2 mm, couvercle 2 mm, clearance d'impression 0,2 mm.
- **Maillage / STL** (`src/app/velxio/import/enclosure-mesh.ts`)
  - branchement réel sur le moteur JSCAD upstream (`base`, `lid`, `pcbMount`) ;
  - `buildEnclosureGeometry()` produit base + couvercle + supports typés ;
  - `generateEnclosureStlBlob()` produit un STL téléchargeable (Blob `model/stl`) ;
  - `lid.type` est mappé : `snap` → snap-fit, `screw-heat-set` → trous borgnes,
    `screw-nut` → logements d'écrou.
- **Pipeline réutilisable** (`src/app/velxio/import/enclosure-pipeline.ts`)
  - `importAndGenerateEnclosure(zip, options)` fait zip → `BoardModel` → `EnclosureSpec` → STL
    en un appel, prêt à être branché sur l'UI.
- **Intégration base Agent A** (merge `5aff747`)
  - 127 entrées dans `data/components.index.json`, 120/120 `partType` Velxio couverts ;
  - API réelle testée : `POST /api/parts/resolve` renvoie les 5 types de l'exemple et
    `missing: ["unknown-widget"]` pour le type inconnu ;
  - `npm run db:coverage` : 0 manquant, 107 estimés, 7 extras (alias/variantes).
- **Démo / tests**
  - zip d'exemple en mémoire : 2 boards + 3 composants (`example-project.ts`) ;
  - cas `partType` inconnu, cas `stacked`, vérification des dimensions extérieures et
    absence de collision (`*.spec.ts`).
  - `npm run build` : vert.
  - `npm test` (Chrome Headless) : **218 SUCCESS**, dont les nouveaux tests Agent B.
  - `npm run db:test` : **11 SUCCESS**.
  - Dimensions vérifiées sur l'exemple : `flat` = 132,6 × 24,6 × 27 mm ;
    `stacked` = 44,6 × 24,6 × 74 mm. STL produit > 1 ko.

## Ce qui reste / limites connues

- Le repli local lit `data/components.index.json` à la racine du workspace. En build Angular
  statique, `data/**` n'est pas dans les assets : sans API `db:serve`, le repli ne trouvera
  pas l'index. Voir `REQUESTS-agent-b.md` R2.
- Pas de branchement UI (hors périmètre Agent B) : les services sont utilisables depuis
  l'application, mais aucun bouton « Importer un zip » n'est ajouté.
- `Cutout` ne porte pas d'offset vertical : les découpes sont centrées verticalement sur la
  paroi. Voir `REQUESTS-agent-b.md`.
- En mode `stacked`, les supports des étages supérieurs sont générés comme des colonnes
  pleines depuis le plancher (pas comme des entretoises suspendues entre deux étages).
- Les `keepouts` de volume (antenne, bouton) sont traités comme des ouvertures de paroi ;
  un keepout purement interne (zone à ne pas recouvrir à l'intérieur du boîtier) n'a pas
  encore de géométrie dédiée.
- Le `lid.type` est mappé sur les modes du moteur, mais les dimensions de vis/inserts
  utilisent les valeurs par défaut du moteur, pas encore de presets par type.

## Blocages

Aucun blocage. La dépendance Agent A (base + index + API) est mergée et vérifiée.
