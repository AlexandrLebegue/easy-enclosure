import { ChatStateService } from './chat-state.service';
import { validateEnclosureSpec } from './patches';
import { createDefaultSpec } from './spec-defaults';

describe('ChatStateService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts from a valid default spec', () => {
    const state = new ChatStateService();

    expect(state.spec().mode).toBe('flat');
    expect(validateEnclosureSpec(state.spec()).ok).toBeTrue();
  });

  it('persists a valid spec and reloads it in a new instance', () => {
    const state = new ChatStateService();
    const next = createDefaultSpec();
    next.rules.wallMm = 3.2;
    next.mode = 'stacked';

    expect(state.setSpec(next)).toBeTrue();

    const reloaded = new ChatStateService();
    expect(reloaded.spec().rules.wallMm).toBe(3.2);
    expect(reloaded.spec().mode).toBe('stacked');
  });

  it('rejects an invalid spec and keeps the previous one', () => {
    const state = new ChatStateService();
    const invalid = createDefaultSpec();
    invalid.rules.wallMm = 20;

    expect(state.setSpec(invalid)).toBeFalse();
    expect(state.spec().rules.wallMm).toBe(2);
  });

  it('reports whether the spec was restored from storage', () => {
    expect(new ChatStateService().restoredFromStorage).toBeFalse();

    localStorage.setItem('velxio.chat.spec', JSON.stringify(createDefaultSpec()));
    expect(new ChatStateService().restoredFromStorage).toBeTrue();
  });

  it('resets to defaults and persists them', () => {
    const state = new ChatStateService();
    const modified = createDefaultSpec();
    modified.mode = 'stacked';
    state.setSpec(modified);

    state.reset();

    expect(state.spec().mode).toBe('flat');
    expect(new ChatStateService().spec().mode).toBe('flat');
  });
});
