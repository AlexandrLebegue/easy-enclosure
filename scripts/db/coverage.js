'use strict';

const { computeCoverage } = require('./lib');

function main() {
  const { total, covered, missing, estimated, extra, index } = computeCoverage();
  const percent = total === 0 ? 0 : Math.round((covered.length / total) * 1000) / 10;

  console.log(`Velxio observed types : ${total}`);
  console.log(`Covered                : ${covered.length} (${percent}%)`);
  console.log(`Estimated              : ${estimated.length}`);
  console.log(`Missing                : ${missing.length}`);
  console.log(`Extra (not observed)   : ${extra.length}`);
  if (!index) {
    console.log('\nNo index found: run `npm run db:build` first.');
  }
  if (missing.length > 0) {
    console.log('\nMissing part types:');
    for (const partType of missing) console.log(`  - ${partType}`);
  }
  if (estimated.length > 0) {
    console.log('\nEstimated part types:');
    for (const partType of estimated) console.log(`  ~ ${partType}`);
  }
  if (extra.length > 0) {
    console.log('\nIndexed but not in data/velxio-types.json:');
    for (const partType of extra) console.log(`  + ${partType}`);
  }
}

main();
