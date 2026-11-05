import type { Hole, Params, PCBMount } from '../../core/params';
import { convertDimension, convertHole, convertPCBMount, toMetricParams } from '../../core/units';
import { enclosureSpecToParams } from '../import/enclosure-mesh';
import type { Cutout } from '../model/component.types';
import type { EnclosureSpec, LidType, Standoff } from '../model/enclosure.types';
import { cloneSpec, createDefaultSpec } from './spec-defaults';

const EPSILON = 0.01;

const approx = (a: number, b: number): boolean => Math.abs(a - b) <= EPSILON;

const sideLength = (spec: EnclosureSpec, side: Cutout['side']): number =>
  side === 'left' || side === 'right' ? spec.outer.depthMm : spec.outer.widthMm;

// Le contrat Cutout est rectangulaire : la forme et le diamètre d'origine ne
// survivent pas au mapping. On compare donc uniquement l'empreinte géométrique.
const holeFootprint = (hole: Hole): { width: number; height: number } => {
  switch (hole.shape) {
    case 'circle': {
      const size = Math.max(0.1, hole.diameter);
      return { width: size, height: size };
    }
    case 'square': {
      const size = Math.max(0.1, hole.width > 0 ? hole.width : hole.diameter);
      return { width: size, height: size };
    }
    case 'rectangle':
    default: {
      const width = Math.max(0.1, hole.width > 0 ? hole.width : hole.diameter);
      const height = Math.max(0.1, hole.length > 0 ? hole.length : width);
      return { width, height };
    }
  }
};

const sameHole = (a: Hole, b: Hole): boolean => {
  const footprintA = holeFootprint(a);
  const footprintB = holeFootprint(b);
  return (
    a.surface === b.surface &&
    approx(a.x, b.x) &&
    approx(a.y, b.y) &&
    approx(footprintA.width, footprintB.width) &&
    approx(footprintA.height, footprintB.height)
  );
};

const sameMount = (a: PCBMount, b: PCBMount): boolean =>
  a.surface === b.surface &&
  approx(a.x, b.x) &&
  approx(a.y, b.y) &&
  approx(a.height, b.height) &&
  approx(a.screwDiameter, b.screwDiameter);

const cutoutGeometryEqual = (a: Cutout, b: Cutout): boolean =>
  a.side === b.side &&
  approx(a.offsetMm, b.offsetMm) &&
  approx(a.widthMm, b.widthMm) &&
  approx(a.heightMm, b.heightMm) &&
  approx(a.depthMm ?? 0, b.depthMm ?? 0);

const standoffGeometryEqual = (a: Standoff, b: Standoff): boolean =>
  a.type === b.type &&
  approx(a.xMm, b.xMm) &&
  approx(a.yMm, b.yMm) &&
  approx(a.heightMm, b.heightMm) &&
  approx(a.screwMm ?? 0, b.screwMm ?? 0);

const uniqueId = (base: string, used: Set<string>): string => {
  let id = base;
  let index = 2;
  while (used.has(id)) {
    id = `${base}-${index++}`;
  }
  used.add(id);
  return id;
};

const findPreviousCutout = (
  cutouts: Cutout[],
  candidate: Pick<Cutout, 'side' | 'offsetMm' | 'widthMm' | 'heightMm'>,
): Cutout | undefined =>
  cutouts.find(
    (cutout) =>
      cutout.side === candidate.side &&
      approx(cutout.offsetMm, candidate.offsetMm) &&
      approx(cutout.widthMm, candidate.widthMm) &&
      approx(cutout.heightMm, candidate.heightMm),
  );

const holesToCutouts = (holes: Hole[], previous: Cutout[], spec: EnclosureSpec): Cutout[] => {
  const used = new Set(previous.map((cutout) => cutout.id));
  const pool = [...previous];
  const cutouts: Cutout[] = [];

  holes.forEach((hole, index) => {
    const side = hole.surface;
    const footprint = holeFootprint(hole);
    const widthMm = footprint.width;
    const heightMm = footprint.height;
    // Inversion exacte de `cutoutToHole` : on ne borne pas ici, sinon les trous
    // existants ne seraient plus reconnus comme déjà gérés par la spec.
    const offsetMm = sideLength(spec, side) - hole.y - widthMm / 2;
    const candidate = { side, offsetMm, widthMm, heightMm };
    const matchIndex = pool.findIndex((cutout) => {
      const match = findPreviousCutout([cutout], candidate);
      return match !== undefined;
    });
    const match = matchIndex >= 0 ? pool.splice(matchIndex, 1)[0] : undefined;

    cutouts.push({
      id: match?.id ?? uniqueId(`hole-${index + 1}`, used),
      ...candidate,
      ...(match?.label ? { label: match.label } : {}),
      ...(match?.depthMm !== undefined ? { depthMm: match.depthMm } : {}),
      ...(match?.clearanceMm !== undefined ? { clearanceMm: match.clearanceMm } : {}),
    });
  });

  return cutouts;
};

const mountsToStandoffs = (
  mounts: PCBMount[],
  previous: Standoff[],
  spec: EnclosureSpec,
): Standoff[] => {
  const used = new Set(previous.map((standoff) => standoff.partId));
  const pool = [...previous];
  const standoffs: Standoff[] = [];

  mounts.forEach((mount, index) => {
    const partId = pool.find(
      (standoff) =>
        approx(standoff.xMm, spec.outer.widthMm - mount.x) &&
        approx(standoff.yMm, spec.outer.depthMm - mount.y) &&
        approx(standoff.heightMm, mount.height),
    )?.partId;
    const matchIndex = partId ? pool.findIndex((standoff) => standoff.partId === partId) : -1;
    const match = matchIndex >= 0 ? pool.splice(matchIndex, 1)[0] : undefined;

    standoffs.push({
      partId: match?.partId ?? uniqueId(`mount-${index + 1}`, used),
      type: match?.type ?? 'standoff-screw',
      xMm: spec.outer.widthMm - mount.x,
      yMm: spec.outer.depthMm - mount.y,
      heightMm: mount.height,
      ...(mount.screwDiameter > 0 ? { screwMm: mount.screwDiameter } : {}),
    });
  });

  return standoffs;
};

const inferLid = (params: Params): EnclosureSpec['lid'] => {
  if (!params.lidScrews) {
    return { type: 'snap' satisfies LidType };
  }
  const type: LidType = params.lidScrewHoleType === 'nut-pocket' ? 'screw-nut' : 'screw-heat-set';
  const screwMm = Math.min(8, Math.max(1, params.lidScrewDiameter));
  return { type, screwMm };
};

/**
 * Applique une EnclosureSpec au moteur existant sans écraser les options que le
 * contrat ne modélise pas (étanchéité, cloisons, clamps, montage mural, vue...).
 * Les trous/montages ajoutés hors chat sont conservés.
 */
export interface ApplySpecOptions {
  /** Remplace entièrement les découpes/empreintes au lieu d'appliquer un delta. */
  replaceHoles?: boolean;
  replaceMounts?: boolean;
}

export function applySpecToParams(
  spec: EnclosureSpec,
  current: Params,
  previousSpec: EnclosureSpec = spec,
  options: ApplySpecOptions = {},
): Params {
  const mapped = enclosureSpecToParams(spec);
  const previousMapped = enclosureSpecToParams(previousSpec);
  const metricCurrent = toMetricParams(current);
  const system = current.measurementSystem ?? 'metric';
  const conv = (value: number): number => convertDimension(value, 'metric', system);

  const replaceHoles = options.replaceHoles ?? false;
  const replaceMounts = options.replaceMounts ?? false;
  const nextById = new Map(spec.cutouts.map((cutout) => [cutout.id, cutout]));
  const removedHoles = replaceHoles
    ? []
    : previousSpec.cutouts.flatMap((cutout, index) => {
        const nextCutout = nextById.get(cutout.id);
        return !nextCutout || !cutoutGeometryEqual(cutout, nextCutout)
          ? [previousMapped.holes[index]]
          : [];
      });
  const addedHoles = spec.cutouts.flatMap((cutout, index) => {
    const previousCutout = replaceHoles
      ? undefined
      : previousSpec.cutouts.find((entry) => entry.id === cutout.id);
    return !previousCutout || !cutoutGeometryEqual(previousCutout, cutout)
      ? [mapped.holes[index]]
      : [];
  });
  const keepHole = metricCurrent.holes.map(() => !replaceHoles);
  for (const removed of removedHoles) {
    const index = metricCurrent.holes.findIndex(
      (hole, holeIndex) => keepHole[holeIndex] && sameHole(hole, removed),
    );
    if (index >= 0) {
      keepHole[index] = false;
    }
  }

  const nextStandoffById = new Map(spec.standoffs.map((standoff) => [standoff.partId, standoff]));
  const removedMounts = replaceMounts
    ? []
    : previousSpec.standoffs.flatMap((standoff, index) => {
        const nextStandoff = nextStandoffById.get(standoff.partId);
        return !nextStandoff || !standoffGeometryEqual(standoff, nextStandoff)
          ? [previousMapped.pcbMounts[index]]
          : [];
      });
  const addedMounts = spec.standoffs.flatMap((standoff, index) => {
    const previousStandoff = replaceMounts
      ? undefined
      : previousSpec.standoffs.find((entry) => entry.partId === standoff.partId);
    return !previousStandoff || !standoffGeometryEqual(previousStandoff, standoff)
      ? [mapped.pcbMounts[index]]
      : [];
  });
  const keepMount = metricCurrent.pcbMounts.map(() => !replaceMounts);
  for (const removed of removedMounts) {
    if (!removed) {
      continue;
    }
    const index = metricCurrent.pcbMounts.findIndex(
      (mount, mountIndex) => keepMount[mountIndex] && sameMount(mount, removed),
    );
    if (index >= 0) {
      keepMount[index] = false;
    }
  }

  const next: Params = {
    ...current,
    width: conv(mapped.width),
    length: conv(mapped.length),
    height: conv(mapped.height),
    wall: conv(mapped.wall),
    floor: conv(mapped.floor),
    roof: conv(mapped.roof),
    cornerRadius: conv(mapped.cornerRadius),
    holes: [
      ...current.holes.filter((_hole, index) => keepHole[index]),
      ...addedHoles.map((hole) => convertHole(hole, 'metric', system)),
    ],
    pcbMounts: [
      ...current.pcbMounts.filter((_mount, index) => keepMount[index]),
      ...addedMounts
        .filter((mount): mount is PCBMount => mount !== undefined)
        .map((mount) => convertPCBMount(mount, 'metric', system)),
    ],
    lidScrews: mapped.lidScrews,
    lidScrewHoleType: mapped.lidScrewHoleType,
    snapFit: { ...current.snapFit, enabled: spec.lid.type === 'snap' },
  };

  if (spec.lid.type === 'screw-heat-set') {
    next.lidScrewHoleDepth = conv(mapped.lidScrewHoleDepth);
  }
  if (spec.lid.screwMm !== undefined) {
    next.lidScrewDiameter = conv(spec.lid.screwMm);
    next.baseLidScrewDiameter = conv(spec.lid.screwMm);
  }

  return next;
}

/**
 * Reconstruit la spec depuis les paramètres du moteur après une édition dans le
 * panneau de paramètres. Les champs absents de Params (mode, jeux, métadonnées,
 * libellés de découpes) sont conservés depuis la spec précédente.
 */
export function paramsToEnclosureSpec(
  params: Params,
  previous: EnclosureSpec = createDefaultSpec(),
): EnclosureSpec {
  const metric = toMetricParams(params);
  const next = cloneSpec(previous);
  next.outer = {
    widthMm: metric.width,
    depthMm: metric.length,
    heightMm: metric.height,
  };
  next.rules = {
    ...next.rules,
    wallMm: metric.wall,
    floorMm: metric.floor,
    lidMm: metric.roof,
    cornerRadiusMm: metric.cornerRadius,
  };
  next.lid = inferLid(metric);
  next.cutouts = holesToCutouts(metric.holes, previous.cutouts, next);
  next.standoffs = mountsToStandoffs(metric.pcbMounts, previous.standoffs, next);
  return next;
}
