# REQUESTS — Agent B

Demandes de changement sur des fichiers hors périmètre Agent B. Aucune n'est bloquante.

## R1 — Offset vertical des découpes (contrat `Cutout`)

Fichier concerné : `src/app/velxio/model/component.types.ts` (ProxBoss).

Contexte : `Cutout` décrit `offsetMm` le long de la paroi et `heightMm`, mais pas la position
verticale de l'ouverture. Le générateur centre donc chaque découpe verticalement, ce qui n'est
pas correct pour un connecteur proche du bas d'une carte.

Demande : ajouter un champ optionnel, par exemple `centerHeightMm?: number` (ou
`offsetZMm?: number`), exprimé depuis le bas de l'enveloppe du composant. Le générateur
l'utiliserait pour positionner la découpe dans la paroi, sans changer le comportement actuel
quand le champ est absent.

Impact : additif et rétrocompatible ; aucun changement requis dans les données existantes.

## R2 — Publication de l'index de composants (dépendance Agent A)

Fichier concerné : `data/components.index.json`.

Contexte : le contrat d'import lit l'index local en repli de l'API HTTP. Sur la branche
`velxio` actuelle, l'index et les fichiers `data/components/**` ne sont pas encore publiés.

Demande : publier l'index généré par `npm run db:build` et les fichiers de composants pour que
les 120 `partType` de `data/velxio-types.json` soient résolvables hors API. Aucun changement
de code Agent B n'est nécessaire.
