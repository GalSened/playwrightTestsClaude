#!/usr/bin/env node
/**
 * Codemod: Normalize topic entries in envelope fixtures
 *
 * Transforms legacy topic formats to schema-compliant:
 * - {topic: "qa..."} → {type: "topic", name: "qa..."}
 * - {name: "qa..."} → {type: "topic", name: "qa..."}
 * - "qa..." → {type: "topic", name: "qa..."}
 */

const fs = require('fs');
const path = require('path');

const DIRS = [
  path.join(__dirname, '../../services/cmo/test/fixtures/envelopes/valid'),
  path.join(__dirname, '../../services/cmo/test/fixtures/envelopes/invalid'),
];

console.log('📝 Normalizing topic entries in fixtures...\n');

let patchedCount = 0;

function patchToArray(envelope) {
  if (!envelope.meta || !Array.isArray(envelope.meta.to)) return envelope;

  envelope.meta.to = envelope.meta.to.map(item => {
    if (!item || typeof item !== 'object') {
      // String format
      if (typeof item === 'string' && item.startsWith('qa.')) {
        return { type: 'topic', name: item };
      }
      return item;
    }

    // Legacy {topic: "..."} format
    if (item.topic && typeof item.topic === 'string') {
      return { type: 'topic', name: item.topic };
    }

    // Legacy {name: "..."} without type
    if (item.name && typeof item.name === 'string' && !item.type) {
      return { type: 'topic', name: item.name };
    }

    // Already correct or agent ID format
    return item;
  });

  return envelope;
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  Directory not found: ${dir}`);
    return;
  }

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
    const before = content;
    let data = JSON.parse(content);

    data = patchToArray(data);

    const after = JSON.stringify(data, null, 2) + '\n';

    if (after !== before) {
      fs.writeFileSync(filePath, after);
      console.log(`✅ Patched topics: ${path.basename(filePath)}`);
      patchedCount++;
    }
  } catch (error) {
    console.warn(`⚠️  Skipped ${path.basename(filePath)}: ${error.message}`);
  }
}

for (const dir of DIRS) {
  walkDir(dir);
}

console.log(`\n✅ Normalized ${patchedCount} fixture files\n`);
