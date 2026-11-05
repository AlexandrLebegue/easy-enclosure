import type { EnclosureSpec } from '../model/enclosure.types';

/** Spécification initiale utilisée par le panneau de chat lorsqu'aucun projet n'est fourni. */
export function createDefaultSpec(): EnclosureSpec {
  return {
    schemaVersion: 1,
    mode: 'flat',
    rules: {
      wallMm: 2,
      clearanceMm: 0.5,
      headroomMm: 5,
      cornerRadiusMm: 3,
      printClearanceMm: 0.2,
      floorMm: 1.5,
      lidMm: 2.4,
    },
    lid: { type: 'snap' },
    outer: { widthMm: 80, depthMm: 60, heightMm: 30 },
    parts: [],
    standoffs: [],
    cutouts: [],
    metadata: {
      projectName: 'Projet sans nom',
      generatedBy: 'velxio-chat',
      generatedAt: new Date(0).toISOString(),
    },
  };
}

export function cloneSpec(spec: EnclosureSpec): EnclosureSpec {
  return JSON.parse(JSON.stringify(spec)) as EnclosureSpec;
}
