#!/usr/bin/env node

/**
 * QA Intelligence Tech Stack Scanner
 * Cross-platform, deterministic inventory scanner
 * No shell dependencies - pure Node.js
 */

const fs = require('fs').promises;
const path = require('path');
const { walkFiles } = require('./utils/fs-walker');
const { detectAll } = require('./utils/detectors');
const { calculateScores } = require('./utils/scoring');

/**
 * Configuration
 */
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUTPUT_FILE = path.join(REPO_ROOT, '.inventory', 'report.json');
const SCHEMA_VERSION = '1.0.0';

/**
 * Main scanner function
 */
async function scan() {
  console.log('🔍 QA Intelligence Tech Stack Scanner v' + SCHEMA_VERSION);
  console.log('━'.repeat(80));
  console.log(`📁 Scanning: ${REPO_ROOT}`);
  console.log('');

  try {
    // Step 1: Walk file tree
    console.log('⏳ Step 1/4: Walking file tree...');
    const startWalk = Date.now();
    const files = await walkFiles(REPO_ROOT);
    const walkDuration = ((Date.now() - startWalk) / 1000).toFixed(2);
    console.log(`   ✅ Found ${files.length} files (${walkDuration}s)`);
    console.log('');

    // Step 2: Run detectors
    console.log('⏳ Step 2/4: Running detectors...');
    const startDetect = Date.now();
    const detections = await detectAll(files, REPO_ROOT);
    const detectDuration = ((Date.now() - startDetect) / 1000).toFixed(2);
    console.log(`   ✅ Detection complete (${detectDuration}s)`);
    console.log('');

    // Step 3: Calculate scores
    console.log('⏳ Step 3/4: Calculating confidence scores...');
    const startScore = Date.now();
    const recommendation = calculateScores(detections);
    const scoreDuration = ((Date.now() - startScore) / 1000).toFixed(2);
    console.log(`   ✅ Scoring complete (${scoreDuration}s)`);
    console.log('');

    // Step 4: Generate report
    console.log('⏳ Step 4/4: Generating report...');
    const report = {
      version: SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
      ...detections,
      recommendation
    };

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(outputDir, { recursive: true });

    // Write report
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(report, null, 2));
    console.log(`   ✅ Report written to: ${path.relative(REPO_ROOT, OUTPUT_FILE)}`);
    console.log('');

    // Print summary
    printSummary(detections, recommendation);

    // Print recommendation
    printRecommendation(recommendation);

    console.log('━'.repeat(80));
    console.log('✅ Scan complete!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Validate: npm run validate');
    console.log('  2. Review:   cat .inventory/report.json');
    console.log('');

  } catch (error) {
    console.error('❌ Scan failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Print scan summary
 */
function printSummary(detections, recommendation) {
  console.log('📊 SCAN SUMMARY');
  console.log('━'.repeat(80));

  // Languages
  const { languages, lockfiles, frameworks, testing, infra, api_contracts, security } = detections;
  const totalFiles = languages.typescript + languages.javascript + languages.python + languages.go;

  console.log('');
  console.log('📝 Languages:');
  console.log(`   TypeScript: ${languages.typescript} files (${((languages.typescript / totalFiles) * 100).toFixed(1)}%)`);
  console.log(`   JavaScript: ${languages.javascript} files (${((languages.javascript / totalFiles) * 100).toFixed(1)}%)`);
  console.log(`   Python:     ${languages.python} files (${((languages.python / totalFiles) * 100).toFixed(1)}%)`);
  console.log(`   Go:         ${languages.go} files (${((languages.go / totalFiles) * 100).toFixed(1)}%)`);

  // Frameworks
  console.log('');
  console.log('🚀 Frameworks:');
  if (frameworks.backend.length > 0) {
    console.log(`   Backend:  ${frameworks.backend.join(', ')}`);
  }
  if (frameworks.frontend.length > 0) {
    console.log(`   Frontend: ${frameworks.frontend.join(', ')}`);
  }
  if (frameworks.backend.length === 0 && frameworks.frontend.length === 0) {
    console.log('   None detected');
  }

  // Testing
  console.log('');
  console.log('🧪 Testing:');
  console.log(`   Playwright TS:        ${testing.playwright_ts.length} files`);
  console.log(`   Playwright Python:    ${testing.playwright_py.length} files`);
  console.log(`   Postman Collections:  ${testing.postman_collections.length} files`);
  console.log(`   k6 Scripts:           ${testing.k6_scripts.length} files`);

  // Infrastructure
  console.log('');
  console.log('🏗️  Infrastructure:');
  console.log(`   Helm:       ${infra.helm.length} files`);
  console.log(`   Terraform:  ${infra.terraform.length} files`);
  console.log(`   Kubernetes: ${infra.kubernetes.length} files`);
  console.log(`   Docker:     ${infra.docker.length} files`);

  // Infrastructure components
  const activeInfra = Object.entries(infra)
    .filter(([key, value]) => typeof value === 'boolean' && value)
    .map(([key]) => key);

  if (activeInfra.length > 0) {
    console.log('');
    console.log('   Components: ' + activeInfra.join(', '));
  }

  // API Contracts
  console.log('');
  console.log('📄 API Contracts:');
  console.log(`   OpenAPI: ${api_contracts.openapi.length} files`);
  console.log(`   Swagger: ${api_contracts.swagger.length} files`);

  // Security
  console.log('');
  console.log('🔒 Security:');
  console.log(`   Env Files:       ${security.env_files.length} files`);
  console.log(`   License Files:   ${security.license_files.length} files`);
  console.log(`   Secret Patterns: ${security.secret_patterns.length} files (⚠️  review recommended)`);

  console.log('');
}

/**
 * Print recommendation
 */
function printRecommendation(recommendation) {
  console.log('🎯 RECOMMENDATION');
  console.log('━'.repeat(80));
  console.log('');
  console.log(`   Language:   ${recommendation.language}`);
  console.log(`   Confidence: ${(recommendation.confidence * 100).toFixed(1)}%`);
  console.log(`   Fallback:   ${recommendation.fallback}`);
  console.log('');

  console.log('📊 Scores:');
  console.log(`   TypeScript: ${(recommendation.scores.typescript * 100).toFixed(1)}%`);
  console.log(`   Python:     ${(recommendation.scores.python * 100).toFixed(1)}%`);
  console.log(`   Go:         ${(recommendation.scores.go * 100).toFixed(1)}%`);
  console.log('');

  console.log('💡 Rationale:');
  recommendation.rationale.forEach((line, idx) => {
    console.log(`   ${idx + 1}. ${line}`);
  });
  console.log('');

  if (recommendation.libraries && Object.keys(recommendation.libraries).length > 0) {
    console.log('📚 Recommended Libraries:');
    Object.entries(recommendation.libraries).forEach(([component, library]) => {
      const formattedComponent = component.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      console.log(`   ${formattedComponent.padEnd(20)} → ${library}`);
    });
    console.log('');
  }
}

// Run scanner
if (require.main === module) {
  scan().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { scan };
