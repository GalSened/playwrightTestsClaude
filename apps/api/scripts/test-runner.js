#!/usr/bin/env node
// Comprehensive test runner for the backend
const { spawn } = require('child_process');
const path = require('path');

class TestRunner {
  constructor() {
    this.testTypes = {
      unit: 'src/**/*.unit.test.ts',
      integration: 'src/tests/integration/**/*.test.ts',
      performance: 'src/tests/performance/**/*.test.ts',
      all: 'src/**/*.test.ts'
    };
    
    this.environments = {
      development: {
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/playwright_dev',
        REDIS_URL: 'redis://localhost:6379/0',
        NODE_ENV: 'development'
      },
      test: {
        TEST_DB_HOST: 'localhost',
        TEST_DB_PORT: '5432',
        TEST_DB_USER: 'postgres',
        TEST_DB_PASSWORD: 'postgres',
        NODE_ENV: 'test',
        LOG_LEVEL: 'error'
      },
      ci: {
        TEST_DB_HOST: process.env.POSTGRES_HOST || 'postgres',
        TEST_DB_PORT: process.env.POSTGRES_PORT || '5432',
        TEST_DB_USER: process.env.POSTGRES_USER || 'postgres',
        TEST_DB_PASSWORD: process.env.POSTGRES_PASSWORD || 'postgres',
        NODE_ENV: 'test',
        LOG_LEVEL: 'error',
        CI: 'true'
      }
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    const config = {
      testType: 'all',
      environment: 'test',
      watch: false,
      coverage: false,
      verbose: false,
      bail: false,
      parallel: false,
      updateSnapshots: false,
      grep: null
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      switch (arg) {
        case '--type':
        case '-t':
          config.testType = args[++i];
          break;
        case '--env':
        case '-e':
          config.environment = args[++i];
          break;
        case '--watch':
        case '-w':
          config.watch = true;
          break;
        case '--coverage':
        case '-c':
          config.coverage = true;
          break;
        case '--verbose':
        case '-v':
          config.verbose = true;
          break;
        case '--bail':
        case '-b':
          config.bail = true;
          break;
        case '--parallel':
        case '-p':
          config.parallel = true;
          break;
        case '--updateSnapshots':
        case '-u':
          config.updateSnapshots = true;
          break;
        case '--grep':
        case '-g':
          config.grep = args[++i];
          break;
        case '--help':
        case '-h':
          this.showHelp();
          process.exit(0);
          break;
      }
    }

    return config;
  }

  showHelp() {
    console.log(`
Backend Test Runner

Usage: node scripts/test-runner.js [options]

Options:
  -t, --type <type>           Test type to run (unit|integration|performance|all) [default: all]
  -e, --env <environment>     Environment to use (development|test|ci) [default: test]  
  -w, --watch                 Watch for file changes and re-run tests
  -c, --coverage              Generate coverage report
  -v, --verbose               Verbose output
  -b, --bail                  Stop on first test failure
  -p, --parallel              Run tests in parallel (not recommended for integration tests)
  -u, --updateSnapshots       Update test snapshots
  -g, --grep <pattern>        Only run tests matching pattern
  -h, --help                  Show this help message

Examples:
  node scripts/test-runner.js --type unit --coverage
  node scripts/test-runner.js --type integration --env ci
  node scripts/test-runner.js --watch --grep "auth"
  
Test Types:
  unit         - Unit tests only
  integration  - Integration tests (requires database)
  performance  - Performance tests
  all          - All test types

Environments:
  development  - Development database
  test         - Isolated test database (default)
  ci           - CI environment settings
    `);
  }

  buildJestCommand(config) {
    const jestArgs = [];
    
    // Test pattern
    if (this.testTypes[config.testType]) {
      jestArgs.push(this.testTypes[config.testType]);
    } else {
      console.error(`Invalid test type: ${config.testType}`);
      console.error(`Valid types: ${Object.keys(this.testTypes).join(', ')}`);
      process.exit(1);
    }

    // Jest options
    if (config.watch) {
      jestArgs.push('--watch');
    }
    
    if (config.coverage) {
      jestArgs.push('--coverage');
    }
    
    if (config.verbose) {
      jestArgs.push('--verbose');
    }
    
    if (config.bail) {
      jestArgs.push('--bail');
    }
    
    if (config.parallel && config.testType === 'unit') {
      jestArgs.push('--runInBand=false');
    } else {
      // Run integration tests serially to avoid database conflicts
      jestArgs.push('--runInBand');
    }
    
    if (config.updateSnapshots) {
      jestArgs.push('--updateSnapshot');
    }
    
    if (config.grep) {
      jestArgs.push('--testNamePattern', config.grep);
    }

    return jestArgs;
  }

  getEnvironment(environmentName) {
    if (!this.environments[environmentName]) {
      console.error(`Invalid environment: ${environmentName}`);
      console.error(`Valid environments: ${Object.keys(this.environments).join(', ')}`);
      process.exit(1);
    }
    
    return this.environments[environmentName];
  }

  async checkDatabaseConnection(env) {
    if (env.NODE_ENV === 'test' && !env.CI) {
      console.log('Checking database connection...');
      
      const { Pool } = require('pg');
      const pool = new Pool({
        host: env.TEST_DB_HOST,
        port: parseInt(env.TEST_DB_PORT),
        user: env.TEST_DB_USER,
        password: env.TEST_DB_PASSWORD,
        database: 'postgres',
        connectionTimeoutMillis: 5000,
      });

      try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('✓ Database connection successful');
      } catch (error) {
        console.error('✗ Database connection failed:', error.message);
        console.error('\nPlease ensure PostgreSQL is running and accessible.');
        console.error('You can start it with: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres');
        process.exit(1);
      } finally {
        await pool.end();
      }
    }
  }

  async runTests(config) {
    const env = this.getEnvironment(config.environment);
    
    // Check database connection for integration tests
    if (config.testType === 'integration' || config.testType === 'all') {
      await this.checkDatabaseConnection(env);
    }

    const jestArgs = this.buildJestCommand(config);
    
    console.log(`Running ${config.testType} tests in ${config.environment} environment...`);
    console.log(`Jest command: npx jest ${jestArgs.join(' ')}`);
    console.log('');

    // Set environment variables
    const testEnv = {
      ...process.env,
      ...env
    };

    // Run Jest
    const jest = spawn('npx', ['jest', ...jestArgs], {
      stdio: 'inherit',
      env: testEnv,
      cwd: path.resolve(__dirname, '..')
    });

    jest.on('close', (code) => {
      if (code === 0) {
        console.log('✓ All tests passed!');
      } else {
        console.log(`✗ Tests failed with exit code ${code}`);
      }
      process.exit(code);
    });

    jest.on('error', (error) => {
      console.error('Failed to run tests:', error);
      process.exit(1);
    });
  }

  async run() {
    try {
      const config = this.parseArguments();
      await this.runTests(config);
    } catch (error) {
      console.error('Test runner failed:', error);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.run();
}

module.exports = TestRunner;