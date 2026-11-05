import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RendererComponent } from './features/renderer/renderer.component';
import { SidebarComponent } from './features/sidebar/sidebar.component';
import { ChatPanelComponent } from './velxio/chat/chat-panel.component';
import { ChatStateService } from './velxio/chat/chat-state.service';
import { applySpecToParams, paramsToEnclosureSpec } from './velxio/chat/spec-bridge';
import type { EnclosureSpec } from './velxio/model/enclosure.types';
import { EnclosureStateService } from './core/state/enclosure-state.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RendererComponent, SidebarComponent, ChatPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly chatState = inject(ChatStateService);
  private readonly enclosureState = inject(EnclosureStateService);

  readonly spec = this.chatState.spec;
  readonly chatOpen = signal(true);

  private applyingChatSpec = false;

  constructor() {
    if (this.chatState.restoredFromStorage) {
      this.applyingChatSpec = true;
      this.applySpecToPreview(this.spec(), this.spec(), {
        replaceHoles: true,
        replaceMounts: true,
      });
    } else {
      this.chatState.setSpec(paramsToEnclosureSpec(this.enclosureState.params(), this.spec()));
    }

    effect(() => {
      const params = this.enclosureState.params();
      if (this.applyingChatSpec) {
        this.applyingChatSpec = false;
        return;
      }
      untracked(() => {
        const next = paramsToEnclosureSpec(params, this.chatState.spec());
        this.chatState.setSpec(next);
      });
    });
  }

  toggleChat(): void {
    this.chatOpen.update((open) => !open);
  }

  onSpecChange(spec: EnclosureSpec): void {
    const previous = this.chatState.spec();
    if (!this.chatState.setSpec(spec)) {
      return;
    }
    this.applyingChatSpec = true;
    this.applySpecToPreview(spec, previous);
  }

  /** Pont EnclosureSpec <-> moteur JSCAD, avec conservation des options hors contrat. */
  private applySpecToPreview(
    spec: EnclosureSpec,
    previous: EnclosureSpec,
    options: { replaceHoles?: boolean; replaceMounts?: boolean } = {},
  ): void {
    this.enclosureState.setParams(
      applySpecToParams(spec, this.enclosureState.params(), previous, options),
    );
  }
}
