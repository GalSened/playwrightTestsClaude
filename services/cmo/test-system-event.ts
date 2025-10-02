import { validateEnvelope } from './src/a2a/envelopes/index.js';
import { readFileSync } from 'fs';

const envelope = JSON.parse(readFileSync('./test/fixtures/envelopes/valid/system-event.json', 'utf-8'));
const result = validateEnvelope(envelope);

console.log('Valid:', result.valid);
if (!result.valid) {
  console.log('Error Code:', result.errorCode);
  console.log('Error Message:', result.error);
  console.log('Detailed Errors:');
  result.errors?.forEach(err => {
    console.log(`  - ${err.path}: ${err.message}`);
  });
}
console.log('\nPayload:', JSON.stringify(envelope.payload, null, 2));
