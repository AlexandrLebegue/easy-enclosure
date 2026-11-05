import { generateCutouts } from '../cutouts/cutout-generator';
import type {
  BoardEnclosureRules,
  BoardModel,
  EnclosureMode,
  EnclosureSpec,
  ImportWarning,
  LidType,
} from '../model/enclosure.types';
import { generateStandoffs } from '../supports/support-generator';
import {
  DEFAULT_ENCLOSURE_RULES,
  DEFAULT_PART_GAP_MM,
  DEFAULT_STACK_GAP_MM,
  DEFAULT_SUPPORT_HEIGHT_MM,
  layoutParts,
} from './layout-engine';

export interface BuildEnclosureOptions {
  mode?: EnclosureMode;
  rules?: Partial<BoardEnclosureRules>;
  lid?: { type?: LidType; screwMm?: number };
  projectName?: string;
  generatedAt?: string;
  gapMm?: number;
  supportHeightMm?: number;
  stackGapMm?: number;
}

export interface EnclosureBuildResult {
  spec: EnclosureSpec;
  warnings: ImportWarning[];
}

const projectNameFromFile = (fileName: string): string => {
  const withoutFolders = fileName.split('/').pop() ?? fileName;
  return withoutFolders.replace(/\.zip$/i, '') || 'velxio-project';
};

/** Assemble a complete, deterministic EnclosureSpec from an imported BoardModel. */
export const buildEnclosureSpec = (
  board: BoardModel,
  options: BuildEnclosureOptions = {},
): EnclosureBuildResult => {
  const mode = options.mode ?? 'flat';
  const rules: BoardEnclosureRules = {
    ...DEFAULT_ENCLOSURE_RULES,
    ...options.rules,
  };
  const supportHeightMm = options.supportHeightMm ?? DEFAULT_SUPPORT_HEIGHT_MM;

  const layout = layoutParts(board.parts, {
    mode,
    rules,
    gapMm: options.gapMm ?? DEFAULT_PART_GAP_MM,
    supportHeightMm,
    stackGapMm: options.stackGapMm ?? DEFAULT_STACK_GAP_MM,
  });

  const cutouts = generateCutouts(layout.parts, {
    rules,
    outer: layout.outer,
  });

  const standoffs = generateStandoffs(layout.parts, {
    rules,
    supportHeightMm,
  });

  const spec: EnclosureSpec = {
    schemaVersion: 1,
    mode,
    rules,
    lid: {
      type: options.lid?.type ?? 'snap',
      screwMm: options.lid?.screwMm,
    },
    outer: layout.outer,
    parts: layout.parts,
    standoffs,
    cutouts,
    metadata: {
      projectName: options.projectName ?? projectNameFromFile(board.source.fileName),
      generatedBy: 'agent-b/enclosure',
      generatedAt: options.generatedAt ?? new Date().toISOString(),
    },
  };

  return {
    spec,
    warnings: layout.warnings,
  };
};
