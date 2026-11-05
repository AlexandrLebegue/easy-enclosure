# REQUESTS — Agent C (assistant conversationnel)

Demandes de changement hors périmètre, à traiter par le propriétaire du fichier concerné.

## R1 — Monter le panneau de chat à côté de l'aperçu 3D — RÉSOLU

**Fichiers concernés** : `src/app/app.ts`, `src/app/app.html`, `src/app/app.spec.ts`.

**État** : fait le 2026-11-05 à la demande explicite de l'utilisateur. Le panneau est monté à
gauche de `app-renderer`, avec un bouton pour le masquer, et relié à `ChatStateService` via
`[specInput]` / `(specChange)`. Un mock `app-chat-panel` a été ajouté au test de la coquille.

## R2 — Pont EnclosureSpec → moteur CAO — RÉSOLU

**Fichiers concernés** : zone agent B (`src/app/velxio/layout/**`, `cutouts/**`, `supports/**`)
et éventuellement `src/app/velxio/model/**` (ProxBoss).

**État** : fait le 2026-11-05. `App.onSpecChange` valide la spec via `ChatStateService`, la mappe
avec `enclosureSpecToParams` (agent B), puis met à jour `EnclosureStateService` ; le renderer se
régénère via son effect existant. Une spec persistée est réappliquée au démarrage. Le chat
continue de ne produire que des `ChatPatch` validés, jamais de géométrie.

## R3 — Authentification du serveur de modèle par défaut

**Fichiers concernés** : configuration d'exécution (hors dépôt).

**Besoin** : `http://192.168.1.59:18020/v1` répond `401 Unauthorized` sans clé API. Fournir une
clé via les réglages UI du panneau (`Base URL`, `Modèle`) ou via
`globalThis.__VELXIO_CHAT_CONFIG__ = { apiKey: '...' }` pour permettre un test réseau réel.
