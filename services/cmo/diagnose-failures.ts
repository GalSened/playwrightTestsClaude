import { readFileSync } from 'fs';
import { validateEnvelope } from './src/a2a/envelopes/index.js';

const failingFixtures = [
  'test/fixtures/envelopes/valid/system-event.json',
  'test/fixtures/envelopes/valid/memory-event.json',
  'test/fixtures/envelopes/valid/context-slice-request.json',
  'test/fixtures/envelopes/valid/context-slice-response.json',
  'test/fixtures/envelopes/valid/registry-heartbeat.json',
  'test/fixtures/envelopes/valid/registry-discovery-response.json',
  'test/fixtures/envelopes/valid/specialist-event-notification.json',
];

for (const fixturePath of failingFixtures) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Fixture: ${fixturePath}`);
  console.log('='.repeat(60));

  try {
    const envelope = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const result = validateEnvelope(envelope);

    console.log(`Valid: ${result.valid}`);
    if (!result.valid) {
      console.log(`Error Code: ${result.errorCode}`);
      console.log(`Error: ${result.error}`);
    }
  } catch (err) {
    console.error(`Failed to process: ${err.message}`);
  }
}
