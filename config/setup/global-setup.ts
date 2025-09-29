/**
 * Global Setup for WeSign Test Suite
 * 
 * Handles environment preparation, authentication token generation,
 * test data validation, and system health checks.
 */

import { FullConfig } from '@playwright/test';
import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { wesignConfig } from '../config/wesign-config';

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting WeSign Test Suite Global Setup...');
  
  try {
    // 1. Validate configuration
    await validateConfiguration();
    
    // 2. Setup test directories
    await setupTestDirectories();
    
    // 3. Health check WeSign services
    await performHealthChecks();
    
    // 4. Prepare authentication tokens
    await prepareAuthenticationTokens();
    
    // 5. Validate test assets
    await validateTestAssets();
    
    // 6. Initialize reporting
    await initializeReporting();
    
    // 7. Setup self-healing service
    if (wesignConfig.isFeatureEnabled('selfHealing')) {
      await initializeSelfHealing();
    }
    
    console.log('✅ WeSign Test Suite Global Setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global Setup failed:', error);
    throw error;
  }
}

async function validateConfiguration(): Promise<void> {
  console.log('🔍 Validating WeSign configuration...');
  
  const validation = wesignConfig.validate();
  if (!validation.valid) {
    throw new Error(`Configuration validation failed:\n${validation.errors.join('\n')}`);
  }
  
  console.log(`📋 Environment: ${wesignConfig.environment.name}`);
  console.log(`🌐 Base URL: ${wesignConfig.environment.baseUrl}`);
  console.log(`⚡ Features enabled: ${Object.entries(wesignConfig.features)
    .filter(([, enabled]) => enabled)
    .map(([feature]) => feature)
    .join(', ')}`);
}

async function setupTestDirectories(): Promise<void> {
  console.log('📁 Setting up test directories...');
  
  const directories = [
    'test-results',
    'reports',
    'reports/html',
    'reports/allure-results',
    'reports/screenshots',
    'reports/videos',
    'reports/traces',
    'reports/logs',
    'test-assets',
    'test-assets/documents',
    'test-assets/images',
    'test-assets/certificates',
    'artifacts',
    'artifacts/executions'
  ];

  for (const dir of directories) {
    const fullPath = resolve(process.cwd(), dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
      console.log(`✅ Created directory: ${dir}`);
    }
  }
}

async function performHealthChecks(): Promise<void> {
  console.log('🏥 Performing WeSign service health checks...');
  
  const healthChecks = [
    {
      name: 'WeSign Application',
      url: wesignConfig.environment.baseUrl,
      timeout: 10000
    },
    {
      name: 'WeSign API',
      url: `${wesignConfig.environment.apiUrl}health`,
      timeout: 5000
    }
  ];

  for (const check of healthChecks) {
    try {
      const response = await fetch(check.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'WeSign-Test-Suite/1.0'
        },
        signal: AbortSignal.timeout(check.timeout)
      });
      
      if (response.ok) {
        console.log(`✅ ${check.name}: Healthy (${response.status})`);
      } else {
        console.warn(`⚠️  ${check.name}: Degraded (${response.status})`);
      }
    } catch (error) {
      console.warn(`⚠️  ${check.name}: Unavailable - ${error.message}`);
      // Don't fail setup for health check failures in non-production
      if (wesignConfig.currentEnv === 'production') {
        throw new Error(`Critical service ${check.name} is unavailable`);
      }
    }
  }
}

async function prepareAuthenticationTokens(): Promise<void> {
  console.log('🔐 Preparing authentication tokens...');
  
  // For each user role, we'll prepare authentication state
  const authStates: Record<string, any> = {};
  
  try {
    // In a real implementation, you'd authenticate each user and store tokens
    for (const [role, credentials] of Object.entries(wesignConfig.credentials)) {
      // Simulate authentication preparation
      authStates[role] = {
        email: credentials.email,
        role: credentials.role,
        prepared: true,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Prepared auth state for: ${role}`);
    }
    
    // Save authentication states for test reuse
    const authStatePath = resolve(process.cwd(), 'test-results/auth-states.json');
    writeFileSync(authStatePath, JSON.stringify(authStates, null, 2));
    
  } catch (error) {
    console.warn('⚠️  Authentication preparation failed:', error.message);
    // Continue with setup, tests will handle authentication individually
  }
}

async function validateTestAssets(): Promise<void> {
  console.log('📄 Validating test assets...');
  
  const missingAssets: string[] = [];
  
  for (const [name, asset] of Object.entries(wesignConfig.fileAssets)) {
    if (!existsSync(asset.path)) {
      missingAssets.push(`${name}: ${asset.path}`);
    }
  }
  
  if (missingAssets.length > 0) {
    console.warn('⚠️  Missing test assets:');
    missingAssets.forEach(asset => console.warn(`   - ${asset}`));
    
    // Create placeholder assets for development
    if (wesignConfig.currentEnv === 'development') {
      await createPlaceholderAssets(missingAssets);
    }
  } else {
    console.log('✅ All test assets validated');
  }
}

async function createPlaceholderAssets(missingAssets: string[]): Promise<void> {
  console.log('🔧 Creating placeholder test assets...');
  
  for (const [name, asset] of Object.entries(wesignConfig.fileAssets)) {
    if (!existsSync(asset.path)) {
      const dir = resolve(asset.path, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      // Create minimal placeholder content
      let placeholderContent = '';
      
      switch (asset.type) {
        case 'pdf':
          placeholderContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n182\n%%EOF';
          break;
        case 'image':
          // Create a minimal PNG header
          placeholderContent = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDAT\x08\x1dc\xf8\x00\x00\x00\x01\x00\x01\x02\x03\x00\x00IEND\xaeB`\x82';
          break;
        default:
          placeholderContent = `Placeholder ${asset.type} file for testing`;
      }
      
      writeFileSync(asset.path, placeholderContent, asset.type === 'image' ? undefined : 'utf-8');
      console.log(`✅ Created placeholder: ${name}`);
    }
  }
}

async function initializeReporting(): Promise<void> {
  console.log('📊 Initializing reporting system...');
  
  const reportConfig = {
    startTime: new Date().toISOString(),
    environment: wesignConfig.environment.name,
    configuration: {
      baseUrl: wesignConfig.environment.baseUrl,
      features: wesignConfig.features,
      thresholds: wesignConfig.thresholds
    },
    testSuite: {
      name: 'WeSign E2E Test Suite',
      version: '1.0.0',
      languages: ['hebrew', 'english'],
      browsers: ['chromium', 'firefox', 'webkit']
    }
  };
  
  const reportConfigPath = resolve(process.cwd(), 'reports/suite-config.json');
  writeFileSync(reportConfigPath, JSON.stringify(reportConfig, null, 2));
  
  console.log('✅ Report configuration initialized');
}

async function initializeSelfHealing(): Promise<void> {
  console.log('🔧 Initializing self-healing system...');
  
  try {
    // Check if healing service is available
    const healingHealthUrl = `${wesignConfig.environment.baseUrl.replace(/\/$/, '')}:8081/api/healing/health`;
    
    const response = await fetch(healingHealthUrl, {
      method: 'GET',
      timeout: 5000
    }).catch(() => null);
    
    if (response?.ok) {
      console.log('✅ Self-healing service is available');
      
      // Initialize healing patterns if needed
      const healingConfig = {
        enabled: true,
        confidence_threshold: 0.7,
        max_attempts: 3,
        patterns_initialized: true,
        initialized_at: new Date().toISOString()
      };
      
      const healingConfigPath = resolve(process.cwd(), 'test-results/healing-config.json');
      writeFileSync(healingConfigPath, JSON.stringify(healingConfig, null, 2));
      
    } else {
      console.warn('⚠️  Self-healing service unavailable - running in fallback mode');
    }
  } catch (error) {
    console.warn('⚠️  Self-healing initialization failed:', error.message);
  }
}

export default globalSetup;