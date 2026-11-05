import { createExampleVelxioZip, EXAMPLE_COMPONENT_SPECS } from './example-project';
import { createStaticPartResolver } from './part-resolver';
import { VelxioImportService } from './velxio-import.service';

describe('VelxioImportService', () => {
  it('imports a real example zip into a complete EnclosureSpec', async () => {
    const service = new VelxioImportService();
    const zip = await createExampleVelxioZip();

    const project = await service.importZip(zip, {
      import: {
        fileName: 'example.zip',
        importedAt: '2026-11-05T10:00:00Z',
        resolver: createStaticPartResolver(EXAMPLE_COMPONENT_SPECS),
      },
      build: { mode: 'flat', generatedAt: '2026-11-05T10:00:00Z' },
    });

    expect(project.partCount).toBeGreaterThan(0);
    expect(project.spec.mode).toBe('flat');
    expect(project.spec.parts.length).toBe(project.partCount);
    expect(project.spec.cutouts.length).toBeGreaterThan(0);
    expect(project.spec.standoffs.length).toBeGreaterThan(0);
    expect(project.warnings.some((warning) => warning.code === 'CANVAS_SCALE_IGNORED')).toBeTrue();
    expect(project.warnings.some((warning) => warning.code === 'UNKNOWN_PART_TYPE')).toBeFalse();
  });
});
