import type { Cutout, Side } from '../model/component.types';
import type { LayoutOuterDimensions } from '../layout/layout-engine';
import type { BoardEnclosureRules, PlacedPart } from '../model/enclosure.types';

export interface CutoutGenerationOptions {
  rules: BoardEnclosureRules;
  outer: LayoutOuterDimensions;
}

const WALL_SIDES: readonly Side[] = ['front', 'right', 'back', 'left'];

const rotateSide = (side: Side, rotateDegrees: number): Side => {
  if (!WALL_SIDES.includes(side)) {
    return side;
  }
  const steps = ((Math.round(rotateDegrees / 90) % 4) + 4) % 4;
  const index = WALL_SIDES.indexOf(side);
  return WALL_SIDES[(index + steps) % 4];
};

interface LocalPoint {
  x: number;
  y: number;
}

const localCutoutCenter = (
  side: Side,
  offsetMm: number,
  widthMm: number,
  envelopeWidth: number,
  envelopeDepth: number,
): LocalPoint => {
  switch (side) {
    case 'front':
      return { x: offsetMm + widthMm / 2, y: envelopeDepth };
    case 'back':
      return { x: offsetMm + widthMm / 2, y: 0 };
    case 'right':
      return { x: envelopeWidth, y: offsetMm + widthMm / 2 };
    case 'left':
      return { x: 0, y: offsetMm + widthMm / 2 };
    case 'top':
    case 'bottom':
      return { x: offsetMm + widthMm / 2, y: envelopeDepth / 2 };
    default:
      return { x: offsetMm + widthMm / 2, y: 0 };
  }
};

const rotateAroundCenter = (
  point: LocalPoint,
  centerX: number,
  centerY: number,
  rotateDegrees: number,
): LocalPoint => {
  const radians = (rotateDegrees * Math.PI) / 180;
  const dx = point.x - centerX;
  const dy = point.y - centerY;
  return {
    x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

const wallLength = (side: Side, outer: LayoutOuterDimensions): number => {
  if (side === 'left' || side === 'right') {
    return outer.depthMm;
  }
  return outer.widthMm;
};

const alongCoordinate = (side: Side, point: LocalPoint): number =>
  side === 'left' || side === 'right' ? point.y : point.x;

/**
 * Project component cutouts onto the enclosure walls.
 *
 * Component keepouts are intentionally not converted into cuts: they reserve a
 * volume but do not remove material from the shell.
 */
export const generateCutouts = (
  parts: readonly PlacedPart[],
  options: CutoutGenerationOptions,
): Cutout[] => {
  const { rules, outer } = options;
  const printClearance = rules.printClearanceMm;
  const cutouts: Cutout[] = [];
  const usedIds = new Set<string>();

  for (const part of parts) {
    if (!part.spec || !part.placedMm) {
      continue;
    }

    const envelope = part.spec.envelope;
    const placed = part.placedMm;
    const centerX = placed.x + envelope.widthMm / 2;
    const centerY = placed.y + envelope.depthMm / 2;

    for (const source of part.spec.cutouts) {
      if (source.widthMm <= 0 || source.heightMm <= 0) {
        continue;
      }

      const localCenter = localCutoutCenter(
        source.side,
        source.offsetMm,
        source.widthMm,
        envelope.widthMm,
        envelope.depthMm,
      );
      const rotatedLocal = rotateAroundCenter(
        localCenter,
        envelope.widthMm / 2,
        envelope.depthMm / 2,
        placed.rotate,
      );

      const absoluteCenter = {
        x: centerX + rotatedLocal.x - envelope.widthMm / 2,
        y: centerY + rotatedLocal.y - envelope.depthMm / 2,
      };

      const side = rotateSide(source.side, placed.rotate);
      const length = wallLength(side, outer);
      const expandedWidth = source.widthMm + printClearance * 2;
      const expandedHeight = source.heightMm + printClearance * 2;
      const along = alongCoordinate(side, absoluteCenter);
      const offsetMm = clamp(along - expandedWidth / 2, 0, length - expandedWidth);

      const baseId = `${part.id}:${source.id}`;
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}#${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);

      cutouts.push({
        id,
        side,
        offsetMm,
        widthMm: expandedWidth,
        heightMm: expandedHeight,
        depthMm: source.depthMm,
        label: source.label ?? `${part.partType} ${source.id}`,
        clearanceMm: printClearance,
      });
    }
  }

  return cutouts;
};
