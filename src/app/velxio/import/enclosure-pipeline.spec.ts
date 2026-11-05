import measureBoundingBox from '@jscad/modeling/src/measurements/measureBoundingBox';
import type { Geom3 } from '@jscad/modeling/src/geometries/types';

import { buildEnclosureSpec } from '../layout/enclosure-spec-builder';
import { createExampleVelxioZip, EXAMPLE_COMPONENT_SPECS } from './example-project';
import { buildEnclosureGeometry, generateEnclosureStlBlob } from './enclosure-mesh';
import { createStaticPartResolver } from './part-resolver';
import { importVelxioZip } from './velxio-import';

const spans = (geometry: Geom3): [number, number, number] => {
  const bounds = measureBoundingBox(geometry) as [
    [number, number, number],
    [number, number, number],
  ];
  return [bounds[1][0] - bounds[0][0], bounds[1][1] - bounds[0][1], bounds[1][2] - bounds[0][2]];
};

describe('enclosure pipeline', () => {
  const resolver = createStaticPartResolver(EXAMPLE_COMPONENT_SPECS);

  const importExample = async (includeUnknownPart = false) => {
    const zip = await createExampleVelxioZip({ includeUnknownPart });
    return importVelxioZip(zip, {
      fileName: 'example.zip',
      importedAt: '2026-11-05T10:00:00Z',
      resolver,
    });
  };

  it('builds a complete flat EnclosureSpec with default rules', async () => {
    const board = await importExample();
    const { spec, warnings } = buildEnclosureSpec(board, {
      mode: 'flat',
      generatedAt: '2026-11-05T10:00:00Z',
    });

    expect(warnings).toEqual([]);
    expect(spec.mode).toBe('flat');
    expect(spec.rules).toEqual({
      wallMm: 2,
      clearanceMm: 0.3,
      headroomMm: 3,
      cornerRadiusMm: 3,
      printClearanceMm: 0.2,
      floorMm: 2,
      lidMm: 2,
    });
    expect(spec.outer.widthMm).toBeCloseTo(132.6, 5);
    expect(spec.outer.depthMm).toBeCloseTo(24.6, 5);
    expect(spec.outer.heightMm).toBeCloseTo(27, 5);
    expect(spec.cutouts.length).toBe(2);
    expect(spec.standoffs.length).toBe(11);
    expect(spec.metadata.projectName).toBe('example');
    expect(spec.parts.every((part) => part.placedMm !== undefined)).toBeTrue();
  });

  it('generates a real base mesh matching the expected outer dimensions', async () => {
    const board = await importExample();
    const { spec } = buildEnclosureSpec(board, {
      mode: 'flat',
      generatedAt: '2026-11-05T10:00:00Z',
    });
    const geometry = buildEnclosureGeometry(spec);
    const [width, depth, height] = spans(geometry.base);

    expect(width).toBeCloseTo(spec.outer.widthMm, 3);
    expect(depth).toBeCloseTo(spec.outer.depthMm, 3);
    expect(height).toBeCloseTo(spec.outer.heightMm, 3);
  });

  it('exports a non-empty STL from the example zip end to end', async () => {
    const board = await importExample();
    const { spec } = buildEnclosureSpec(board, {
      mode: 'flat',
      generatedAt: '2026-11-05T10:00:00Z',
    });
    const blob = generateEnclosureStlBlob(spec);

    expect(blob.type).toBe('model/stl');
    expect(blob.size).toBeGreaterThan(1000);
  });

  it('builds a stacked spec whose mesh is tall enough for every level', async () => {
    const board = await importExample();
    const { spec } = buildEnclosureSpec(board, {
      mode: 'stacked',
      generatedAt: '2026-11-05T10:00:00Z',
    });
    const geometry = buildEnclosureGeometry(spec);
    const [width, depth, height] = spans(geometry.base);

    expect(spec.outer.heightMm).toBeCloseTo(74, 5);
    expect(width).toBeCloseTo(44.6, 3);
    expect(depth).toBeCloseTo(24.6, 3);
    expect(height).toBeCloseTo(74, 3);
    expect(blobSize(spec)).toBeGreaterThan(1000);
  });

  it('keeps unknown parts visible in the spec but out of the physical layout', async () => {
    const board = await importExample(true);
    const { spec } = buildEnclosureSpec(board, {
      mode: 'flat',
      generatedAt: '2026-11-05T10:00:00Z',
    });

    expect(spec.parts.length).toBe(6);
    const unknown = spec.parts.find((part) => part.id === 'unknown1');
    expect(unknown?.spec).toBeNull();
    expect(unknown?.placedMm).toBeUndefined();
    expect(spec.cutouts.length).toBe(2);
    expect(spec.standoffs.length).toBe(11);
  });
});

const blobSize = (spec: Parameters<typeof generateEnclosureStlBlob>[0]): number =>
  generateEnclosureStlBlob(spec).size;
