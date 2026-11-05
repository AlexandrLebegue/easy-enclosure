import { parseChatResponse } from './service';

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
