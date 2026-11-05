import type { ChatPatch } from '../model/enclosure.types';
import { applyPatches, validateEnclosureSpec } from './patches';
import { createDefaultSpec } from './spec-defaults';

describe('applyPatches', () => {
  it('applies a valid rule patch', () => {
    const spec = createDefaultSpec();
    const result = applyPatches(spec, [
      { op: 'set-rule', path: 'rules.wallMm', value: 3, rationale: 'Paroi plus solide' },
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.applied.length).toBe(1);
    expect(result.spec.rules.wallMm).toBe(3);
    expect(spec.rules.wallMm).toBe(2);
    expect(validateEnclosureSpec(result.spec).ok).toBeTrue();
  });

  it('rejects a rule value outside realistic bounds', () => {
    const spec = createDefaultSpec();
    const result = applyPatches(spec, [
      { op: 'set-rule', path: 'rules.wallMm', value: 12 },
      { op: 'set-rule', path: 'rules.clearanceMm', value: -1 },
      { op: 'set-rule', path: 'rules.cornerRadiusMm', value: 42 },
      { op: 'set-rule', path: 'rules.lidMm', value: 0.5 },
    ]);

    expect(result.applied).toEqual([]);
    expect(result.rejected.length).toBe(4);
    expect(result.rejected[0].reason).toContain('entre 1.2 et 5');
    expect(result.spec).toEqual(spec);
  });

  it('rejects an unknown patch operation without crashing', () => {
    const spec = createDefaultSpec();
    const unknown = { op: 'generate-geometry', value: 'STL' } as unknown as ChatPatch;
    const result = applyPatches(spec, [unknown]);

    expect(result.applied).toEqual([]);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].reason).toContain('inconnue');
    expect(result.spec).toEqual(spec);
  });

  it('adds then removes a cutout while validating the whole spec', () => {
    const spec = createDefaultSpec();
    const added = applyPatches(spec, [
      {
        op: 'add-cutout',
        value: {
          id: 'usb',
          side: 'front',
          offsetMm: 10,
          widthMm: 12,
          heightMm: 6,
          label: 'USB',
        },
      },
    ]);

    expect(added.rejected).toEqual([]);
    expect(added.spec.cutouts.length).toBe(1);
    expect(validateEnclosureSpec(added.spec).ok).toBeTrue();

    const removed = applyPatches(added.spec, [{ op: 'remove-cutout', value: 'usb' }]);
    expect(removed.rejected).toEqual([]);
    expect(removed.spec.cutouts).toEqual([]);
  });

  it('rejects a cutout that does not fit its face', () => {
    const spec = createDefaultSpec();
    const result = applyPatches(spec, [
      {
        op: 'add-cutout',
        value: { id: 'wide', side: 'left', offsetMm: 50, widthMm: 20, heightMm: 5 },
      },
    ]);

    expect(result.applied).toEqual([]);
    expect(result.rejected.length).toBe(1);
    expect(result.rejected[0].reason).toContain('dépasse');
  });

  it('surfaces ask-user questions in the applied list without touching the spec', () => {
    const spec = createDefaultSpec();
    const result = applyPatches(spec, [
      { op: 'ask-user', question: 'Quelle matière souhaitez-vous ?' },
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.applied.length).toBe(1);
    expect(result.applied[0].patch.op).toBe('ask-user');
    expect(result.applied[0].patch.question).toBe('Quelle matière souhaitez-vous ?');
    expect(result.spec).toEqual(spec);
  });

  it('updates lid type and screw diameter', () => {
    const spec = createDefaultSpec();
    const result = applyPatches(spec, [
      { op: 'set-lid', path: 'lid.type', value: 'screw-nut' },
      { op: 'set-lid', path: 'lid.screwMm', value: 3 },
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.spec.lid.type).toBe('screw-nut');
    expect(result.spec.lid.screwMm).toBe(3);
  });
});
