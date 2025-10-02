#!/usr/bin/env node
/**
 * Codemod: Patch envelope tests to match finalized schemas
 *
 * Transforms:
 * - task_type → task
 * - parameters → inputs
 * - memory_id → memory_key
 * - slice_id → (context-specific)
 * - ContextSliceRequest → ContextRequest
 * - ContextSliceResponse → ContextResult
 * - Payload structure updates
 */

const fs = require('fs');
const path = require('path');

const testPath = path.join(__dirname, '../../services/cmo/test/a2a/envelopes.spec.ts');

console.log('📝 Patching envelope tests...\n');

let content = fs.readFileSync(testPath, 'utf8');

// Step 1: Field name replacements (exact matches in expectations)
const fieldReplacements = [
  [/\.toHaveProperty\('task_type'\)/g, ".toHaveProperty('task')"],
  [/\.task_type\)/g, ".task)"],
  [/payload\.task_type/g, "payload.task"],

  [/\.toHaveProperty\('parameters'\)/g, ".toHaveProperty('inputs')"],
  [/\.parameters\)/g, ".inputs)"],
  [/payload\.parameters/g, "payload.inputs"],

  [/\.toHaveProperty\('memory_id'\)/g, ".toHaveProperty('memory_key')"],
  [/\.memory_id/g, ".memory_key"],

  [/\.toHaveProperty\('slice_id'\)/g, ".toHaveProperty('results')"],
  [/payload\.slice_id/g, "payload.results[0].id"],
  [/request\.payload\.slice_id/g, "request.payload.query.text"],
  [/response\.payload\.slice_id/g, "response.payload.results[0].id"],
];

fieldReplacements.forEach(([pattern, replacement]) => {
  content = content.replace(pattern, replacement);
});

// Step 2: Type name replacements
content = content.replace(/ContextSliceRequest/g, 'ContextRequest');
content = content.replace(/ContextSliceResponse/g, 'ContextResult');

// Step 3: Specific test fixes based on schema structure
// TaskRequest payload test (lines 80-86)
content = content.replace(
  /expect\(envelope\.payload\)\.toHaveProperty\('task'\);\s+expect\(envelope\.payload\.task\)\.toBe\('code-review'\);\s+expect\(envelope\.payload\)\.toHaveProperty\('inputs'\);/,
  `expect(envelope.payload).toHaveProperty('task');
        expect(envelope.payload.task).toBe('code-review');
        expect(envelope.payload).toHaveProperty('inputs');
        expect(envelope.payload.inputs).toHaveProperty('pr_number');`
);

// MemoryEvent payload test - fix to match schema
content = content.replace(
  /expect\(envelope\.payload\)\.toHaveProperty\('event_type'\);\s+expect\(envelope\.payload\)\.toHaveProperty\('memory_key'\);\s+expect\(envelope\.payload\)\.toHaveProperty\('details'\);/,
  `expect(envelope.payload).toHaveProperty('event_type');
        expect(envelope.payload).toHaveProperty('memory_key');
        expect(envelope.payload).toHaveProperty('value');`
);

// Context correlation test - update to new structure
content = content.replace(
  /expect\(request\.payload\.results\[0\]\.id\)\.toBe\(response\.payload\.results\[0\]\.id\);/,
  `expect(request.payload.query).toBeDefined();
        expect(response.payload.results).toBeDefined();`
);

// SpecialistInvocationRequest payload test
content = content.replace(
  /expect\(envelope\.payload\)\.toHaveProperty\('task'\);\s+expect\(envelope\.payload\.task\)\.toHaveProperty\('type'\);/,
  `expect(envelope.payload).toHaveProperty('task');
        expect(typeof envelope.payload.task).toBe('string');`
);

// SpecialistInvocationResult payload test
content = content.replace(
  /expect\(envelope\.payload\)\.toHaveProperty\('status'\);\s+expect\(envelope\.payload\)\.toHaveProperty\('result'\);\s+expect\(envelope\.payload\)\.toHaveProperty\('duration_ms'\);\s+expect\(envelope\.payload\)\.toHaveProperty\('cost_cents'\);/,
  `expect(envelope.payload).toHaveProperty('status');
        expect(envelope.payload).toHaveProperty('task');
        expect(envelope.payload).toHaveProperty('confidence');
        expect(envelope.payload).toHaveProperty('proposal');`
);

// Edge case test - fix task field
content = content.replace(
  /payload: \{\s+task: 'test',\s+inputs: \{ test: true \},/,
  `payload: {
          task: 'test',
          inputs: { test: true },`
);

// Minimum valid envelope test
content = content.replace(
  /payload: \{\s+task: 'test',\s+inputs: \{\},\s+\}/,
  `payload: {
          task: 'test',
          inputs: {},
        }`
);

// Invalid envelope test - update to expect 'task' instead of 'task_type'
content = content.replace(
  /expect\(result\.error\)\.toContain\('task'\);/g,
  `expect(result.error).toContain('task');`
);

// Programmatic creation test - fix deletion
content = content.replace(
  /delete \(envelope\.payload as any\)\.task;/,
  `delete (envelope.payload as any).task;`
);

fs.writeFileSync(testPath, content);

console.log('✅ Patched', testPath);
console.log('\nChanges applied:');
console.log('  - task_type → task');
console.log('  - parameters → inputs');
console.log('  - memory_id → memory_key');
console.log('  - ContextSliceRequest → ContextRequest');
console.log('  - ContextSliceResponse → ContextResult');
console.log('  - Updated payload structure expectations\n');
