import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RendererComponent } from './features/renderer/renderer.component';
import { SidebarComponent } from './features/sidebar/sidebar.component';
import { ChatPanelComponent } from './velxio/chat/chat-panel.component';
import { ChatStateService } from './velxio/chat/chat-state.service';
import { enclosureSpecToParams } from './velxio/import/enclosure-mesh';
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

  constructor() {
    if (this.chatState.restoredFromStorage) {
      this.applySpecToPreview(this.spec());
    }
  }

  toggleChat(): void {
    this.chatOpen.update((open) => !open);
  }

  onSpecChange(spec: EnclosureSpec): void {
    if (!this.chatState.setSpec(spec)) {
      return;
    }
    this.applySpecToPreview(spec);
  }

  /** Pont EnclosureSpec -> moteur JSCAD via le mapping fourni par l'agent B. */
  private applySpecToPreview(spec: EnclosureSpec): void {
    const mapped = enclosureSpecToParams(spec);
    const current = this.enclosureState.params();
    this.enclosureState.setParams({
      ...mapped,
      measurementSystem: current.measurementSystem,
      showGrid: current.showGrid,
      gridSpacing: current.gridSpacing,
      showLid: current.showLid,
      showBase: current.showBase,
    });
  }
}
