/**
 * Test Running Module Validation Suite
 * Comprehensive validation of the QA Intelligence test execution system
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const API_BASE = 'http://localhost:8082/api';
const BACKEND_HEALTHY = false;

// Test configuration
const TEST_CONFIG = {
  simpleTest: 'tests/auth/test_login.py',
  complexTest: 'tests/contacts/test_comprehensive_contacts.py',
  invalidTest: 'tests/nonexistent/fake_test.py',
  bulkTest: 'tests/bulk_operations/test_bulk_operations.py'
};

class TestValidationSuite {
  constructor() {
    this.results = [];
    this.activeExecutions = new Set();
  }

  async log(message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data);
    this.results.push({ timestamp, message, data });
  }

  async validateHealthCheck() {
    try {
      const response = await axios.get(`${API_BASE}/health`);
      await this.log('✅ Backend health check passed', { status: response.status });
      return response.data;
    } catch (error) {
      await this.log('❌ Backend health check failed', { error: error.message });
      throw error;
    }
  }

  // Phase 1: Core Execution Flow Validation
  async validateBasicExecution() {
    await this.log('🧪 Starting basic execution validation');

    try {
      // Test simple pytest execution
      const response = await axios.post(`${API_BASE}/execute/pytest`, {
        testPath: TEST_CONFIG.simpleTest,
        environment: 'development',
        timeout: 300000 // 5 minutes
      });

      const executionId = response.data.executionId;
      this.activeExecutions.add(executionId);

      await this.log('✅ Test execution started', {
        executionId,
        testPath: TEST_CONFIG.simpleTest
      });

      // Monitor execution status
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes with 5-second intervals
      let finalStatus = null;

      while (attempts < maxAttempts) {
        try {
          const statusResponse = await axios.get(`${API_BASE}/execute/status/${executionId}`);
          const status = statusResponse.data;

          if (status.status === 'completed' || status.status === 'failed') {
            finalStatus = status;
            break;
          }

          await this.log('⏳ Execution in progress', {
            executionId,
            status: status.status,
            attempt: attempts + 1
          });

        } catch (error) {
          await this.log('⚠️ Status check failed', { executionId, error: error.message });
        }

        attempts++;
        await this.sleep(5000); // Wait 5 seconds
      }

      if (finalStatus) {
        await this.log('✅ Basic execution completed', {
          executionId,
          finalStatus: finalStatus.status,
          duration: finalStatus.duration
        });
        this.activeExecutions.delete(executionId);
        return finalStatus;
      } else {
        throw new Error(`Execution timeout after ${maxAttempts} attempts`);
      }

    } catch (error) {
      await this.log('❌ Basic execution validation failed', { error: error.message });
      throw error;
    }
  }

  async validateExecutionHistory() {
    await this.log('🧪 Validating execution history');

    try {
      const response = await axios.get(`${API_BASE}/execute/history`);
      const history = response.data;

      await this.log('✅ Execution history retrieved', {
        count: history.length,
        recent: history.slice(0, 3).map(h => ({ id: h.executionId, status: h.status }))
      });

      return history;
    } catch (error) {
      await this.log('❌ Execution history validation failed', { error: error.message });
      throw error;
    }
  }

  // Phase 2: Error Handling Validation
  async validateInvalidTestExecution() {
    await this.log('🧪 Validating invalid test handling');

    try {
      const response = await axios.post(`${API_BASE}/execute/pytest`, {
        testPath: TEST_CONFIG.invalidTest,
        environment: 'development'
      });

      const executionId = response.data.executionId;
      await this.log('⏳ Invalid test execution started', { executionId });

      // Wait for completion (should fail quickly)
      await this.sleep(10000);

      const statusResponse = await axios.get(`${API_BASE}/execute/status/${executionId}`);
      const status = statusResponse.data;

      if (status.status === 'failed') {
        await this.log('✅ Invalid test properly failed', { executionId, exitCode: status.exitCode });
      } else {
        await this.log('⚠️ Invalid test did not fail as expected', { executionId, status: status.status });
      }

      return status;
    } catch (error) {
      await this.log('❌ Invalid test validation failed', { error: error.message });
      throw error;
    }
  }

  async validateProcessCancellation() {
    await this.log('🧪 Validating process cancellation');

    try {
      // Start a complex test that will run longer
      const response = await axios.post(`${API_BASE}/execute/pytest`, {
        testPath: TEST_CONFIG.complexTest,
        environment: 'development'
      });

      const executionId = response.data.executionId;
      await this.log('⏳ Long-running test started for cancellation', { executionId });

      // Wait a bit to ensure it's running
      await this.sleep(5000);

      // Cancel the execution
      const cancelResponse = await axios.delete(`${API_BASE}/execute/${executionId}`);
      await this.log('🛑 Cancellation requested', { executionId, response: cancelResponse.data });

      // Check if it was cancelled
      await this.sleep(2000);
      const statusResponse = await axios.get(`${API_BASE}/execute/status/${executionId}`);

      await this.log('✅ Cancellation validation completed', {
        executionId,
        finalStatus: statusResponse.data.status
      });

      return statusResponse.data;
    } catch (error) {
      await this.log('❌ Process cancellation validation failed', { error: error.message });
      throw error;
    }
  }

  // Phase 3: Concurrent Execution Validation
  async validateConcurrentExecution() {
    await this.log('🧪 Validating concurrent execution');

    try {
      const executions = [];
      const testPaths = [
        TEST_CONFIG.simpleTest,
        TEST_CONFIG.bulkTest,
        'tests/contacts/test_contacts_management.py'
      ];

      // Start multiple executions simultaneously
      for (let i = 0; i < testPaths.length; i++) {
        const response = await axios.post(`${API_BASE}/execute/pytest`, {
          testPath: testPaths[i],
          environment: 'development'
        });

        executions.push({
          id: response.data.executionId,
          testPath: testPaths[i],
          startTime: Date.now()
        });

        await this.log('🚀 Concurrent execution started', {
          executionId: response.data.executionId,
          testIndex: i + 1,
          testPath: testPaths[i]
        });
      }

      // Monitor all executions
      const results = await Promise.allSettled(
        executions.map(async (exec) => {
          let attempts = 0;
          const maxAttempts = 40;

          while (attempts < maxAttempts) {
            try {
              const statusResponse = await axios.get(`${API_BASE}/execute/status/${exec.id}`);
              const status = statusResponse.data;

              if (status.status === 'completed' || status.status === 'failed') {
                return { ...exec, finalStatus: status };
              }
            } catch (error) {
              // Continue monitoring even if status check fails
            }

            attempts++;
            await this.sleep(3000);
          }

          throw new Error(`Execution ${exec.id} timeout`);
        })
      );

      await this.log('✅ Concurrent execution validation completed', {
        totalExecutions: executions.length,
        successful: results.filter(r => r.status === 'fulfilled').length,
        failed: results.filter(r => r.status === 'rejected').length
      });

      return results;
    } catch (error) {
      await this.log('❌ Concurrent execution validation failed', { error: error.message });
      throw error;
    }
  }

  // Phase 4: Artifact Validation
  async validateArtifactGeneration(executionId) {
    await this.log('🧪 Validating artifact generation', { executionId });

    try {
      const statusResponse = await axios.get(`${API_BASE}/execute/status/${executionId}`);
      const execution = statusResponse.data;

      if (!execution.artifacts) {
        throw new Error('No artifacts found in execution result');
      }

      const artifacts = execution.artifacts;
      const checks = [];

      // Check if artifacts directory exists
      checks.push({
        name: 'Artifacts directory',
        path: artifacts.directory,
        exists: await this.fileExists(artifacts.directory)
      });

      // Check specific artifact files
      const artifactFiles = [
        { name: 'JUnit XML', path: artifacts.junit },
        { name: 'HTML Report', path: artifacts.html },
        { name: 'Screenshots dir', path: artifacts.screenshots },
        { name: 'Videos dir', path: artifacts.videos },
        { name: 'Logs dir', path: artifacts.logs }
      ];

      for (const artifact of artifactFiles) {
        checks.push({
          name: artifact.name,
          path: artifact.path,
          exists: await this.fileExists(artifact.path)
        });
      }

      await this.log('✅ Artifact validation completed', {
        executionId,
        checks: checks.map(c => ({ name: c.name, exists: c.exists }))
      });

      return checks;
    } catch (error) {
      await this.log('❌ Artifact validation failed', { executionId, error: error.message });
      throw error;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    await this.log('🧹 Cleaning up active executions');

    for (const executionId of this.activeExecutions) {
      try {
        await axios.delete(`${API_BASE}/execute/${executionId}`);
        await this.log('🗑️ Cleaned up execution', { executionId });
      } catch (error) {
        await this.log('⚠️ Cleanup failed', { executionId, error: error.message });
      }
    }

    this.activeExecutions.clear();
  }

  async runFullValidation() {
    await this.log('🚀 Starting comprehensive test module validation');
    const startTime = Date.now();

    try {
      // Phase 1: Health and Basic Execution
      await this.validateHealthCheck();
      const basicExecution = await this.validateBasicExecution();
      await this.validateExecutionHistory();

      // Phase 2: Error Handling
      await this.validateInvalidTestExecution();
      await this.validateProcessCancellation();

      // Phase 3: Advanced Features
      await this.validateConcurrentExecution();

      // Phase 4: Artifacts (using basic execution)
      if (basicExecution && basicExecution.executionId) {
        await this.validateArtifactGeneration(basicExecution.executionId);
      }

      const duration = Date.now() - startTime;
      await this.log('🎉 Full validation completed successfully', {
        totalDuration: `${duration}ms`,
        totalTests: this.results.length
      });

    } catch (error) {
      await this.log('💥 Validation suite failed', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      await this.cleanup();

      // Save results to file
      await this.saveResults();
    }
  }

  async saveResults() {
    try {
      const resultsPath = path.join(__dirname, 'validation-results.json');
      await fs.writeFile(resultsPath, JSON.stringify(this.results, null, 2));
      await this.log('💾 Results saved', { path: resultsPath });
    } catch (error) {
      console.error('Failed to save results:', error);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new TestValidationSuite();

  validator.runFullValidation()
    .then(() => {
      console.log('✅ All validations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Validation suite failed:', error.message);
      process.exit(1);
    });
}

module.exports = TestValidationSuite;