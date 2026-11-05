# STATUS — Agent C (assistant conversationnel)

Branche : `agent-c/chat` (basée sur `velxio`)
Périmètre livré : `src/app/velxio/chat/**`, `docs/icd/STATUS-agent-c.md`, `docs/icd/REQUESTS-agent-c.md`,
plus le montage dans la coquille (`src/app/app.ts`, `src/app/app.html`, `src/app/app.spec.ts`)
à la demande explicite du 2026-11-05. La branche contient aussi les merges de
`agent-a/components` et `agent-b/enclosure`.

## Ce qui marche

- **Service de chat OpenAI-compatible** (`chat/service.ts`)
  - endpoint `${baseUrl}/chat/completions`, configurable par `localStorage` (réglages UI) ou par
    `globalThis.__VELXIO_CHAT_CONFIG__` injecté au runtime.
  - valeurs par défaut : `http://192.168.1.59:18020/v1`, modèle `qwen3.8-27b`, timeout 60 s.
  - l'URL peut pointer vers opencode-go ou tout serveur compatible (llama.cpp, vLLM…).
  - erreurs HTTP, timeout (`AbortController`) et réponse HTTP non-JSON transformés en messages
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
  - chaque patch est appliqué sur une copie puis l'`EnclosureSpec` complète est revalidée ; un
    patch invalide est rejeté avec une raison en français sans annuler les autres patches valides.
  - `ask-user` ne modifie pas la spec mais remonte la question dans `applied`.
- **Panneau Angular autonome** (`chat/chat-panel.component.*`)
  - historique de conversation, patches appliqués/rejetés, question `ask-user` en évidence,
    bouton « Expliquer le choix », résumé live de la spec, réglages base URL / modèle / timeout.
  - aucune dépendance au moteur CAO, à JSCAD ou au rendu 3D ; l'état de sortie est exposé via
    l'output `specChange`.
- **Montage dans l'application** (`src/app/app.*`)
  - le panneau est affiché à gauche de l'aperçu 3D, avec un bouton pour le masquer/réafficher.
  - la spec est portée par `ChatStateService` (`chat/chat-state.service.ts`), partagée entre
    l'application et le panneau via `[specInput]` / `(specChange)`.
  - la spec persistée est revalidée au chargement ; une spec invalide est ignorée.
  - les patches acceptés sont mappés vers le moteur par `enclosureSpecToParams` (agent B) puis
    transmis à `EnclosureStateService` : l'aperçu 3D se régénère après chaque modification.
  - les réglages de vue (système d'unités, grille, affichage base/couvercle) sont conservés lors
    du passage de la spec au moteur.
- **Historique persistant** (`chat/chat-history.ts`) : conversation et tours restaurés depuis
  `localStorage`, bouton « Effacer » pour purger.
- **Point d'entrée public** (`chat/index.ts`) : réexporte le composant, le service, l'état,
  `applyPatches`, `validateEnclosureSpec`, `createDefaultSpec` et les types associés.
- **Tests** (`patches.spec.ts`, `service.spec.ts`, `chat-panel.component.spec.ts`,
  `chat-state.service.spec.ts`) : 37 tests couvrant patch valide, hors bornes, opération inconnue,
  découpe dupliquée ou hors face, suppression inconnue, supports valides/inconnus/`none`, mode
  invalide, valeur non numérique, conversation multi-tours, réponse non-JSON, question `ask-user`,
  erreurs HTTP/timeout, persistance des réglages, persistance de l'historique et explication.

## Vérifications

- `npm run build` : vert.
- `npm test` : 258/258 SUCCESS (dont les 37 tests du chat et les tests import/layout/
  cutouts/supports de l'agent B).
- `npm run db:test` : 11/11 SUCCESS (base de composants de l'agent A).
- Si Chrome n'est pas installé, lancer avec un binaire Chromium disponible :
  `CHROME_BIN=/chemin/vers/chrome npm test`.

## Ce qui reste / à intégrer

- **Synchronisation inverse sidebar → spec** : les modifications faites dans le panneau de
  paramètres après un échange avec le chat ne sont pas réinjectées dans l'`EnclosureSpec`. Une
  nouvelle demande du chat repart de la dernière spec du chat et peut donc écraser ces
  modifications. Un mapping `Params -> EnclosureSpec` (ou un état unique) reste à décider.
- **Eau / options hors spec** : l'`EnclosureSpec` ne modélise pas `waterProof`, les clamps, les
  cloisons internes ni le montage mural ; le passage par `enclosureSpecToParams` désactive ces
  options. À arbitrer si le chat doit les piloter un jour.
- **Streaming** : non implémenté, la requête reste non-streamée pour garder une validation
  atomique des patches.
- **Test réseau réel** : le serveur `http://192.168.1.59:18020/v1` répond `401 Unauthorized`
  sans clé API ; le service est donc testé avec `fetch` simulé. Renseigner une clé dans les
  réglages UI ou `__VELXIO_CHAT_CONFIG__` pour un test manuel.

## Blocages

- Pas de blocage code. Le pont moteur CAO dépend de l'agent B (R2).
- Le test contre le serveur par défaut est bloqué par l'authentification (`401 Unauthorized`) ;
  aucune clé API n'est fournie dans l'environnement.
