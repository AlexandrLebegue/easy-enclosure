import type { ComponentSpec } from '../model/component.types';
import type { BoardEnclosureRules, PlacedPart } from '../model/enclosure.types';
import { generateCutouts } from './cutout-generator';

const rules: BoardEnclosureRules = {
  wallMm: 2,
  clearanceMm: 0.3,
  headroomMm: 3,
  cornerRadiusMm: 3,
  printClearanceMm: 0.2,
  floorMm: 2,
  lidMm: 2,
};

const spec: ComponentSpec = {
  partType: 'test-part',
  displayName: 'Test part',
  category: 'module',
  envelope: { widthMm: 20, depthMm: 10, heightMm: 6 },
  mountHoles: [],
  cutouts: [
    {
      id: 'connector',
      side: 'front',
      offsetMm: 2,
      widthMm: 6,
      heightMm: 4,
      label: 'Connector',
    },
  ],
  keepouts: [
    {
      side: 'right',
      offsetMm: 1,
      widthMm: 3,
      heightMm: 2,
      reason: 'Antenna keepout',
    },
  ],
  provenance: {
    license: 'CERN-OHL-P-2.0',
    retrievedAt: '2026-11-05T00:00:00Z',
  },
  confidence: 'datasheet',
  schemaVersion: 1,
};

const part: PlacedPart = {
  id: 'part1',
  partType: 'test-part',
  spec,
  canvas: { x: 0, y: 0, rotate: 0 },
  placedMm: { x: 5, y: 5, z: 2, rotate: 0 },
};

describe('cutout generator', () => {
  it('projects cutouts and wall-side keepouts with print clearance', () => {
    const cutouts = generateCutouts([part], {
      rules,
      outer: { widthMm: 60, depthMm: 40, heightMm: 20 },
    });

    expect(cutouts.length).toBe(2);

    const connector = cutouts.find((cutout) => cutout.id === 'part1:connector');
    expect(connector?.side).toBe('front');
    expect(connector?.widthMm).toBeCloseTo(6.4, 5);
    expect(connector?.heightMm).toBeCloseTo(4.4, 5);
    expect(connector?.offsetMm).toBeCloseTo(6.8, 5);
    expect(connector?.clearanceMm).toBe(0.2);

    const keepout = cutouts.find((cutout) => cutout.id === 'part1:keepout-1');
    expect(keepout?.side).toBe('right');
    expect(keepout?.label).toBe('Antenna keepout');
    expect(keepout?.widthMm).toBeCloseTo(3.4, 5);
    expect(keepout?.offsetMm).toBeCloseTo(5.8, 5);
  });

  it('rotates cutout sides with the placed part', () => {
    const rotated: PlacedPart = {
      ...part,
      placedMm: { x: 5, y: 5, z: 2, rotate: 90 },
    };
    const cutouts = generateCutouts([rotated], {
      rules,
      outer: { widthMm: 60, depthMm: 40, heightMm: 20 },
    });

    const connector = cutouts.find((cutout) => cutout.id === 'part1:connector');
    expect(connector?.side).toBe('right');
  });
});
