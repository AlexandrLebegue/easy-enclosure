import { Injectable } from '@angular/core';

import type { ChatPatch, ChatTurn, EnclosureSpec } from '../model/enclosure.types';
import { buildSystemPrompt, buildUserPrompt } from './prompt';

/** Configuration d'un endpoint OpenAI-compatible (llama.cpp, vLLM, opencode-go...). */
export interface ChatConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs: number;
}

export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  baseUrl: 'http://192.168.1.59:18020/v1',
  model: 'qwen3.8-27b',
  apiKey: '',
  timeoutMs: 60_000,
};

const STORAGE_KEY = 'velxio.chat.config';

interface InjectedConfig {
  __VELXIO_CHAT_CONFIG__?: Partial<ChatConfig>;
}

function sanitizeConfig(candidate: Partial<ChatConfig> | undefined): Partial<ChatConfig> {
  if (!candidate) {
    return {};
  }
  const cleaned: Partial<ChatConfig> = {};
  if (typeof candidate.baseUrl === 'string' && candidate.baseUrl.trim().length > 0) {
    cleaned.baseUrl = candidate.baseUrl.trim();
  }
  if (typeof candidate.model === 'string' && candidate.model.trim().length > 0) {
    cleaned.model = candidate.model.trim();
  }
  if (typeof candidate.apiKey === 'string') {
    cleaned.apiKey = candidate.apiKey.trim();
  }
  if (
    typeof candidate.timeoutMs === 'number' &&
    Number.isFinite(candidate.timeoutMs) &&
    candidate.timeoutMs > 0
  ) {
    cleaned.timeoutMs = candidate.timeoutMs;
  }
  return cleaned;
}

/**
 * Lit la configuration depuis, par priorité croissante :
 * valeurs par défaut, global injecté au runtime, réglages UI persistés.
 */
export function loadChatConfig(): ChatConfig {
  let stored: Partial<ChatConfig> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      stored = JSON.parse(raw) as Partial<ChatConfig>;
    }
  } catch {
    stored = {};
  }
  const injected = (globalThis as InjectedConfig).__VELXIO_CHAT_CONFIG__;
  return {
    ...DEFAULT_CHAT_CONFIG,
    ...sanitizeConfig(injected),
    ...sanitizeConfig(stored),
  };
}

export function saveChatConfig(patch: Partial<ChatConfig>): ChatConfig {
  const next: ChatConfig = {
    ...loadChatConfig(),
    ...sanitizeConfig(patch),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible : la configuration reste valable pour la session.
  }
  return next;
}

export interface ChatRequest {
  spec: EnclosureSpec;
  history: ChatTurn[];
  userText: string;
}

export interface ParsedChatResponse {
  patches: ChatPatch[];
  message?: string;
}

export class ChatServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChatServiceError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asPatch(value: unknown): ChatPatch | null {
  if (!isRecord(value) || typeof value['op'] !== 'string') {
    return null;
  }
  return value as unknown as ChatPatch;
}

function extractJsonCandidate(text: string): string | null {
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (withoutFence !== text && withoutFence.trim().length > 0) {
    return withoutFence.trim();
  }
  const objectStart = text.indexOf('{');
  const objectEnd = text.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return text.slice(objectStart, objectEnd + 1);
  }
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return text.slice(arrayStart, arrayEnd + 1);
  }
  return null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Extrait les patches d'une réponse modèle. Une réponse non-JSON n'est pas une
 * erreur fatale : elle est traitée comme un message texte à afficher.
 */
export function parseChatResponse(content: string): ParsedChatResponse {
  const trimmed = (content ?? '').trim();
  if (trimmed.length === 0) {
    return { patches: [], message: 'Le modèle a renvoyé une réponse vide.' };
  }

  let parsed = parseJson(trimmed);
  if (parsed === undefined) {
    const candidate = extractJsonCandidate(trimmed);
    if (candidate) {
      parsed = parseJson(candidate);
    }
  }

  if (parsed === undefined) {
    return { patches: [], message: trimmed };
  }

  if (Array.isArray(parsed)) {
    return { patches: parsed.map(asPatch).filter((patch): patch is ChatPatch => patch !== null) };
  }

  if (isRecord(parsed)) {
    const rawPatches = parsed['patches'];
    const patches = Array.isArray(rawPatches)
      ? rawPatches.map(asPatch).filter((patch): patch is ChatPatch => patch !== null)
      : typeof parsed['op'] === 'string'
        ? [parsed as unknown as ChatPatch]
        : [];
    const message = typeof parsed['message'] === 'string' ? parsed['message'] : undefined;
    return { patches, message };
  }

  return { patches: [], message: trimmed };
}

function extractMessageContent(payload: unknown): string {
  if (typeof payload === 'string') {
    return payload;
  }
  if (!isRecord(payload)) {
    return '';
  }
  const choices = payload['choices'];
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    if (isRecord(first)) {
      const message = first['message'];
      if (isRecord(message) && typeof message['content'] === 'string') {
        return message['content'];
      }
      if (typeof first['text'] === 'string') {
        return first['text'];
      }
    }
  }
  if (typeof payload['content'] === 'string') {
    return payload['content'];
  }
  return '';
}

function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  getConfig(): ChatConfig {
    return loadChatConfig();
  }

  saveConfig(patch: Partial<ChatConfig>): ChatConfig {
    return saveChatConfig(patch);
  }

  /** Envoie un tour de conversation et renvoie les patches proposés. */
  async sendMessage(request: ChatRequest): Promise<ChatTurn> {
    const config = this.getConfig();
    const timeoutMs = config.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const messages = [
      { role: 'system', content: buildSystemPrompt(request.spec) },
      ...request.history.flatMap((turn) => [
        { role: 'user', content: turn.userText },
        {
          role: 'assistant',
          content: JSON.stringify({ message: turn.message ?? '', patches: turn.patches }),
        },
      ]),
      { role: 'user', content: buildUserPrompt(request.userText) },
    ];

    try {
      const response = await fetch(`${trimBaseUrl(config.baseUrl)}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          messages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ChatServiceError(
          `Le modèle a répondu ${response.status}${body ? ` : ${truncate(body, 200)}` : ''}`,
        );
      }

      let payload: unknown;
      try {
        payload = (await response.json()) as unknown;
      } catch {
        throw new ChatServiceError('La réponse HTTP du modèle n’est pas un JSON valide.');
      }

      const parsed = parseChatResponse(extractMessageContent(payload));
      return {
        userText: request.userText,
        patches: parsed.patches,
        message: parsed.message,
      };
    } catch (error) {
      if (error instanceof ChatServiceError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ChatServiceError(
          `Le modèle n’a pas répondu dans les ${Math.round(timeoutMs / 1000)} s.`,
        );
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new ChatServiceError(
        `Impossible de joindre le modèle à ${trimBaseUrl(config.baseUrl)} : ${detail}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
