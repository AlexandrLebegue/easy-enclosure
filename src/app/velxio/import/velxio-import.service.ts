import { Injectable } from '@angular/core';

import { buildEnclosureSpec, type BuildEnclosureOptions } from '../layout/enclosure-spec-builder';
import type { EnclosureSpec, ImportWarning } from '../model/enclosure.types';
import { importVelxioZip, type ImportVelxioOptions } from './velxio-import';

export interface ImportedVelxioProject {
  spec: EnclosureSpec;
  warnings: ImportWarning[];
  partCount: number;
}

export interface VelxioImportRequest {
  import?: ImportVelxioOptions;
  build?: BuildEnclosureOptions;
}

/**
 * Import zip Velxio -> BoardModel -> EnclosureSpec, sans générer le STL :
 * le renderer reconstruit la géométrie depuis les Params mis à jour.
 */
@Injectable({ providedIn: 'root' })
export class VelxioImportService {
  async importZip(
    data: ArrayBuffer | Uint8Array | Blob,
    request: VelxioImportRequest = {},
  ): Promise<ImportedVelxioProject> {
    const board = await importVelxioZip(data, request.import);
    const { spec, warnings } = buildEnclosureSpec(board, request.build);
    return {
      spec,
      warnings: [...board.warnings, ...warnings],
      partCount: board.parts.length,
    };
  }
}
