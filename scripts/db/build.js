'use strict';

const { build, INDEX_FILE, REPORT_FILE, ROOT } = require('./lib');

function main() {
  const { report, index } = build();
  const errors = report.issues.filter((issue) => issue.severity === 'error');
  const warnings = report.issues.filter((issue) => issue.severity === 'warning');

  console.log(`Checked ${report.checked} component file(s).`);
  if (index) {
    console.log(`Wrote ${index.count} component(s) to ${relative(INDEX_FILE)}.`);
  }
  console.log(`Wrote validation report to ${relative(REPORT_FILE)}.`);
  if (warnings.length > 0) console.log(`Warnings: ${warnings.length}`);
  if (errors.length > 0) {
    console.error(`Errors: ${errors.length}`);
    for (const issue of errors) {
      console.error(`  [${issue.code}] ${issue.partType}: ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Validation OK.');
}

function relative(file) {
  return require('node:path').relative(ROOT, file).split(require('node:path').sep).join('/');
}

main();
