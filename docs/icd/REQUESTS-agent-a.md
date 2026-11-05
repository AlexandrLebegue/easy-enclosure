# REQUESTS — Agent A (base de composants)

## R1 — Modification hors zone stricte : `package.json` / `package-lock.json`

Pour livrer les commandes obligatoires de l'ICD, j'ai ajouté à `package.json` :

- `db:build`, `db:coverage`, `db:serve`, `db:test` ;
- la dépendance `express` (serveur HTTP imposé) ;
- les devDependencies `@types/express` et `@types/node` (nécessaires au typecheck Angular).

Ces fichiers sont hors du périmètre `data/components/**`, `scripts/db/**`,
`src/app/velxio/db/**`. Aucun autre fichier racine n'a été modifié. Merci de confirmer ou de
réintégrer ces ajouts lors du merge dans `velxio`.

## R2 — E-paper 1.54 pouce vs 2.13 pouces

Le référentiel Velxio observé ne contient qu'un seul `partType` `velxio-epaper`, alors que la
mission demande les deux tailles (1.54 et 2.13). J'ai rempli `velxio-epaper` avec les cotes du
module 1.54 pouce (42,5 x 33,5 mm) et ajouté une entrée de variante documentée
`velxio-epaper-2-13` (59,2 x 29,2 x 1,05 mm, panneau Waveshare).

Demande : ajouter deux `partType` officiels dans Velxio (ou dans le contrat) si les deux variantes
doivent être distinguées automatiquement. En l'état, `velxio-epaper` reste la variante 1.54 et
`velxio-epaper-2-13` est un extra hors liste observée.

## R3 — Composants virtuels sans empreinte physique

20 types observés (`velxio-logic-*`, `velxio-flip-flop-*`, `velxio-junction`,
`wokwi-opamp-ideal`) sont des composants de simulation sans corps physique. Ils restent
volontairement non couverts et apparaissent dans `npm run db:coverage`.

Demande : confirmer qu'ils doivent rester hors base dimensionnelle (recommandé) ou fournir une
règle de boîtier pour les composants virtuels.

## R4 — Alias de cartes `board-velxio-*`

L'ICD cite `board-velxio-esp32` et `board-velxio-arduino-uno`, et le projet d'exemple de l'agent B
utilise ces `partType`, mais `data/velxio-types.json` ne liste que les équivalents `wokwi-*`.
J'ai ajouté dans la base des alias explicites : `board-velxio-esp32`,
`board-velxio-arduino-uno`, `board-velxio-esp32-c3`, `board-velxio-rpi-pico` et
`board-velxio-stm32`. Ils réutilisent les dimensions documentées et sont marqués « extra » par
le rapport de couverture.

Demande : confirmer les `partType` canoniques réellement produits par les exports Velxio afin de
figer les alias (ou de les supprimer s'ils sont inutiles).
