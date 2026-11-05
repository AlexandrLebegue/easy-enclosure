import { createDefaultSpec } from './spec-defaults';
import {
  ChatService,
  ChatServiceError,
  DEFAULT_CHAT_CONFIG,
  loadChatConfig,
  parseChatResponse,
  saveChatConfig,
} from './service';

describe('parseChatResponse', () => {
  it('parses a bare ChatPatch array', () => {
    const parsed = parseChatResponse('[{"op":"set-rule","path":"rules.wallMm","value":2.4}]');

    expect(parsed.patches.length).toBe(1);
    expect(parsed.patches[0].op).toBe('set-rule');
    expect(parsed.message).toBeUndefined();
  });

  it('parses an object with patches and a message', () => {
    const parsed = parseChatResponse(
      '{"message":"Voici le réglage.","patches":[{"op":"set-mode","value":"stacked"}]}',
    );

    expect(parsed.message).toBe('Voici le réglage.');
    expect(parsed.patches).toEqual([{ op: 'set-mode', value: 'stacked' }]);
  });

  it('extracts JSON from a Markdown code fence', () => {
    const parsed = parseChatResponse(
      '```json\n{"message":"ok","patches":[{"op":"ask-user","question":"Quelle face ?"}]}\n```',
    );

    expect(parsed.message).toBe('ok');
    expect(parsed.patches.length).toBe(1);
    expect(parsed.patches[0].op).toBe('ask-user');
  });

  it('handles a non-JSON response without crashing', () => {
    const parsed = parseChatResponse('Je ne peux pas répondre en JSON pour le moment.');

    expect(parsed.patches).toEqual([]);
    expect(parsed.message).toBe('Je ne peux pas répondre en JSON pour le moment.');
  });

  it('drops malformed patch entries but keeps valid ones', () => {
    const parsed = parseChatResponse(
      '{"patches":[null,42,{"path":"missing-op"},{"op":"set-mode","value":"flat"}]}',
    );

    expect(parsed.patches).toEqual([{ op: 'set-mode', value: 'flat' }]);
  });

  it('returns a friendly message when the model content is empty', () => {
    const parsed = parseChatResponse('   ');

    expect(parsed.patches).toEqual([]);
    expect(parsed.message).toContain('vide');
  });
});

describe('ChatService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('posts to the configured OpenAI-compatible endpoint and parses the response', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').and.resolveTo(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"message":"Mode empilé.","patches":[{"op":"set-mode","value":"stacked"}]}',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const service = new ChatService();
    const result = await service.sendMessage({
      spec: createDefaultSpec(),
      history: [],
      userText: 'empile le boîtier',
    });

    expect(result.message).toBe('Mode empilé.');
    expect(result.patches).toEqual([{ op: 'set-mode', value: 'stacked' }]);

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_CHAT_CONFIG.baseUrl}/chat/completions`);
    const body = JSON.parse(String(init.body)) as {
      model: string;
      messages: { role: string; content: string }[];
    };
    expect(body.model).toBe(DEFAULT_CHAT_CONFIG.model);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('ChatPatch');
    expect(body.messages[body.messages.length - 1].content).toContain('empile le boîtier');
  });

  it('turns an HTTP error into a clean ChatServiceError', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response('gateway down', { status: 502 }));

    const service = new ChatService();
    await expectAsync(
      service.sendMessage({ spec: createDefaultSpec(), history: [], userText: 'test' }),
    ).toBeRejectedWithError(ChatServiceError, /502/);
  });

  it('reports a timeout when the request aborts', async () => {
    spyOn(globalThis, 'fetch').and.rejectWith(new DOMException('Aborted', 'AbortError'));

    const service = new ChatService();
    await expectAsync(
      service.sendMessage({ spec: createDefaultSpec(), history: [], userText: 'test' }),
    ).toBeRejectedWithError(ChatServiceError, /60 s/);
  });

  it('persists UI settings loaded by the next request', () => {
    saveChatConfig({
      baseUrl: ' http://localhost:1234/v1 ',
      model: ' local-model ',
      timeoutMs: 1500,
    });

    const config = loadChatConfig();
    expect(config.baseUrl).toBe('http://localhost:1234/v1');
    expect(config.model).toBe('local-model');
    expect(config.timeoutMs).toBe(1500);
  });
});
