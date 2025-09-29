import Database from 'better-sqlite3';
import { join } from 'path';
import { readFile } from 'fs/promises';
import {
  TraceViewerRun,
  TraceStep,
  TraceArtifact,
  ConsoleLog,
  NetworkLog,
  PerformanceMetric,
  TestEnvironment,
  GetRunsRequest,
  GetRunsResponse,
  GetRunDetailResponse,
  TraceViewerFilters,
  StepFilters,
  RunStatistics,
  StepStatistics
} from '../types/trace';

export class TraceDatabase {
  private db: Database.Database;

  constructor(dbPath: string = './data/trace.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    try {
      // Read and execute the trace schema
      const schemaPath = join(__dirname, 'trace-schema.sql');
      const schema = require('fs').readFileSync(schemaPath, 'utf8');
      this.db.exec(schema);
    } catch (error) {
      console.error('Failed to initialize trace database:', error);
      throw error;
    }
  }

  // Test Runs
  async createRun(run: Omit<TraceViewerRun, 'id' | 'createdAt' | 'updatedAt' | 'passRate'>): Promise<TraceViewerRun> {
    const id = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO test_runs (
        id, suite_id, suite_name, started_at, finished_at, status, environment,
        browser, test_mode, total_tests, passed_tests, failed_tests, skipped_tests,
        duration_ms, branch, commit_sha, triggered_by, artifacts_path, trace_file,
        video_file, html_report, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id, run.suiteId, run.suiteName, run.startedAt, run.finishedAt, run.status,
      run.environment, run.browser, run.testMode, run.totals.total, run.totals.passed,
      run.totals.failed, run.totals.skipped, run.duration, run.branch, run.commitSha,
      run.triggeredBy, run.artifactsPath, run.traceFile, run.videoFile,
      run.htmlReport, run.metadata ? JSON.stringify(run.metadata) : null, now, now
    ]);

    return this.getRunById(id)!;
  }

  async updateRun(id: string, updates: Partial<TraceViewerRun>): Promise<TraceViewerRun | null> {
    const setClauses: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'totals' && value) {
        setClauses.push('total_tests = ?', 'passed_tests = ?', 'failed_tests = ?', 'skipped_tests = ?');
        values.push(value.total, value.passed, value.failed, value.skipped);
      } else if (key === 'metadata' && value) {
        setClauses.push('metadata_json = ?');
        values.push(JSON.stringify(value));
      } else if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'passRate') {
        const dbColumn = this.camelToSnake(key);
        setClauses.push(`${dbColumn} = ?`);
        values.push(value);
      }
    });

    if (setClauses.length === 0) return this.getRunById(id);

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE test_runs 
      SET ${setClauses.join(', ')} 
      WHERE id = ?
    `);

    stmt.run(values);
    return this.getRunById(id);
  }

  async getRunById(id: string): Promise<TraceViewerRun | null> {
    const stmt = this.db.prepare(`
      SELECT 
        id, suite_id, suite_name, started_at, finished_at, status, environment,
        browser, test_mode, total_tests, passed_tests, failed_tests, skipped_tests,
        duration_ms, branch, commit_sha, triggered_by, artifacts_path, trace_file,
        video_file, html_report, metadata_json, created_at, updated_at,
        ROUND(CAST(passed_tests AS REAL) / NULLIF(total_tests, 0) * 100, 2) as pass_rate
      FROM test_runs 
      WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapRunFromDb(row) : null;
  }

  async getRuns(request: GetRunsRequest = {}): Promise<GetRunsResponse> {
    const {
      page = 1,
      limit = 50,
      status,
      environment,
      suite,
      branch,
      startDate,
      endDate,
      search
    } = request;

    const whereClauses: string[] = [];
    const values: any[] = [];

    if (status) {
      whereClauses.push('status = ?');
      values.push(status);
    }

    if (environment) {
      whereClauses.push('environment = ?');
      values.push(environment);
    }

    if (suite) {
      whereClauses.push('suite_name LIKE ?');
      values.push(`%${suite}%`);
    }

    if (branch) {
      whereClauses.push('branch = ?');
      values.push(branch);
    }

    if (startDate) {
      whereClauses.push('started_at >= ?');
      values.push(startDate);
    }

    if (endDate) {
      whereClauses.push('started_at <= ?');
      values.push(endDate);
    }

    if (search) {
      whereClauses.push('(suite_name LIKE ? OR commit_sha LIKE ?)');
      values.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    // Get total count
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as total FROM test_runs ${whereClause}
    `);
    const { total } = countStmt.get(values) as { total: number };

    // Get runs
    const stmt = this.db.prepare(`
      SELECT 
        id, suite_id, suite_name, started_at, finished_at, status, environment,
        browser, test_mode, total_tests, passed_tests, failed_tests, skipped_tests,
        duration_ms, branch, commit_sha, triggered_by, artifacts_path, trace_file,
        video_file, html_report, metadata_json, created_at, updated_at,
        ROUND(CAST(passed_tests AS REAL) / NULLIF(total_tests, 0) * 100, 2) as pass_rate
      FROM test_runs 
      ${whereClause}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all([...values, limit, offset]);
    const runs = rows.map(row => this.mapRunFromDb(row));

    return {
      runs,
      total,
      page,
      limit,
      hasMore: offset + runs.length < total
    };
  }

  // Test Steps
  async createStep(step: Omit<TraceStep, 'id' | 'createdAt'>): Promise<TraceStep> {
    const id = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO test_steps (
        id, run_id, test_id, test_name, step_index, action_type, action_name,
        selector, url, expected_value, actual_value, started_at, finished_at,
        duration_ms, status, error_message, stack_trace, retry_count,
        screenshot_before, screenshot_after, video_timestamp, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id, step.runId, step.testId, step.testName, step.stepIndex, step.actionType,
      step.actionName, step.selector, step.url, step.expectedValue, step.actualValue,
      step.startedAt, step.finishedAt, step.duration, step.status, step.errorMessage,
      step.stackTrace, step.retryCount, step.screenshotBefore, step.screenshotAfter,
      step.videoTimestamp, now
    ]);

    return this.getStepById(id)!;
  }

  async getStepById(id: string): Promise<TraceStep | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM test_steps WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapStepFromDb(row) : null;
  }

  async getStepsByRunId(runId: string, filters?: StepFilters): Promise<TraceStep[]> {
    const whereClauses = ['run_id = ?'];
    const values: any[] = [runId];

    if (filters?.status && filters.status.length > 0) {
      whereClauses.push(`status IN (${filters.status.map(() => '?').join(', ')})`);
      values.push(...filters.status);
    }

    if (filters?.actionTypes && filters.actionTypes.length > 0) {
      whereClauses.push(`action_type IN (${filters.actionTypes.map(() => '?').join(', ')})`);
      values.push(...filters.actionTypes);
    }

    if (filters?.hasError) {
      whereClauses.push('error_message IS NOT NULL');
    }

    if (filters?.hasScreenshot) {
      whereClauses.push('(screenshot_before IS NOT NULL OR screenshot_after IS NOT NULL)');
    }

    if (filters?.duration?.min) {
      whereClauses.push('duration_ms >= ?');
      values.push(filters.duration.min);
    }

    if (filters?.duration?.max) {
      whereClauses.push('duration_ms <= ?');
      values.push(filters.duration.max);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM test_steps 
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY step_index ASC
    `);

    const rows = stmt.all(values);
    return rows.map(row => this.mapStepFromDb(row));
  }

  // Artifacts
  async createArtifact(artifact: Omit<TraceArtifact, 'id' | 'createdAt'>): Promise<TraceArtifact> {
    const id = `artifact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO test_artifacts (
        id, run_id, step_id, artifact_type, name, file_path, file_url,
        mime_type, file_size, thumbnail_path, thumbnail_url, width, height,
        duration_ms, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id, artifact.runId, artifact.stepId, artifact.artifactType, artifact.name,
      artifact.filePath, artifact.fileUrl, artifact.mimeType, artifact.fileSize,
      artifact.thumbnailPath, artifact.thumbnailUrl, artifact.width, artifact.height,
      artifact.duration, artifact.metadata ? JSON.stringify(artifact.metadata) : null, now
    ]);

    return this.getArtifactById(id)!;
  }

  async getArtifactById(id: string): Promise<TraceArtifact | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM test_artifacts WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapArtifactFromDb(row) : null;
  }

  async getArtifactsByRunId(runId: string, stepId?: string): Promise<TraceArtifact[]> {
    const whereClauses = ['run_id = ?'];
    const values: any[] = [runId];

    if (stepId) {
      whereClauses.push('step_id = ?');
      values.push(stepId);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM test_artifacts 
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY created_at ASC
    `);

    const rows = stmt.all(values);
    return rows.map(row => this.mapArtifactFromDb(row));
  }

  // Console Logs
  async createConsoleLog(log: Omit<ConsoleLog, 'id' | 'createdAt'>): Promise<ConsoleLog> {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO console_logs (
        id, run_id, step_id, timestamp, log_level, source, message,
        stack_trace, url, line_number, column_number, args_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id, log.runId, log.stepId, log.timestamp, log.level, log.source,
      log.message, log.stackTrace, log.url, log.lineNumber, log.columnNumber,
      log.args ? JSON.stringify(log.args) : null, now
    ]);

    return this.getConsoleLogById(id)!;
  }

  async getConsoleLogById(id: string): Promise<ConsoleLog | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM console_logs WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapConsoleLogFromDb(row) : null;
  }

  async getConsoleLogsByRunId(runId: string, stepId?: string): Promise<ConsoleLog[]> {
    const whereClauses = ['run_id = ?'];
    const values: any[] = [runId];

    if (stepId) {
      whereClauses.push('step_id = ?');
      values.push(stepId);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM console_logs 
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(values);
    return rows.map(row => this.mapConsoleLogFromDb(row));
  }

  // Network Logs
  async createNetworkLog(log: Omit<NetworkLog, 'id' | 'createdAt'>): Promise<NetworkLog> {
    const id = `net_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO network_logs (
        id, run_id, step_id, timestamp, method, url, status_code, status_text,
        request_headers_json, response_headers_json, request_body, response_body,
        request_size, response_size, duration_ms, failed, failure_reason, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      id, log.runId, log.stepId, log.timestamp, log.method, log.url,
      log.statusCode, log.statusText,
      log.requestHeaders ? JSON.stringify(log.requestHeaders) : null,
      log.responseHeaders ? JSON.stringify(log.responseHeaders) : null,
      log.requestBody, log.responseBody, log.requestSize, log.responseSize,
      log.duration, log.failed, log.failureReason, now
    ]);

    return this.getNetworkLogById(id)!;
  }

  async getNetworkLogById(id: string): Promise<NetworkLog | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM network_logs WHERE id = ?
    `);

    const row = stmt.get(id);
    return row ? this.mapNetworkLogFromDb(row) : null;
  }

  async getNetworkLogsByRunId(runId: string, stepId?: string): Promise<NetworkLog[]> {
    const whereClauses = ['run_id = ?'];
    const values: any[] = [runId];

    if (stepId) {
      whereClauses.push('step_id = ?');
      values.push(stepId);
    }

    const stmt = this.db.prepare(`
      SELECT * FROM network_logs 
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY timestamp ASC
    `);

    const rows = stmt.all(values);
    return rows.map(row => this.mapNetworkLogFromDb(row));
  }

  // Statistics
  async getRunStatistics(filters?: TraceViewerFilters): Promise<RunStatistics> {
    const whereClauses: string[] = [];
    const values: any[] = [];

    if (filters?.status && filters.status.length > 0) {
      whereClauses.push(`status IN (${filters.status.map(() => '?').join(', ')})`);
      values.push(...filters.status);
    }

    if (filters?.environments && filters.environments.length > 0) {
      whereClauses.push(`environment IN (${filters.environments.map(() => '?').join(', ')})`);
      values.push(...filters.environments);
    }

    if (filters?.dateRange?.start) {
      whereClauses.push('started_at >= ?');
      values.push(filters.dateRange.start);
    }

    if (filters?.dateRange?.end) {
      whereClauses.push('started_at <= ?');
      values.push(filters.dateRange.end);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Basic stats
    const basicStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_runs,
        ROUND(AVG(CAST(passed_tests AS REAL) / NULLIF(total_tests, 0) * 100), 2) as pass_rate,
        ROUND(AVG(duration_ms), 0) as average_duration
      FROM test_runs ${whereClause}
    `);
    const basicStats = basicStmt.get(values) as any;

    // Most failed tests
    const failedTestsStmt = this.db.prepare(`
      SELECT test_name, COUNT(*) as failure_count
      FROM test_steps ts
      JOIN test_runs tr ON ts.run_id = tr.id
      WHERE ts.status = 'failed' ${whereClauses.length > 0 ? `AND ${whereClauses.join(' AND ')}` : ''}
      GROUP BY test_name
      ORDER BY failure_count DESC
      LIMIT 10
    `);
    const mostFailedTests = failedTestsStmt.all(values);

    // Environment stats
    const envStmt = this.db.prepare(`
      SELECT 
        environment,
        COUNT(*) as runs,
        ROUND(AVG(CAST(passed_tests AS REAL) / NULLIF(total_tests, 0) * 100), 2) as pass_rate
      FROM test_runs ${whereClause}
      GROUP BY environment
      ORDER BY runs DESC
    `);
    const environmentStats = envStmt.all(values);

    // Browser statistics
    const browserStmt = this.db.prepare(`
      SELECT 
        browser,
        COUNT(*) as runs,
        ROUND(AVG(CASE WHEN status = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate
      FROM test_runs ${whereClause}
      GROUP BY browser
      ORDER BY runs DESC
    `);
    const browserStats = browserStmt.all(values).map((row: any) => ({
      browser: row.browser || 'unknown',
      runs: row.runs,
      passRate: row.pass_rate
    }));

    // Trend data (last 30 days)
    const trendStmt = this.db.prepare(`
      SELECT 
        DATE(started_at) as date,
        COUNT(*) as runs,
        ROUND(AVG(CASE WHEN status = 'passed' THEN 100.0 ELSE 0.0 END), 2) as pass_rate
      FROM test_runs ${whereClause}
      AND started_at >= datetime('now', '-30 days')
      GROUP BY DATE(started_at)
      ORDER BY date DESC
      LIMIT 30
    `);
    const trendData = trendStmt.all(values).map((row: any) => ({
      date: row.date,
      runs: row.runs,
      passRate: row.pass_rate
    }));

    return {
      totalRuns: basicStats.total_runs || 0,
      passRate: basicStats.pass_rate || 0,
      averageDuration: basicStats.average_duration || 0,
      mostFailedTests: mostFailedTests || [],
      environmentStats: environmentStats || [],
      browserStats: browserStats,
      trendData: trendData
    };
  }

  // Utility methods
  private mapRunFromDb(row: any): TraceViewerRun {
    return {
      id: row.id,
      suiteId: row.suite_id,
      suiteName: row.suite_name,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      status: row.status,
      environment: row.environment,
      browser: row.browser,
      testMode: row.test_mode,
      totals: {
        total: row.total_tests || 0,
        passed: row.passed_tests || 0,
        failed: row.failed_tests || 0,
        skipped: row.skipped_tests || 0
      },
      duration: row.duration_ms,
      branch: row.branch,
      commitSha: row.commit_sha,
      triggeredBy: row.triggered_by,
      artifactsPath: row.artifacts_path,
      traceFile: row.trace_file,
      videoFile: row.video_file,
      htmlReport: row.html_report,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      passRate: row.pass_rate || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private mapStepFromDb(row: any): TraceStep {
    return {
      id: row.id,
      runId: row.run_id,
      testId: row.test_id,
      testName: row.test_name,
      stepIndex: row.step_index,
      actionType: row.action_type,
      actionName: row.action_name,
      selector: row.selector,
      url: row.url,
      expectedValue: row.expected_value,
      actualValue: row.actual_value,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      duration: row.duration_ms,
      status: row.status,
      errorMessage: row.error_message,
      stackTrace: row.stack_trace,
      retryCount: row.retry_count,
      screenshotBefore: row.screenshot_before,
      screenshotAfter: row.screenshot_after,
      videoTimestamp: row.video_timestamp,
      createdAt: row.created_at
    };
  }

  private mapArtifactFromDb(row: any): TraceArtifact {
    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      artifactType: row.artifact_type,
      name: row.name,
      filePath: row.file_path,
      fileUrl: row.file_url,
      mimeType: row.mime_type,
      fileSize: row.file_size,
      thumbnailPath: row.thumbnail_path,
      thumbnailUrl: row.thumbnail_url,
      width: row.width,
      height: row.height,
      duration: row.duration_ms,
      metadata: row.metadata_json ? JSON.parse(row.metadata_json) : undefined,
      createdAt: row.created_at
    };
  }

  private mapConsoleLogFromDb(row: any): ConsoleLog {
    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      timestamp: row.timestamp,
      level: row.log_level,
      source: row.source,
      message: row.message,
      stackTrace: row.stack_trace,
      url: row.url,
      lineNumber: row.line_number,
      columnNumber: row.column_number,
      args: row.args_json ? JSON.parse(row.args_json) : undefined,
      createdAt: row.created_at
    };
  }

  private mapNetworkLogFromDb(row: any): NetworkLog {
    return {
      id: row.id,
      runId: row.run_id,
      stepId: row.step_id,
      timestamp: row.timestamp,
      method: row.method,
      url: row.url,
      statusCode: row.status_code,
      statusText: row.status_text,
      requestHeaders: row.request_headers_json ? JSON.parse(row.request_headers_json) : undefined,
      responseHeaders: row.response_headers_json ? JSON.parse(row.response_headers_json) : undefined,
      requestBody: row.request_body,
      responseBody: row.response_body,
      requestSize: row.request_size,
      responseSize: row.response_size,
      duration: row.duration_ms,
      failed: Boolean(row.failed),
      failureReason: row.failure_reason,
      createdAt: row.created_at
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // Cleanup methods
  async deleteRun(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM test_runs WHERE id = ?');
    stmt.run(id);
  }

  async cleanup(daysOld: number): Promise<{ runsDeleted: number; artifactsDeleted: number }> {
    const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000)).toISOString();
    
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM test_runs WHERE created_at < ?');
    const { count: runsToDelete } = countStmt.get(cutoffDate) as { count: number };

    const artifactCountStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM test_artifacts ta
      JOIN test_runs tr ON ta.run_id = tr.id
      WHERE tr.created_at < ?
    `);
    const { count: artifactsToDelete } = artifactCountStmt.get(cutoffDate) as { count: number };

    const deleteStmt = this.db.prepare('DELETE FROM test_runs WHERE created_at < ?');
    deleteStmt.run(cutoffDate);

    return {
      runsDeleted: runsToDelete,
      artifactsDeleted: artifactsToDelete
    };
  }

  close(): void {
    this.db.close();
  }
}