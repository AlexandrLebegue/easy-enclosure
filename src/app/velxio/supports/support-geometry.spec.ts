import measureBoundingBox from '@jscad/modeling/src/measurements/measureBoundingBox';

import { DEFAULT_ENCLOSURE_RULES } from '../layout/layout-engine';
import type { ComponentSpec } from '../model/component.types';
import type { EnclosureSpec, PlacedPart, SupportType } from '../model/enclosure.types';
import { buildSupportGeometry } from './support-geometry';

const makeSpec = (category: ComponentSpec['category']): ComponentSpec => ({
  partType: `test-${category}`,
  displayName: `Test ${category}`,
  category,
  envelope: { widthMm: 12, depthMm: 8, heightMm: 6 },
  mountHoles: [],
  cutouts: [],
  keepouts: [],
  provenance: { license: 'CERN-OHL-P-2.0', retrievedAt: '2026-11-05T00:00:00Z' },
  confidence: 'datasheet',
  schemaVersion: 1,
});

const makeEnclosure = (type: SupportType, category: ComponentSpec['category']): EnclosureSpec => {
  const part: PlacedPart = {
    id: 'part1',
    partType: `test-${category}`,
    spec: makeSpec(category),
    canvas: { x: 0, y: 0, rotate: 0 },
    placedMm: { x: 40, y: 25, z: 7, rotate: 0 },
  };

  return {
    schemaVersion: 1,
    mode: 'flat',
    rules: DEFAULT_ENCLOSURE_RULES,
    lid: { type: 'snap' },
    outer: { widthMm: 100, depthMm: 60, heightMm: 30 },
    parts: [part],
    standoffs: [
      {
        partId: 'part1',
        type,
        xMm: 50,
        yMm: 30,
        heightMm: 5,
        screwMm: type === 'standoff-screw' ? 3 : undefined,
      },
    ],
    cutouts: [],
    metadata: {
      projectName: 'test',
      generatedBy: 'agent-b/enclosure',
      generatedAt: '2026-11-05T00:00:00Z',
    },
  };
};

describe('support geometry', () => {
  const cases: Array<[SupportType, ComponentSpec['category']]> = [
    ['standoff-screw', 'board'],
    ['cradle', 'display'],
    ['clip', 'sensor'],
    ['pocket', 'passive'],
  ];

  for (const [type, category] of cases) {
    it(`builds printable ${type} geometry`, () => {
      const geometry = buildSupportGeometry(makeEnclosure(type, category));
      expect(geometry).not.toBeNull();

      const bounds = measureBoundingBox(geometry!) as [
        [number, number, number],
        [number, number, number],
      ];
      expect(bounds[0][2]).toBeCloseTo(DEFAULT_ENCLOSURE_RULES.floorMm, 2);
      expect(bounds[1][2]).toBeCloseTo(DEFAULT_ENCLOSURE_RULES.floorMm + 5, 2);
      expect(bounds[1][0] - bounds[0][0]).toBeGreaterThan(0);
      expect(bounds[1][1] - bounds[0][1]).toBeGreaterThan(0);
    });
  }

  it('returns null without standoffs', () => {
    const spec = makeEnclosure('none', 'other');
    spec.standoffs = [];
    expect(buildSupportGeometry(spec)).toBeNull();
  });
});
