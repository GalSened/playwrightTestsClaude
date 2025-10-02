/**
 * API Health Check Suite
 * Validates all critical API endpoints are responding correctly
 */

import { logger } from '../utils/logger';

interface HealthCheckResult {
  endpoint: string;
  method: string;
  status: 'pass' | 'fail' | 'skip';
  statusCode?: number;
  responseTime?: number;
  message: string;
  error?: string;
  response?: any;
}

interface HealthCheckReport {
  timestamp: string;
  baseUrl: string;
  totalChecks: number;
  passed: number;
  failed: number;
  skipped: number;
  averageResponseTime: number;
  results: HealthCheckResult[];
}

class APIHealthChecker {
  private baseUrl: string;
  private results: HealthCheckResult[] = [];
  private timeout: number = 5000; // 5 seconds

  constructor(baseUrl: string = 'http://localhost:8082') {
    this.baseUrl = baseUrl;
  }

  /**
   * Run all health checks
   */
  async runHealthChecks(): Promise<HealthCheckReport> {
    console.log('\n🏥 Starting API Health Check Suite...\n');
    console.log(`Base URL: ${this.baseUrl}\n`);

    // Core health endpoints
    await this.checkEndpoint('GET', '/health', 'System health check');
    await this.checkEndpoint('GET', '/api/health', 'API health check');

    // WeSign endpoints
    await this.checkEndpoint('GET', '/api/wesign/health', 'WeSign health check');
    await this.checkEndpoint('GET', '/api/wesign/tests', 'Get WeSign tests');
    await this.checkEndpoint('GET', '/api/wesign/suites', 'Get WeSign test suites');

    // WeSign Unified API endpoints
    await this.checkEndpoint('GET', '/api/wesign/unified/queue/status', 'Queue status');
    await this.checkEndpoint('GET', '/api/wesign/unified/tests/categories', 'Test categories');
    await this.checkEndpoint('GET', '/api/wesign/unified/tests/tags', 'Test tags');
    await this.checkEndpoint('GET', '/api/wesign/unified/schedules', 'Get schedules');

    // Analytics endpoints (Phase 2.4 additions)
    await this.checkEndpoint('POST', '/api/wesign/unified/analytics/metrics', 'Analytics metrics', {});
    await this.checkEndpoint('POST', '/api/wesign/unified/analytics/insights', 'Analytics insights', {});
    await this.checkEndpoint('GET', '/api/wesign/unified/analytics/quick-stats', 'Quick stats');

    // Test discovery endpoints
    await this.checkEndpoint('POST', '/api/wesign/unified/discovery/scan', 'Test discovery', {
      directories: [],
      recursive: true
    });

    // CI/CD endpoints
    await this.checkEndpoint('GET', '/api/ci/dashboard', 'CI/CD dashboard');
    await this.checkEndpoint('GET', '/api/ci/runs', 'CI/CD runs');
    await this.checkEndpoint('GET', '/api/ci/environments', 'CI/CD environments');

    // Reports endpoints
    await this.checkEndpoint('GET', '/api/reports', 'Get reports');

    // Analytics (general) endpoint
    await this.checkEndpoint('GET', '/api/analytics/metrics', 'General analytics metrics');

    // Generate and print report
    const report = this.generateReport();
    this.printReport(report);

    return report;
  }

  /**
   * Check individual endpoint
   */
  private async checkEndpoint(
    method: string,
    path: string,
    description: string,
    body?: any
  ): Promise<void> {
    const url = `${this.baseUrl}${path}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        signal: controller.signal
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      let responseData: any;

      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }

      const result: HealthCheckResult = {
        endpoint: path,
        method,
        status: response.ok ? 'pass' : 'fail',
        statusCode: response.status,
        responseTime,
        message: response.ok
          ? `✅ ${description} - ${response.status} (${responseTime}ms)`
          : `❌ ${description} - ${response.status} ${response.statusText}`,
        response: typeof responseData === 'object' ? responseData : undefined
      };

      if (!response.ok) {
        result.error = typeof responseData === 'string'
          ? responseData
          : JSON.stringify(responseData);
      }

      this.results.push(result);
      console.log(result.message);

    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      const result: HealthCheckResult = {
        endpoint: path,
        method,
        status: 'fail',
        responseTime,
        message: `❌ ${description} - ${error.name}`,
        error: error.message
      };

      this.results.push(result);
      console.log(result.message);

      if (error.name === 'AbortError') {
        console.log(`   ⏱️  Request timed out after ${this.timeout}ms`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log(`   🔌 Connection refused - is the server running on ${this.baseUrl}?`);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
  }

  /**
   * Generate health check report
   */
  private generateReport(): HealthCheckReport {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const skipped = this.results.filter(r => r.status === 'skip').length;

    const responseTimes = this.results
      .filter(r => r.responseTime !== undefined)
      .map(r => r.responseTime!);

    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    return {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      totalChecks: this.results.length,
      passed,
      failed,
      skipped,
      averageResponseTime: Math.round(averageResponseTime),
      results: this.results
    };
  }

  /**
   * Print formatted report
   */
  private printReport(report: HealthCheckReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('API HEALTH CHECK REPORT');
    console.log('='.repeat(80));
    console.log(`Generated: ${report.timestamp}`);
    console.log(`Base URL: ${report.baseUrl}`);
    console.log(`Total Checks: ${report.totalChecks}`);
    console.log(`✅ Passed: ${report.passed} (${((report.passed / report.totalChecks) * 100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${report.failed} (${((report.failed / report.totalChecks) * 100).toFixed(1)}%)`);
    console.log(`⏱️  Average Response Time: ${report.averageResponseTime}ms`);
    console.log('='.repeat(80));

    if (report.failed > 0) {
      console.log('\n🚨 FAILED ENDPOINTS:');
      report.results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          console.log(`\n  ${r.method} ${r.endpoint}`);
          console.log(`  Status: ${r.statusCode || 'N/A'}`);
          console.log(`  Response Time: ${r.responseTime || 'N/A'}ms`);
          if (r.error) {
            console.log(`  Error: ${r.error.substring(0, 200)}${r.error.length > 200 ? '...' : ''}`);
          }
        });
    }

    // Performance analysis
    const slowEndpoints = report.results
      .filter(r => r.responseTime && r.responseTime > 2000)
      .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0));

    if (slowEndpoints.length > 0) {
      console.log('\n⏱️  SLOW ENDPOINTS (>2s):');
      slowEndpoints.forEach(r => {
        console.log(`  ${r.method} ${r.endpoint} - ${r.responseTime}ms`);
      });
    }

    // Success criteria
    console.log('\n' + '='.repeat(80));

    const successRate = (report.passed / report.totalChecks) * 100;

    if (successRate === 100 && report.averageResponseTime < 2000) {
      console.log('🎉 API HEALTH: EXCELLENT');
      console.log('All endpoints responding correctly with good performance!');
    } else if (successRate >= 90 && report.averageResponseTime < 3000) {
      console.log('✅ API HEALTH: GOOD');
      console.log('Most endpoints working, minor issues detected.');
    } else if (successRate >= 70) {
      console.log('⚠️  API HEALTH: FAIR');
      console.log('Significant issues detected. Investigation recommended.');
    } else {
      console.log('❌ API HEALTH: POOR');
      console.log('Critical issues detected. Immediate action required!');
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * Check if server is running
   */
  async isServerRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Main execution
async function main() {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:8082';
  const checker = new APIHealthChecker(baseUrl);

  // Check if server is running first
  console.log(`🔍 Checking if server is running at ${baseUrl}...`);
  const isRunning = await checker.isServerRunning();

  if (!isRunning) {
    console.error(`\n❌ ERROR: Server is not responding at ${baseUrl}`);
    console.error('Please ensure the backend server is running:');
    console.error('  cd backend && npm run dev\n');
    process.exit(1);
  }

  console.log('✅ Server is running!\n');

  try {
    const report = await checker.runHealthChecks();

    // Save report to file
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(process.cwd(), 'api-health-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Full report saved to: ${reportPath}\n`);

    // Exit with appropriate code
    const successRate = (report.passed / report.totalChecks) * 100;
    process.exit(successRate >= 90 ? 0 : 1);

  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { APIHealthChecker, HealthCheckResult, HealthCheckReport };
