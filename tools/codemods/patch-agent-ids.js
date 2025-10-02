#!/usr/bin/env node

/**
 * Codemod: Normalize Agent IDs to match AgentId.schema.json requirements
 *
 * Fixes:
 * 1. from.type: "service" → "system" (enum compliance)
 * 2. to[].type: "service" → "system" (enum compliance)
 * 3. Agent IDs: replace dots and @ with hyphens (pattern: ^[a-z0-9_-]+$)
 *
 * Usage: node tools/codemods/patch-agent-ids.js
 */

const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, '../../services/cmo/test/fixtures/envelopes/valid');

function normalizeAgentId(id) {
  if (!id || typeof id !== 'string') return id;

  // Replace dots and @ with hyphens to match pattern ^[a-z0-9_-]+$
  return id.replace(/[.@]/g, '-');
}

function patchAgentType(agent) {
  if (!agent || typeof agent !== 'object') return agent;

  // Fix type: "service" → "system"
  if (agent.type === 'service') {
    agent.type = 'system';
  }

  // Normalize ID pattern
  if (agent.id) {
    agent.id = normalizeAgentId(agent.id);
  }

  return agent;
}

function patchEnvelope(envelope) {
  if (!envelope.meta) return envelope;

  let modified = false;

  // Fix from field
  if (envelope.meta.from) {
    const oldFrom = JSON.stringify(envelope.meta.from);
    envelope.meta.from = patchAgentType(envelope.meta.from);
    if (JSON.stringify(envelope.meta.from) !== oldFrom) {
      modified = true;
    }
  }

  // Fix to array
  if (Array.isArray(envelope.meta.to)) {
    envelope.meta.to = envelope.meta.to.map(item => {
      // Only patch agent IDs, not topics
      if (item.type !== 'topic') {
        const oldItem = JSON.stringify(item);
        const patched = patchAgentType(item);
        if (JSON.stringify(patched) !== oldItem) {
          modified = true;
        }
        return patched;
      }
      return item;
    });
  }

  return { envelope, modified };
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const envelope = JSON.parse(content);

  const { envelope: patched, modified } = patchEnvelope(envelope);

  if (modified) {
    fs.writeFileSync(filePath, JSON.stringify(patched, null, 2) + '\n', 'utf-8');
    console.log(`✅ Patched: ${path.basename(filePath)}`);
    return 1;
  } else {
    console.log(`⏭️  Skipped: ${path.basename(filePath)} (no changes needed)`);
    return 0;
  }
}

function main() {
  console.log('🔧 Patching Agent IDs in fixtures...\n');

  const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));
  let patchedCount = 0;

  for (const file of files) {
    const filePath = path.join(fixturesDir, file);
    patchedCount += processFile(filePath);
  }

  console.log(`\n✨ Done! Patched ${patchedCount} file(s).`);
}

main();
