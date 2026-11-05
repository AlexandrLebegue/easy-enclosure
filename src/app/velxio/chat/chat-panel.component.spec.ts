import { TestBed } from '@angular/core/testing';

import type { ChatTurn } from '../model/enclosure.types';
import { ChatPanelComponent } from './chat-panel.component';
import { ChatService, DEFAULT_CHAT_CONFIG, type ChatRequest } from './service';

describe('ChatPanelComponent', () => {
  let sendMessageSpy: jasmine.Spy;
  let saveConfigSpy: jasmine.Spy;

  const chatMock = {
    sendMessage: (...args: unknown[]) => sendMessageSpy(...args),
    getConfig: () => DEFAULT_CHAT_CONFIG,
    saveConfig: (...args: unknown[]) => saveConfigSpy(...args),
  };

  function createComponent() {
    const fixture = TestBed.createComponent(ChatPanelComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    localStorage.clear();
    sendMessageSpy = jasmine.createSpy('sendMessage');
    saveConfigSpy = jasmine
      .createSpy('saveConfig')
      .and.callFake((patch: Record<string, unknown>) => ({ ...DEFAULT_CHAT_CONFIG, ...patch }));
    await TestBed.configureTestingModule({
      imports: [ChatPanelComponent],
      providers: [{ provide: ChatService, useValue: chatMock }],
    }).compileComponents();
  });

  it('applies a valid patch and displays the updated spec', async () => {
    sendMessageSpy.and.resolveTo({
      userText: 'une paroi de 3 mm',
      patches: [{ op: 'set-rule', path: 'rules.wallMm', value: 3 }],
      message: 'Paroi réglée à 3 mm.',
    } satisfies ChatTurn);

    const fixture = createComponent();
    const component = fixture.componentInstance;
    await component.sendMessage('une paroi de 3 mm');
    fixture.detectChanges();

    expect(component.spec().rules.wallMm).toBe(3);
    expect(component.messages().length).toBe(2);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('3 mm');
    expect(text).toContain('Paroi réglée à 3 mm.');
  });

  it('keeps the previous spec and reports a rejected patch', async () => {
    sendMessageSpy.and.resolveTo({
      userText: 'paroi de 20 mm',
      patches: [{ op: 'set-rule', path: 'rules.wallMm', value: 20 }],
      message: 'Modification proposée.',
    } satisfies ChatTurn);

    const fixture = createComponent();
    const component = fixture.componentInstance;
    await component.sendMessage('paroi de 20 mm');
    fixture.detectChanges();

    expect(component.spec().rules.wallMm).toBe(2);
    const assistant = component.lastAssistant();
    expect(assistant?.rejected?.length).toBe(1);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Rejeté');
  });

  it('supports a multi-turn conversation and forwards history', async () => {
    sendMessageSpy.and.returnValues(
      Promise.resolve({
        userText: 'paroi de 3 mm',
        patches: [{ op: 'set-rule', path: 'rules.wallMm', value: 3 }],
        message: 'Paroi réglée.',
      } satisfies ChatTurn),
      Promise.resolve({
        userText: 'jeu de 1 mm',
        patches: [{ op: 'set-rule', path: 'rules.clearanceMm', value: 1 }],
        message: 'Jeu réglé.',
      } satisfies ChatTurn),
    );

    const fixture = createComponent();
    const component = fixture.componentInstance;
    await component.sendMessage('paroi de 3 mm');
    await component.sendMessage('jeu de 1 mm');
    fixture.detectChanges();

    expect(sendMessageSpy.calls.count()).toBe(2);
    const secondRequest = sendMessageSpy.calls.argsFor(1)[0] as ChatRequest;
    expect(secondRequest.history.length).toBe(1);
    expect(secondRequest.history[0].userText).toBe('paroi de 3 mm');
    expect(secondRequest.spec.rules.wallMm).toBe(3);
    expect(component.spec().rules.clearanceMm).toBe(1);
    expect(component.messages().length).toBe(4);
  });

  it('surfaces an ask-user question in the UI', async () => {
    sendMessageSpy.and.resolveTo({
      userText: 'fais un boîtier',
      patches: [{ op: 'ask-user', question: 'Quel connecteur veux-tu exposer ?' }],
      message: '',
    } satisfies ChatTurn);

    const fixture = createComponent();
    const component = fixture.componentInstance;
    await component.sendMessage('fais un boîtier');
    fixture.detectChanges();

    expect(component.pendingQuestion()).toBe('Quel connecteur veux-tu exposer ?');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Quel connecteur veux-tu exposer ?');
    expect(text).toContain('Question de l’assistant');
  });

  it('shows a clean error when the service fails', async () => {
    sendMessageSpy.and.rejectWith(new Error('Timeout du modèle'));

    const fixture = createComponent();
    const component = fixture.componentInstance;
    await component.sendMessage('bonjour');
    fixture.detectChanges();

    expect(component.error()).toBe('Timeout du modèle');
    expect(component.busy()).toBeFalse();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Timeout du modèle');
  });

  it('explains the last applied choices without calling the CAD engine', async () => {
    sendMessageSpy.and.resolveTo({
      userText: 'paroi de 3 mm',
      patches: [
        {
          op: 'set-rule',
          path: 'rules.wallMm',
          value: 3,
          rationale: 'Une paroi plus épaisse résiste mieux.',
        },
      ],
      message: 'Paroi réglée.',
    } satisfies ChatTurn);

    const fixture = createComponent();
    const component = fixture.componentInstance;
    await component.sendMessage('paroi de 3 mm');
    component.explainLast();
    fixture.detectChanges();

    expect(component.explanation()).toContain('Une paroi plus épaisse résiste mieux.');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Explication');
  });

  it('saves endpoint settings from the UI', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.baseUrlDraft = 'http://localhost:9999/v1';
    component.modelDraft = 'local-model';
    component.apiKeyDraft = 'secret';
    component.timeoutDraft = '30';
    component.saveSettings();

    expect(saveConfigSpy).toHaveBeenCalledWith({
      baseUrl: 'http://localhost:9999/v1',
      model: 'local-model',
      apiKey: 'secret',
      timeoutMs: 30_000,
    });
    expect(component.config().model).toBe('local-model');
    expect(component.showSettings()).toBeFalse();
  });

  it('refuses an invalid timeout without saving', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component.timeoutDraft = '0';
    component.saveSettings();

    expect(saveConfigSpy).not.toHaveBeenCalled();
    expect(component.settingsError()).toContain('positif');
  });

  it('restores the conversation history from localStorage', async () => {
    sendMessageSpy.and.resolveTo({
      userText: 'paroi de 3 mm',
      patches: [{ op: 'set-rule', path: 'rules.wallMm', value: 3 }],
      message: 'Paroi réglée.',
    } satisfies ChatTurn);

    const first = createComponent();
    await first.componentInstance.sendMessage('paroi de 3 mm');
    first.destroy();

    const second = TestBed.createComponent(ChatPanelComponent);
    second.detectChanges();

    expect(second.componentInstance.messages().length).toBe(2);
    const text = (second.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Paroi réglée.');
  });

  it('clears the persisted conversation history', async () => {
    sendMessageSpy.and.resolveTo({
      userText: 'bonjour',
      patches: [],
      message: 'Bonjour.',
    } satisfies ChatTurn);

    const fixture = createComponent();
    const component = fixture.componentInstance;
    await component.sendMessage('bonjour');

    component.clearHistory();
    fixture.detectChanges();

    expect(component.messages()).toEqual([]);
    expect(localStorage.getItem('velxio.chat.history')).toBeNull();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Bonjour.');
  });
});
