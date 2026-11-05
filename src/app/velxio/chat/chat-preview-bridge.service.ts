import { Injectable, effect, inject, untracked } from '@angular/core';

import { EnclosureStateService } from '../../core/state/enclosure-state.service';
import type { EnclosureSpec } from '../model/enclosure.types';
import { ChatStateService } from './chat-state.service';
import { applySpecToParams, paramsToEnclosureSpec, type ApplySpecOptions } from './spec-bridge';

/**
 * Synchronise l'EnclosureSpec du chat et les Params du moteur JSCAD dans les
 * deux sens. Les modifications de la sidebar remontent dans la spec ; les
 * patches du chat (ou un import Velxio) descendent vers le renderer.
 */
@Injectable({ providedIn: 'root' })
export class ChatPreviewBridgeService {
  private readonly chatState = inject(ChatStateService);
  private readonly enclosureState = inject(EnclosureStateService);

  readonly spec = this.chatState.spec;

  private applyingSpec = false;

  constructor() {
    if (this.chatState.restoredFromStorage) {
      this.applyingSpec = true;
      this.enclosureState.setParams(
        applySpecToParams(this.spec(), this.enclosureState.params(), this.spec(), {
          replaceHoles: true,
          replaceMounts: true,
        }),
      );
    } else {
      this.chatState.setSpec(paramsToEnclosureSpec(this.enclosureState.params(), this.spec()));
    }

    effect(() => {
      const params = this.enclosureState.params();
      if (this.applyingSpec) {
        this.applyingSpec = false;
        return;
      }
      untracked(() => {
        queueMicrotask(() => {
          this.chatState.setSpec(paramsToEnclosureSpec(params, this.chatState.spec()));
        });
      });
    });
  }

  /** Applique une spec validée au chat et au moteur, puis met à jour l'aperçu. */
  applySpec(spec: EnclosureSpec, options: ApplySpecOptions = {}): boolean {
    const previous = this.chatState.spec();
    if (!this.chatState.setSpec(spec)) {
      return false;
    }
    this.applyingSpec = true;
    this.enclosureState.setParams(
      applySpecToParams(spec, this.enclosureState.params(), previous, options),
    );
    return true;
  }
}
