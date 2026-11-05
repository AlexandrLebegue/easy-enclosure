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

## R2 — Hébergement statique du repli local (résolu côté données, reste côté build)

Fichiers concernés : `angular.json` (assets) ou serveur statique.

Contexte : l'index et les 127 fichiers `data/components/**` sont désormais présents et
l'API `npm run db:serve` fonctionne. Le repli local lit toutefois `data/components.index.json`
à la racine du workspace ; en build Angular statique, `data/**` n'est pas copié dans `dist`,
donc le repli échoue si l'API n'est pas lancée.

Demande : ajouter `data/components.index.json` et `data/components/**` aux assets Angular
(ou servir ces fichiers depuis le même serveur que l'application). Aucun changement de code
Agent B n'est nécessaire.
