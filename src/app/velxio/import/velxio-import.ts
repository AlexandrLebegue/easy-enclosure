import JSZip from 'jszip';

import type { ComponentSpec } from '../model/component.types';
import type { BoardModel, Connection, ImportWarning, PlacedPart } from '../model/enclosure.types';
import {
  createDefaultPartResolver,
  type PartResolver,
  type PartResolverOptions,
} from './part-resolver';

export interface VelxioRawPart {
  type: string;
  id?: string;
  top?: number;
  left?: number;
  rotate?: number;
  attrs?: Record<string, unknown>;
}

export interface VelxioDiagram {
  version?: number;
  author?: string;
  editor?: string;
  parts: VelxioRawPart[];
  connections?: unknown[];
}

export interface VelxioArchive {
  fileName: string;
  diagram: VelxioDiagram;
  sketch: string | null;
}

export interface ImportVelxioOptions {
  fileName?: string;
  importedAt?: string;
  resolver?: PartResolver;
  resolverOptions?: PartResolverOptions;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asFiniteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizeRawPart = (value: unknown, index: number): VelxioRawPart => {
  if (!isRecord(value) || typeof value['type'] !== 'string') {
    throw new Error(`INVALID_DIAGRAM_PART at index ${index}`);
  }

  return {
    type: value['type'],
    id: typeof value['id'] === 'string' ? value['id'] : `part-${index}`,
    top: asFiniteNumber(value['top'], 0),
    left: asFiniteNumber(value['left'], 0),
    rotate: asFiniteNumber(value['rotate'], 0),
    attrs: isRecord(value['attrs']) ? value['attrs'] : undefined,
  };
};

export const parseDiagramJson = (text: string): VelxioDiagram => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('INVALID_DIAGRAM_JSON');
  }

  if (!isRecord(parsed) || !Array.isArray(parsed['parts'])) {
    throw new Error('INVALID_DIAGRAM_STRUCTURE');
  }

  return {
    version: typeof parsed['version'] === 'number' ? parsed['version'] : undefined,
    author: typeof parsed['author'] === 'string' ? parsed['author'] : undefined,
    editor: typeof parsed['editor'] === 'string' ? parsed['editor'] : undefined,
    parts: parsed['parts'].map((part, index) => normalizeRawPart(part, index)),
    connections: Array.isArray(parsed['connections']) ? parsed['connections'] : [],
  };
};

const findEntry = (zip: JSZip, pattern: RegExp): string | null => {
  const name = Object.keys(zip.files).find((entry) => pattern.test(entry));
  return name ?? null;
};

export const readVelxioArchive = async (
  data: ArrayBuffer | Uint8Array | Blob,
  fileName = 'project.zip',
): Promise<VelxioArchive> => {
  const zip = await JSZip.loadAsync(data);

  const diagramName = findEntry(zip, /(^|\/)diagram\.json$/i);
  if (!diagramName) {
    throw new Error('MISSING_DIAGRAM_JSON');
  }

  const diagramFile = zip.file(diagramName);
  if (!diagramFile) {
    throw new Error('MISSING_DIAGRAM_JSON');
  }
  const diagram = parseDiagramJson(await diagramFile.async('string'));

  const sketchName = findEntry(zip, /(^|\/)sketch\.ino$/i);
  const sketchFile = sketchName ? zip.file(sketchName) : null;
  const sketch = sketchFile ? await sketchFile.async('string') : null;

  return { fileName, diagram, sketch };
};

export const normalizeConnections = (raw: unknown): Connection[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) {
      return [];
    }
    const from = typeof entry[0] === 'string' ? entry[0] : '';
    const to = typeof entry[1] === 'string' ? entry[1] : '';
    if (!from || !to) {
      return [];
    }
    return [
      {
        from,
        to,
        color: typeof entry[2] === 'string' ? entry[2] : '',
      },
    ];
  });
};

export interface BuildBoardModelInput {
  fileName: string;
  importedAt: string;
  diagram: VelxioDiagram;
  sketch?: string | null;
  specs: ReadonlyMap<string, ComponentSpec>;
  missingPartTypes?: readonly string[];
}

export const buildBoardModel = (input: BuildBoardModelInput): BoardModel => {
  const warnings: ImportWarning[] = [
    {
      code: 'CANVAS_SCALE_IGNORED',
      message:
        'Velxio canvas coordinates are pixels, not millimetres. They are used only to preserve relative topology before physical placement.',
    },
  ];

  if (!input.sketch) {
    warnings.push({
      code: 'MISSING_SKETCH',
      message: 'No sketch.ino found in the Velxio archive.',
    });
  }

  const parts: PlacedPart[] = input.diagram.parts.map((part) => {
    const spec = input.specs.get(part.type) ?? null;
    if (!spec) {
      warnings.push({
        code: 'UNKNOWN_PART_TYPE',
        message: `Unknown part type "${part.type}": no dimensions available, part excluded from physical placement.`,
        partId: part.id,
      });
    } else if (spec.confidence === 'estimated') {
      warnings.push({
        code: 'ESTIMATED_DIMENSIONS',
        message: `Dimensions for "${part.type}" are estimated; review the component database entry.`,
        partId: part.id,
      });
    }

    return {
      id: part.id ?? part.type,
      partType: part.type,
      spec,
      canvas: {
        x: asFiniteNumber(part.left, 0),
        y: asFiniteNumber(part.top, 0),
        rotate: asFiniteNumber(part.rotate, 0),
      },
    };
  });

  return {
    source: { fileName: input.fileName, importedAt: input.importedAt },
    parts,
    connections: normalizeConnections(input.diagram.connections),
    warnings,
    complete: parts.every((part) => part.spec !== null),
  };
};

/**
 * Import a Velxio zip export (`diagram.json` + optional `sketch.ino`) into a
 * `BoardModel`, resolving each `parts[].type` through the component database.
 */
export const importVelxioZip = async (
  data: ArrayBuffer | Uint8Array | Blob,
  options: ImportVelxioOptions = {},
): Promise<BoardModel> => {
  const archive = await readVelxioArchive(data, options.fileName);
  const resolver = options.resolver ?? createDefaultPartResolver(options.resolverOptions);

  const partTypes = archive.diagram.parts.map((part) => part.type);
  const resolution = await resolver(partTypes);
  const specs = new Map(resolution.resolved.map((spec) => [spec.partType, spec]));

  return buildBoardModel({
    fileName: options.fileName ?? archive.fileName,
    importedAt: options.importedAt ?? new Date().toISOString(),
    diagram: archive.diagram,
    sketch: archive.sketch,
    specs,
    missingPartTypes: resolution.missing,
  });
};
