import { DEFAULT_PARAMS, cloneParams } from '../../core/params';
import { convertParams, mmToInches } from '../../core/units';
import type { EnclosureSpec } from '../model/enclosure.types';
import { applySpecToParams, paramsToEnclosureSpec } from './spec-bridge';
import { createDefaultSpec } from './spec-defaults';

const specWith = (mutate: (spec: EnclosureSpec) => void): EnclosureSpec => {
  const spec = createDefaultSpec();
  mutate(spec);
  return spec;
};

describe('spec bridge', () => {
  it('applies spec geometry while preserving unsupported app options', () => {
    const current = cloneParams(DEFAULT_PARAMS);
    current.waterProof = true;
    current.wallMounts = true;
    current.dinRailMount = true;
    current.showGrid = false;
    current.internalWalls = [{ x: 1, y: 2, height: 3, length: 4, thickness: 1, rotation: 0 }];

    const spec = specWith((next) => {
      next.rules.wallMm = 3;
      next.lid = { type: 'screw-nut' };
    });
    const mapped = applySpecToParams(spec, current);

    expect(mapped.wall).toBe(3);
    expect(mapped.waterProof).toBeTrue();
    expect(mapped.wallMounts).toBeTrue();
    expect(mapped.dinRailMount).toBeTrue();
    expect(mapped.showGrid).toBeFalse();
    expect(mapped.measurementSystem).toBe('metric');
    expect(mapped.internalWalls.length).toBe(1);
    expect(mapped.lidScrews).toBeTrue();
    expect(mapped.lidScrewHoleType).toBe('nut-pocket');
  });

  it('maps the lid screw diameter and keeps the user snap-fit settings', () => {
    const current = cloneParams(DEFAULT_PARAMS);
    current.snapFit = { ...current.snapFit, enabled: true, width: 11 };
    const spec = specWith((next) => {
      next.lid = { type: 'snap' };
      next.rules.wallMm = 2.2;
    });

    const mapped = applySpecToParams(spec, current);
    expect(mapped.snapFit.enabled).toBeTrue();
    expect(mapped.snapFit.width).toBe(11);

    const screwed = specWith((next) => {
      next.lid = { type: 'screw-heat-set', screwMm: 3 };
    });
    const screwedParams = applySpecToParams(screwed, current);
    expect(screwedParams.lidScrewDiameter).toBe(3);
    expect(screwedParams.baseLidScrewDiameter).toBe(3);
    expect(screwedParams.snapFit.enabled).toBeFalse();
  });

  it('builds a spec from engine params and preserves chat-only fields', () => {
    const previous = specWith((next) => {
      next.mode = 'stacked';
      next.outer = { widthMm: 120, depthMm: 90, heightMm: 40 };
      next.rules.clearanceMm = 1.25;
      next.rules.headroomMm = 8;
      next.cutouts = [
        {
          id: 'usb',
          side: 'front',
          offsetMm: 10,
          widthMm: 12,
          heightMm: 6,
          label: 'USB',
        },
      ];
    });
    const params = cloneParams(DEFAULT_PARAMS);
    params.width = 120;
    params.length = 90;
    params.height = 40;
    params.wall = 2.5;
    params.roof = 3;
    params.holes = [
      {
        shape: 'rectangle',
        diameter: 0,
        width: 12,
        length: 6,
        surface: 'front',
        x: 0,
        y: 120 - 16,
      },
    ];
    params.lidScrews = true;
    params.lidScrewHoleType = 'nut-pocket';
    params.lidScrewDiameter = 3;

    const spec = paramsToEnclosureSpec(params, previous);

    expect(spec.outer).toEqual({ widthMm: 120, depthMm: 90, heightMm: 40 });
    expect(spec.rules.wallMm).toBe(2.5);
    expect(spec.rules.clearanceMm).toBe(1.25);
    expect(spec.rules.headroomMm).toBe(8);
    expect(spec.mode).toBe('stacked');
    expect(spec.lid).toEqual({ type: 'screw-nut', screwMm: 3 });
    expect(spec.cutouts.length).toBe(1);
    expect(spec.cutouts[0].id).toBe('usb');
    expect(spec.cutouts[0].label).toBe('USB');
  });

  it('keeps user holes and mounts that are not managed by the chat spec', () => {
    const previous = createDefaultSpec();
    const current = cloneParams(DEFAULT_PARAMS);
    current.holes = [
      { shape: 'circle', diameter: 12.5, width: 10, length: 10, surface: 'front', x: 0, y: 10 },
    ];
    current.pcbMounts = [
      {
        surface: 'bottom',
        x: 10,
        y: 10,
        height: 5,
        outerDiameter: 6,
        screwDiameter: 3,
      },
    ];

    const spec = specWith((next) => {
      next.cutouts = [{ id: 'usb', side: 'front', offsetMm: 10, widthMm: 12, heightMm: 6 }];
      next.standoffs = [
        {
          partId: 'mcu',
          type: 'standoff-screw',
          xMm: 20,
          yMm: 15,
          heightMm: 6,
          screwMm: 2.5,
        },
      ];
    });
    const mapped = applySpecToParams(spec, current, previous);

    expect(mapped.holes.length).toBe(2);
    expect(mapped.holes.some((hole) => hole.shape === 'circle')).toBeTrue();
    expect(mapped.pcbMounts.length).toBe(2);
  });

  it('round-trips chat-managed cutouts without changing their ids', () => {
    const spec = specWith((next) => {
      next.cutouts = [
        { id: 'usb', side: 'front', offsetMm: 12, widthMm: 10, heightMm: 5, label: 'USB' },
      ];
      next.standoffs = [
        {
          partId: 'mcu',
          type: 'standoff-screw',
          xMm: 20,
          yMm: 15,
          heightMm: 6,
          screwMm: 2.5,
        },
      ];
    });

    const current = cloneParams(DEFAULT_PARAMS);
    current.holes = [];
    current.pcbMounts = [];
    const params = applySpecToParams(spec, current, spec, {
      replaceHoles: true,
      replaceMounts: true,
    });
    const roundTrip = paramsToEnclosureSpec(params, spec);

    expect(roundTrip.cutouts.length).toBe(1);
    expect(roundTrip.cutouts[0].id).toBe('usb');
    expect(roundTrip.cutouts[0].label).toBe('USB');
    expect(roundTrip.standoffs.length).toBe(1);
    expect(roundTrip.standoffs[0].partId).toBe('mcu');
  });

  it('round-trips values when the app is in imperial units', () => {
    const imperial = convertParams(cloneParams(DEFAULT_PARAMS), 'imperial');
    const spec = specWith((next) => {
      next.outer = { widthMm: 100, depthMm: 80, heightMm: 30 };
      next.rules.wallMm = 3;
      next.cutouts = [{ id: 'usb', side: 'front', offsetMm: 10, widthMm: 12, heightMm: 6 }];
    });

    const previous = paramsToEnclosureSpec(imperial);
    const mapped = applySpecToParams(spec, imperial, previous);
    expect(mapped.measurementSystem).toBe('imperial');
    expect(mapped.wall).toBeCloseTo(mmToInches(3), 4);
    expect(mapped.holes.length).toBe(1);
    expect(mapped.holes[0].width).toBeCloseTo(mmToInches(12), 4);

    const roundTrip = paramsToEnclosureSpec(mapped, spec);
    expect(roundTrip.outer.widthMm).toBe(100);
    expect(roundTrip.outer.depthMm).toBe(80);
    expect(roundTrip.rules.wallMm).toBe(3);
    expect(roundTrip.cutouts.length).toBe(1);
  });

  it('preserves upstream hole shapes and mount options when cutouts did not change', () => {
    const params = cloneParams(DEFAULT_PARAMS);
    const spec = paramsToEnclosureSpec(params);

    const mapped = applySpecToParams(spec, params, spec);

    expect(mapped.holes.length).toBe(params.holes.length);
    expect(mapped.holes[0].shape).toBe('circle');
    expect(mapped.holes[0].diameter).toBe(12.5);
    expect(mapped.pcbMounts.length).toBe(params.pcbMounts.length);
    expect(mapped.pcbMounts[0].outerDiameter).toBe(6);
  });
});
