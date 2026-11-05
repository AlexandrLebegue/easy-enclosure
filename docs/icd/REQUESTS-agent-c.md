# REQUESTS — Agent C (assistant conversationnel)

Toutes les demandes ouvertes ont été traitées. Aucune action externe en attente.

## R1 — Monter le panneau de chat à côté de l'aperçu 3D — RÉSOLU

Le panneau est monté dans `src/app/app.html` à gauche de `app-renderer`, avec bouton de
masquage, et relié à `ChatStateService` via `[specInput]` / `(specChange)`. Le test de la
coquille utilise un mock `app-chat-panel`.

## R2 — Pont EnclosureSpec ↔ moteur CAO — RÉSOLU

`chat/spec-bridge.ts` assure les deux sens :

- `applySpecToParams` mappe la spec via `enclosureSpecToParams` (agent B), préserve les options
  hors contrat et applique les découpes/supports en delta pour ne pas perdre les formes upstream ;
- `paramsToEnclosureSpec` reconstruit la spec après une édition dans le panneau de paramètres,
  y compris en unités impériales.

L'aperçu 3D se met à jour après chaque patch et le chat repart de l'état réel de l'application.

## R3 — Authentification du serveur de modèle — RÉSOLU

Le serveur `http://192.168.1.59:18020/v1` exige un bearer token. Le panneau expose désormais un
champ « Clé API » (masqué, persisté localement). Le test réel avec la clé de l'environnement
renvoie 200 et des patches conformes ; le streaming SSE est également supporté.
