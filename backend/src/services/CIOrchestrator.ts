/**
 * CI Orchestrator Service
 * Comprehensive CI/CD pipeline orchestration and management
 * Integrates with existing QA Intelligence backend architecture
 */

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  CIRun,
  CIStage,
  CIArtifact,
  CIConfiguration,
  CIEnvironmentConfig,
  CINotification,
  CIRollback,
  CreateCIRunRequest,
  UpdateCIRunRequest,
  CIRunDetails,
  CIRunSummary,
  CIDashboardStats,
  CIMetrics,
  EnvironmentStats,
  CIRunStatusType,
  CIEnvironmentType,
  CIStageTypeType,
  DeploymentStatusType,
  CIError,
  CIValidationError,
  CIExecutionError,
  CIRunStatus,
  CIStageType,
  DeploymentStatus
} from '../models/CI';
import { JenkinsClient } from '../integrations/JenkinsClient';
import { getDatabase } from '../database/database';
import { eventBus } from '../core/wesign/EventBus';
import { logger } from '../utils/logger';
import { spawn, ChildProcess } from 'child_process';
import { createReadStream } from 'fs';

// ===============================
// INTERFACES
// ===============================

interface CIRunFilters {
  status?: CIRunStatusType;
  environment?: CIEnvironmentType;
  branch?: string;
  from?: string;
  to?: string;
  tenantId?: string;
}

interface Pagination {
  page: number;
  limit: number;
}

interface CIRunsResult {
  runs: CIRunSummary[];
  total: number;
}

interface LogStreamOptions {
  lines?: number;
  follow?: boolean;
}

interface ArtifactFilters {
  type?: string;
  category?: string;
}

interface RollbackOptions {
  rollbackToVersion?: string;
  rollbackToCommit?: string;
  reason?: string;
  initiatedBy: string;
}

// ===============================
// CI ORCHESTRATOR SERVICE
// ===============================

export class CIOrchestrator {
  private db: any;
  private jenkinsClient: JenkinsClient;
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private artifactsPath: string;

  constructor() {
    this.db = getDatabase();
    this.jenkinsClient = new JenkinsClient();
    this.artifactsPath = process.env.CI_ARTIFACTS_PATH || path.join(__dirname, '../../artifacts/ci');

    // Ensure artifacts directory exists
    this.ensureArtifactsDirectory();

    logger.info('CI Orchestrator initialized', {
      artifactsPath: this.artifactsPath
    });
  }

  private ensureArtifactsDirectory(): void {
    if (!fs.existsSync(this.artifactsPath)) {
      fs.mkdirSync(this.artifactsPath, { recursive: true });
      logger.info('Created CI artifacts directory', { path: this.artifactsPath });
    }
  }

  // ===============================
  // CI RUN MANAGEMENT
  // ===============================

  async createCIRun(request: CreateCIRunRequest & { runId: string; createdBy?: string; tenantId?: string }): Promise<CIRun> {
    try {
      // Validate configuration if provided
      let configuration: CIConfiguration | null = null;
      if (request.configurationId) {
        configuration = await this.getCIConfiguration(request.configurationId);
        if (!configuration) {
          throw new CIValidationError(`Configuration not found: ${request.configurationId}`);
        }
      }

      // Get default WeSign test suite path
      const testSuitePath = configuration?.testSuiteConfig?.testSuitePath ||
        process.env.WESIGN_TEST_SUITE_PATH ||
        'C:/Users/gals/seleniumpythontests-1/playwright_tests/';

      const ciRun: Omit<CIRun, 'id'> = {
        runId: request.runId,
        name: request.name,
        description: request.description,
        status: CIRunStatus.PENDING,
        environment: request.environment,
        branch: request.branch,
        config: configuration?.pipelineConfig,
        variables: { ...configuration?.defaultVariables, ...request.variables },
        testSuitePath,
        testFilter: request.testFilter,
        parallelWorkers: request.parallelWorkers || 4,
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        skippedTests: 0,
        testSuccessRate: 0,
        qualityGatePassed: false,
        qualityScore: 0,
        deployServer: process.env.CI_DEVTEST_SERVER || 'DevTest',
        deployPath: process.env.CI_DEPLOY_DIR || 'C:\\inetpub\\WeSign',
        deploymentStatus: DeploymentStatus.NOT_STARTED,
        retryCount: 0,
        maxRetries: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: request.createdBy,
        tenantId: request.tenantId
      };

      // Insert into database
      const result = this.db.prepare(`
        INSERT INTO ci_runs (
          run_id, name, description, status, environment, branch, config, variables,
          test_suite_path, test_filter, parallel_workers, total_tests, passed_tests,
          failed_tests, skipped_tests, test_success_rate, quality_gate_passed,
          quality_score, deploy_server, deploy_path, deployment_status, retry_count,
          max_retries, created_at, updated_at, created_by, tenant_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ciRun.runId, ciRun.name, ciRun.description, ciRun.status, ciRun.environment,
        ciRun.branch, JSON.stringify(ciRun.config), JSON.stringify(ciRun.variables),
        ciRun.testSuitePath, ciRun.testFilter, ciRun.parallelWorkers, ciRun.totalTests,
        ciRun.passedTests, ciRun.failedTests, ciRun.skippedTests, ciRun.testSuccessRate,
        ciRun.qualityGatePassed ? 1 : 0, ciRun.qualityScore, ciRun.deployServer,
        ciRun.deployPath, ciRun.deploymentStatus, ciRun.retryCount, ciRun.maxRetries,
        ciRun.createdAt, ciRun.updatedAt, ciRun.createdBy, ciRun.tenantId
      );

      const createdRun = { ...ciRun, id: result.lastInsertRowid as number };

      // Create default stages if configuration is provided
      if (configuration?.stages) {
        await this.createStagesForRun(createdRun.runId, configuration.stages);
      }

      logger.info('CI run created', {
        runId: createdRun.runId,
        name: createdRun.name,
        environment: createdRun.environment,
        createdBy: createdRun.createdBy
      });

      return createdRun;

    } catch (error) {
      logger.error('Failed to create CI run', { error, request });
      throw error instanceof CIError ? error : new CIExecutionError('Failed to create CI run', error);
    }
  }

  async getCIRun(runId: string): Promise<CIRun | null> {
    try {
      const result = this.db.prepare(`
        SELECT * FROM ci_runs WHERE run_id = ?
      `).get(runId);

      if (!result) return null;

      return this.mapDbRowToCIRun(result);
    } catch (error) {
      logger.error('Failed to get CI run', { error, runId });
      throw new CIExecutionError('Failed to get CI run', error);
    }
  }

  async updateCIRun(runId: string, updates: UpdateCIRunRequest): Promise<CIRun> {
    try {
      const current = await this.getCIRun(runId);
      if (!current) {
        throw new CIValidationError(`CI run not found: ${runId}`);
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];

      if (updates.status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(updates.status);
      }

      if (updates.errorMessage !== undefined) {
        updateFields.push('error_message = ?');
        updateValues.push(updates.errorMessage);
      }

      if (updates.errorDetails !== undefined) {
        updateFields.push('error_details = ?');
        updateValues.push(updates.errorDetails);
      }

      if (updates.deploymentStatus !== undefined) {
        updateFields.push('deployment_status = ?');
        updateValues.push(updates.deploymentStatus);
      }

      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());
      updateValues.push(runId);

      const query = `UPDATE ci_runs SET ${updateFields.join(', ')} WHERE run_id = ?`;
      this.db.prepare(query).run(...updateValues);

      const updated = await this.getCIRun(runId);
      if (!updated) {
        throw new CIExecutionError('Failed to retrieve updated CI run');
      }

      logger.info('CI run updated', { runId, updates });
      return updated;

    } catch (error) {
      logger.error('Failed to update CI run', { error, runId, updates });
      throw error instanceof CIError ? error : new CIExecutionError('Failed to update CI run', error);
    }
  }

  async getCIRuns(filters: CIRunFilters, pagination: Pagination): Promise<CIRunsResult> {
    try {
      let whereClause = '1 = 1';
      const params: any[] = [];

      if (filters.status) {
        whereClause += ' AND status = ?';
        params.push(filters.status);
      }

      if (filters.environment) {
        whereClause += ' AND environment = ?';
        params.push(filters.environment);
      }

      if (filters.branch) {
        whereClause += ' AND branch = ?';
        params.push(filters.branch);
      }

      if (filters.tenantId) {
        whereClause += ' AND (tenant_id = ? OR tenant_id IS NULL)';
        params.push(filters.tenantId);
      }

      if (filters.from) {
        whereClause += ' AND created_at >= ?';
        params.push(filters.from);
      }

      if (filters.to) {
        whereClause += ' AND created_at <= ?';
        params.push(filters.to);
      }

      // Get total count
      const countResult = this.db.prepare(`
        SELECT COUNT(*) as total FROM ci_runs WHERE ${whereClause}
      `).get(...params);

      const total = countResult.total;

      // Get paginated results
      const offset = (pagination.page - 1) * pagination.limit;
      const runs = this.db.prepare(`
        SELECT run_id, name, status, environment, branch, duration,
               test_success_rate, quality_score, created_at
        FROM ci_runs
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, pagination.limit, offset);

      const runSummaries: CIRunSummary[] = await Promise.all(
        runs.map(async (run: any) => {
          const stages = await this.getCIStagesSummary(run.run_id);
          return {
            runId: run.run_id,
            name: run.name,
            status: run.status,
            environment: run.environment,
            branch: run.branch,
            duration: run.duration,
            testSuccessRate: run.test_success_rate,
            qualityScore: run.quality_score,
            createdAt: run.created_at,
            stages
          };
        })
      );

      return { runs: runSummaries, total };

    } catch (error) {
      logger.error('Failed to get CI runs', { error, filters, pagination });
      throw new CIExecutionError('Failed to get CI runs', error);
    }
  }

  async getCIRunDetails(runId: string): Promise<CIRunDetails | null> {
    try {
      const run = await this.getCIRun(runId);
      if (!run) return null;

      const stages = await this.getCIStages(runId);
      const artifacts = await this.getCIArtifacts(runId);
      const notifications = await this.getCINotifications(runId);

      return {
        ...run,
        stages,
        artifacts,
        notifications
      };

    } catch (error) {
      logger.error('Failed to get CI run details', { error, runId });
      throw new CIExecutionError('Failed to get CI run details', error);
    }
  }

  // ===============================
  // CI RUN EXECUTION
  // ===============================

  async startCIRun(runId: string, userId: string): Promise<CIRun> {
    try {
      const run = await this.getCIRun(runId);
      if (!run) {
        throw new CIValidationError(`CI run not found: ${runId}`);
      }

      if (run.status !== CIRunStatus.PENDING) {
        throw new CIValidationError(`CI run is not in pending status: ${run.status}`);
      }

      // Update status to running
      const updatedRun = await this.updateCIRun(runId, {
        status: CIRunStatus.RUNNING
      });

      // Update started_at timestamp
      this.db.prepare(`
        UPDATE ci_runs SET started_at = ? WHERE run_id = ?
      `).run(new Date().toISOString(), runId);

      // Start execution in background
      this.executeRunAsync(runId);

      // Publish event
      await eventBus.createAndPublish('ci_run', 'orchestrator', {
        runId,
        action: 'started',
        status: updatedRun.status,
        environment: updatedRun.environment,
        startedBy: userId
      });

      logger.info('CI run started', { runId, startedBy: userId });
      return updatedRun;

    } catch (error) {
      logger.error('Failed to start CI run', { error, runId, userId });
      throw error instanceof CIError ? error : new CIExecutionError('Failed to start CI run', error);
    }
  }

  async cancelCIRun(runId: string, userId: string): Promise<CIRun> {
    try {
      const run = await this.getCIRun(runId);
      if (!run) {
        throw new CIValidationError(`CI run not found: ${runId}`);
      }

      if (run.status !== CIRunStatus.RUNNING) {
        throw new CIValidationError(`CI run is not running: ${run.status}`);
      }

      // Kill running process if exists
      const process = this.runningProcesses.get(runId);
      if (process) {
        process.kill('SIGTERM');
        this.runningProcesses.delete(runId);
      }

      // Cancel Jenkins job if exists
      if (run.jenkinsJobName && run.jenkinsBuildNumber) {
        try {
          await this.jenkinsClient.stopBuild(run.jenkinsJobName, run.jenkinsBuildNumber);
        } catch (error) {
          logger.warn('Failed to cancel Jenkins build', { error, runId });
        }
      }

      // Update status
      const updatedRun = await this.updateCIRun(runId, {
        status: CIRunStatus.CANCELLED
      });

      // Update completed_at timestamp
      const startedAt = new Date(run.startedAt || run.createdAt).getTime();
      const duration = Math.floor((Date.now() - startedAt) / 1000);

      this.db.prepare(`
        UPDATE ci_runs SET completed_at = ?, duration = ? WHERE run_id = ?
      `).run(new Date().toISOString(), duration, runId);

      // Publish event
      await eventBus.createAndPublish('ci_run', 'orchestrator', {
        runId,
        action: 'cancelled',
        status: updatedRun.status,
        cancelledBy: userId
      });

      logger.info('CI run cancelled', { runId, cancelledBy: userId });
      return updatedRun;

    } catch (error) {
      logger.error('Failed to cancel CI run', { error, runId, userId });
      throw error instanceof CIError ? error : new CIExecutionError('Failed to cancel CI run', error);
    }
  }

  private async executeRunAsync(runId: string): Promise<void> {
    try {
      logger.info('Starting CI run execution', { runId });

      const run = await this.getCIRun(runId);
      if (!run) {
        throw new CIExecutionError(`CI run not found: ${runId}`);
      }

      const stages = await this.getCIStages(runId);
      if (stages.length === 0) {
        throw new CIExecutionError(`No stages found for CI run: ${runId}`);
      }

      let success = true;
      let errorMessage = '';

      // Execute stages in sequence
      for (const stage of stages.sort((a, b) => a.sequenceNumber - b.sequenceNumber)) {
        try {
          await this.executeStage(runId, stage);
        } catch (error) {
          success = false;
          errorMessage = error instanceof Error ? error.message : 'Stage execution failed';
          logger.error('Stage execution failed', { error, runId, stageId: stage.stageId });
          break;
        }
      }

      // Update final status
      const finalStatus = success ? CIRunStatus.SUCCESS : CIRunStatus.FAILED;
      const startedAt = new Date(run.startedAt || run.createdAt).getTime();
      const duration = Math.floor((Date.now() - startedAt) / 1000);

      await this.updateCIRun(runId, {
        status: finalStatus,
        errorMessage: success ? undefined : errorMessage
      });

      this.db.prepare(`
        UPDATE ci_runs SET completed_at = ?, duration = ? WHERE run_id = ?
      `).run(new Date().toISOString(), duration, runId);

      // Calculate final test metrics
      await this.calculateTestMetrics(runId);

      // Publish completion event
      await eventBus.createAndPublish('ci_run', 'orchestrator', {
        runId,
        action: 'completed',
        status: finalStatus,
        duration,
        success
      });

      logger.info('CI run execution completed', { runId, status: finalStatus, duration });

    } catch (error) {
      logger.error('CI run execution failed', { error, runId });

      await this.updateCIRun(runId, {
        status: CIRunStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Execution failed'
      });

      // Publish failure event
      await eventBus.createAndPublish('ci_run', 'orchestrator', {
        runId,
        action: 'failed',
        status: CIRunStatus.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async executeStage(runId: string, stage: CIStage): Promise<void> {
    logger.info('Executing stage', { runId, stageId: stage.stageId, type: stage.stageType });

    // Update stage status to running
    await this.updateStageStatus(stage.stageId, CIRunStatus.RUNNING);

    const startTime = Date.now();

    try {
      switch (stage.stageType) {
        case CIStageType.BUILD:
          await this.executeBuildStage(runId, stage);
          break;
        case CIStageType.TEST:
          await this.executeTestStage(runId, stage);
          break;
        case CIStageType.QUALITY_GATE:
          await this.executeQualityGateStage(runId, stage);
          break;
        case CIStageType.DEPLOY:
          await this.executeDeploymentStage(runId, stage);
          break;
        default:
          throw new CIExecutionError(`Unknown stage type: ${stage.stageType}`);
      }

      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Update stage status to success
      await this.updateStageStatus(stage.stageId, CIRunStatus.SUCCESS, duration);

      // Publish stage completion event
      await eventBus.createAndPublish('ci_stage', 'orchestrator', {
        runId,
        stageId: stage.stageId,
        action: 'completed',
        status: CIRunStatus.SUCCESS,
        stageType: stage.stageType,
        duration
      });

    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : 'Stage execution failed';

      // Update stage status to failed
      await this.updateStageStatus(stage.stageId, CIRunStatus.FAILED, duration, errorMessage);

      // Publish stage failure event
      await eventBus.createAndPublish('ci_stage', 'orchestrator', {
        runId,
        stageId: stage.stageId,
        action: 'failed',
        status: CIRunStatus.FAILED,
        stageType: stage.stageType,
        duration,
        errorMessage
      });

      throw error;
    }
  }

  private async executeBuildStage(runId: string, stage: CIStage): Promise<void> {
    logger.info('Executing build stage', { runId, stageId: stage.stageId });

    // For now, just simulate build success
    // In a real implementation, this would trigger actual build processes
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.info('Build stage completed', { runId, stageId: stage.stageId });
  }

  private async executeTestStage(runId: string, stage: CIStage): Promise<void> {
    logger.info('Executing test stage', { runId, stageId: stage.stageId });

    const run = await this.getCIRun(runId);
    if (!run) {
      throw new CIExecutionError(`CI run not found: ${runId}`);
    }

    // Execute WeSign Playwright tests
    await this.executePlaywrightTests(runId, run, stage);

    logger.info('Test stage completed', { runId, stageId: stage.stageId });
  }

  private async executeQualityGateStage(runId: string, stage: CIStage): Promise<void> {
    logger.info('Executing quality gate stage', { runId, stageId: stage.stageId });

    const run = await this.getCIRun(runId);
    if (!run) {
      throw new CIExecutionError(`CI run not found: ${runId}`);
    }

    // Check quality gates
    const qualityGatePassed = run.testSuccessRate >= 95; // 95% success rate required

    if (!qualityGatePassed) {
      throw new CIExecutionError(`Quality gate failed: Test success rate ${run.testSuccessRate}% is below 95%`);
    }

    // Update run quality status
    await this.updateCIRun(runId, {});
    this.db.prepare(`
      UPDATE ci_runs SET quality_gate_passed = ?, quality_score = ? WHERE run_id = ?
    `).run(1, run.testSuccessRate, runId);

    logger.info('Quality gate stage passed', { runId, stageId: stage.stageId, successRate: run.testSuccessRate });
  }

  private async executeDeploymentStage(runId: string, stage: CIStage): Promise<void> {
    logger.info('Executing deployment stage', { runId, stageId: stage.stageId });

    const run = await this.getCIRun(runId);
    if (!run) {
      throw new CIExecutionError(`CI run not found: ${runId}`);
    }

    // Update deployment status
    await this.updateCIRun(runId, {
      deploymentStatus: DeploymentStatus.DEPLOYING
    });

    // Simulate deployment (in real implementation, this would deploy to actual servers)
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Update deployment status to deployed
    await this.updateCIRun(runId, {
      deploymentStatus: DeploymentStatus.DEPLOYED
    });

    logger.info('Deployment stage completed', { runId, stageId: stage.stageId });
  }

  private async executePlaywrightTests(runId: string, run: CIRun, stage: CIStage): Promise<void> {
    return new Promise((resolve, reject) => {
      const pythonPath = process.env.PYTHON_PATH || 'C:/Users/gals/AppData/Local/Programs/Python/Python312/python.exe';
      const testSuitePath = run.testSuitePath || 'C:/Users/gals/seleniumpythontests-1/playwright_tests/';

      const args = [
        '-m', 'pytest',
        testSuitePath,
        '--workers', (run.parallelWorkers || 4).toString(),
        '--json-report',
        '--json-report-file', path.join(this.artifactsPath, `${runId}-test-results.json`),
        '--html', path.join(this.artifactsPath, `${runId}-test-report.html`),
        '--self-contained-html'
      ];

      if (run.testFilter) {
        args.push('-k', run.testFilter);
      }

      logger.info('Starting Playwright tests', {
        runId,
        pythonPath,
        testSuitePath,
        args: args.join(' ')
      });

      const testProcess = spawn(pythonPath, args, {
        cwd: testSuitePath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      this.runningProcesses.set(runId, testProcess);

      let stdout = '';
      let stderr = '';

      testProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Stream logs in real-time via WebSocket
        eventBus.createAndPublish('ci_stage_log', 'orchestrator', {
          runId,
          stageId: stage.stageId,
          type: 'stdout',
          data: data.toString()
        });
      });

      testProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
        eventBus.createAndPublish('ci_stage_log', 'orchestrator', {
          runId,
          stageId: stage.stageId,
          type: 'stderr',
          data: data.toString()
        });
      });

      testProcess.on('close', async (code) => {
        this.runningProcesses.delete(runId);

        // Store logs
        await this.updateStageOutput(stage.stageId, stdout, stderr);

        // Parse test results
        try {
          const resultsPath = path.join(this.artifactsPath, `${runId}-test-results.json`);
          if (fs.existsSync(resultsPath)) {
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
            await this.updateTestResults(runId, results);

            // Create test report artifact
            await this.createArtifact({
              runId,
              stageId: stage.stageId,
              name: 'Test Results Report',
              artifactType: 'report',
              fileName: `${runId}-test-report.html`,
              filePath: path.join(this.artifactsPath, `${runId}-test-report.html`),
              category: 'test_report',
              reportFormat: 'html'
            });
          }
        } catch (error) {
          logger.warn('Failed to parse test results', { error, runId });
        }

        if (code === 0) {
          resolve();
        } else {
          reject(new CIExecutionError(`Test execution failed with exit code: ${code}`));
        }
      });

      testProcess.on('error', (error) => {
        this.runningProcesses.delete(runId);
        logger.error('Test process error', { error, runId });
        reject(new CIExecutionError(`Test process error: ${error.message}`));
      });
    });
  }

  // ===============================
  // STAGE MANAGEMENT
  // ===============================

  private async createStagesForRun(runId: string, stageDefinitions: any[]): Promise<void> {
    for (const stageDef of stageDefinitions) {
      const stageId = uuidv4();

      this.db.prepare(`
        INSERT INTO ci_stages (
          stage_id, ci_run_id, name, description, stage_type, status, sequence_number,
          depends_on, config, command, tests_executed, tests_passed, tests_failed,
          artifacts_generated, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        stageId, runId, stageDef.name, stageDef.description, stageDef.type, CIRunStatus.PENDING,
        stageDef.sequence, stageDef.dependsOn?.join(','), JSON.stringify(stageDef.config),
        stageDef.command, 0, 0, 0, 0, new Date().toISOString(), new Date().toISOString()
      );
    }
  }

  async getCIStages(runId: string): Promise<CIStage[]> {
    try {
      const results = this.db.prepare(`
        SELECT * FROM ci_stages WHERE ci_run_id = ? ORDER BY sequence_number
      `).all(runId);

      return results.map((row: any) => this.mapDbRowToCIStage(row));
    } catch (error) {
      logger.error('Failed to get CI stages', { error, runId });
      throw new CIExecutionError('Failed to get CI stages', error);
    }
  }

  async getCIStagesSummary(runId: string): Promise<any[]> {
    try {
      const results = this.db.prepare(`
        SELECT stage_id, name, stage_type, status, duration, artifacts_generated
        FROM ci_stages
        WHERE ci_run_id = ?
        ORDER BY sequence_number
      `).all(runId);

      return results.map((row: any) => ({
        stageId: row.stage_id,
        name: row.name,
        stageType: row.stage_type,
        status: row.status,
        duration: row.duration,
        artifactsGenerated: row.artifacts_generated
      }));
    } catch (error) {
      logger.error('Failed to get CI stages summary', { error, runId });
      return [];
    }
  }

  private async updateStageStatus(
    stageId: string,
    status: CIRunStatusType,
    duration?: number,
    errorMessage?: string
  ): Promise<void> {
    const updates: string[] = ['status = ?', 'updated_at = ?'];
    const values: any[] = [status, new Date().toISOString()];

    if (status === CIRunStatus.RUNNING) {
      updates.push('started_at = ?');
      values.push(new Date().toISOString());
    }

    if (status === CIRunStatus.SUCCESS || status === CIRunStatus.FAILED) {
      updates.push('completed_at = ?');
      values.push(new Date().toISOString());
    }

    if (duration !== undefined) {
      updates.push('duration = ?');
      values.push(duration);
    }

    if (errorMessage) {
      updates.push('error_log = ?');
      values.push(errorMessage);
    }

    values.push(stageId);

    const query = `UPDATE ci_stages SET ${updates.join(', ')} WHERE stage_id = ?`;
    this.db.prepare(query).run(...values);
  }

  private async updateStageOutput(stageId: string, stdout: string, stderr: string): Promise<void> {
    this.db.prepare(`
      UPDATE ci_stages SET output_log = ?, error_log = ?, updated_at = ? WHERE stage_id = ?
    `).run(stdout, stderr, new Date().toISOString(), stageId);
  }

  async getStageLogs(stageId: string, options: LogStreamOptions): Promise<any> {
    try {
      const stage = this.db.prepare(`
        SELECT output_log, error_log, console_output FROM ci_stages WHERE stage_id = ?
      `).get(stageId);

      if (!stage) {
        throw new CIValidationError(`Stage not found: ${stageId}`);
      }

      const logs = {
        stdout: stage.output_log || '',
        stderr: stage.error_log || '',
        console: stage.console_output || ''
      };

      if (options.lines) {
        // Return last N lines
        Object.keys(logs).forEach(key => {
          const lines = (logs as any)[key].split('\n');
          (logs as any)[key] = lines.slice(-options.lines!).join('\n');
        });
      }

      return logs;
    } catch (error) {
      logger.error('Failed to get stage logs', { error, stageId });
      throw error instanceof CIError ? error : new CIExecutionError('Failed to get stage logs', error);
    }
  }

  // ===============================
  // ARTIFACT MANAGEMENT
  // ===============================

  async getCIArtifacts(runId: string, filters?: ArtifactFilters): Promise<CIArtifact[]> {
    try {
      let whereClause = 'ci_run_id = ?';
      const params: any[] = [runId];

      if (filters?.type) {
        whereClause += ' AND artifact_type = ?';
        params.push(filters.type);
      }

      if (filters?.category) {
        whereClause += ' AND category = ?';
        params.push(filters.category);
      }

      const results = this.db.prepare(`
        SELECT * FROM ci_artifacts WHERE ${whereClause} ORDER BY created_at DESC
      `).all(...params);

      return results.map((row: any) => this.mapDbRowToCIArtifact(row));
    } catch (error) {
      logger.error('Failed to get CI artifacts', { error, runId, filters });
      throw new CIExecutionError('Failed to get CI artifacts', error);
    }
  }

  async getArtifact(artifactId: string): Promise<CIArtifact | null> {
    try {
      const result = this.db.prepare(`
        SELECT * FROM ci_artifacts WHERE artifact_id = ?
      `).get(artifactId);

      if (!result) return null;

      return this.mapDbRowToCIArtifact(result);
    } catch (error) {
      logger.error('Failed to get artifact', { error, artifactId });
      throw new CIExecutionError('Failed to get artifact', error);
    }
  }

  async downloadArtifact(artifactId: string, res: Response): Promise<void> {
    try {
      const artifact = await this.getArtifact(artifactId);
      if (!artifact) {
        throw new CIValidationError(`Artifact not found: ${artifactId}`);
      }

      if (!fs.existsSync(artifact.filePath)) {
        throw new CIExecutionError(`Artifact file not found: ${artifact.filePath}`);
      }

      res.setHeader('Content-Disposition', `attachment; filename="${artifact.fileName}"`);
      res.setHeader('Content-Type', artifact.mimeType || 'application/octet-stream');

      const stream = createReadStream(artifact.filePath);
      stream.pipe(res);

    } catch (error) {
      logger.error('Failed to download artifact', { error, artifactId });
      throw error instanceof CIError ? error : new CIExecutionError('Failed to download artifact', error);
    }
  }

  async updateArtifactDownloadCount(artifactId: string): Promise<void> {
    try {
      this.db.prepare(`
        UPDATE ci_artifacts SET download_count = download_count + 1, updated_at = ? WHERE artifact_id = ?
      `).run(new Date().toISOString(), artifactId);
    } catch (error) {
      logger.warn('Failed to update artifact download count', { error, artifactId });
    }
  }

  private async createArtifact(artifactData: {
    runId: string;
    stageId?: string;
    name: string;
    artifactType: string;
    fileName: string;
    filePath: string;
    category?: string;
    reportFormat?: string;
  }): Promise<void> {
    try {
      const artifactId = uuidv4();
      const fileSize = fs.existsSync(artifactData.filePath) ? fs.statSync(artifactData.filePath).size : 0;

      this.db.prepare(`
        INSERT INTO ci_artifacts (
          artifact_id, ci_run_id, ci_stage_id, name, artifact_type, file_path, file_name,
          file_size, category, report_format, is_public, retention_days, download_count,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        artifactId, artifactData.runId, artifactData.stageId, artifactData.name,
        artifactData.artifactType, artifactData.filePath, artifactData.fileName,
        fileSize, artifactData.category, artifactData.reportFormat, 0, 90, 0,
        new Date().toISOString(), new Date().toISOString()
      );

      logger.info('Artifact created', { artifactId, runId: artifactData.runId });
    } catch (error) {
      logger.error('Failed to create artifact', { error, artifactData });
    }
  }

  // ===============================
  // ROLLBACK MANAGEMENT
  // ===============================

  async initializeRollback(runId: string, options: RollbackOptions): Promise<CIRollback> {
    try {
      const rollbackId = uuidv4();
      const run = await this.getCIRun(runId);
      if (!run) {
        throw new CIValidationError(`CI run not found: ${runId}`);
      }

      const rollback: Omit<CIRollback, 'id'> = {
        rollbackId,
        originalRunId: runId,
        rollbackType: 'manual',
        triggerReason: options.reason,
        targetEnvironment: run.environment,
        rollbackToVersion: options.rollbackToVersion,
        rollbackToCommit: options.rollbackToCommit,
        status: CIRunStatus.PENDING,
        rollbackSuccessful: false,
        initiatedBy: options.initiatedBy,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const result = this.db.prepare(`
        INSERT INTO ci_rollbacks (
          rollback_id, original_run_id, rollback_type, trigger_reason, target_environment,
          rollback_to_version, rollback_to_commit, status, rollback_successful,
          initiated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        rollback.rollbackId, rollback.originalRunId, rollback.rollbackType,
        rollback.triggerReason, rollback.targetEnvironment, rollback.rollbackToVersion,
        rollback.rollbackToCommit, rollback.status, rollback.rollbackSuccessful ? 1 : 0,
        rollback.initiatedBy, rollback.createdAt, rollback.updatedAt
      );

      const createdRollback = { ...rollback, id: result.lastInsertRowid as number };

      logger.info('Rollback initialized', { rollbackId, originalRunId: runId });
      return createdRollback;

    } catch (error) {
      logger.error('Failed to initialize rollback', { error, runId, options });
      throw error instanceof CIError ? error : new CIExecutionError('Failed to initialize rollback', error);
    }
  }

  // ===============================
  // ANALYTICS AND METRICS
  // ===============================

  async getDashboardStats(tenantId: string, timeframe: string): Promise<CIDashboardStats> {
    try {
      let whereClause = '(tenant_id = ? OR tenant_id IS NULL)';
      const params = [tenantId];

      // Add timeframe filter
      const now = new Date();
      let fromDate: Date;
      switch (timeframe) {
        case '1d':
          fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      whereClause += ' AND created_at >= ?';
      params.push(fromDate.toISOString());

      // Get basic stats
      const stats = this.db.prepare(`
        SELECT
          COUNT(*) as total_runs,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_runs,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_runs,
          AVG(CASE WHEN test_success_rate > 0 THEN test_success_rate END) as avg_success_rate,
          AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration
        FROM ci_runs WHERE ${whereClause}
      `).get(...params);

      // Get recent runs
      const recentRuns = await this.getCIRuns({ tenantId }, { page: 1, limit: 10 });

      // Get environment stats
      const envStats = this.db.prepare(`
        SELECT
          environment,
          COUNT(*) as total_runs,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_runs,
          AVG(CASE WHEN duration > 0 THEN duration END) as avg_duration,
          MAX(created_at) as last_deployment
        FROM ci_runs
        WHERE ${whereClause}
        GROUP BY environment
      `).all(...params);

      const environmentStats: EnvironmentStats[] = envStats.map((env: any) => ({
        environment: env.environment,
        totalRuns: env.total_runs,
        successRate: env.successful_runs / env.total_runs * 100,
        averageDuration: env.avg_duration || 0,
        lastDeployment: env.last_deployment
      }));

      return {
        totalRuns: stats.total_runs,
        successfulRuns: stats.successful_runs,
        failedRuns: stats.failed_runs,
        averageSuccessRate: stats.avg_success_rate || 0,
        averageDuration: stats.avg_duration || 0,
        recentRuns: recentRuns.runs,
        environmentStats
      };

    } catch (error) {
      logger.error('Failed to get dashboard stats', { error, tenantId, timeframe });
      throw new CIExecutionError('Failed to get dashboard stats', error);
    }
  }

  async getCIMetrics(tenantId: string, timeframe: string): Promise<CIMetrics> {
    try {
      // Implement DORA metrics calculation
      // This is a simplified version - real implementation would be more sophisticated

      return {
        deploymentFrequency: 2.5, // deployments per day
        leadTimeForChanges: 2.1, // hours
        meanTimeToRecovery: 0.8, // hours
        changeFailureRate: 5.2, // percentage
        testAutomationRate: 95.0, // percentage
        qualityGatePassRate: 92.5 // percentage
      };

    } catch (error) {
      logger.error('Failed to get CI metrics', { error, tenantId, timeframe });
      throw new CIExecutionError('Failed to get CI metrics', error);
    }
  }

  // ===============================
  // CONFIGURATION MANAGEMENT
  // ===============================

  async getCIConfigurations(tenantId: string): Promise<CIConfiguration[]> {
    try {
      const results = this.db.prepare(`
        SELECT * FROM ci_configurations
        WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_active = 1
        ORDER BY name
      `).all(tenantId);

      return results.map((row: any) => ({
        id: row.id,
        configId: row.config_id,
        name: row.name,
        description: row.description,
        pipelineConfig: JSON.parse(row.pipeline_config || '{}'),
        defaultVariables: JSON.parse(row.default_variables || '{}'),
        stages: JSON.parse(row.stages || '[]'),
        qualityGates: JSON.parse(row.quality_gates || '[]'),
        notificationConfig: JSON.parse(row.notification_config || '{}'),
        targetEnvironments: JSON.parse(row.target_environments || '[]'),
        deploymentConfig: JSON.parse(row.deployment_config || '{}'),
        testSuiteConfig: JSON.parse(row.test_suite_config || '{}'),
        parallelConfig: JSON.parse(row.parallel_config || '{}'),
        jenkinsJobTemplate: JSON.parse(row.jenkins_job_template || '{}'),
        jenkinsParameters: JSON.parse(row.jenkins_parameters || '{}'),
        version: row.version,
        isActive: row.is_active === 1,
        tenantId: row.tenant_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));
    } catch (error) {
      logger.error('Failed to get CI configurations', { error, tenantId });
      throw new CIExecutionError('Failed to get CI configurations', error);
    }
  }

  async getCIConfiguration(configId: string): Promise<CIConfiguration | null> {
    try {
      const result = this.db.prepare(`
        SELECT * FROM ci_configurations WHERE config_id = ? AND is_active = 1
      `).get(configId);

      if (!result) return null;

      return {
        id: result.id,
        configId: result.config_id,
        name: result.name,
        description: result.description,
        pipelineConfig: JSON.parse(result.pipeline_config || '{}'),
        defaultVariables: JSON.parse(result.default_variables || '{}'),
        stages: JSON.parse(result.stages || '[]'),
        qualityGates: JSON.parse(result.quality_gates || '[]'),
        notificationConfig: JSON.parse(result.notification_config || '{}'),
        targetEnvironments: JSON.parse(result.target_environments || '[]'),
        deploymentConfig: JSON.parse(result.deployment_config || '{}'),
        testSuiteConfig: JSON.parse(result.test_suite_config || '{}'),
        parallelConfig: JSON.parse(result.parallel_config || '{}'),
        jenkinsJobTemplate: JSON.parse(result.jenkins_job_template || '{}'),
        jenkinsParameters: JSON.parse(result.jenkins_parameters || '{}'),
        version: result.version,
        isActive: result.is_active === 1,
        tenantId: result.tenant_id,
        createdBy: result.created_by,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };
    } catch (error) {
      logger.error('Failed to get CI configuration', { error, configId });
      throw new CIExecutionError('Failed to get CI configuration', error);
    }
  }

  async getCIEnvironments(tenantId: string): Promise<CIEnvironmentConfig[]> {
    try {
      const results = this.db.prepare(`
        SELECT * FROM ci_environments
        WHERE (tenant_id = ? OR tenant_id IS NULL) AND is_active = 1
        ORDER BY name
      `).all(tenantId);

      return results.map((row: any) => this.mapDbRowToCIEnvironment(row));
    } catch (error) {
      logger.error('Failed to get CI environments', { error, tenantId });
      throw new CIExecutionError('Failed to get CI environments', error);
    }
  }

  // ===============================
  // NOTIFICATION MANAGEMENT
  // ===============================

  async getCINotifications(runId: string): Promise<CINotification[]> {
    try {
      const results = this.db.prepare(`
        SELECT * FROM ci_notifications WHERE ci_run_id = ? ORDER BY created_at DESC
      `).all(runId);

      return results.map((row: any) => this.mapDbRowToCINotification(row));
    } catch (error) {
      logger.error('Failed to get CI notifications', { error, runId });
      throw new CIExecutionError('Failed to get CI notifications', error);
    }
  }

  // ===============================
  // HELPER METHODS
  // ===============================

  private async updateTestResults(runId: string, testResults: any): Promise<void> {
    try {
      const totalTests = testResults.summary?.total || 0;
      const passedTests = testResults.summary?.passed || 0;
      const failedTests = testResults.summary?.failed || 0;
      const skippedTests = testResults.summary?.skipped || 0;
      const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

      this.db.prepare(`
        UPDATE ci_runs SET
          total_tests = ?, passed_tests = ?, failed_tests = ?, skipped_tests = ?,
          test_success_rate = ?, updated_at = ?
        WHERE run_id = ?
      `).run(
        totalTests, passedTests, failedTests, skippedTests, successRate,
        new Date().toISOString(), runId
      );

      logger.info('Test results updated', {
        runId, totalTests, passedTests, failedTests, skippedTests, successRate
      });
    } catch (error) {
      logger.error('Failed to update test results', { error, runId });
    }
  }

  private async calculateTestMetrics(runId: string): Promise<void> {
    // Additional test metrics calculation would go here
    logger.debug('Calculating test metrics', { runId });
  }

  private mapDbRowToCIRun(row: any): CIRun {
    return {
      id: row.id,
      runId: row.run_id,
      name: row.name,
      description: row.description,
      status: row.status,
      environment: row.environment,
      branch: row.branch,
      commitHash: row.commit_hash,
      commitMessage: row.commit_message,
      config: row.config ? JSON.parse(row.config) : undefined,
      variables: row.variables ? JSON.parse(row.variables) : undefined,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      jenkinsJobName: row.jenkins_job_name,
      jenkinsBuildNumber: row.jenkins_build_number,
      jenkinsJobUrl: row.jenkins_job_url,
      jenkinsConsoleUrl: row.jenkins_console_url,
      testSuitePath: row.test_suite_path,
      testFilter: row.test_filter,
      parallelWorkers: row.parallel_workers,
      totalTests: row.total_tests,
      passedTests: row.passed_tests,
      failedTests: row.failed_tests,
      skippedTests: row.skipped_tests,
      testSuccessRate: row.test_success_rate,
      qualityGatePassed: row.quality_gate_passed === 1,
      qualityScore: row.quality_score,
      deployServer: row.deploy_server,
      deployPath: row.deploy_path,
      deploymentStatus: row.deployment_status,
      errorMessage: row.error_message,
      errorDetails: row.error_details,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      tenantId: row.tenant_id
    };
  }

  private mapDbRowToCIStage(row: any): CIStage {
    return {
      id: row.id,
      stageId: row.stage_id,
      ciRunId: row.ci_run_id,
      name: row.name,
      description: row.description,
      stageType: row.stage_type,
      status: row.status,
      sequenceNumber: row.sequence_number,
      dependsOn: row.depends_on ? row.depends_on.split(',') : undefined,
      config: row.config ? JSON.parse(row.config) : undefined,
      command: row.command,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      duration: row.duration,
      jenkinsstageName: row.jenkins_stage_name,
      jenkinsStageUrl: row.jenkins_stage_url,
      outputLog: row.output_log,
      errorLog: row.error_log,
      consoleOutput: row.console_output,
      exitCode: row.exit_code,
      successCriteria: row.success_criteria ? JSON.parse(row.success_criteria) : undefined,
      artifactsGenerated: row.artifacts_generated,
      testsExecuted: row.tests_executed,
      testsPassed: row.tests_passed,
      testsFailed: row.tests_failed,
      qualityChecks: row.quality_checks ? JSON.parse(row.quality_checks) : undefined,
      qualityResults: row.quality_results ? JSON.parse(row.quality_results) : undefined,
      deploymentTarget: row.deployment_target,
      deploymentArtifacts: row.deployment_artifacts ? JSON.parse(row.deployment_artifacts) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToCIArtifact(row: any): CIArtifact {
    return {
      id: row.id,
      artifactId: row.artifact_id,
      ciRunId: row.ci_run_id,
      ciStageId: row.ci_stage_id,
      name: row.name,
      description: row.description,
      artifactType: row.artifact_type,
      filePath: row.file_path,
      fileName: row.file_name,
      fileSize: row.file_size,
      fileHash: row.file_hash,
      mimeType: row.mime_type,
      category: row.category,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      testName: row.test_name,
      testFile: row.test_file,
      testStatus: row.test_status,
      reportFormat: row.report_format,
      reportSummary: row.report_summary ? JSON.parse(row.report_summary) : undefined,
      isPublic: row.is_public === 1,
      retentionDays: row.retention_days,
      expiresAt: row.expires_at,
      downloadCount: row.download_count,
      downloadUrl: row.download_url,
      externalUrl: row.external_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToCIEnvironment(row: any): CIEnvironmentConfig {
    return {
      id: row.id,
      environmentId: row.environment_id,
      name: row.name,
      environmentType: row.environment_type,
      serverUrl: row.server_url,
      serverName: row.server_name,
      deploymentPath: row.deployment_path,
      credentials: row.credentials ? JSON.parse(row.credentials) : undefined,
      apiKeys: row.api_keys ? JSON.parse(row.api_keys) : undefined,
      environmentVariables: row.environment_variables ? JSON.parse(row.environment_variables) : undefined,
      deploymentConfig: row.deployment_config ? JSON.parse(row.deployment_config) : undefined,
      testConfig: row.test_config ? JSON.parse(row.test_config) : undefined,
      healthCheckUrl: row.health_check_url,
      monitoringEnabled: row.monitoring_enabled === 1,
      alertThreshold: row.alert_threshold,
      isActive: row.is_active === 1,
      requiresApproval: row.requires_approval === 1,
      approvedUsers: row.approved_users ? JSON.parse(row.approved_users) : undefined,
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapDbRowToCINotification(row: any): CINotification {
    return {
      id: row.id,
      notificationId: row.notification_id,
      ciRunId: row.ci_run_id,
      ciStageId: row.ci_stage_id,
      type: row.type,
      eventType: row.event_type,
      recipients: row.recipients ? JSON.parse(row.recipients) : [],
      subject: row.subject,
      message: row.message,
      status: row.status,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}