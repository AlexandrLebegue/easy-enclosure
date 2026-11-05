import { createExampleVelxioZip, EXAMPLE_COMPONENT_SPECS } from '../import/example-project';
import { createStaticPartResolver } from '../import/part-resolver';
import { importVelxioZip } from '../import/velxio-import';
import { DEFAULT_ENCLOSURE_RULES, findCollisions, layoutParts } from './layout-engine';

describe('layout engine', () => {
  const resolver = createStaticPartResolver(EXAMPLE_COMPONENT_SPECS);

  const importExample = async () => {
    const zip = await createExampleVelxioZip();
    return importVelxioZip(zip, {
      fileName: 'example.zip',
      importedAt: '2026-11-05T10:00:00Z',
      resolver,
    });
  };

  it('lays out flat parts in a single wide layer without collisions', async () => {
    const board = await importExample();
    const result = layoutParts(board.parts, {
      mode: 'flat',
      rules: DEFAULT_ENCLOSURE_RULES,
    });

    expect(result.warnings).toEqual([]);
    expect(result.parts.every((part) => part.placedMm !== undefined)).toBeTrue();
    expect(findCollisions(result.parts, DEFAULT_ENCLOSURE_RULES.clearanceMm)).toEqual([]);

    // widths 30+25+40+5+20 = 120, 4 gaps of 2 mm, 2 * 0.3 mm clearance, 2 * 2 mm walls
    expect(result.outer.widthMm).toBeCloseTo(132.6, 5);
    expect(result.outer.depthMm).toBeCloseTo(24.6, 5);
    // floor 2 + support 5 + tallest part 15 + headroom 3 + lid 2
    expect(result.outer.heightMm).toBeCloseTo(27, 5);
  });

  it('stacks parts on levels with supports and no collision', async () => {
    const board = await importExample();
    const result = layoutParts(board.parts, {
      mode: 'stacked',
      rules: DEFAULT_ENCLOSURE_RULES,
    });

    expect(findCollisions(result.parts, DEFAULT_ENCLOSURE_RULES.clearanceMm)).toEqual([]);
    const heights = result.parts
      .map((part) => part.placedMm?.z)
      .filter((z): z is number => z !== undefined);
    expect(heights.length).toBe(5);
    expect(new Set(heights).size).toBe(5);

    expect(result.outer.widthMm).toBeCloseTo(44.6, 5);
    expect(result.outer.depthMm).toBeCloseTo(24.6, 5);
    // floor 2 + support 5 + part heights 42 + 4 gaps of 5 + headroom 3 + lid 2
    expect(result.outer.heightMm).toBeCloseTo(74, 5);
  });

  it('ignores parts without a spec instead of inventing dimensions', async () => {
    const zip = await createExampleVelxioZip({ includeUnknownPart: true });
    const board = await importVelxioZip(zip, {
      fileName: 'unknown.zip',
      importedAt: '2026-11-05T10:00:00Z',
      resolver,
    });
    const result = layoutParts(board.parts, {
      mode: 'flat',
      rules: DEFAULT_ENCLOSURE_RULES,
    });

    const unknown = result.parts.find((part) => part.id === 'unknown1');
    expect(unknown?.spec).toBeNull();
    expect(unknown?.placedMm).toBeUndefined();
    expect(result.warnings.some((warning) => warning.code === 'PART_IGNORED')).toBeTrue();
  });

  it('detects overlapping bounding boxes', () => {
    const spec = EXAMPLE_COMPONENT_SPECS[0];
    const overlapping = [
      {
        id: 'a',
        partType: spec.partType,
        spec,
        canvas: { x: 0, y: 0, rotate: 0 },
        placedMm: { x: 0, y: 0, z: 2, rotate: 0 },
      },
      {
        id: 'b',
        partType: spec.partType,
        spec,
        canvas: { x: 0, y: 0, rotate: 0 },
        placedMm: { x: 1, y: 1, z: 2, rotate: 0 },
      },
    ];

    expect(findCollisions(overlapping, 0.3).length).toBe(1);
  });
});
