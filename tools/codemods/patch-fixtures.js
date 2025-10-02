#!/usr/bin/env node
/**
 * Codemod: Patch envelope fixtures to match finalized schemas
 *
 * Transforms:
 * - Ensure message_id is 32 lowercase hex chars
 * - task_type → task
 * - parameters → inputs
 * - memory_id → memory_key
 * - ContextSliceRequest → ContextRequest with query object
 * - ContextSliceResponse → ContextResult with results array
 */

const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, '../../services/cmo/test/fixtures/envelopes');

console.log('📝 Patching envelope fixtures...\n');

let patchedCount = 0;

function walkDir(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.json')) {
      patchFixture(filePath);
    }
  }
}

function patchFixture(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let data = JSON.parse(content);
    let modified = false;

    // Fix message_id format - must be 32 lowercase hex chars
    if (data.meta && data.meta.message_id) {
      const msgId = data.meta.message_id;
      if (msgId.length < 32 || !/^[a-f0-9]{32}$/.test(msgId)) {
        // Pad or regenerate to 32 hex chars
        const padded = msgId.replace(/-/g, '').toLowerCase().padEnd(32, '0').slice(0, 32);
        data.meta.message_id = padded;
        modified = true;
      }
    }

    // Fix reply_to format if present
    if (data.meta && data.meta.reply_to) {
      const replyTo = data.meta.reply_to;
      if (replyTo.length < 32 || !/^[a-f0-9]{32}$/.test(replyTo)) {
        const padded = replyTo.replace(/-/g, '').toLowerCase().padEnd(32, '0').slice(0, 32);
        data.meta.reply_to = padded;
        modified = true;
      }
    }

    // TaskRequest/TaskResult: task_type → task, parameters → inputs
    if (data.payload) {
      if (data.payload.task_type) {
        data.payload.task = data.payload.task_type;
        delete data.payload.task_type;
        modified = true;
      }

      if (data.payload.parameters) {
        data.payload.inputs = data.payload.parameters;
        delete data.payload.parameters;
        modified = true;
      }

      // MemoryEvent: memory_id → memory_key, details → value
      if (data.payload.memory_id) {
        data.payload.memory_key = `test_memory/${data.payload.memory_id}`;
        delete data.payload.memory_id;
        modified = true;
      }

      if (data.payload.event_type === 'memory_added') {
        data.payload.event_type = 'created';
        modified = true;
      }

      if (data.payload.details && data.payload.event_type) {
        data.payload.value = data.payload.details;
        delete data.payload.details;
        modified = true;
      }

      // ContextSliceRequest → ContextRequest
      if (data.meta.type === 'ContextSliceRequest') {
        data.meta.type = 'ContextRequest';
        modified = true;

        // Transform payload to query structure
        if (data.payload.slice_id || data.payload.filters) {
          const newPayload = {
            query: {
              type: 'semantic',
              text: data.payload.slice_id || 'context query',
              filters: data.payload.filters || {}
            },
            limit: data.payload.max_items || 100,
            include_scores: true
          };
          data.payload = newPayload;
          modified = true;
        }
      }

      // ContextSliceResponse → ContextResult
      if (data.meta.type === 'ContextSliceResponse') {
        data.meta.type = 'ContextResult';
        modified = true;

        // Transform payload to results structure
        if (data.payload.items) {
          const results = data.payload.items.map((item, idx) => ({
            id: item.id || `result-${idx}`,
            content: item.content || item,
            score: 0.9,
            metadata: item.tags ? { tags: item.tags } : {}
          }));

          data.payload = {
            results,
            total_count: results.length,
            query_duration_ms: 45
          };
          modified = true;
        }
      }

      // SpecialistInvocationRequest: task as string, budget.max_minutes
      if (data.meta.type === 'SpecialistInvocationRequest') {
        if (data.payload.task && typeof data.payload.task === 'object') {
          data.payload.task = data.payload.task.type || 'specialist-task';
          modified = true;
        }

        if (data.payload.budget) {
          if (data.payload.budget.max_duration_ms) {
            data.payload.budget.max_minutes = data.payload.budget.max_duration_ms / 60000;
            delete data.payload.budget.max_duration_ms;
            modified = true;
          }
          if (data.payload.budget.max_cost_cents) {
            data.payload.budget.max_cost_usd = data.payload.budget.max_cost_cents / 100;
            delete data.payload.budget.max_cost_cents;
            modified = true;
          }
        }
      }

      // SpecialistInvocationResult → SpecialistResult
      if (data.meta.type === 'SpecialistInvocationResult') {
        data.meta.type = 'SpecialistResult';
        modified = true;

        // Add required fields
        if (!data.payload.task) {
          data.payload.task = 'specialist-task';
          modified = true;
        }
        if (!data.payload.confidence) {
          data.payload.confidence = 0.95;
          modified = true;
        }
        if (data.payload.result) {
          data.payload.proposal = data.payload.result;
          delete data.payload.result;
          modified = true;
        }
        if (data.payload.cost_cents || data.payload.duration_ms || data.payload.metadata) {
          data.payload.metrics = {
            duration_ms: data.payload.duration_ms,
            cost_usd: data.payload.cost_cents ? data.payload.cost_cents / 100 : undefined,
            ...(data.payload.metadata || {})
          };
          delete data.payload.duration_ms;
          delete data.payload.cost_cents;
          delete data.payload.metadata;
          modified = true;
        }
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
      console.log(`✅ Patched: ${path.relative(fixturesDir, filePath)}`);
      patchedCount++;
    }
  } catch (error) {
    console.warn(`⚠️  Skipped ${filePath}: ${error.message}`);
  }
}

walkDir(fixturesDir);

console.log(`\n✅ Patched ${patchedCount} fixture files\n`);
