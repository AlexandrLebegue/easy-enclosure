import type {
  BoardEnclosureRules,
  EnclosureMode,
  ImportWarning,
  PlacedPart,
} from '../model/enclosure.types';

export const DEFAULT_ENCLOSURE_RULES: BoardEnclosureRules = {
  wallMm: 2,
  clearanceMm: 0.3,
  headroomMm: 3,
  cornerRadiusMm: 3,
  printClearanceMm: 0.2,
  floorMm: 2,
  lidMm: 2,
};

export const DEFAULT_PART_GAP_MM = 2;
export const DEFAULT_SUPPORT_HEIGHT_MM = 5;
export const DEFAULT_STACK_GAP_MM = 5;

export interface LayoutOptions {
  mode: EnclosureMode;
  rules: BoardEnclosureRules;
  /** Horizontal gap between parts in flat mode, mm. */
  gapMm?: number;
  /** Height of supports below each part, mm. */
  supportHeightMm?: number;
  /** Vertical gap between stacked parts, mm. */
  stackGapMm?: number;
}

export interface LayoutOuterDimensions {
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export interface LayoutResult {
  parts: PlacedPart[];
  outer: LayoutOuterDimensions;
  warnings: ImportWarning[];
}

export interface PlacementCollision {
  firstPartId: string;
  secondPartId: string;
}

interface PartFootprint {
  part: PlacedPart;
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

const toFootprint = (part: PlacedPart): PartFootprint | null => {
  if (!part.spec) {
    return null;
  }
  return {
    part,
    widthMm: part.spec.envelope.widthMm,
    depthMm: part.spec.envelope.depthMm,
    heightMm: part.spec.envelope.heightMm,
  };
};

const sortByCanvasTopology = (parts: readonly PlacedPart[]): PlacedPart[] =>
  [...parts].sort((a, b) => {
    if (a.canvas.y !== b.canvas.y) {
      return a.canvas.y - b.canvas.y;
    }
    if (a.canvas.x !== b.canvas.x) {
      return a.canvas.x - b.canvas.x;
    }
    return a.id.localeCompare(b.id);
  });

const maxOf = (values: readonly number[], fallback = 0): number =>
  values.length > 0 ? Math.max(...values) : fallback;

const withPlacement = (part: PlacedPart, x: number, y: number, z: number): PlacedPart => ({
  ...part,
  placedMm: { x, y, z, rotate: part.canvas.rotate },
});

/**
 * Place known parts. Unknown parts keep `placedMm` undefined: without a spec no
 * dimension is invented, so they cannot participate in physical placement.
 */
export const layoutParts = (
  parts: readonly PlacedPart[],
  options: Partial<LayoutOptions> & { mode: EnclosureMode },
): LayoutResult => {
  const rules = options.rules ?? DEFAULT_ENCLOSURE_RULES;
  const mode = options.mode;
  const gapMm = options.gapMm ?? DEFAULT_PART_GAP_MM;
  const supportHeightMm = options.supportHeightMm ?? DEFAULT_SUPPORT_HEIGHT_MM;
  const stackGapMm = options.stackGapMm ?? DEFAULT_STACK_GAP_MM;

  const sortedKnown = sortByCanvasTopology(parts)
    .map(toFootprint)
    .filter((footprint): footprint is PartFootprint => footprint !== null);

  const warnings: ImportWarning[] = [];
  const unknownParts = parts.filter((part) => part.spec === null);
  for (const part of unknownParts) {
    warnings.push({
      code: 'PART_IGNORED',
      message: `Part "${part.id}" (${part.partType}) has no dimensions and was left out of the physical layout.`,
      partId: part.id,
    });
  }

  const clearance = rules.clearanceMm;
  const wall = rules.wallMm;
  const floor = rules.floorMm;
  const lid = rules.lidMm;
  const headroom = rules.headroomMm;

  const knownWidths = sortedKnown.map((entry) => entry.widthMm);
  const knownDepths = sortedKnown.map((entry) => entry.depthMm);
  const knownHeights = sortedKnown.map((entry) => entry.heightMm);

  const maxWidth = maxOf(knownWidths);
  const maxDepth = maxOf(knownDepths);
  const maxHeight = maxOf(knownHeights);

  const placedById = new Map<string, PlacedPart>();

  if (mode === 'flat') {
    const contentWidth =
      knownWidths.reduce((total, width) => total + width, 0) +
      Math.max(0, sortedKnown.length - 1) * gapMm +
      clearance * 2;
    const contentDepth = maxDepth + clearance * 2;

    const baseZ = floor + supportHeightMm;
    let cursorX = wall + clearance;

    for (const entry of sortedKnown) {
      const y = wall + clearance + (maxDepth - entry.depthMm) / 2;
      placedById.set(entry.part.id, withPlacement(entry.part, cursorX, y, baseZ));
      cursorX += entry.widthMm + gapMm;
    }

    const outer: LayoutOuterDimensions = {
      widthMm: contentWidth + wall * 2,
      depthMm: contentDepth + wall * 2,
      heightMm: floor + supportHeightMm + maxHeight + headroom + lid,
    };

    return {
      parts: mergePlacements(parts, placedById),
      outer,
      warnings,
    };
  }

  const contentWidth = maxWidth + clearance * 2;
  const contentDepth = maxDepth + clearance * 2;

  let cursorZ = floor + supportHeightMm;
  for (const entry of sortedKnown) {
    const x = wall + clearance + (maxWidth - entry.widthMm) / 2;
    const y = wall + clearance + (maxDepth - entry.depthMm) / 2;
    placedById.set(entry.part.id, withPlacement(entry.part, x, y, cursorZ));
    cursorZ += entry.heightMm + stackGapMm;
  }

  const stackedTop = cursorZ - stackGapMm;
  const outer: LayoutOuterDimensions = {
    widthMm: contentWidth + wall * 2,
    depthMm: contentDepth + wall * 2,
    heightMm: Math.max(floor + supportHeightMm, stackedTop) + headroom + lid,
  };

  return {
    parts: mergePlacements(parts, placedById),
    outer,
    warnings,
  };
};

const mergePlacements = (
  parts: readonly PlacedPart[],
  placedById: ReadonlyMap<string, PlacedPart>,
): PlacedPart[] => parts.map((part) => placedById.get(part.id) ?? part);

const boxesOverlap = (first: PlacedPart, second: PlacedPart, clearanceMm: number): boolean => {
  const a = first.placedMm;
  const b = second.placedMm;
  if (!a || !b || !first.spec || !second.spec) {
    return false;
  }

  const aWidth = first.spec.envelope.widthMm;
  const aDepth = first.spec.envelope.depthMm;
  const aHeight = first.spec.envelope.heightMm;
  const bWidth = second.spec.envelope.widthMm;
  const bDepth = second.spec.envelope.depthMm;
  const bHeight = second.spec.envelope.heightMm;

  const zOverlap = a.z < b.z + bHeight && b.z < a.z + aHeight;
  if (!zOverlap) {
    return false;
  }

  const xOverlap = a.x < b.x + bWidth + clearanceMm && b.x < a.x + aWidth + clearanceMm;
  const yOverlap = a.y < b.y + bDepth + clearanceMm && b.y < a.y + aDepth + clearanceMm;
  return xOverlap && yOverlap;
};

/** Bounding-box collision test, with the configured minimum clearance. */
export const findCollisions = (
  parts: readonly PlacedPart[],
  clearanceMm: number,
): PlacementCollision[] => {
  const collisions: PlacementCollision[] = [];
  for (let firstIndex = 0; firstIndex < parts.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < parts.length; secondIndex += 1) {
      const first = parts[firstIndex];
      const second = parts[secondIndex];
      if (boxesOverlap(first, second, clearanceMm)) {
        collisions.push({ firstPartId: first.id, secondPartId: second.id });
      }
    }
  }
  return collisions;
};
