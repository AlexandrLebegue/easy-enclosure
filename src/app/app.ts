import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RendererComponent } from './features/renderer/renderer.component';
import { SidebarComponent } from './features/sidebar/sidebar.component';
import { ChatPanelComponent } from './velxio/chat/chat-panel.component';
import { ChatStateService } from './velxio/chat/chat-state.service';
import type { EnclosureSpec } from './velxio/model/enclosure.types';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RendererComponent, SidebarComponent, ChatPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly chatState = inject(ChatStateService);

  readonly spec = this.chatState.spec;
  readonly chatOpen = signal(true);

  toggleChat(): void {
    this.chatOpen.update((open) => !open);
  }

  onSpecChange(spec: EnclosureSpec): void {
    this.chatState.setSpec(spec);
  }
}
