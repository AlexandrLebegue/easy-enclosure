import type { Cutout } from '../model/component.types';
import type {
  BoardEnclosureRules,
  ChatPatch,
  EnclosureSpec,
  LidType,
  Standoff,
  SupportType,
} from '../model/enclosure.types';
import { cloneSpec } from './spec-defaults';

/**
 * Le chat ne produit jamais de géométrie : il ne peut modifier la spécification
 * que par les opérations autorisées ci-dessous, dans des bornes physiques
 * réalistes. Chaque patch est validé avant application.
 */

export type RuleKey = keyof BoardEnclosureRules;

export interface Bounds {
  min: number;
  max: number;
}

/** Bornes réalistes des réglages du boîtier, en millimètres. */
export const RULE_BOUNDS: Record<RuleKey, Bounds> = {
  wallMm: { min: 1.2, max: 5 },
  clearanceMm: { min: 0, max: 2 },
  headroomMm: { min: 0, max: 100 },
  cornerRadiusMm: { min: 0, max: 20 },
  printClearanceMm: { min: 0, max: 2 },
  floorMm: { min: 0.8, max: 5 },
  lidMm: { min: 2, max: 4 },
};

export const LID_TYPES: readonly LidType[] = ['snap', 'screw-heat-set', 'screw-nut'];
export const SUPPORT_TYPES: readonly SupportType[] = [
  'standoff-screw',
  'cradle',
  'clip',
  'pocket',
  'none',
];
export const CUTOUT_SIDES = ['front', 'back', 'left', 'right', 'top', 'bottom'] as const;

export interface AppliedPatch {
  patch: ChatPatch;
  description: string;
}

export interface RejectedPatch {
  patch: ChatPatch;
  reason: string;
}

export interface ApplyPatchesResult {
  spec: EnclosureSpec;
  applied: AppliedPatch[];
  rejected: RejectedPatch[];
}

export interface SpecValidationResult {
  ok: boolean;
  issues: string[];
}

class PatchError extends Error {}

function fail(message: string): never {
  throw new PatchError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function sideLength(spec: EnclosureSpec, side: Cutout['side']): number {
  return side === 'left' || side === 'right' ? spec.outer.depthMm : spec.outer.widthMm;
}

function cutoutIssue(spec: EnclosureSpec, cutout: Partial<Cutout>): string | null {
  if (!isNonEmptyString(cutout.id)) {
    return 'La découpe doit avoir un identifiant non vide.';
  }
  if (cutout.side === undefined || !CUTOUT_SIDES.includes(cutout.side)) {
    return `Face de découpe invalide : ${String(cutout.side)}.`;
  }
  if (!isFiniteNumber(cutout.offsetMm)) {
    return 'offsetMm doit être un nombre.';
  }
  if (!isFiniteNumber(cutout.widthMm) || cutout.widthMm <= 0) {
    return 'widthMm doit être un nombre strictement positif.';
  }
  if (!isFiniteNumber(cutout.heightMm) || cutout.heightMm <= 0) {
    return 'heightMm doit être un nombre strictement positif.';
  }
  if (cutout.depthMm !== undefined && (!isFiniteNumber(cutout.depthMm) || cutout.depthMm < 0)) {
    return 'depthMm doit être un nombre positif ou nul.';
  }
  if (
    cutout.clearanceMm !== undefined &&
    (!isFiniteNumber(cutout.clearanceMm) || cutout.clearanceMm < 0 || cutout.clearanceMm > 5)
  ) {
    return 'clearanceMm doit être comprise entre 0 et 5 mm.';
  }
  return null;
}

function cutoutPlacementIssue(spec: EnclosureSpec, cutout: Partial<Cutout>): string | null {
  if (cutout.side === undefined) {
    return null;
  }
  if (!isFiniteNumber(cutout.offsetMm) || cutout.offsetMm < 0) {
    return 'offsetMm doit être un nombre positif ou nul.';
  }
  if (!isFiniteNumber(cutout.widthMm) || cutout.widthMm <= 0) {
    return 'widthMm doit être un nombre strictement positif.';
  }
  const available = sideLength(spec, cutout.side);
  if (cutout.offsetMm + cutout.widthMm > available + 1e-6) {
    return `La découpe dépasse la face ${cutout.side} (${(cutout.offsetMm + cutout.widthMm).toFixed(2)} mm > ${available} mm).`;
  }
  return null;
}

function readCutout(value: unknown): Partial<Cutout> {
  if (!isRecord(value)) {
    fail('Une découpe doit être un objet Cutout.');
  }
  return value as Partial<Cutout>;
}

function readStandoff(value: unknown): Partial<Standoff> {
  if (!isRecord(value)) {
    fail('Un support doit être un objet Standoff.');
  }
  return value as Partial<Standoff>;
}

function cutoutIdFrom(patch: ChatPatch): string | null {
  if (isNonEmptyString(patch.value)) {
    return patch.value;
  }
  if (isRecord(patch.value) && isNonEmptyString(patch.value['id'])) {
    return patch.value['id'];
  }
  if (patch.path?.startsWith('cutouts.')) {
    const id = patch.path.slice('cutouts.'.length);
    return id.length > 0 ? id : null;
  }
  return null;
}

function describe(patch: ChatPatch): string {
  switch (patch.op) {
    case 'set-mode':
      return `Mode du boîtier défini sur ${String(patch.value)}.`;
    case 'set-rule':
      return `Réglage ${patch.path ?? '?'} défini sur ${String(patch.value)} mm.`;
    case 'set-lid':
      return `Couvercle mis à jour (${patch.path ?? 'lid'} = ${JSON.stringify(patch.value)}).`;
    case 'add-cutout': {
      const cutout = isRecord(patch.value) ? patch.value : {};
      return `Découpe « ${String(cutout['id'] ?? '?')} » ajoutée sur ${String(cutout['side'] ?? '?')}.`;
    }
    case 'remove-cutout':
      return `Découpe « ${String(cutoutIdFrom(patch) ?? '?')} » supprimée.`;
    case 'set-support': {
      const support = isRecord(patch.value) ? patch.value : {};
      return `Support ${String(support['type'] ?? '?')} défini pour ${String(support['partId'] ?? '?')}.`;
    }
    case 'ask-user':
      return 'Question posée à l’utilisateur.';
    default:
      return `Patch ${String((patch as { op?: unknown }).op)} appliqué.`;
  }
}

function applyOne(spec: EnclosureSpec, patch: ChatPatch): void {
  if (!isRecord(patch) || typeof patch['op'] !== 'string') {
    fail('Patch invalide : le champ op est obligatoire.');
  }

  switch (patch.op) {
    case 'set-mode': {
      if (patch.value !== 'flat' && patch.value !== 'stacked') {
        fail('set-mode accepte uniquement "flat" ou "stacked".');
      }
      spec.mode = patch.value;
      return;
    }

    case 'set-rule': {
      if (!isNonEmptyString(patch.path)) {
        fail('set-rule exige un chemin, par exemple "rules.wallMm".');
      }
      const key = patch.path.startsWith('rules.') ? patch.path.slice('rules.'.length) : patch.path;
      if (!Object.prototype.hasOwnProperty.call(RULE_BOUNDS, key)) {
        fail(`Règle inconnue : ${key}.`);
      }
      const bounds = RULE_BOUNDS[key as RuleKey];
      if (!isFiniteNumber(patch.value)) {
        fail(`${key} doit être une valeur numérique.`);
      }
      if (patch.value < bounds.min || patch.value > bounds.max) {
        fail(
          `${key} doit être comprise entre ${bounds.min} et ${bounds.max} mm (reçu ${patch.value}).`,
        );
      }
      (spec.rules as unknown as Record<string, number>)[key] = patch.value;
      return;
    }

    case 'set-lid': {
      if (isRecord(patch.value) && !Array.isArray(patch.value)) {
        applyLid(spec, patch.value);
        return;
      }
      if (patch.path === 'lid.type' || typeof patch.value === 'string') {
        if (!LID_TYPES.includes(patch.value as LidType)) {
          fail(`Type de couvercle invalide : ${String(patch.value)}.`);
        }
        spec.lid.type = patch.value as LidType;
        return;
      }
      if (patch.path === 'lid.screwMm' || typeof patch.value === 'number') {
        if (!isFiniteNumber(patch.value) || patch.value < 1 || patch.value > 8) {
          fail('lid.screwMm doit être comprise entre 1 et 8 mm.');
        }
        spec.lid.screwMm = patch.value;
        return;
      }
      fail('set-lid exige "lid.type", "lid.screwMm" ou un objet {type, screwMm}.');
      return;
    }

    case 'add-cutout': {
      const cutout = readCutout(patch.value);
      if (spec.cutouts.some((existing) => existing.id === cutout.id)) {
        fail(`La découpe « ${String(cutout.id)} » existe déjà.`);
      }
      const issue = cutoutIssue(spec, cutout) ?? cutoutPlacementIssue(spec, cutout);
      if (issue) {
        fail(issue);
      }
      spec.cutouts.push({
        id: cutout.id as string,
        side: cutout.side as Cutout['side'],
        offsetMm: cutout.offsetMm as number,
        widthMm: cutout.widthMm as number,
        heightMm: cutout.heightMm as number,
        ...(cutout.depthMm !== undefined ? { depthMm: cutout.depthMm } : {}),
        ...(isNonEmptyString(cutout.label) ? { label: cutout.label } : {}),
        ...(cutout.clearanceMm !== undefined ? { clearanceMm: cutout.clearanceMm } : {}),
      });
      return;
    }

    case 'remove-cutout': {
      const id = cutoutIdFrom(patch);
      if (!id) {
        fail('remove-cutout exige l’identifiant de la découpe à supprimer.');
      }
      const index = spec.cutouts.findIndex((cutout) => cutout.id === id);
      if (index < 0) {
        fail(`Découpe inconnue : ${id}.`);
      }
      spec.cutouts.splice(index, 1);
      return;
    }

    case 'set-support': {
      const support = readStandoff(patch.value);
      if (!isNonEmptyString(support.partId)) {
        fail('set-support exige un partId.');
      }
      if (support.type === undefined || !SUPPORT_TYPES.includes(support.type)) {
        fail(`Type de support invalide : ${String(support.type)}.`);
      }
      if (spec.parts.length > 0 && !spec.parts.some((part) => part.id === support.partId)) {
        fail(`Composant inconnu dans la spécification : ${support.partId}.`);
      }
      if (support.type === 'none') {
        spec.standoffs = spec.standoffs.filter((standoff) => standoff.partId !== support.partId);
        return;
      }
      if (!isFiniteNumber(support.xMm) || !isFiniteNumber(support.yMm)) {
        fail('Les coordonnées xMm et yMm du support doivent être numériques.');
      }
      if (!isFiniteNumber(support.heightMm) || support.heightMm <= 0) {
        fail('heightMm du support doit être strictement positif.');
      }
      if (
        support.screwMm !== undefined &&
        (!isFiniteNumber(support.screwMm) || support.screwMm < 1 || support.screwMm > 8)
      ) {
        fail('screwMm du support doit être comprise entre 1 et 8 mm.');
      }
      const standoff: Standoff = {
        partId: support.partId,
        type: support.type,
        xMm: support.xMm,
        yMm: support.yMm,
        heightMm: support.heightMm,
        ...(support.screwMm !== undefined ? { screwMm: support.screwMm } : {}),
      };
      const index = spec.standoffs.findIndex((existing) => existing.partId === standoff.partId);
      if (index >= 0) {
        spec.standoffs[index] = standoff;
      } else {
        spec.standoffs.push(standoff);
      }
      return;
    }

    case 'ask-user': {
      if (!isNonEmptyString(patch.question)) {
        fail('ask-user exige une question non vide.');
      }
      return;
    }

    default:
      fail(`Opération de patch inconnue : ${String((patch as { op?: unknown }).op)}.`);
  }
}

function applyLid(spec: EnclosureSpec, value: Record<string, unknown>): void {
  const type = value['type'];
  if (type !== undefined) {
    if (!LID_TYPES.includes(type as LidType)) {
      fail(`Type de couvercle invalide : ${String(type)}.`);
    }
    spec.lid.type = type as LidType;
  }
  const screwMm = value['screwMm'];
  if (screwMm !== undefined) {
    if (!isFiniteNumber(screwMm) || screwMm < 1 || screwMm > 8) {
      fail('lid.screwMm doit être comprise entre 1 et 8 mm.');
    }
    spec.lid.screwMm = screwMm;
  }
  if (type === undefined && screwMm === undefined) {
    fail('Objet couvercle vide : fournissez type et/ou screwMm.');
  }
}

/** Valide une spécification complète avant de l'exposer à l'UI ou au moteur CAO. */
export function validateEnclosureSpec(spec: EnclosureSpec): SpecValidationResult {
  const issues: string[] = [];

  if (!isRecord(spec)) {
    return { ok: false, issues: ['La spécification doit être un objet.'] };
  }
  if (!Number.isInteger(spec.schemaVersion) || spec.schemaVersion < 1) {
    issues.push('schemaVersion doit être un entier positif.');
  }
  if (spec.mode !== 'flat' && spec.mode !== 'stacked') {
    issues.push('mode doit valoir "flat" ou "stacked".');
  }

  if (!isRecord(spec.rules)) {
    issues.push('rules est obligatoire.');
  } else {
    for (const key of Object.keys(RULE_BOUNDS) as RuleKey[]) {
      const value = (spec.rules as unknown as Record<string, unknown>)[key];
      if (!isFiniteNumber(value)) {
        issues.push(`rules.${key} doit être numérique.`);
      } else if (value < 0) {
        issues.push(`rules.${key} doit être positif ou nul.`);
      } else if ((key === 'wallMm' || key === 'floorMm' || key === 'lidMm') && value === 0) {
        issues.push(`rules.${key} doit être strictement positif.`);
      }
    }
  }

  if (!isRecord(spec.lid) || !LID_TYPES.includes(spec.lid.type)) {
    issues.push('lid.type est invalide.');
  } else if (spec.lid.screwMm !== undefined) {
    if (!isFiniteNumber(spec.lid.screwMm) || spec.lid.screwMm < 1 || spec.lid.screwMm > 8) {
      issues.push('lid.screwMm doit être comprise entre 1 et 8 mm.');
    }
  }

  if (
    !isRecord(spec.outer) ||
    !isFiniteNumber(spec.outer.widthMm) ||
    !isFiniteNumber(spec.outer.depthMm) ||
    !isFiniteNumber(spec.outer.heightMm) ||
    spec.outer.widthMm <= 0 ||
    spec.outer.depthMm <= 0 ||
    spec.outer.heightMm <= 0
  ) {
    issues.push('outer doit contenir des dimensions strictement positives.');
  }

  if (!Array.isArray(spec.parts)) {
    issues.push('parts doit être un tableau.');
  }
  if (!Array.isArray(spec.standoffs)) {
    issues.push('standoffs doit être un tableau.');
  } else {
    for (const standoff of spec.standoffs) {
      if (!isNonEmptyString(standoff.partId)) {
        issues.push('standoffs[].partId est obligatoire.');
      }
      if (!SUPPORT_TYPES.includes(standoff.type)) {
        issues.push(`standoffs[].type invalide : ${String(standoff.type)}.`);
      }
      if (!isFiniteNumber(standoff.xMm) || !isFiniteNumber(standoff.yMm)) {
        issues.push(`standoffs[${standoff.partId}].xMm/yMm doivent être numériques.`);
      }
      if (!isFiniteNumber(standoff.heightMm) || standoff.heightMm <= 0) {
        issues.push(`standoffs[${standoff.partId}].heightMm doit être strictement positif.`);
      }
    }
  }

  if (!Array.isArray(spec.cutouts)) {
    issues.push('cutouts doit être un tableau.');
  } else {
    const seen = new Set<string>();
    for (const cutout of spec.cutouts) {
      if (seen.has(cutout.id)) {
        issues.push(`Découpe dupliquée : ${cutout.id}.`);
      }
      seen.add(cutout.id);
      const issue = cutoutIssue(spec, cutout);
      if (issue) {
        issues.push(issue);
      }
    }
  }

  if (!isRecord(spec.metadata)) {
    issues.push('metadata est obligatoire.');
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Applique une liste de patches. Un patch invalide est rejeté avec une raison
 * explicite sans empêcher les autres patches valides d'être appliqués.
 * Les `ask-user` ne modifient pas la spec mais sont remontés dans `applied`
 * afin que l'UI puisse afficher la question.
 */
export function applyPatches(spec: EnclosureSpec, patches: ChatPatch[]): ApplyPatchesResult {
  let current = cloneSpec(spec);
  const applied: AppliedPatch[] = [];
  const rejected: RejectedPatch[] = [];

  for (const patch of patches) {
    if (!isRecord(patch) || typeof patch['op'] !== 'string') {
      rejected.push({
        patch: patch as ChatPatch,
        reason: 'Patch invalide : objet avec un champ op attendu.',
      });
      continue;
    }

    if (patch.op === 'ask-user') {
      if (!isNonEmptyString(patch.question)) {
        rejected.push({ patch, reason: 'ask-user exige une question non vide.' });
        continue;
      }
      applied.push({ patch, description: describe(patch) });
      continue;
    }

    const candidate = cloneSpec(current);
    try {
      applyOne(candidate, patch);
      const validation = validateEnclosureSpec(candidate);
      if (!validation.ok) {
        rejected.push({
          patch,
          reason: `Spécification invalide après application : ${validation.issues.join(' ')}`,
        });
        continue;
      }
      current = candidate;
      applied.push({ patch, description: describe(patch) });
    } catch (error) {
      rejected.push({
        patch,
        reason: error instanceof Error ? error.message : 'Patch invalide.',
      });
    }
  }

  return { spec: current, applied, rejected };
}
