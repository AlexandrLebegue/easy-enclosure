import type { Geom3 } from '@jscad/modeling/src/geometries/types';
import { subtract, union } from '@jscad/modeling/src/operations/booleans';
import { rotateZ, translate } from '@jscad/modeling/src/operations/transforms';
import { cuboid } from '@jscad/modeling/src/primitives';
import { degToRad } from '@jscad/modeling/src/utils';

import { pcbMount } from '../../core/enclosure/pcbmount';
import type { EnclosureSpec, PlacedPart, Standoff } from '../model/enclosure.types';

const SUPPORT_WALL_MM = 1.5;
const SUPPORT_GAP_MM = 0.3;
const CLIP_LIP_MM = 1.2;

const engineX = (spec: EnclosureSpec, xMm: number): number => xMm - spec.outer.widthMm / 2;

const engineY = (spec: EnclosureSpec, yMm: number): number => yMm - spec.outer.depthMm / 2;

const findPart = (spec: EnclosureSpec, partId: string): PlacedPart | undefined =>
  spec.parts.find((part) => part.id === partId);

const buildStandoffScrew = (
  spec: EnclosureSpec,
  standoff: Standoff,
  x: number,
  y: number,
): Geom3 => {
  const mount = pcbMount({
    surface: 'bottom',
    x: 0,
    y: 0,
    height: standoff.heightMm,
    outerDiameter: Math.max(4, (standoff.screwMm ?? 3) + 2),
    screwDiameter: standoff.screwMm ?? 3,
    chamfer: true,
  });
  return translate([x, y, spec.rules.floorMm + standoff.heightMm / 2], mount);
};

const buildPocket = (part: PlacedPart, standoff: Standoff, rotationDegrees: number): Geom3 => {
  const width = part.spec!.envelope.widthMm;
  const depth = part.spec!.envelope.depthMm;
  const outerWidth = width + 2 * (SUPPORT_GAP_MM + SUPPORT_WALL_MM);
  const outerDepth = depth + 2 * (SUPPORT_GAP_MM + SUPPORT_WALL_MM);
  const innerWidth = width + 2 * SUPPORT_GAP_MM;
  const innerDepth = depth + 2 * SUPPORT_GAP_MM;

  const ring = subtract(
    cuboid({ size: [outerWidth, outerDepth, standoff.heightMm] }),
    cuboid({ size: [innerWidth, innerDepth, standoff.heightMm + 2] }),
  );
  return rotateZ(degToRad(rotationDegrees), ring);
};

const buildCradle = (part: PlacedPart, standoff: Standoff, rotationDegrees: number): Geom3 => {
  const width = part.spec!.envelope.widthMm;
  const depth = part.spec!.envelope.depthMm;
  const railOffset = width / 2 + SUPPORT_GAP_MM + SUPPORT_WALL_MM / 2;
  const rail = cuboid({
    size: [SUPPORT_WALL_MM, depth + 2 * SUPPORT_GAP_MM, standoff.heightMm],
  });
  const rails = union(translate([railOffset, 0, 0], rail), translate([-railOffset, 0, 0], rail));
  return rotateZ(degToRad(rotationDegrees), rails);
};

const buildClip = (part: PlacedPart, standoff: Standoff, rotationDegrees: number): Geom3 => {
  const width = part.spec!.envelope.widthMm;
  const depth = part.spec!.envelope.depthMm;
  const tabOffset = width / 2 + SUPPORT_GAP_MM + SUPPORT_WALL_MM / 2;
  const tabDepth = Math.max(2, depth * 0.6);
  const lipHeight = Math.min(1, standoff.heightMm);
  const tab = cuboid({
    size: [SUPPORT_WALL_MM, tabDepth, standoff.heightMm],
  });
  const lip = cuboid({
    size: [CLIP_LIP_MM, tabDepth, lipHeight],
  });
  const lipOffset = width / 2 + SUPPORT_GAP_MM - CLIP_LIP_MM / 2 + 0.2;
  const lipZ = standoff.heightMm / 2 - lipHeight / 2;

  const clips = union(
    translate([tabOffset, 0, 0], tab),
    translate([-tabOffset, 0, 0], tab),
    translate([lipOffset, 0, lipZ], lip),
    translate([-lipOffset, 0, lipZ], lip),
  );
  return rotateZ(degToRad(rotationDegrees), clips);
};

const buildGenericSupport = (standoff: Standoff): Geom3 =>
  cuboid({ size: [6, 6, standoff.heightMm] });

/**
 * Build printable support geometry for every standoff, honouring its type.
 * Coordinates are translated into the upstream engine's centred frame.
 */
export const buildSupportGeometry = (spec: EnclosureSpec): Geom3 | null => {
  const pieces: Geom3[] = [];

  for (const standoff of spec.standoffs) {
    if (standoff.heightMm <= 0) {
      continue;
    }

    const x = engineX(spec, standoff.xMm);
    const y = engineY(spec, standoff.yMm);
    const part = findPart(spec, standoff.partId);

    if (standoff.type === 'standoff-screw') {
      pieces.push(buildStandoffScrew(spec, standoff, x, y));
      continue;
    }

    let geometry: Geom3;
    if (!part?.spec) {
      geometry = buildGenericSupport(standoff);
    } else {
      const rotation = part.placedMm?.rotate ?? 0;
      switch (standoff.type) {
        case 'cradle':
          geometry = buildCradle(part, standoff, rotation);
          break;
        case 'clip':
          geometry = buildClip(part, standoff, rotation);
          break;
        case 'pocket':
        default:
          geometry = buildPocket(part, standoff, rotation);
          break;
      }
    }

    pieces.push(translate([x, y, spec.rules.floorMm + standoff.heightMm / 2], geometry));
  }

  return pieces.length > 0 ? union(pieces) : null;
};
