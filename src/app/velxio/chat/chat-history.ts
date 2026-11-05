import type { ChatTurn } from '../model/enclosure.types';
import type { ChatEntry, ChatRole } from './chat-panel.component';

const STORAGE_KEY = 'velxio.chat.history';
const ROLES: readonly ChatRole[] = ['user', 'assistant', 'system'];

export interface StoredChatHistory {
  entries: ChatEntry[];
  turns: ChatTurn[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEntry(value: unknown): value is ChatEntry {
  return (
    isRecord(value) &&
    typeof value['id'] === 'number' &&
    typeof value['text'] === 'string' &&
    ROLES.includes(value['role'] as ChatRole)
  );
}

function isTurn(value: unknown): value is ChatTurn {
  return (
    isRecord(value) && typeof value['userText'] === 'string' && Array.isArray(value['patches'])
  );
}

export function loadChatHistory(): StoredChatHistory | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed['entries']) || !Array.isArray(parsed['turns'])) {
      return null;
    }
    const entries = parsed['entries'].filter(isEntry);
    const turns = parsed['turns'].filter(isTurn);
    if (entries.length === 0 && turns.length === 0) {
      return null;
    }
    return { entries, turns };
  } catch {
    return null;
  }
}

export function saveChatHistory(entries: ChatEntry[], turns: ChatTurn[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, turns }));
  } catch {
    // Stockage indisponible : l'historique reste en mémoire.
  }
}

export function clearChatHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à faire si le stockage est indisponible.
  }
}
