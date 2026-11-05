# STATUS — Agent C (assistant conversationnel)

Branche : `agent-c/chat` (basée sur `velxio`)
Périmètre livré : `src/app/velxio/chat/**`, `docs/icd/STATUS-agent-c.md`, `docs/icd/REQUESTS-agent-c.md`.

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
- **Tests** (`patches.spec.ts`, `service.spec.ts`, `chat-panel.component.spec.ts`) : 19 tests
  couvrant patch valide, hors bornes, opération inconnue, ajout/suppression de découpe,
  conversation multi-tours, réponse non-JSON, question `ask-user`, erreur de service et
  explication.

## Vérifications

- `npm run build` : vert.
- `npm test` : 214/214 SUCCESS (dont les 19 tests du chat).
- Si Chrome n'est pas installé, lancer avec un binaire Chromium disponible :
  `CHROME_BIN=/chemin/vers/chrome npm test`.

## Ce qui reste / à intégrer

- **Montage dans la coquille de l'application** : le composant n'est pas encore posé à côté de
  `app-renderer` car `src/app/app.html` et `src/app/app.ts` sont hors du périmètre de l'agent C.
  Demande déposée dans `REQUESTS-agent-c.md` (import de `ChatPanelComponent`, ajout de
  `<app-chat-panel [specInput]="spec" (specChange)="onSpecChange($event)" />` dans une colonne
  latérale).
- **Branchement sur la spec réelle** : le panneau démarre sur `createDefaultSpec()` et accepte
  une spec via l'input `specInput`. Le propriétaire de l'état partagé (agent B / ProxBoss) doit
  fournir l'`EnclosureSpec` courante et consommer `specChange` pour la transmettre au moteur CAO.
- **Streaming** : non implémenté, la requête est non-streamée pour garder une validation
  atomique des patches.
- **Historique persistant** : l'historique vit en mémoire du composant ; pas de sauvegarde
  localStorage pour éviter de stocker des données projet sans décision d'ICD.

## Blocages

- Aucun blocage technique. Le seul point ouvert est l'intégration UI dans la coquille applicative,
  hors périmètre (voir `REQUESTS-agent-c.md`).
