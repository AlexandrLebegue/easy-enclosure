import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { union } from '@jscad/modeling/src/operations/booleans';
import { translate } from '@jscad/modeling/src/operations/transforms';
import { serialize as serializeStl } from '@jscad/stl-serializer';

import { base } from '../../core/enclosure/base';
import { lid } from '../../core/enclosure/lid';
import { DEFAULT_PARAMS, cloneParams, type Hole, type Params } from '../../core/params';
import type { Cutout } from '../model/component.types';
import type { EnclosureSpec } from '../model/enclosure.types';
import { buildSupportGeometry } from '../supports/support-geometry';

const LID_SPACING_MM = 5;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

const cutoutToHole = (cutout: Cutout, spec: EnclosureSpec): Hole => {
  const wallLength =
    cutout.side === 'left' || cutout.side === 'right' ? spec.outer.depthMm : spec.outer.widthMm;
  const alongCenter = cutout.offsetMm + cutout.widthMm / 2;

  return {
    shape: 'rectangle',
    diameter: 0,
    width: cutout.widthMm,
    length: cutout.heightMm,
    surface: cutout.side,
    // No vertical offset exists in the Cutout contract: centre it on the wall.
    x: 0,
    y: wallLength - alongCenter,
    rotation: 0,
  };
};

/** Map the portable EnclosureSpec onto the upstream JSCAD engine parameters. */
export const enclosureSpecToParams = (spec: EnclosureSpec): Params => {
  const params = cloneParams(DEFAULT_PARAMS);
  const { outer, rules } = spec;

  params.width = outer.widthMm;
  params.length = outer.depthMm;
  params.height = outer.heightMm;
  params.floor = rules.floorMm;
  params.roof = rules.lidMm;
  params.wall = rules.wallMm;
  params.waterProof = false;
  params.cornerRadius = clamp(
    rules.cornerRadiusMm,
    0,
    Math.min(outer.widthMm, outer.depthMm) / 2 - 0.01,
  );

  params.holes = spec.cutouts.map((cutout) => cutoutToHole(cutout, spec));
  params.pcbMounts = spec.standoffs
    .filter((standoff) => standoff.heightMm > 0)
    .map((standoff) => ({
      surface: 'bottom' as const,
      // The engine moves mounts from a centre-based coordinate system.
      x: outer.widthMm - standoff.xMm,
      y: outer.depthMm - standoff.yMm,
      height: standoff.heightMm,
      outerDiameter: Math.max(4, (standoff.screwMm ?? 3) + 2),
      screwDiameter: standoff.screwMm ?? 3,
      chamfer: true,
    }));

  params.internalWalls = [];
  params.cableClamps = [];
  params.wallMounts = false;
  params.dinRailMount = false;
  params.showDinRailMount = false;
  params.pcbPreview = { ...params.pcbPreview, enabled: false };
  params.baseBedChamfer = 0;
  params.lidBedChamfer = 0;
  params.lidTopChamfer = 0;
  params.showBase = true;
  params.showLid = true;
  params.showGrid = false;
  params.measurementSystem = 'metric';

  switch (spec.lid.type) {
    case 'screw-heat-set':
      params.lidScrews = true;
      params.lidScrewHoleType = 'blind';
      params.lidScrewHoleDepth = clamp(outer.heightMm - rules.floorMm - 1, 0.5, 10);
      break;
    case 'screw-nut':
      params.lidScrews = true;
      params.lidScrewHoleType = 'nut-pocket';
      break;
    case 'snap':
    default:
      params.lidScrews = false;
      params.snapFit = { ...params.snapFit, enabled: true };
      break;
  }

  return params;
};

export interface EnclosureGeometry {
  params: Params;
  base: Geom3;
  lid: Geom3;
  standoffs: Geom3 | null;
  assembly: Geom3;
}

/**
 * Generate the actual mesh through the existing upstream JSCAD engine.
 * The lid is laid out beside the base so the exported STL is printable as-is.
 */
export const buildEnclosureGeometry = (spec: EnclosureSpec): EnclosureGeometry => {
  const params = enclosureSpecToParams(spec);
  const baseGeometry = base(params);
  const lidGeometry = translate([spec.outer.widthMm + LID_SPACING_MM, 0, 0], lid(params));
  const standoffGeometry = buildSupportGeometry(spec);

  const pieces: Geom3[] = [baseGeometry, lidGeometry];
  if (standoffGeometry) {
    pieces.push(standoffGeometry);
  }

  return {
    params,
    base: baseGeometry,
    lid: lidGeometry,
    standoffs: standoffGeometry,
    assembly: union(pieces),
  };
};

export const serializeEnclosureStl = (spec: EnclosureSpec): string => {
  const { assembly } = buildEnclosureGeometry(spec);
  const output = serializeStl({ binary: false }, assembly);
  return Array.isArray(output) ? output.join('') : String(output);
};

/** Downloadable STL blob for the complete enclosure (base + lid + supports). */
export const generateEnclosureStlBlob = (spec: EnclosureSpec): Blob => {
  const stl = serializeEnclosureStl(spec);
  return new Blob([stl], { type: 'model/stl' });
};
