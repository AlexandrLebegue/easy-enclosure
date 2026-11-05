# STATUS — Agent C (assistant conversationnel)

Branche : `agent-c/chat` (basée sur `velxio`, mergée avec `agent-a/components` et
`agent-b/enclosure`).

Périmètre livré : `src/app/velxio/chat/**`, le montage dans la coquille (`src/app/app.ts`,
`src/app/app.html`, `src/app/app.spec.ts`) et la documentation ICD.

## Ce qui marche

- **Service de chat OpenAI-compatible** (`chat/service.ts`)
  - endpoint `${baseUrl}/chat/completions`, configurable par les réglages UI (`localStorage`) ou
    par `globalThis.__VELXIO_CHAT_CONFIG__`.
  - valeurs par défaut : `http://192.168.1.59:18020/v1`, modèle `qwen3.8-27b`, timeout 60 s.
  - clé API configurable dans le panneau (champ masqué), URL et modèle modifiables à chaud.
  - streaming SSE quand le serveur le supporte, repli automatique sur la réponse JSON complète.
  - erreurs HTTP, timeout (`AbortController`) et réponses non-JSON transformés en messages
    propres (`ChatServiceError`), jamais en exception non gérée côté UI.
- **Prompt système strict** (`chat/prompt.ts`) : décrit `EnclosureSpec`, les opérations `ChatPatch`
  autorisées, les bornes, interdit la géométrie/le code CAO et impose une sortie JSON unique avec
  la prose confinée dans `message`.
- **Application des patches** (`chat/patches.ts`)
  - `applyPatches(spec, patches) -> { spec, applied, rejected }`.
  - opérations : `set-mode`, `set-rule`, `set-lid`, `add-cutout`, `remove-cutout`, `set-support`,
    `ask-user`.
  - bornes : paroi 1,2–5 mm, jeu 0–2 mm, congés 0–20 mm, couvercle 2–4 mm (plus des bornes
    réalistes pour hauteur libre, jeu d'impression et plancher).
  - validation structurelle complète de l'`EnclosureSpec` avant exposition ; les bornes de patch
    restent appliquées séparément pour ne pas casser les projets upstream existants.
  - `ask-user` ne modifie pas la spec mais remonte la question dans `applied`.
- **Pont bidirectionnel spec ↔ moteur** (`chat/spec-bridge.ts`)
  - `EnclosureSpec -> Params` via `enclosureSpecToParams` (agent B) puis
    `EnclosureStateService` : l'aperçu 3D se régénère après chaque patch.
  - `Params -> EnclosureSpec` après édition dans le panneau de paramètres : le chat repart
    toujours de l'état réel de l'application.
  - les options non modélisées par le contrat (`waterProof`, cloisons, clamps, montage mural,
    montage DIN, aperçu PCB, unités impériales, grille) sont préservées.
  - les trous/montages upstream (formes cercle/carré, diamètres, options) sont conservés tant que
    le chat ne les modifie pas ; les suppressions/ajouts du chat sont appliqués en delta.
  - les unités impériales sont converties dans les deux sens, la spec restant toujours en mm.
- **Panneau Angular autonome** (`chat/chat-panel.component.*`)
  - historique de conversation, patches appliqués/rejetés, question `ask-user` en évidence,
    bouton « Expliquer le choix », résumé live de la spec, réglages serveur/modèle/clé/timeout.
  - indicateur de réception pendant le streaming.
  - historique persisté dans `localStorage` avec bouton « Effacer ».
  - aucune dépendance directe au moteur CAO ou au rendu 3D.
- **Intégration application**
  - panneau affiché à gauche de l'aperçu 3D, avec bouton pour le masquer/réafficher.
  - la spec validée est partagée par `ChatStateService`, persistée et revalidée au chargement.
  - une spec persistée est réappliquée au démarrage (découpes et supports compris).
  - import de projet Velxio : bouton « Import Velxio ZIP » dans la barre d'outils, service
    `VelxioImportService` (zip → `EnclosureSpec`, sans STL inutile), application à l'aperçu via
    `ChatPreviewBridgeService`, erreurs lisibles et avertissements affichés.
  - `data/**` est servi comme asset Angular pour que le repli `data/components.index.json`
    fonctionne en build statique.
- **Point d'entrée public** (`chat/index.ts`) : composant, service, état, bridge, `applyPatches`,
  `validateEnclosureSpec`, `createDefaultSpec` et types associés.

## Vérifications

- `npm run build` : vert.
- `npm test` : **270/270 SUCCESS** (dont 45 tests chat).
- `npm run db:test` : **11/11 SUCCESS**.
- Test réseau réel avec la clé de l'environnement : `GET /v1/models` → 200, puis
  `POST /v1/chat/completions` → 200 avec une réponse JSON valide contenant les patches attendus
  (`set-rule` paroi 3 mm, `set-lid` vis, `add-cutout` USB).
- Streaming réel vérifié sur le serveur (`text/event-stream`).
- Si Chrome n'est pas installé, lancer avec un binaire Chromium disponible :
  `CHROME_BIN=/chemin/vers/chrome npm test`.

## Points d'attention

- Le contrat `Cutout` ne décrit que des ouvertures rectangulaires. Les trous upstream
  cercle/carré/double-D restent inchangés tant que le chat ne les modifie pas ; une découpe
  ajoutée ou remplacée par le chat est rectangulaire par construction du contrat.
- La clé API saisie dans l'UI est stockée dans `localStorage` sur ce poste ; laisser le champ vide
  pour un serveur sans authentification.
- Le serveur par défaut exige une clé API : sans clé, l'UI affiche proprement le `401`.
