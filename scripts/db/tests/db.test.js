'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const {
  ROOT,
  validateComponent,
  validateEntries,
  readComponents,
  resolvePartTypes,
  loadParts,
  build,
  computeCoverage,
} = require('../lib');

function validSpec(overrides = {}) {
  return {
    partType: 'test-part',
    displayName: 'Test Part',
    category: 'module',
    envelope: { widthMm: 10, depthMm: 10, heightMm: 5 },
    mountHoles: [],
    cutouts: [],
    keepouts: [],
    provenance: {
      url: 'https://example.com/datasheet.pdf',
      license: 'datasheet',
      retrievedAt: '2026-11-05T00:00:00Z',
    },
    confidence: 'datasheet',
    schemaVersion: 1,
    ...overrides,
  };
}

function codes(issues) {
  return issues.map((issue) => issue.code);
}

test('rejects a negative envelope dimension with NEGATIVE_DIMENSION', () => {
  const issues = validateComponent(
    validSpec({ envelope: { widthMm: -1, depthMm: 10, heightMm: 5 } }),
  );
  assert.ok(issues.some((issue) => issue.code === 'NEGATIVE_DIMENSION'));
  assert.ok(issues.some((issue) => issue.severity === 'error'));
});

test('rejects a mounting hole outside the envelope with HOLE_OUTSIDE_ENVELOPE', () => {
  const issues = validateComponent(validSpec({ mountHoles: [{ xMm: 11, yMm: 5, diameterMm: 3 }] }));
  assert.deepEqual(codes(issues), ['HOLE_OUTSIDE_ENVELOPE']);
});

test('rejects a duplicate partType in two files with DUPLICATE_PART_TYPE', () => {
  const issues = validateEntries([
    { rel: 'a.json', spec: validSpec({ partType: 'duplicate-part' }) },
    { rel: 'b.json', spec: validSpec({ partType: 'duplicate-part' }) },
  ]);
  assert.ok(issues.some((issue) => issue.code === 'DUPLICATE_PART_TYPE'));
});

test('rejects a cutout wider than its wall with CUTOUT_OUTSIDE_SIDE', () => {
  const issues = validateComponent(
    validSpec({
      cutouts: [{ id: 'usb', side: 'front', offsetMm: 8, widthMm: 5, heightMm: 3, label: 'USB' }],
    }),
  );
  assert.deepEqual(codes(issues), ['CUTOUT_OUTSIDE_SIDE']);
});

test('real component database validates with at least 40 components and no errors', () => {
  const { entries, issues: readIssues } = readComponents();
  const issues = [...readIssues, ...validateEntries(entries)];
  const errors = issues.filter((issue) => issue.severity === 'error');
  assert.deepEqual(errors, []);
  assert.ok(entries.length >= 40, `expected >= 40 components, got ${entries.length}`);
});

test('build produces a valid index and report', () => {
  const { report, index } = build();
  assert.equal(report.ok, true);
  assert.ok(report.checked >= 40);
  assert.deepEqual(
    report.issues.filter((issue) => issue.severity === 'error'),
    [],
  );
  assert.ok(index);
  assert.equal(index.count, report.checked);
});

test('build exits non-zero and unpublishes the index on invalid component data', (t) => {
  const badFile = path.join(ROOT, 'data', 'components', 'other', 'zz-invalid-test.json');
  fs.mkdirSync(path.dirname(badFile), { recursive: true });
  fs.writeFileSync(
    badFile,
    JSON.stringify(
      validSpec({
        partType: 'zz-invalid-test',
        envelope: { widthMm: -5, depthMm: 10, heightMm: 5 },
      }),
    ),
  );
  t.after(() => {
    if (fs.existsSync(badFile)) fs.unlinkSync(badFile);
    build();
  });

  const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'db', 'build.js')], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /NEGATIVE_DIMENSION/);
  assert.equal(fs.existsSync(path.join(ROOT, 'data', 'components.index.json')), false);
});

test('priority board aliases and display/servo variants resolve', () => {
  const requested = [
    'board-velxio-esp32',
    'board-velxio-arduino-uno',
    'board-velxio-esp32-c3',
    'board-velxio-rpi-pico',
    'board-velxio-stm32',
    'wokwi-servo-mg996r',
    'velxio-epaper-2-13',
  ];
  const { resolved, missing } = resolvePartTypes(requested, loadParts());
  assert.deepEqual(missing, []);
  assert.equal(resolved.length, requested.length);
});

test('all observed Velxio types are covered, including virtual components', () => {
  const coverage = computeCoverage();
  assert.equal(coverage.covered.length, coverage.total);
  assert.deepEqual(coverage.missing, []);

  const parts = loadParts();
  for (const partType of [
    'velxio-logic-and',
    'velxio-flip-flop-d',
    'velxio-junction',
    'wokwi-opamp-ideal',
  ]) {
    const spec = parts.get(partType);
    assert.ok(spec, `${partType} should be in the database`);
    assert.equal(spec.confidence, 'estimated');
    assert.match(spec.notes || '', /virtual/i);
  }
});

test('resolve returns 4 resolved and 1 missing for 5 requested types', () => {
  const requested = ['wokwi-led', 'wokwi-resistor', 'wokwi-servo', 'wokwi-dht22', 'no-such-part'];
  const { resolved, missing } = resolvePartTypes(requested, loadParts());
  assert.equal(resolved.length, 4);
  assert.deepEqual(
    resolved.map((spec) => spec.partType),
    ['wokwi-led', 'wokwi-resistor', 'wokwi-servo', 'wokwi-dht22'],
  );
  assert.deepEqual(missing, ['no-such-part']);
});

test('read-only HTTP server exposes parts, detail, resolve and 404', async (t) => {
  const port = 4187;
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'db', 'run-server.js')], {
    cwd: ROOT,
    env: { ...process.env, DB_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  t.after(() => {
    child.kill('SIGTERM');
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(`${base}/api/parts`);
      if (response.ok) {
        ready = true;
        const body = await response.json();
        assert.ok(body.count >= 40);
        assert.ok(Array.isArray(body.parts));
        break;
      }
    } catch {
      // server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `server did not start: ${stderr}`);

  const led = await fetch(`${base}/api/parts/wokwi-led`);
  assert.equal(led.status, 200);
  const ledSpec = await led.json();
  assert.equal(ledSpec.partType, 'wokwi-led');
  assert.ok(ledSpec.envelope.widthMm > 0);

  const missingResponse = await fetch(`${base}/api/parts/does-not-exist`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), {
    error: 'NOT_FOUND',
    partType: 'does-not-exist',
  });

  const resolveResponse = await fetch(`${base}/api/parts/resolve`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      partTypes: ['wokwi-led', 'wokwi-buzzer', 'wokwi-servo', 'wokwi-hc-sr04', 'missing-part'],
    }),
  });
  assert.equal(resolveResponse.status, 200);
  const resolved = await resolveResponse.json();
  assert.equal(resolved.resolved.length, 4);
  assert.deepEqual(resolved.missing, ['missing-part']);
});
