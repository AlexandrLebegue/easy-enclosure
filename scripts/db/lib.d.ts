import type { ComponentSpec, ValidationIssue } from '../../src/app/velxio/model/component.types';

export interface ComponentEntry {
  file?: string;
  rel?: string;
  spec: unknown;
}

export interface BuildResult {
  report: { ok: boolean; checked: number; issues: ValidationIssue[] };
  index: {
    generatedAt: string;
    count: number;
    byPartType: Record<string, { file: string; category: string; confidence: string }>;
  } | null;
}

export declare const ROOT: string;
export declare const COMPONENTS_DIR: string;
export declare const INDEX_FILE: string;
export declare const REPORT_FILE: string;
export declare const VELXIO_TYPES_FILE: string;

export declare function validateComponent(
  spec: unknown,
  fallbackPartType?: string,
): ValidationIssue[];
export declare function validateEntries(entries: ComponentEntry[]): ValidationIssue[];
export declare function readComponents(): { entries: ComponentEntry[]; issues: ValidationIssue[] };
export declare function build(): BuildResult;
export declare function buildIndex(entries: ComponentEntry[]): BuildResult['index'];
export declare function writeJson(file: string, value: unknown): void;
export declare function readIndex(): BuildResult['index'];
export declare function readVelxioTypes(): {
  generatedFrom: string;
  count: number;
  types: string[];
};
export declare function loadParts(): Map<string, ComponentSpec>;
export declare function resolvePartTypes(
  partTypes: string[],
  parts?: Map<string, ComponentSpec>,
): { resolved: ComponentSpec[]; missing: string[] };
export declare function computeCoverage(): {
  total: number;
  covered: string[];
  missing: string[];
  estimated: string[];
  extra: string[];
  index: BuildResult['index'];
};
