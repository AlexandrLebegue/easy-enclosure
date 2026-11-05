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
module 1.54 pouce (42,5 x 33,5 mm) et documenté dans `notes` que le 2.13 pouce (~60 x 40 mm) ne
doit pas réutiliser ces valeurs.

Demande : ajouter deux `partType` distincts dans Velxio (ou dans le contrat) si les deux variantes
doivent être distinguées automatiquement. En l'état, l'agent B doit afficher une alerte sur
`velxio-epaper`.

## R3 — Composants virtuels sans empreinte physique

20 types observés (`velxio-logic-*`, `velxio-flip-flop-*`, `velxio-junction`,
`wokwi-opamp-ideal`) sont des composants de simulation sans corps physique. Ils restent
volontairement non couverts et apparaissent dans `npm run db:coverage`.

Demande : confirmer qu'ils doivent rester hors base dimensionnelle (recommandé) ou fournir une
règle de boîtier pour les composants virtuels.
