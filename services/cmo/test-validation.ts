import { validateTaskRequest } from './src/a2a/envelopes/index.js';

const envelope = {
  meta: {
    a2a_version: '1.0',
    message_id: 'a1b2c3d4e5f6789012345678901234',
    trace_id: 'trace-001',
    ts: '2025-01-15T10:30:00.000Z',
    from: { id: 'cmo-001', type: 'cmo', version: '1.0.0' },
    to: [{ id: 'spec-001', type: 'specialist', version: '1.0.0' }],
    tenant: 'wesign',
    project: 'qa-platform',
    type: 'TaskRequest'
  },
  payload: {
    task: 'code-review',
    inputs: { pr_number: 123, repo: 'wesign/qa-platform' }
  }
};

const result = validateTaskRequest(envelope);
console.log('Valid:', result.valid);
if (!result.valid) {
  console.log('Error Code:', result.errorCode);
  console.log('Error Message:', result.error);
  console.log('Detailed Errors:');
  result.errors?.forEach(err => {
    console.log(`  - ${err.path}: ${err.message}`);
  });
}
