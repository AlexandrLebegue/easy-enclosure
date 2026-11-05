import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RendererComponent } from './features/renderer/renderer.component';
import { SidebarComponent } from './features/sidebar/sidebar.component';
import { ChatPanelComponent } from './velxio/chat/chat-panel.component';
import { ChatPreviewBridgeService } from './velxio/chat/chat-preview-bridge.service';
import type { EnclosureSpec } from './velxio/model/enclosure.types';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RendererComponent, SidebarComponent, ChatPanelComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly preview = inject(ChatPreviewBridgeService);

  readonly spec = this.preview.spec;
  readonly chatOpen = signal(true);

  toggleChat(): void {
    this.chatOpen.update((open) => !open);
  }

  onSpecChange(spec: EnclosureSpec): void {
    this.preview.applySpec(spec);
  }
}
