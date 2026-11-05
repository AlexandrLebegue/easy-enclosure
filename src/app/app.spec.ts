import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { EnclosureStateService } from './core/state/enclosure-state.service';
import { createDefaultSpec } from './velxio/chat/spec-defaults';
import type { EnclosureSpec } from './velxio/model/enclosure.types';

@Component({ selector: 'app-renderer', template: '' })
class MockRendererComponent {}

@Component({ selector: 'app-sidebar', template: '' })
class MockSidebarComponent {}

@Component({ selector: 'app-chat-panel', template: '' })
class MockChatPanelComponent {
  readonly specInput = input<EnclosureSpec | null>(null);
  readonly specChange = output<EnclosureSpec>();
}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .overrideComponent(App, {
        set: {
          imports: [MockRendererComponent, MockSidebarComponent, MockChatPanelComponent],
        },
      })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the shell feature components', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-renderer')).not.toBeNull();
    expect(host.querySelector('app-sidebar')).not.toBeNull();
    expect(host.querySelector('app-chat-panel')).not.toBeNull();
  });

  it('toggles the chat panel and stores a valid spec change', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    expect(app.chatOpen()).toBeTrue();
    app.toggleChat();
    fixture.detectChanges();
    expect(app.chatOpen()).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-chat-panel')).toBeNull();

    const next = { ...app.spec(), mode: 'stacked' as const };
    app.onSpecChange(next);
    expect(app.spec().mode).toBe('stacked');
  });

  it('applies chat spec changes to the CAD parameters', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const state = TestBed.inject(EnclosureStateService);

    const next = createDefaultSpec();
    next.rules.wallMm = 3.2;
    next.lid = { type: 'screw-nut' };
    next.cutouts = [{ id: 'usb', side: 'front', offsetMm: 10, widthMm: 12, heightMm: 6 }];
    app.onSpecChange(next);

    expect(state.params().wall).toBe(3.2);
    expect(state.params().lidScrews).toBeTrue();
    expect(state.params().lidScrewHoleType).toBe('nut-pocket');
    expect(state.params().holes.length).toBe(1);
  });

  it('restores a persisted chat spec into the CAD parameters', () => {
    const persisted = createDefaultSpec();
    persisted.rules.wallMm = 3.4;
    persisted.cutouts = [{ id: 'usb', side: 'front', offsetMm: 10, widthMm: 12, heightMm: 6 }];
    localStorage.setItem('velxio.chat.spec', JSON.stringify(persisted));

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const params = TestBed.inject(EnclosureStateService).params();
    expect(params.wall).toBe(3.4);
    expect(params.holes.length).toBe(1);
  });

  it('syncs sidebar parameter edits back into the chat spec', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const state = TestBed.inject(EnclosureStateService);

    state.updateParam('wall', 4);
    TestBed.flushEffects();
    await Promise.resolve();
    fixture.detectChanges();

    expect(app.spec().rules.wallMm).toBe(4);
  });
});
