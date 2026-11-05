import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type { ChatPatch, ChatTurn, EnclosureSpec } from '../model/enclosure.types';
import { clearChatHistory, loadChatHistory, saveChatHistory } from './chat-history';
import { applyPatches, type AppliedPatch, type RejectedPatch } from './patches';
import { ChatService } from './service';
import { cloneSpec, createDefaultSpec } from './spec-defaults';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatEntry {
  id: number;
  role: ChatRole;
  text: string;
  patches?: ChatPatch[];
  applied?: AppliedPatch[];
  rejected?: RejectedPatch[];
}

interface SummaryRow {
  label: string;
  value: string;
}

/**
 * Panneau de chat autonome. Il ne connaît que EnclosureSpec et ChatPatch :
 * aucun accès au moteur CAO ni au rendu 3D.
 */
@Component({
  selector: 'app-chat-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-panel.component.html',
  styleUrl: './chat-panel.component.css',
})
export class ChatPanelComponent {
  private readonly chat = inject(ChatService);

  readonly specInput = input<EnclosureSpec | null>(null);
  readonly specChange = output<EnclosureSpec>();

  readonly spec = signal<EnclosureSpec>(createDefaultSpec());
  readonly messages = signal<ChatEntry[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly pendingQuestion = signal<string | null>(null);
  readonly explanation = signal<string | null>(null);
  readonly streamingText = signal('');
  readonly showSettings = signal(false);
  readonly settingsError = signal<string | null>(null);
  readonly config = signal(this.chat.getConfig());

  draft = '';
  baseUrlDraft = '';
  modelDraft = '';
  apiKeyDraft = '';
  timeoutDraft = '';

  private readonly turns = signal<ChatTurn[]>([]);
  private nextId = 1;

  constructor() {
    const stored = loadChatHistory();
    if (stored) {
      this.messages.set(stored.entries);
      this.turns.set(stored.turns);
      this.nextId = stored.entries.reduce((maxId, entry) => Math.max(maxId, entry.id), 0) + 1;
    }

    const config = this.chat.getConfig();
    this.config.set(config);
    this.baseUrlDraft = config.baseUrl;
    this.modelDraft = config.model;
    this.apiKeyDraft = config.apiKey;
    this.timeoutDraft = String(Math.round(config.timeoutMs / 1000));

    effect(() => {
      const incoming = this.specInput();
      if (incoming) {
        this.spec.set(cloneSpec(incoming));
      }
    });
  }

  readonly summary = computed<SummaryRow[]>(() => {
    const spec = this.spec();
    return [
      { label: 'Mode', value: spec.mode },
      {
        label: 'Dimensions',
        value: `${spec.outer.widthMm} × ${spec.outer.depthMm} × ${spec.outer.heightMm} mm`,
      },
      { label: 'Paroi', value: `${spec.rules.wallMm} mm` },
      { label: 'Jeu', value: `${spec.rules.clearanceMm} mm` },
      { label: 'Congés', value: `${spec.rules.cornerRadiusMm} mm` },
      { label: 'Couvercle', value: `${spec.lid.type} · ${spec.rules.lidMm} mm` },
      { label: 'Découpes', value: String(spec.cutouts.length) },
      { label: 'Supports', value: String(spec.standoffs.length) },
    ];
  });

  readonly lastAssistant = computed<ChatEntry | null>(() => {
    const assistant = this.messages()
      .slice()
      .reverse()
      .find((entry) => entry.role === 'assistant');
    return assistant ?? null;
  });

  readonly canExplain = computed(() => {
    const last = this.lastAssistant();
    if (!last) {
      return false;
    }
    return (last.applied?.length ?? 0) + (last.rejected?.length ?? 0) > 0;
  });

  onDraftInput(event: Event): void {
    this.draft = (event.target as HTMLTextAreaElement).value;
  }

  onBaseUrlInput(event: Event): void {
    this.baseUrlDraft = (event.target as HTMLInputElement).value;
  }

  onModelInput(event: Event): void {
    this.modelDraft = (event.target as HTMLInputElement).value;
  }

  onApiKeyInput(event: Event): void {
    this.apiKeyDraft = (event.target as HTMLInputElement).value;
  }

  onTimeoutInput(event: Event): void {
    this.timeoutDraft = (event.target as HTMLInputElement).value;
  }

  toggleSettings(): void {
    this.showSettings.update((visible) => !visible);
    this.settingsError.set(null);
  }

  saveSettings(): void {
    const timeoutSeconds = Number(this.timeoutDraft);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
      this.settingsError.set('Le timeout doit être un nombre de secondes positif.');
      return;
    }
    const next = this.chat.saveConfig({
      baseUrl: this.baseUrlDraft,
      model: this.modelDraft,
      apiKey: this.apiKeyDraft,
      timeoutMs: Math.round(timeoutSeconds * 1000),
    });
    this.config.set(next);
    this.baseUrlDraft = next.baseUrl;
    this.modelDraft = next.model;
    this.apiKeyDraft = next.apiKey;
    this.timeoutDraft = String(Math.round(next.timeoutMs / 1000));
    this.settingsError.set(null);
    this.showSettings.set(false);
  }

  async sendMessage(rawText?: string): Promise<void> {
    const text = (rawText ?? this.draft).trim();
    if (text.length === 0 || this.busy()) {
      return;
    }

    this.draft = '';
    this.error.set(null);
    this.explanation.set(null);
    this.pendingQuestion.set(null);
    this.streamingText.set('');
    this.append({ role: 'user', text });
    this.busy.set(true);

    try {
      const response = await this.chat.sendMessage(
        {
          spec: this.spec(),
          history: this.turns(),
          userText: text,
        },
        (delta) => this.streamingText.update((current) => current + delta),
      );

      const result = applyPatches(this.spec(), response.patches);
      this.spec.set(result.spec);

      const question = result.applied
        .map((entry) => entry.patch)
        .find((patch) => patch.op === 'ask-user')?.question;
      const pending = typeof question === 'string' ? question.trim() : '';
      if (pending.length > 0) {
        this.pendingQuestion.set(pending);
      }

      const message =
        response.message?.trim() ||
        (pending.length > 0 ? pending : this.describeResult(result.applied, result.rejected));

      this.append({
        role: 'assistant',
        text: message,
        patches: response.patches,
        applied: result.applied,
        rejected: result.rejected,
      });
      this.turns.update((turns) => [
        ...turns,
        {
          userText: text,
          patches: response.patches,
          message: response.message,
        },
      ]);
      this.persistHistory();
      this.specChange.emit(result.spec);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error.set(message);
      this.append({ role: 'system', text: `Erreur : ${message}` });
    } finally {
      this.streamingText.set('');
      this.busy.set(false);
    }
  }

  clearHistory(): void {
    this.messages.set([]);
    this.turns.set([]);
    this.nextId = 1;
    this.pendingQuestion.set(null);
    this.explanation.set(null);
    this.error.set(null);
    this.streamingText.set('');
    clearChatHistory();
  }

  explainLast(): void {
    const last = this.lastAssistant();
    if (!last) {
      this.explanation.set('Aucune réponse à expliquer pour le moment.');
      return;
    }

    const lines: string[] = [];
    for (const entry of last.applied ?? []) {
      const rationale = entry.patch.rationale?.trim();
      lines.push(`• ${entry.description}${rationale ? ` — ${rationale}` : ''}`);
    }
    for (const entry of last.rejected ?? []) {
      lines.push(`• ${entry.patch.op} refusé — ${entry.reason}`);
    }
    this.explanation.set(
      lines.length > 0
        ? lines.join('\n')
        : 'Le modèle n’a proposé aucune modification pour ce tour.',
    );
  }

  private describeResult(applied: AppliedPatch[], rejected: RejectedPatch[]): string {
    if (applied.length === 0 && rejected.length === 0) {
      return 'Aucune modification proposée.';
    }
    return `${applied.length} patch(es) appliqué(s), ${rejected.length} rejeté(s).`;
  }

  private append(entry: Omit<ChatEntry, 'id'>): void {
    this.messages.update((entries) => [...entries, { ...entry, id: this.nextId++ }]);
    this.persistHistory();
  }

  private persistHistory(): void {
    saveChatHistory(this.messages(), this.turns());
  }
}
