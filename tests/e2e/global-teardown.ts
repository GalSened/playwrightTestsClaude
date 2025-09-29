import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Global Teardown for Enterprise E2E Tests
 * Cleans up test data and generates final reports
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Enterprise E2E Test Environment Cleanup...');
  
  // Clean up authentication state
  try {
    if (fs.existsSync('auth-state.json')) {
      fs.unlinkSync('auth-state.json');
      console.log('✅ Authentication state cleaned up');
    }
  } catch (error) {
    console.log('⚠️ Could not clean auth state:', error);
  }
  
  // Generate test summary report
  console.log('📊 Generating test summary report...');
  await generateTestSummary();
  
  // Archive test artifacts
  console.log('📁 Archiving test artifacts...');
  await archiveTestArtifacts();
  
  console.log('✅ Enterprise E2E Test Environment Cleanup Complete!');
}

async function generateTestSummary(): Promise<void> {
  try {
    const reportsDir = '../reports';
    
    // Ensure reports directory exists
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    // Read test results if available
    let testResults = null;
    const resultsPath = path.join(reportsDir, 'test-results.json');
    
    if (fs.existsSync(resultsPath)) {
      testResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
    }
    
    // Generate summary
    const summary = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      testSuite: 'Playwright Smart Enterprise E2E Tests',
      version: '2.0.0',
      summary: testResults ? {
        totalTests: testResults.stats?.total || 0,
        passed: testResults.stats?.passed || 0,
        failed: testResults.stats?.failed || 0,
        skipped: testResults.stats?.skipped || 0,
        duration: testResults.stats?.duration || 0
      } : {
        message: 'Test results not available'
      },
      coverage: {
        target: '100%',
        areas: [
          'Authentication & Authorization',
          'Real-time Features (WebSocket)',
          'API Security & Multi-tenancy',
          'Mobile & Responsive Design',
          'Cross-browser Compatibility',
          'Accessibility (WCAG 2.1)',
          'Performance & Load Testing'
        ]
      },
      artifacts: {
        htmlReport: 'playwright-html-report/index.html',
        junitResults: 'junit-results.xml',
        allureResults: 'allure-results/',
        testArtifacts: 'test-artifacts/'
      }
    };
    
    // Write summary report
    fs.writeFileSync(
      path.join(reportsDir, 'test-summary.json'),
      JSON.stringify(summary, null, 2)
    );
    
    console.log('✅ Test summary report generated');
    
  } catch (error) {
    console.log('⚠️ Could not generate test summary:', error);
  }
}

async function archiveTestArtifacts(): Promise<void> {
  try {
    const reportsDir = '../reports';
    const archiveDir = path.join(reportsDir, 'archive');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create archive directory
    const currentArchiveDir = path.join(archiveDir, `e2e-run-${timestamp}`);
    if (!fs.existsSync(currentArchiveDir)) {
      fs.mkdirSync(currentArchiveDir, { recursive: true });
    }
    
    // List of artifacts to archive
    const artifactsToArchive = [
      'test-summary.json',
      'junit-results.xml',
      'test-results.json'
    ];
    
    // Copy artifacts to archive
    for (const artifact of artifactsToArchive) {
      const sourcePath = path.join(reportsDir, artifact);
      const destPath = path.join(currentArchiveDir, artifact);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
    
    // Create archive metadata
    const archiveMetadata = {
      timestamp,
      testSuite: 'Enterprise E2E Tests',
      environment: process.env.NODE_ENV || 'test',
      artifacts: artifactsToArchive.filter(artifact => 
        fs.existsSync(path.join(reportsDir, artifact))
      )
    };
    
    fs.writeFileSync(
      path.join(currentArchiveDir, 'archive-metadata.json'),
      JSON.stringify(archiveMetadata, null, 2)
    );
    
    console.log(`✅ Test artifacts archived to: ${currentArchiveDir}`);
    
  } catch (error) {
    console.log('⚠️ Could not archive test artifacts:', error);
  }
}

export default globalTeardown;