import { buildEnclosureSpec, type BuildEnclosureOptions } from '../layout/enclosure-spec-builder';
import type { BoardModel, EnclosureSpec, ImportWarning } from '../model/enclosure.types';
import { generateEnclosureStlBlob } from './enclosure-mesh';
import { importVelxioZip, type ImportVelxioOptions } from './velxio-import';

export interface EnclosurePipelineOptions {
  import?: ImportVelxioOptions;
  build?: BuildEnclosureOptions;
}

export interface EnclosureProject {
  board: BoardModel;
  spec: EnclosureSpec;
  warnings: ImportWarning[];
  stl: Blob;
}

/** Build the spec and STL from an already imported BoardModel. */
export const generateEnclosureFromBoard = (
  board: BoardModel,
  options: BuildEnclosureOptions = {},
): Omit<EnclosureProject, 'board'> => {
  const { spec, warnings } = buildEnclosureSpec(board, options);
  return {
    spec,
    warnings: [...board.warnings, ...warnings],
    stl: generateEnclosureStlBlob(spec),
  };
};

/**
 * End-to-end entry point used by the UI layer: Velxio zip in, printable STL out.
 * No geometry is produced here directly; it all goes through the JSCAD engine.
 */
export const importAndGenerateEnclosure = async (
  data: ArrayBuffer | Uint8Array | Blob,
  options: EnclosurePipelineOptions = {},
): Promise<EnclosureProject> => {
  const board = await importVelxioZip(data, options.import);
  return {
    board,
    ...generateEnclosureFromBoard(board, options.build),
  };
};
