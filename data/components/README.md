# data/components — base de dimensions

Un fichier par composant, nommé `<partType>.json`, rangé par catégorie
(`board/`, `display/`, `sensor/`, `passive/`, `actuator/`, `power/`, `module/`, `other/`).

- Schéma : `src/app/velxio/model/component.types.ts` (`ComponentSpec`).
- Contrat détaillé : `docs/icd/ICD-components.md`.
- Validation : `npm run db:build` (index + rapport).
- Couverture : `npm run db:coverage`.
- Tests : `npm run db:test`.
- Serveur lecture seule : `npm run db:serve` (port 4100).
- La liste des `partType` réellement présents dans Velxio est dans `data/velxio-types.json`
  (120 types, généré le 2026-11-05).

Aucun fichier n'est écrit à la main en dehors de cette arborescence.
