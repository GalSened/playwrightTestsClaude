/**
 * Schema Validation Script
 * Validates all A2A envelope schemas compile correctly with cross-references
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_DIR = join(__dirname, '../src/a2a/envelopes/schemas');

// Initialize AJV with same config as production
const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictSchema: true,
  strictRequired: true,
  strictTypes: false,
  allowUnionTypes: true,
  validateFormats: true,
  $data: true,
});

addFormats(ajv);

console.log('🔍 Validating A2A envelope schemas...\n');

// Step 1: Load all schema files
const schemaFiles = readdirSync(SCHEMA_DIR)
  .filter(f => f.endsWith('.schema.json'))
  .sort();

console.log(`Found ${schemaFiles.length} schema files:`);
schemaFiles.forEach(f => console.log(`  - ${f}`));
console.log('');

// Step 2: Parse and register all schemas
const loadedSchemas: Array<{ filename: string; schemaId: string }> = [];

for (const filename of schemaFiles) {
  const filepath = join(SCHEMA_DIR, filename);
  const content = readFileSync(filepath, 'utf-8');
  const schema = JSON.parse(content);

  // Force $id to match filename for consistent resolution
  schema.$id = filename;

  try {
    ajv.addSchema(schema, schema.$id);
    loadedSchemas.push({ filename, schemaId: schema.$id });
    console.log(`✅ Registered: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to register ${filename}:`);
    console.error(`   ${(error as Error).message}`);
    process.exit(1);
  }
}

console.log('');

// Step 3: Compile all schemas to verify cross-references work
console.log('Compiling schemas to verify cross-references...\n');

for (const { filename, schemaId } of loadedSchemas) {
  try {
    const validator = ajv.getSchema(schemaId);
    if (!validator) {
      throw new Error(`Schema not found after registration: ${schemaId}`);
    }

    // Test compilation by validating an empty object (will fail but proves compilation works)
    validator({});

    console.log(`✅ Compiled: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to compile ${filename}:`);
    console.error(`   ${(error as Error).message}`);
    process.exit(1);
  }
}

console.log('');
console.log(`🎉 Successfully validated ${loadedSchemas.length} schemas with cross-references!`);
console.log('');

process.exit(0);
