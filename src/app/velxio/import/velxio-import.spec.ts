import { createExampleVelxioZip, EXAMPLE_COMPONENT_SPECS } from './example-project';
import { createDefaultPartResolver, createStaticPartResolver } from './part-resolver';
import { importVelxioZip, parseDiagramJson } from './velxio-import';

describe('velxio import', () => {
  const resolver = createStaticPartResolver(EXAMPLE_COMPONENT_SPECS);

  it('imports a zip with 2 boards + 3 components and resolves every spec', async () => {
    const zip = await createExampleVelxioZip();
    const model = await importVelxioZip(zip, {
      fileName: 'example.zip',
      importedAt: '2026-11-05T10:00:00Z',
      resolver,
    });

    expect(model.parts.length).toBe(5);
    expect(model.complete).toBeTrue();
    expect(model.source.fileName).toBe('example.zip');
    expect(model.connections.length).toBe(4);
    expect(model.parts.every((part) => part.spec !== null)).toBeTrue();
    expect(model.parts.find((part) => part.id === 'board1')?.canvas).toEqual({
      x: 0,
      y: 0,
      rotate: 0,
    });
    expect(model.warnings.some((warning) => warning.code === 'CANVAS_SCALE_IGNORED')).toBeTrue();
    expect(model.warnings.some((warning) => warning.code === 'MISSING_SKETCH')).toBeFalse();
  });

  it('flags an unknown part type without inventing dimensions', async () => {
    const zip = await createExampleVelxioZip({ includeUnknownPart: true });
    const model = await importVelxioZip(zip, {
      fileName: 'unknown.zip',
      importedAt: '2026-11-05T10:00:00Z',
      resolver,
    });

    expect(model.parts.length).toBe(6);
    expect(model.complete).toBeFalse();
    const unknown = model.parts.find((part) => part.id === 'unknown1');
    expect(unknown?.spec).toBeNull();
    const warning = model.warnings.find((entry) => entry.code === 'UNKNOWN_PART_TYPE');
    expect(warning?.partId).toBe('unknown1');
  });

  it('rejects malformed diagram JSON', () => {
    expect(() => parseDiagramJson('{not json')).toThrowError('INVALID_DIAGRAM_JSON');
    expect(() => parseDiagramJson('{"parts": "nope"}')).toThrowError('INVALID_DIAGRAM_STRUCTURE');
  });

  it('falls back to the local index when the HTTP API is unavailable', async () => {
    const index = {
      generatedAt: '2026-11-05T00:00:00Z',
      count: 1,
      byPartType: {
        'wokwi-led': {
          file: 'passive/wokwi-led.json',
          category: 'passive',
          confidence: 'datasheet',
        },
      },
    };
    const specs = new Map(EXAMPLE_COMPONENT_SPECS.map((spec) => [spec.partType, spec]));
    const fetchImpl = (async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.includes('/api/parts/resolve')) {
        throw new Error('connection refused');
      }
      if (url.endsWith('data/components.index.json')) {
        return new Response(JSON.stringify(index), { status: 200 });
      }
      if (url.endsWith('passive/wokwi-led.json')) {
        const spec = specs.get('wokwi-led');
        return new Response(JSON.stringify(spec), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as typeof fetch;

    const fallbackResolver = createDefaultPartResolver({
      fetchImpl,
      timeoutMs: 50,
    });
    const result = await fallbackResolver(['wokwi-led', 'missing-part']);

    expect(result.source).toBe('index');
    expect(result.resolved.map((spec) => spec.partType)).toEqual(['wokwi-led']);
    expect(result.missing).toEqual(['missing-part']);
  });
});
