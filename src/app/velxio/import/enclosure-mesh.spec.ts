import { DEFAULT_ENCLOSURE_RULES } from '../layout/layout-engine';
import type { EnclosureSpec, LidType } from '../model/enclosure.types';
import { enclosureSpecToParams } from './enclosure-mesh';

const makeSpec = (lidType: LidType): EnclosureSpec => ({
  schemaVersion: 1,
  mode: 'flat',
  rules: DEFAULT_ENCLOSURE_RULES,
  lid: { type: lidType },
  outer: { widthMm: 100, depthMm: 60, heightMm: 30 },
  parts: [],
  standoffs: [],
  cutouts: [],
  metadata: {
    projectName: 'test',
    generatedBy: 'agent-b/enclosure',
    generatedAt: '2026-11-05T00:00:00Z',
  },
});

describe('enclosure mesh parameter mapping', () => {
  it('maps the snap lid to the upstream snap-fit', () => {
    const params = enclosureSpecToParams(makeSpec('snap'));
    expect(params.lidScrews).toBeFalse();
    expect(params.snapFit.enabled).toBeTrue();
  });

  it('maps heat-set and nut lids to the corresponding screw mode', () => {
    const heatSet = enclosureSpecToParams(makeSpec('screw-heat-set'));
    expect(heatSet.lidScrews).toBeTrue();
    expect(heatSet.lidScrewHoleType).toBe('blind');
    expect(heatSet.lidScrewHoleDepth).toBeGreaterThan(0);

    const nut = enclosureSpecToParams(makeSpec('screw-nut'));
    expect(nut.lidScrews).toBeTrue();
    expect(nut.lidScrewHoleType).toBe('nut-pocket');
  });
});
