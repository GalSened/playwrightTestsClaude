import { validateEnvelope } from './src/a2a/envelopes/index.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const fixturesDir = join(__dirname, 'test/fixtures/envelopes/valid');
const files = readdirSync(fixturesDir).filter(f => f.endsWith('.json'));

console.log('Testing all valid fixtures:\n');

let passed = 0;
let failed = 0;

for (const file of files) {
  const envelope = JSON.parse(readFileSync(join(fixturesDir, file), 'utf-8'));
  const result = validateEnvelope(envelope);
  
  if (result.valid) {
    console.log(`✅ ${file}`);
    passed++;
  } else {
    console.log(`❌ ${file}`);
    console.log(`   Error: ${result.error}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} fixtures`);
