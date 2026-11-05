# REQUESTS — Agent C (assistant conversationnel)

Demandes de changement hors périmètre, à traiter par le propriétaire du fichier concerné.

## R1 — Monter le panneau de chat à côté de l'aperçu 3D

**Fichiers concernés (hors périmètre agent C)** : `src/app/app.ts`, `src/app/app.html`,
éventuellement `src/app/core/state/**`.

**Besoin** : afficher `ChatPanelComponent` dans une colonne à côté de `app-renderer`, comme le
panneau latéral existant, et connecter sa spec à l'état applicatif.

**Suggestion d'intégration** :

```ts
import { ChatPanelComponent } from './velxio/chat/chat-panel.component';

@Component({
  imports: [RendererComponent, SidebarComponent, ChatPanelComponent],
})
export class App {}
```

```html
<div class="relative min-w-0 flex-1">
  <app-renderer />
</div>

<aside class="relative z-10 w-96 overflow-hidden">
  <app-chat-panel [specInput]="spec()" (specChange)="onSpecChange($event)" />
</aside>
```

Le composant est autonome et n'a besoin que d'entrées/sorties `specInput` / `specChange`.
Il ne touche jamais au moteur CAO : il ne produit que des `ChatPatch` validés.

**Alternative** : créer une route dédiée `/chat` dans `app.routes.ts` si l'intégrateur préfère un
écran séparé.

## R2 — Contrat d'état partagé pour EnclosureSpec

**Fichiers concernés** : `src/app/velxio/model/**` (ProxBoss), `src/app/core/state/**`.

**Besoin** : un service d'état partagé exposant l'`EnclosureSpec` courante et acceptant les
patches validés par le chat. Le chat fournit déjà `applyPatches` et `validateEnclosureSpec` ; il
suffit de brancher `specChange` sur l'état puis de transmettre la spec au moteur de génération.
