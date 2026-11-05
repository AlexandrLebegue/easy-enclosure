import type { ComponentIndex, ComponentSpec } from '../model/component.types';

export type PartResolutionSource = 'http' | 'index' | 'none';

export interface PartResolveResult {
  resolved: ComponentSpec[];
  missing: string[];
  source: PartResolutionSource;
}

export type PartResolver = (partTypes: string[]) => Promise<PartResolveResult>;

export interface PartResolverOptions {
  /** Optional local dimension API (agent A). Tried first when reachable. */
  resolveUrl?: string;
  /** Local generated index fallback. */
  indexUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_RESOLVE_URL = 'http://127.0.0.1:4100/api/parts/resolve';
const DEFAULT_INDEX_URL = 'data/components.index.json';
const DEFAULT_TIMEOUT_MS = 1500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isResolveResponse = (
  value: unknown,
): value is { resolved: ComponentSpec[]; missing: string[] } =>
  isRecord(value) &&
  Array.isArray(value['resolved']) &&
  Array.isArray(value['missing']) &&
  value['resolved'].every((entry) => isRecord(entry) && typeof entry['partType'] === 'string') &&
  value['missing'].every((entry) => typeof entry === 'string');

const isComponentIndex = (value: unknown): value is ComponentIndex =>
  isRecord(value) && isRecord(value['byPartType']);

const indexPathCandidates = (file: string): string[] => {
  const candidates = [file, `data/${file}`, `data/components/${file}`];
  return candidates.filter((candidate, index) => candidates.indexOf(candidate) === index);
};

const fetchJson = async (
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown | null> => {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      ...init,
      signal: controller?.signal,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const tryHttpResolver = async (
  partTypes: string[],
  fetchImpl: typeof fetch,
  resolveUrl: string,
  timeoutMs: number,
): Promise<PartResolveResult | null> => {
  const body = await fetchJson(
    fetchImpl,
    resolveUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ partTypes }),
    },
    timeoutMs,
  );
  if (!isResolveResponse(body)) {
    return null;
  }
  return {
    resolved: body.resolved,
    missing: body.missing,
    source: 'http',
  };
};

const tryIndexResolver = async (
  partTypes: string[],
  fetchImpl: typeof fetch,
  indexUrl: string,
  timeoutMs: number,
): Promise<PartResolveResult | null> => {
  const index = await fetchJson(fetchImpl, indexUrl, { method: 'GET' }, timeoutMs);
  if (!isComponentIndex(index)) {
    return null;
  }

  const resolved: ComponentSpec[] = [];
  const missing: string[] = [];

  for (const partType of partTypes) {
    const entry = index.byPartType[partType];
    if (!entry) {
      missing.push(partType);
      continue;
    }

    const candidates = [
      ...indexPathCandidates(entry.file),
      `data/components/${entry.category}/${partType}.json`,
    ].filter((candidate, position, list) => list.indexOf(candidate) === position);

    let spec: ComponentSpec | null = null;
    for (const candidate of candidates) {
      const fileBody = await fetchJson(fetchImpl, candidate, { method: 'GET' }, timeoutMs);
      if (isRecord(fileBody) && fileBody['partType'] === partType) {
        spec = fileBody as unknown as ComponentSpec;
        break;
      }
    }

    if (spec) {
      resolved.push(spec);
    } else {
      missing.push(partType);
    }
  }

  return { resolved, missing, source: 'index' };
};

const mergeResults = (
  partTypes: string[],
  primary: PartResolveResult | null,
  secondary: PartResolveResult | null,
): PartResolveResult => {
  const byPartType = new Map<string, ComponentSpec>();
  for (const result of [primary, secondary]) {
    for (const spec of result?.resolved ?? []) {
      byPartType.set(spec.partType, spec);
    }
  }

  const resolved: ComponentSpec[] = [];
  const missing: string[] = [];
  for (const partType of partTypes) {
    const spec = byPartType.get(partType);
    if (spec) {
      resolved.push(spec);
    } else {
      missing.push(partType);
    }
  }

  const source: PartResolutionSource =
    primary?.source === 'http' || secondary?.source === 'http'
      ? 'http'
      : primary?.source === 'index' || secondary?.source === 'index'
        ? 'index'
        : 'none';

  return { resolved, missing, source };
};

/**
 * Resolve Velxio part types against the component database.
 *
 * The local HTTP API is preferred when it responds. The generated local index
 * (`data/components.index.json`) is used as a fallback, and can also fill any
 * types the API did not know about. Missing types are reported, never guessed.
 */
export const createDefaultPartResolver = (options: PartResolverOptions = {}): PartResolver => {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const resolveUrl = options.resolveUrl ?? DEFAULT_RESOLVE_URL;
  const indexUrl = options.indexUrl ?? DEFAULT_INDEX_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return async (partTypes: string[]): Promise<PartResolveResult> => {
    const uniqueTypes = partTypes.filter(
      (partType, index) => partTypes.indexOf(partType) === index,
    );
    if (uniqueTypes.length === 0) {
      return { resolved: [], missing: [], source: 'none' };
    }

    if (typeof fetchImpl !== 'function') {
      return { resolved: [], missing: uniqueTypes, source: 'none' };
    }

    const httpResult = await tryHttpResolver(uniqueTypes, fetchImpl, resolveUrl, timeoutMs);
    const httpMissing = httpResult
      ? uniqueTypes.filter(
          (partType) => !httpResult.resolved.some((spec) => spec.partType === partType),
        )
      : uniqueTypes;

    if (httpResult && httpMissing.length === 0) {
      return httpResult;
    }

    const indexResult =
      httpMissing.length > 0
        ? await tryIndexResolver(httpMissing, fetchImpl, indexUrl, timeoutMs)
        : null;

    return mergeResults(uniqueTypes, httpResult, indexResult);
  };
};

/** Deterministic resolver backed by an in-memory list (tests, presets). */
export const createStaticPartResolver = (specs: readonly ComponentSpec[]): PartResolver => {
  const byPartType = new Map(specs.map((spec) => [spec.partType, spec]));
  return async (partTypes: string[]): Promise<PartResolveResult> => {
    const resolved: ComponentSpec[] = [];
    const missing: string[] = [];
    for (const partType of partTypes) {
      const spec = byPartType.get(partType);
      if (spec) {
        resolved.push(spec);
      } else {
        missing.push(partType);
      }
    }
    return { resolved, missing, source: 'index' };
  };
};

/** Resolver backed by a plain `partType -> ComponentSpec` lookup. */
export const createLookupPartResolver =
  (lookup: Readonly<Record<string, ComponentSpec>>): PartResolver =>
  async (partTypes: string[]): Promise<PartResolveResult> => {
    const resolved: ComponentSpec[] = [];
    const missing: string[] = [];
    for (const partType of partTypes) {
      const spec = lookup[partType];
      if (spec) {
        resolved.push(spec);
      } else {
        missing.push(partType);
      }
    }
    return { resolved, missing, source: 'index' };
  };
