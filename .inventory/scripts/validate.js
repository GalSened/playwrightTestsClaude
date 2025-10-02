#!/usr/bin/env node

/**
 * JSON Schema validator for tech inventory reports
 * Uses ajv for strict validation
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Configuration
 */
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCHEMA_FILE = path.join(REPO_ROOT, '.inventory', 'report.schema.json');
const REPORT_FILE = path.join(REPO_ROOT, '.inventory', 'report.json');

/**
 * Main validation function
 */
async function validate() {
  console.log('🔍 QA Intelligence Report Validator');
  console.log('━'.repeat(80));
  console.log('');

  try {
    // Check if ajv is available
    let Ajv, addFormats;
    try {
      Ajv = require('ajv');
      addFormats = require('ajv-formats');
    } catch (error) {
      console.error('❌ Error: ajv and ajv-formats are required');
      console.error('');
      console.error('Install with:');
      console.error('  npm install --save-dev ajv ajv-formats');
      console.error('');
      process.exit(1);
    }

    // Step 1: Load schema
    console.log('⏳ Step 1/3: Loading schema...');
    const schemaContent = await fs.readFile(SCHEMA_FILE, 'utf8');
    const schema = JSON.parse(schemaContent);
    console.log(`   ✅ Schema loaded: ${path.relative(REPO_ROOT, SCHEMA_FILE)}`);
    console.log('');

    // Step 2: Load report
    console.log('⏳ Step 2/3: Loading report...');
    let reportExists = true;
    try {
      await fs.access(REPORT_FILE);
    } catch {
      reportExists = false;
    }

    if (!reportExists) {
      console.error(`   ❌ Report not found: ${path.relative(REPO_ROOT, REPORT_FILE)}`);
      console.error('');
      console.error('Generate report first:');
      console.error('  npm run scan');
      console.error('');
      process.exit(1);
    }

    const reportContent = await fs.readFile(REPORT_FILE, 'utf8');
    const report = JSON.parse(reportContent);
    console.log(`   ✅ Report loaded: ${path.relative(REPO_ROOT, REPORT_FILE)}`);
    console.log('');

    // Step 3: Validate
    console.log('⏳ Step 3/3: Validating report against schema...');
    const ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    const validateFn = ajv.compile(schema);
    const valid = validateFn(report);

    console.log('');

    if (!valid) {
      console.log('❌ VALIDATION FAILED');
      console.log('━'.repeat(80));
      console.log('');
      console.log('Errors:');
      validateFn.errors.forEach((err, idx) => {
        console.log(`  ${idx + 1}. ${err.instancePath || 'root'}: ${err.message}`);
        if (err.params) {
          console.log(`     Params: ${JSON.stringify(err.params)}`);
        }
      });
      console.log('');
      console.log('Fix these errors and run again:');
      console.log('  npm run scan && npm run validate');
      console.log('');
      process.exit(1);
    }

    // Success!
    console.log('✅ VALIDATION PASSED');
    console.log('━'.repeat(80));
    console.log('');
    console.log('Report is valid and conforms to schema v' + schema.version);
    console.log('');

    // Print key metrics
    printMetrics(report);

    console.log('━'.repeat(80));
    console.log('✅ Validation complete!');
    console.log('');

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Print key metrics from report
 */
function printMetrics(report) {
  console.log('📊 Key Metrics:');
  console.log('');

  const totalFiles =
    report.languages.typescript +
    report.languages.javascript +
    report.languages.python +
    report.languages.go;

  console.log(`   Total Files:        ${totalFiles}`);
  console.log(`   Lockfiles:          ${report.lockfiles.length}`);
  console.log(`   Frameworks:         ${(report.frameworks.backend.length + report.frameworks.frontend.length)}`);
  console.log(`   Test Artifacts:     ${Object.values(report.testing).flat().length}`);
  console.log(`   IaC Files:          ${report.infra.helm.length + report.infra.terraform.length + report.infra.kubernetes.length}`);
  console.log(`   API Contracts:      ${report.api_contracts.openapi.length + report.api_contracts.swagger.length}`);
  console.log('');

  console.log(`   Recommendation:     ${report.recommendation.language}`);
  console.log(`   Confidence:         ${(report.recommendation.confidence * 100).toFixed(1)}%`);
  console.log(`   Fallback:           ${report.recommendation.fallback}`);
  console.log('');
}

// Run validator
if (require.main === module) {
  validate().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { validate };
