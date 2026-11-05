import { Injectable, signal } from '@angular/core';

import type { EnclosureSpec } from '../model/enclosure.types';
import { validateEnclosureSpec } from './patches';
import { cloneSpec, createDefaultSpec } from './spec-defaults';

const STORAGE_KEY = 'velxio.chat.spec';

function loadPersistedSpec(): EnclosureSpec | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as EnclosureSpec;
    return validateEnclosureSpec(parsed).ok ? cloneSpec(parsed) : null;
  } catch {
    return null;
  }
}

function persistSpec(spec: EnclosureSpec): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(spec));
  } catch {
    // Stockage indisponible : l'état reste valable pour la session.
  }
}

/**
 * État partagé de la spécification pilotée par le chat. La coquille le consomme
 * via `enclosureSpecToParams` (agent B) pour mettre à jour le moteur JSCAD.
 */
@Injectable({ providedIn: 'root' })
export class ChatStateService {
  private readonly persisted = loadPersistedSpec();
  private readonly current = signal<EnclosureSpec>(
    this.persisted ? cloneSpec(this.persisted) : createDefaultSpec(),
  );

  readonly spec = this.current.asReadonly();
  readonly restoredFromStorage = this.persisted !== null;

  /** Accepte une spec complète uniquement si elle est valide ; renvoie false sinon. */
  setSpec(next: EnclosureSpec): boolean {
    const candidate = cloneSpec(next);
    if (!validateEnclosureSpec(candidate).ok) {
      return false;
    }
    this.current.set(candidate);
    persistSpec(candidate);
    return true;
  }

  reset(): void {
    const spec = createDefaultSpec();
    this.current.set(spec);
    persistSpec(spec);
  }
}
