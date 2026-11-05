# Répartition et règles de travail — projet `easy-enclosure` fork Velxio

Trois agents travaillent en parallèle sur le même dépôt. Sans discipline de fichiers, ils se
écrasent mutuellement. Ce document fait autorité.

## 1. Propriété des fichiers

| Zone | Propriétaire | Contenu |
|---|---|---|
| `src/app/velxio/model/**` | **ProxBoss (chef de projet)** | contrats TypeScript partagés |
| `docs/icd/**` | ProxBoss | ICD, schémas, décisions |
| `data/components/**`, `scripts/db/**`, `src/app/velxio/db/**` | **Agent A** | base de dimensions |
| `src/app/velxio/import/**`, `layout/**`, `cutouts/**`, `supports/**` | **Agent B** | import Velxio + génération de boîtier |
| `src/app/velxio/chat/**` | **Agent C** | assistant conversationnel |
| reste du dépôt (moteur upstream) | personne sans accord | on ne touche pas |

Règle : un agent ne modifie **jamais** un fichier hors de sa zone. S'il estime qu'un changement
est nécessaire ailleurs, il l'écrit dans `docs/icd/REQUESTS-<agent>.md` et continue.

## 2. Branches

- `main` : upstream Bruce Borrett, jamais commitée directement.
- `velxio` : branche d'intégration, reçoit les trois travaux.
- `agent-a/components`, `agent-b/enclosure`, `agent-c/chat` : une branche par agent.

L'intégrateur (ProxBoss) merge dans `velxio` après revue. Un agent ne merge pas lui-même.

## 3. Commits

- Un commit = un changement cohérent, message en anglais, impératif, préfixé :
  `feat(db): ...`, `test(db): ...`, `docs(icd): ...`.
- Pas de commit de `node_modules`, `dist`, `.angular`, ni de fichier de plus de 5 Mo.
- `npm run build` et les tests concernés doivent passer avant commit.

## 4. Définition de « terminé »

- Le code compile (`npm run build`).
- Les tests écrits pour la fonctionnalité passent.
- La démo correspondante est exécutable sans intervention manuelle.
- Le rapport de fin ("ce qui marche / ce qui reste") est déposé dans
  `docs/icd/STATUS-<agent>.md`.

## 5. Conflits et blocages

Un agent bloqué plus de 20 minutes sur une dépendance d'un autre agent écrit son blocage dans
son fichier `STATUS-<agent>.md` avec la question précise. Il continue ensuite sur une autre
partie de son périmètre plutôt que d'attendre.
