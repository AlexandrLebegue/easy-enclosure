'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const COMPONENTS_DIR = path.join(ROOT, 'data', 'components');
const INDEX_FILE = path.join(ROOT, 'data', 'components.index.json');
const REPORT_FILE = path.join(ROOT, 'data', 'components-report.json');
const VELXIO_TYPES_FILE = path.join(ROOT, 'data', 'velxio-types.json');

const CATEGORIES = new Set([
  'board',
  'display',
  'sensor',
  'passive',
  'actuator',
  'power',
  'module',
  'other',
]);
const CONFIDENCES = new Set(['verified', 'datasheet', 'estimated']);
const SIDES = new Set(['front', 'back', 'left', 'right', 'top', 'bottom']);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositive(value) {
  return isFiniteNumber(value) && value > 0;
}

function issue(partType, severity, code, message) {
  return { partType: partType || '<unknown>', severity, code, message };
}

function sideLength(spec, side) {
  const envelope = isObject(spec.envelope) ? spec.envelope : {};
  const { widthMm, depthMm } = envelope;
  if (side === 'left' || side === 'right') return depthMm;
  return widthMm;
}

function validateMountHoles(spec, partType, issues) {
  const { mountHoles } = spec;
  if (!Array.isArray(mountHoles)) {
    issues.push(issue(partType, 'error', 'SCHEMA', 'mountHoles must be an array'));
    return;
  }
  const envelope = isObject(spec.envelope) ? spec.envelope : {};
  const { widthMm, depthMm } = envelope;
  for (let i = 0; i < mountHoles.length; i += 1) {
    const hole = mountHoles[i];
    const label = `mountHoles[${i}]`;
    if (!isObject(hole)) {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label} must be an object`));
      continue;
    }
    const fields = ['xMm', 'yMm', 'diameterMm'];
    if (fields.some((field) => !isFiniteNumber(hole[field]))) {
      issues.push(
        issue(partType, 'error', 'SCHEMA', `${label} requires numeric xMm, yMm, diameterMm`),
      );
      continue;
    }
    if (hole.diameterMm <= 0) {
      issues.push(
        issue(partType, 'error', 'NEGATIVE_DIMENSION', `${label}.diameterMm must be > 0`),
      );
    }
    if (
      isPositive(widthMm) &&
      isPositive(depthMm) &&
      (hole.xMm < 0 || hole.xMm > widthMm || hole.yMm < 0 || hole.yMm > depthMm)
    ) {
      issues.push(
        issue(
          partType,
          'error',
          'HOLE_OUTSIDE_ENVELOPE',
          `${label} (${hole.xMm}, ${hole.yMm}) is outside the ${widthMm}x${depthMm} envelope`,
        ),
      );
    }
  }
}

function validateCutouts(spec, partType, issues) {
  const { cutouts } = spec;
  if (!Array.isArray(cutouts)) {
    issues.push(issue(partType, 'error', 'SCHEMA', 'cutouts must be an array'));
    return;
  }
  const seenIds = new Set();
  for (let i = 0; i < cutouts.length; i += 1) {
    const cutout = cutouts[i];
    const label = `cutouts[${i}]`;
    if (!isObject(cutout)) {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label} must be an object`));
      continue;
    }
    if (typeof cutout.id !== 'string' || cutout.id.trim() === '') {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label}.id must be a non-empty string`));
    } else if (seenIds.has(cutout.id)) {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label}.id "${cutout.id}" is duplicated`));
    } else {
      seenIds.add(cutout.id);
    }
    if (!SIDES.has(cutout.side)) {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label}.side is invalid`));
      continue;
    }
    if (
      !isFiniteNumber(cutout.offsetMm) ||
      !isFiniteNumber(cutout.widthMm) ||
      !isFiniteNumber(cutout.heightMm)
    ) {
      issues.push(
        issue(partType, 'error', 'SCHEMA', `${label} requires numeric offsetMm, widthMm, heightMm`),
      );
      continue;
    }
    if (cutout.offsetMm < 0 || cutout.widthMm <= 0 || cutout.heightMm <= 0) {
      issues.push(
        issue(partType, 'error', 'NEGATIVE_DIMENSION', `${label} dimensions must be positive`),
      );
    }
    if (cutout.depthMm !== undefined && (!isFiniteNumber(cutout.depthMm) || cutout.depthMm < 0)) {
      issues.push(issue(partType, 'error', 'NEGATIVE_DIMENSION', `${label}.depthMm must be >= 0`));
    }
    const length = sideLength(spec, cutout.side);
    if (isPositive(length) && (cutout.offsetMm < 0 || cutout.offsetMm + cutout.widthMm > length)) {
      issues.push(
        issue(
          partType,
          'error',
          'CUTOUT_OUTSIDE_SIDE',
          `${label} extends beyond the ${cutout.side} wall (${length} mm)`,
        ),
      );
    }
  }
}

function validateKeepouts(spec, partType, issues) {
  const { keepouts } = spec;
  if (!Array.isArray(keepouts)) {
    issues.push(issue(partType, 'error', 'SCHEMA', 'keepouts must be an array'));
    return;
  }
  for (let i = 0; i < keepouts.length; i += 1) {
    const keepout = keepouts[i];
    const label = `keepouts[${i}]`;
    if (!isObject(keepout)) {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label} must be an object`));
      continue;
    }
    if (!SIDES.has(keepout.side)) {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label}.side is invalid`));
    }
    if (
      !isFiniteNumber(keepout.offsetMm) ||
      !isFiniteNumber(keepout.widthMm) ||
      !isFiniteNumber(keepout.heightMm) ||
      !isPositive(keepout.widthMm) ||
      !isPositive(keepout.heightMm) ||
      keepout.offsetMm < 0
    ) {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label} has invalid dimensions`));
    }
    if (typeof keepout.reason !== 'string' || keepout.reason.trim() === '') {
      issues.push(issue(partType, 'error', 'SCHEMA', `${label}.reason must be a non-empty string`));
    }
  }
}

/**
 * Validate a single ComponentSpec. Returns an array of ValidationIssue.
 * @param {unknown} spec
 * @param {string} [fallbackPartType]
 */
function validateComponent(spec, fallbackPartType) {
  const issues = [];
  if (!isObject(spec)) {
    return [issue(fallbackPartType, 'error', 'SCHEMA', 'component must be a JSON object')];
  }
  const partType =
    typeof spec.partType === 'string' && spec.partType.trim() !== ''
      ? spec.partType
      : fallbackPartType || '<unknown>';
  if (typeof spec.partType !== 'string' || spec.partType.trim() === '') {
    issues.push(issue(partType, 'error', 'SCHEMA', 'partType must be a non-empty string'));
  }
  if (typeof spec.displayName !== 'string' || spec.displayName.trim() === '') {
    issues.push(issue(partType, 'error', 'SCHEMA', 'displayName must be a non-empty string'));
  }
  if (!CATEGORIES.has(spec.category)) {
    issues.push(issue(partType, 'error', 'SCHEMA', `category "${spec.category}" is invalid`));
  }
  if (!isObject(spec.envelope)) {
    issues.push(issue(partType, 'error', 'SCHEMA', 'envelope must be an object'));
  } else {
    for (const field of ['widthMm', 'depthMm', 'heightMm']) {
      if (!isFiniteNumber(spec.envelope[field])) {
        issues.push(issue(partType, 'error', 'SCHEMA', `envelope.${field} must be a number`));
      } else if (spec.envelope[field] <= 0) {
        issues.push(
          issue(partType, 'error', 'NEGATIVE_DIMENSION', `envelope.${field} must be > 0`),
        );
      }
    }
  }
  if (!isObject(spec.provenance)) {
    issues.push(issue(partType, 'error', 'MISSING_PROVENANCE', 'provenance is required'));
  } else {
    if (typeof spec.provenance.license !== 'string' || spec.provenance.license.trim() === '') {
      issues.push(issue(partType, 'error', 'MISSING_PROVENANCE', 'provenance.license is required'));
    }
    if (
      typeof spec.provenance.retrievedAt !== 'string' ||
      Number.isNaN(Date.parse(spec.provenance.retrievedAt))
    ) {
      issues.push(
        issue(
          partType,
          'error',
          'MISSING_PROVENANCE',
          'provenance.retrievedAt must be an ISO-8601 date',
        ),
      );
    }
    if (spec.provenance.url !== undefined && typeof spec.provenance.url !== 'string') {
      issues.push(issue(partType, 'error', 'SCHEMA', 'provenance.url must be a string'));
    }
    if (
      spec.confidence === 'verified' &&
      (typeof spec.provenance.url !== 'string' || spec.provenance.url.trim() === '')
    ) {
      issues.push(
        issue(
          partType,
          'error',
          'MISSING_PROVENANCE',
          'confidence "verified" requires provenance.url',
        ),
      );
    }
  }
  if (!CONFIDENCES.has(spec.confidence)) {
    issues.push(issue(partType, 'error', 'SCHEMA', `confidence "${spec.confidence}" is invalid`));
  }
  if (!Number.isInteger(spec.schemaVersion) || spec.schemaVersion < 1) {
    issues.push(issue(partType, 'error', 'SCHEMA', 'schemaVersion must be an integer >= 1'));
  }
  if (spec.notes !== undefined && typeof spec.notes !== 'string') {
    issues.push(issue(partType, 'error', 'SCHEMA', 'notes must be a string'));
  }
  validateMountHoles(spec, partType, issues);
  validateCutouts(spec, partType, issues);
  validateKeepouts(spec, partType, issues);
  return issues;
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('_')) {
      files.push(full);
    }
  }
  return files.sort();
}

/** Read all component files. Returns { entries, issues }. */
function readComponents() {
  const entries = [];
  const issues = [];
  for (const file of listJsonFiles(COMPONENTS_DIR)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    let spec;
    try {
      spec = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      issues.push(
        issue(
          path.basename(file, '.json'),
          'error',
          'SCHEMA',
          `${rel}: invalid JSON (${error.message})`,
        ),
      );
      continue;
    }
    entries.push({ file, rel, spec });
  }
  return { entries, issues };
}

/** Validate all entries and detect duplicate partTypes across files. */
function validateEntries(entries) {
  const issues = [];
  const byPartType = new Map();
  for (const entry of entries) {
    const fallback = path.basename(entry.file || entry.rel || '', '.json');
    const entryIssues = validateComponent(entry.spec, fallback);
    issues.push(...entryIssues);
    if (isObject(entry.spec) && typeof entry.spec.partType === 'string') {
      const list = byPartType.get(entry.spec.partType) || [];
      list.push(entry.rel || entry.file || fallback);
      byPartType.set(entry.spec.partType, list);
    }
  }
  for (const [partType, files] of byPartType) {
    if (files.length > 1) {
      issues.push(
        issue(
          partType,
          'error',
          'DUPLICATE_PART_TYPE',
          `partType "${partType}" appears in ${files.length} files: ${files.join(', ')}`,
        ),
      );
    }
  }
  return issues;
}

function buildIndex(entries) {
  const byPartType = {};
  for (const entry of entries) {
    byPartType[entry.spec.partType] = {
      file: entry.rel,
      category: entry.spec.category,
      confidence: entry.spec.confidence,
    };
  }
  return {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    byPartType,
  };
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Run the full build. Writes index + report and returns { report, index }. */
function build() {
  const { entries, issues: readIssues } = readComponents();
  const issues = [...readIssues, ...validateEntries(entries)];
  const report = {
    ok: !issues.some((entry) => entry.severity === 'error'),
    checked: entries.length + readIssues.length,
    issues,
  };
  let index = null;
  if (report.ok) {
    index = buildIndex(entries);
    writeJson(INDEX_FILE, index);
  }
  writeJson(REPORT_FILE, report);
  return { report, index };
}

function readIndex() {
  if (!fs.existsSync(INDEX_FILE)) return null;
  return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
}

function readVelxioTypes() {
  return JSON.parse(fs.readFileSync(VELXIO_TYPES_FILE, 'utf8'));
}

/** Map partType -> ComponentSpec, loaded from disk. */
function loadParts() {
  const { entries } = readComponents();
  const map = new Map();
  for (const entry of entries) {
    if (isObject(entry.spec) && typeof entry.spec.partType === 'string') {
      map.set(entry.spec.partType, entry.spec);
    }
  }
  return map;
}

/** Resolve a list of part types. Unknown types are reported as missing. */
function resolvePartTypes(partTypes, parts) {
  const map = parts || loadParts();
  const resolved = [];
  const missing = [];
  const seenMissing = new Set();
  for (const partType of partTypes) {
    const spec = map.get(partType);
    if (spec) {
      if (!resolved.some((item) => item.partType === partType)) resolved.push(spec);
    } else if (!seenMissing.has(partType)) {
      seenMissing.add(partType);
      missing.push(partType);
    }
  }
  return { resolved, missing };
}

function computeCoverage() {
  const index = readIndex();
  const { types } = readVelxioTypes();
  const known = new Set(types);
  const indexed = index ? index.byPartType : {};
  const covered = types.filter((partType) =>
    Object.prototype.hasOwnProperty.call(indexed, partType),
  );
  const missing = types.filter(
    (partType) => !Object.prototype.hasOwnProperty.call(indexed, partType),
  );
  const estimated = covered.filter((partType) => indexed[partType].confidence === 'estimated');
  const extra = Object.keys(indexed)
    .filter((partType) => !known.has(partType))
    .sort();
  return { total: types.length, covered, missing, estimated, extra, index };
}

module.exports = {
  ROOT,
  COMPONENTS_DIR,
  INDEX_FILE,
  REPORT_FILE,
  VELXIO_TYPES_FILE,
  validateComponent,
  validateEntries,
  readComponents,
  build,
  buildIndex,
  writeJson,
  readIndex,
  readVelxioTypes,
  loadParts,
  resolvePartTypes,
  computeCoverage,
};
