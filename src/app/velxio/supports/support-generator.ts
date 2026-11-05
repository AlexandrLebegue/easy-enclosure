import type { ComponentSpec } from '../model/component.types';
import type {
  BoardEnclosureRules,
  PlacedPart,
  Standoff,
  SupportType,
} from '../model/enclosure.types';

export interface SupportGenerationOptions {
  rules: BoardEnclosureRules;
  /** Support height beneath a part, mm. */
  supportHeightMm?: number;
}

interface SupportProfile {
  type: SupportType;
  screwMm?: number;
}

const supportProfileFor = (spec: ComponentSpec): SupportProfile => {
  switch (spec.category) {
    case 'board':
      return { type: 'standoff-screw', screwMm: 3 };
    case 'display':
      return { type: 'cradle' };
    case 'sensor':
      return { type: 'clip' };
    case 'actuator':
      return { type: 'cradle' };
    case 'passive':
      return { type: 'pocket' };
    case 'power':
    case 'module':
    case 'other':
    default:
      return { type: 'pocket' };
  }
};

const rotateAroundCenter = (
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  rotateDegrees: number,
): { x: number; y: number } => {
  const radians = (rotateDegrees * Math.PI) / 180;
  const dx = x - centerX;
  const dy = y - centerY;
  return {
    x: centerX + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: centerY + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
};

/**
 * Build one support per component. Boards with mounting holes get one standoff
 * per hole; other components get a single support at their footprint centre.
 */
export const generateStandoffs = (
  parts: readonly PlacedPart[],
  options: SupportGenerationOptions,
): Standoff[] => {
  const { rules } = options;
  const defaultSupportHeight = options.supportHeightMm ?? 5;
  const standoffs: Standoff[] = [];

  for (const part of parts) {
    if (!part.spec || !part.placedMm) {
      continue;
    }

    const profile = supportProfileFor(part.spec);
    if (profile.type === 'none') {
      continue;
    }

    const placed = part.placedMm;
    const envelope = part.spec.envelope;
    const centerX = placed.x + envelope.widthMm / 2;
    const centerY = placed.y + envelope.depthMm / 2;
    const heightMm = Math.max(0, placed.z - rules.floorMm) || defaultSupportHeight;

    if (part.spec.category === 'board' && part.spec.mountHoles.length > 0) {
      for (const hole of part.spec.mountHoles) {
        const rotated = rotateAroundCenter(
          hole.xMm,
          hole.yMm,
          envelope.widthMm / 2,
          envelope.depthMm / 2,
          placed.rotate,
        );
        standoffs.push({
          partId: part.id,
          type: profile.type,
          xMm: placed.x + rotated.x,
          yMm: placed.y + rotated.y,
          heightMm,
          screwMm: profile.screwMm,
        });
      }
      continue;
    }

    standoffs.push({
      partId: part.id,
      type: profile.type,
      xMm: centerX,
      yMm: centerY,
      heightMm,
      screwMm: profile.screwMm,
    });
  }

  return standoffs;
};
