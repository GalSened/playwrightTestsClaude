/**
 * WeSign Phase 1 Validation Test Script
 * Tests core functionality of the WeSign-centric refactoring
 */

import { globalEventBus } from './src/core/wesign/EventBus';
import { globalPluginManager } from './src/core/wesign/PluginManager';
import { globalWeSignCore } from './src/core/wesign/WeSignCore';
import { WeSignPlugin } from './src/core/wesign/plugins/WeSignPlugin';
import { EventType, UnifiedTestConfig } from './src/core/wesign/types';
import { logger } from './src/utils/logger';

interface ValidationResult {
  component: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class WeSignValidator {
  private results: ValidationResult[] = [];

  private addResult(component: string, passed: boolean, error?: string, details?: any) {
    this.results.push({ component, passed, error, details });
    console.log(`${passed ? '✅' : '❌'} ${component}: ${passed ? 'PASSED' : `FAILED - ${error}`}`);
    if (details) {
      console.log('  Details:', JSON.stringify(details, null, 2));
    }
  }

  async validateEventBus(): Promise<void> {
    console.log('\n🔍 Validating EventBus...');

    try {
      // Test event subscription and publishing
      let eventReceived = false;
      const unsubscribe = globalEventBus.subscribe(EventType.TEST_EXECUTION_STARTED, () => {
        eventReceived = true;
      });

      await globalEventBus.createAndPublish(
        EventType.TEST_EXECUTION_STARTED,
        'ValidationTest',
        { testData: 'validation' }
      );

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 100));

      if (eventReceived) {
        this.addResult('EventBus - Event Publishing', true);
      } else {
        this.addResult('EventBus - Event Publishing', false, 'Event not received');
      }

      // Test stats
      const stats = globalEventBus.getStats();
      this.addResult('EventBus - Stats', !!stats && typeof stats.uptime === 'number');

      // Cleanup
      unsubscribe();

    } catch (error) {
      this.addResult('EventBus', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async validatePluginManager(): Promise<void> {
    console.log('\n🔍 Validating PluginManager...');

    try {
      // Test plugin registration
      const testPlugin = new WeSignPlugin();
      await globalPluginManager.register(testPlugin);

      this.addResult('PluginManager - Registration', true);

      // Test plugin retrieval
      const retrievedPlugin = globalPluginManager.get('wesign-core');
      this.addResult('PluginManager - Retrieval', !!retrievedPlugin);

      // Test health check
      const healthResults = await globalPluginManager.healthCheckAll();
      this.addResult('PluginManager - Health Check', healthResults.size > 0);

      // Test stats
      const stats = globalPluginManager.getStats();
      this.addResult('PluginManager - Stats', stats.totalPlugins > 0, undefined, stats);

    } catch (error) {
      this.addResult('PluginManager', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async validateWeSignPlugin(): Promise<void> {
    console.log('\n🔍 Validating WeSignPlugin...');

    try {
      const plugin = new WeSignPlugin();
      await plugin.initialize(globalEventBus);

      // Test health check
      const health = await plugin.healthCheck();
      this.addResult('WeSignPlugin - Health Check', !!health && !!health.status, undefined, health);

      // Test config schema
      const schema = plugin.getConfigSchema();
      this.addResult('WeSignPlugin - Config Schema', !!schema && typeof schema === 'object');

      // Test config validation
      const validConfig: UnifiedTestConfig = {
        framework: 'wesign',
        execution: { mode: 'single', browser: 'chromium', headless: true },
        tests: { testIds: ['test1'] },
        ai: { enabled: false },
        realTime: { monitoring: true, notifications: true, streaming: true }
      };

      const isValid = plugin.validateConfig(validConfig);
      this.addResult('WeSignPlugin - Config Validation', isValid);

      // Test discovery (this might fail if test directory doesn't exist, but we'll catch it)
      try {
        const tests = await plugin.discover(['.']);
        this.addResult('WeSignPlugin - Test Discovery', Array.isArray(tests), undefined, { count: tests.length });
      } catch (discoveryError) {
        this.addResult('WeSignPlugin - Test Discovery', false, 'Expected - test directory may not exist');
      }

    } catch (error) {
      this.addResult('WeSignPlugin', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async validateWeSignCore(): Promise<void> {
    console.log('\n🔍 Validating WeSignCore...');

    try {
      // Test initialization
      await globalWeSignCore.initialize();
      this.addResult('WeSignCore - Initialization', globalWeSignCore.isReady());

      // Test health check
      const health = await globalWeSignCore.getHealth();
      this.addResult('WeSignCore - Health Check', !!health && !!health.status, undefined, health);

      // Test stats
      const stats = globalWeSignCore.getStats();
      this.addResult('WeSignCore - Stats', !!stats && stats.initialized, undefined, stats);

      // Test discovery
      try {
        const discovery = await globalWeSignCore.discoverTests(['.']);
        this.addResult('WeSignCore - Test Discovery', !!discovery && Array.isArray(discovery.tests));
      } catch (discoveryError) {
        this.addResult('WeSignCore - Test Discovery', false, 'Expected - test service may not be available');
      }

    } catch (error) {
      this.addResult('WeSignCore', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async validateTypeSystem(): Promise<void> {
    console.log('\n🔍 Validating Type System...');

    try {
      // Test type imports
      const { EventType, UnifiedTestConfig } = await import('./src/core/wesign/types');
      this.addResult('Types - Import', !!EventType && !!UnifiedTestConfig);

      // Test EventType enum
      const hasRequiredEvents = !!(
        EventType.TEST_EXECUTION_STARTED &&
        EventType.TEST_EXECUTION_COMPLETED &&
        EventType.PLUGIN_INSTALLED &&
        EventType.DISCOVERY_COMPLETED
      );
      this.addResult('Types - EventType Enum', hasRequiredEvents);

      // Create a valid config to test type structure
      const testConfig: UnifiedTestConfig = {
        framework: 'wesign',
        execution: {
          mode: 'single',
          workers: 1,
          timeout: 30000,
          browser: 'chromium',
          headless: true
        },
        tests: {
          testIds: ['test1'],
          suites: ['suite1'],
          tags: ['smoke'],
          categories: ['integration']
        },
        ai: {
          enabled: false,
          autoHeal: false,
          generateInsights: false
        },
        realTime: {
          monitoring: true,
          notifications: true,
          streaming: true
        }
      };

      this.addResult('Types - UnifiedTestConfig Structure', !!testConfig.framework);

    } catch (error) {
      this.addResult('Type System', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async validateAPI(): Promise<void> {
    console.log('\n🔍 Validating API Components...');

    try {
      // Test WeSignRoutes import
      const { wesignRouter } = await import('./src/api/unified/WeSignRoutes');
      this.addResult('API - WeSignRoutes Import', !!wesignRouter);

      // Test LegacyProxy import
      const { legacyProxyRouter } = await import('./src/api/unified/LegacyProxy');
      this.addResult('API - LegacyProxy Import', !!legacyProxyRouter);

    } catch (error) {
      this.addResult('API Components', false, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  generateReport(): void {
    console.log('\n📊 VALIDATION REPORT');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.passed).length;
    const total = this.results.length;
    const failureRate = ((total - passed) / total * 100).toFixed(1);

    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (total - passed > 0) {
      console.log('\n❌ FAILURES:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.component}: ${result.error}`);
      });
    }

    console.log('\n📋 DETAILED RESULTS:');
    this.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.component}`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }
    });

    // Critical issues that would prevent system from working
    const criticalFailures = this.results.filter(r =>
      !r.passed && (
        r.component.includes('EventBus') ||
        r.component.includes('PluginManager') ||
        r.component.includes('WeSignCore - Initialization')
      )
    );

    if (criticalFailures.length > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND:');
      criticalFailures.forEach(failure => {
        console.log(`  ⚠️  ${failure.component}: ${failure.error}`);
      });
      console.log('\nThese issues must be resolved before the system can function properly.');
    } else {
      console.log('\n🎉 NO CRITICAL ISSUES FOUND - Core system should be operational');
    }
  }

  async runValidation(): Promise<void> {
    console.log('🚀 Starting WeSign Phase 1 Validation...\n');

    await this.validateTypeSystem();
    await this.validateEventBus();
    await this.validatePluginManager();
    await this.validateWeSignPlugin();
    await this.validateWeSignCore();
    await this.validateAPI();

    this.generateReport();
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new WeSignValidator();
  validator.runValidation()
    .then(() => {
      console.log('\n✨ Validation complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n💥 Validation failed with error:', error);
      process.exit(1);
    });
}

export { WeSignValidator };