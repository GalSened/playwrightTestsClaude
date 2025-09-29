import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Schedule, ScheduleRun, SchedulerError } from '@/types/scheduler';
import { logger } from '@/utils/logger';
import { testDiscoveryService } from '@/services/testDiscoveryService';

export class SchedulerDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'scheduler.db') {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
    
    logger.info('Database initialized', { path: dbPath });
  }

  private initializeSchema(): void {
    try {
      logger.info('Initializing comprehensive database schema');
      
      // Initialize core scheduler schema
      this.initializeCoreSchema();
      
      // Initialize agent-related schema
      this.initializeAgentSchema();
      
      // Initialize test discovery schema
      this.initializeTestDiscoverySchema();
      
      // Initialize workflow execution schema
      this.initializeWorkflowSchema();
      
      // Run migrations for existing databases
      this.runMigrations();
      
      // Validate schema integrity
      this.validateSchemaIntegrity();
      
      logger.info('Comprehensive database schema initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database schema', { error });
      throw new SchedulerError('DATABASE_INIT_ERROR', 'Failed to initialize database schema', error);
    }
  }

  private runMigrations(): void {
    try {
      logger.info('Running database migrations');
      
      // Get current schema version
      this.ensureSchemaVersionTable();
      const currentVersion = this.getCurrentSchemaVersion();
      
      // Run migrations based on current version
      this.runMigrationsFromVersion(currentVersion);
      
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', { error });
      throw error;
    }
  }

  private ensureSchemaVersionTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY,
        version INTEGER NOT NULL,
        migration_name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        UNIQUE(version)
      );
    `);
  }

  private getCurrentSchemaVersion(): number {
    try {
      const result = this.db.prepare('SELECT MAX(version) as version FROM schema_versions').get() as any;
      return result?.version || 0;
    } catch (error) {
      return 0;
    }
  }

  private runMigrationsFromVersion(currentVersion: number): void {
    const migrations = [
      {
        version: 1,
        name: 'initial_schema',
        execute: () => {
          // Initial schema is already created, just mark as applied
          this.markMigrationApplied(1, 'initial_schema');
        }
      },
      {
        version: 2,
        name: 'add_recurrence_days',
        execute: () => {
          try {
            const result = this.db.prepare(`PRAGMA table_info(schedules)`).all() as any[];
            const hasRecurrenceDays = result.some(col => col.name === 'recurrence_days');
            
            if (!hasRecurrenceDays) {
              this.db.exec('ALTER TABLE schedules ADD COLUMN recurrence_days TEXT;');
              logger.info('Added recurrence_days column to schedules table');
            }
            this.markMigrationApplied(2, 'add_recurrence_days');
          } catch (error) {
            logger.warn('Recurrence days migration warning', { error });
          }
        }
      },
      {
        version: 3,
        name: 'add_generated_tests_support',
        execute: () => {
          try {
            const migrationPath = join(__dirname, 'migrations', 'add-generated-tests-support.sql');
            if (existsSync(migrationPath)) {
              const migration = readFileSync(migrationPath, 'utf8');
              this.db.exec(migration);
              logger.info('Applied generated tests support migration');
            }
            this.markMigrationApplied(3, 'add_generated_tests_support');
          } catch (error) {
            logger.warn('Generated tests migration warning', { error });
          }
        }
      },
      {
        version: 4,
        name: 'enhance_agent_capabilities',
        execute: () => {
          try {
            // Add additional columns to agent tables if they don't exist
            const agentTableInfo = this.db.prepare(`PRAGMA table_info(agent_states)`).all() as any[];
            
            // Check for recovery_attempts column
            if (!agentTableInfo.some(col => col.name === 'recovery_attempts')) {
              this.db.exec('ALTER TABLE agent_states ADD COLUMN recovery_attempts INTEGER DEFAULT 0;');
              this.db.exec('ALTER TABLE agent_states ADD COLUMN last_recovery_at TEXT;');
              this.db.exec('ALTER TABLE agent_states ADD COLUMN escalation_count INTEGER DEFAULT 0;');
              logger.info('Enhanced agent capabilities schema');
            }
            
            this.markMigrationApplied(4, 'enhance_agent_capabilities');
          } catch (error) {
            logger.warn('Agent capabilities enhancement warning', { error });
          }
        }
      },
      {
        version: 5,
        name: 'add_jira_integration_agent_type',
        execute: () => {
          try {
            // SQLite doesn't support modifying CHECK constraints directly
            // We need to recreate the agent_states table with the new constraint
            logger.info('Adding agent type support for jira-integration and failure-analysis');
            
            // First, check if both jira-integration and failure-analysis are supported
            let needsMigration = false;
            logger.info('Checking agent type constraints...');

            try {
              // Try to insert a test record with jira-integration type
              const testJiraStmt = this.db.prepare(`INSERT INTO agent_states (id, type, capabilities) VALUES ('test-jira', 'jira-integration', '[]')`);
              testJiraStmt.run();
              this.db.prepare(`DELETE FROM agent_states WHERE id = 'test-jira'`).run();
              logger.info('jira-integration type already supported');
            } catch (constraintError) {
              logger.info('jira-integration type not supported, migration needed');
              needsMigration = true;
            }

            if (!needsMigration) {
              try {
                // Try to insert a test record with failure-analysis type
                const testFailureStmt = this.db.prepare(`INSERT INTO agent_states (id, type, capabilities) VALUES ('test-failure', 'failure-analysis', '[]')`);
                testFailureStmt.run();
                this.db.prepare(`DELETE FROM agent_states WHERE id = 'test-failure'`).run();
                logger.info('failure-analysis type already supported');
                logger.info('Both agent types already supported');
              } catch (constraintError) {
                logger.info('failure-analysis type not supported, migration needed');
                needsMigration = true;
              }
            }

            if (needsMigration) {
              // If constraint error, we need to recreate the table
              logger.info('Recreating agent_states table with updated agent type support');
              
              // Create backup table
              this.db.exec(`
                CREATE TABLE agent_states_backup AS SELECT * FROM agent_states;
              `);
              
              // Drop existing table
              this.db.exec(`DROP TABLE agent_states;`);
              
              // Recreate table with updated constraint
              this.db.exec(`
                CREATE TABLE agent_states (
                  id TEXT PRIMARY KEY,
                  type TEXT NOT NULL CHECK (type IN (
                      'test-intelligence', 'healing', 'code-generation', 
                      'quality-assurance', 'performance-optimization', 
                      'workflow-orchestration', 'specialist', 'general-purpose',
                      'jira-integration', 'failure-analysis'
                  )),
                  status TEXT NOT NULL CHECK (status IN ('idle', 'active', 'busy', 'error', 'offline')) DEFAULT 'idle',
                  capabilities TEXT NOT NULL,
                  last_activity TEXT,
                  current_task TEXT,
                  performance_metrics TEXT DEFAULT '{}',
                  resource_usage TEXT DEFAULT '{}',
                  configuration TEXT DEFAULT '{}',
                  context TEXT DEFAULT '{}',
                  health_score REAL DEFAULT 1.0 CHECK (health_score >= 0 AND health_score <= 1.0),
                  error_count INTEGER DEFAULT 0,
                  success_count INTEGER DEFAULT 0,
                  total_executions INTEGER DEFAULT 0,
                  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
                  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
                  recovery_attempts INTEGER DEFAULT 0,
                  last_recovery_at TEXT,
                  escalation_count INTEGER DEFAULT 0
                );
              `);
              
              // Restore data from backup
              this.db.exec(`
                INSERT INTO agent_states SELECT * FROM agent_states_backup;
              `);
              
              // Drop backup table
              this.db.exec(`DROP TABLE agent_states_backup;`);
              
              logger.info('Successfully recreated agent_states table with jira-integration support');
            }
            
            this.markMigrationApplied(5, 'add_jira_integration_agent_type');
          } catch (error) {
            logger.error('JIRA integration agent type migration failed', { error });
            throw error;
          }
        }
      },
      {
        version: 6,
        name: 'fix_agent_type_constraint',
        execute: () => {
          try {
            logger.info('Fixing agent_states table constraint for failure-analysis type');

            // Test if failure-analysis type is supported
            let needsConstraintFix = false;
            try {
              const testStmt = this.db.prepare(`INSERT INTO agent_states (id, type, capabilities) VALUES ('test-failure-constraint', 'failure-analysis', '[]')`);
              testStmt.run();
              this.db.prepare(`DELETE FROM agent_states WHERE id = 'test-failure-constraint'`).run();
              logger.info('failure-analysis constraint already working');
            } catch (constraintError) {
              logger.info('failure-analysis constraint broken, fixing now');
              needsConstraintFix = true;
            }

            if (needsConstraintFix) {
              logger.info('Recreating agent_states table with proper failure-analysis constraint');

              // Create backup table
              this.db.exec(`CREATE TABLE agent_states_backup AS SELECT * FROM agent_states;`);

              // Drop existing table
              this.db.exec(`DROP TABLE agent_states;`);

              // Recreate table with updated constraint including failure-analysis
              this.db.exec(`
                CREATE TABLE agent_states (
                  id TEXT PRIMARY KEY,
                  type TEXT NOT NULL CHECK (type IN (
                      'test-intelligence', 'healing', 'code-generation',
                      'quality-assurance', 'performance-optimization',
                      'workflow-orchestration', 'specialist', 'general-purpose',
                      'jira-integration', 'failure-analysis'
                  )),
                  status TEXT NOT NULL CHECK (status IN ('idle', 'active', 'busy', 'error', 'offline')) DEFAULT 'idle',
                  capabilities TEXT NOT NULL,
                  last_activity TEXT,
                  current_task TEXT,
                  performance_metrics TEXT DEFAULT '{}',
                  resource_usage TEXT DEFAULT '{}',
                  configuration TEXT DEFAULT '{}',
                  context TEXT DEFAULT '{}',
                  health_score REAL DEFAULT 1.0 CHECK (health_score >= 0 AND health_score <= 1.0),
                  error_count INTEGER DEFAULT 0,
                  success_count INTEGER DEFAULT 0,
                  total_executions INTEGER DEFAULT 0,
                  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
                  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
                  recovery_attempts INTEGER DEFAULT 0,
                  last_recovery_at TEXT,
                  escalation_count INTEGER DEFAULT 0
                );
              `);

              // Restore data from backup
              this.db.exec(`INSERT INTO agent_states SELECT * FROM agent_states_backup;`);

              // Clean up backup
              this.db.exec(`DROP TABLE agent_states_backup;`);

              logger.info('Successfully fixed agent_states table constraint');
            }

            this.markMigrationApplied(6, 'fix_agent_type_constraint');
          } catch (error) {
            logger.error('Failed to fix agent type constraint', { error });
            throw error;
          }
        }
      },
      {
        version: 100,
        name: 'add_ci_tables',
        execute: () => {
          try {
            logger.info('Adding CI/CD tables to database schema');
            const migrationPath = join(__dirname, 'migrations', 'add_ci_tables.sql');
            if (existsSync(migrationPath)) {
              const migration = readFileSync(migrationPath, 'utf8');
              this.db.exec(migration);
              logger.info('Successfully added CI/CD tables');
            } else {
              logger.warn('CI/CD migration file not found, creating tables manually');
              // Basic table creation as fallback
              this.createCITablesManually();
            }
            this.markMigrationApplied(100, 'add_ci_tables');
          } catch (error) {
            logger.error('CI/CD tables migration failed', { error });
            throw error;
          }
        }
      }
    ];

    // Run migrations that haven't been applied yet
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        logger.info(`Applying migration ${migration.version}: ${migration.name}`);
        try {
          migration.execute();
        } catch (error) {
          logger.error(`Migration ${migration.version} failed`, { error });
          throw error;
        }
      }
    }
  }

  private markMigrationApplied(version: number, name: string): void {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO schema_versions (version, migration_name) 
        VALUES (?, ?)
      `).run(version, name);
    } catch (error) {
      logger.warn(`Failed to mark migration ${version} as applied`, { error });
    }
  }

  private initializeCoreSchema(): void {
    try {
      const schemaPath = join(__dirname, 'schema.sql');
      if (existsSync(schemaPath)) {
        const schema = readFileSync(schemaPath, 'utf8');
        this.db.exec(schema);
        logger.debug('Core scheduler schema initialized');
      }
    } catch (error) {
      logger.warn('Core schema initialization warning', { error });
    }
  }

  private initializeAgentSchema(): void {
    try {
      // Check if agent_states table exists
      const tableResult = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='agent_states'`).get();
      
      if (!tableResult) {
        logger.info('Initializing agent schema...');
        const agentSchemaPath = join(__dirname, 'agents-schema.sql');
        if (existsSync(agentSchemaPath)) {
          const agentSchema = readFileSync(agentSchemaPath, 'utf8');
          this.db.exec(agentSchema);
          logger.info('Agent schema initialized successfully');
        }
      } else {
        logger.debug('Agent schema already exists');
      }
    } catch (error) {
      logger.error('Failed to initialize agent schema', { error });
      throw error; // Agents are critical for Phase 5
    }
  }

  private initializeTestDiscoverySchema(): void {
    try {
      const testSchemaPath = join(__dirname, 'test-discovery-schema.sql');
      if (existsSync(testSchemaPath)) {
        const testSchema = readFileSync(testSchemaPath, 'utf8');
        this.db.exec(testSchema);
        logger.debug('Test discovery schema initialized');
      } else {
        // Create basic test discovery tables inline
        this.db.exec(`
          CREATE TABLE IF NOT EXISTS tests (
            id TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            test_name TEXT NOT NULL,
            class_name TEXT,
            function_name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            line_number INTEGER,
            last_run DATETIME,
            last_status TEXT,
            last_duration INTEGER,
            test_type TEXT DEFAULT 'python',
            steps TEXT,
            complexity TEXT DEFAULT 'medium',
            estimated_duration INTEGER DEFAULT 60,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            UNIQUE(file_path, test_name)
          );
          
          CREATE TABLE IF NOT EXISTS test_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id TEXT NOT NULL,
            tag_name TEXT NOT NULL,
            tag_type TEXT NOT NULL DEFAULT 'marker',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(test_id, tag_name)
          );
          
          CREATE INDEX IF NOT EXISTS idx_tests_category ON tests(category);
          CREATE INDEX IF NOT EXISTS idx_tests_file_path ON tests(file_path);
          CREATE INDEX IF NOT EXISTS idx_test_tags_test_id ON test_tags(test_id);
        `);
      }
      logger.debug('Test discovery schema initialized');
    } catch (error) {
      logger.error('Failed to initialize test discovery schema', { error });
      throw error;
    }
  }

  private initializeWorkflowSchema(): void {
    try {
      // Create workflow execution tracking tables
      this.db.exec(`
        -- Workflow execution history table
        CREATE TABLE IF NOT EXISTS workflow_executions (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          workflow_name TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
          started_at TEXT NOT NULL,
          completed_at TEXT,
          duration_ms INTEGER,
          
          -- Workflow context and configuration
          context TEXT DEFAULT '{}', -- JSON workflow context
          configuration TEXT DEFAULT '{}', -- JSON workflow configuration
          
          -- Results and metrics
          steps_total INTEGER NOT NULL DEFAULT 0,
          steps_completed INTEGER NOT NULL DEFAULT 0,
          steps_failed INTEGER NOT NULL DEFAULT 0,
          success_rate REAL DEFAULT 0.0,
          
          -- Error tracking
          error_message TEXT,
          error_step_id TEXT,
          error_details TEXT, -- JSON error details
          
          -- Metadata
          created_by TEXT DEFAULT 'system',
          priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
          
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );
        
        -- Workflow step execution details
        CREATE TABLE IF NOT EXISTS workflow_step_executions (
          id TEXT PRIMARY KEY,
          workflow_execution_id TEXT NOT NULL,
          step_id TEXT NOT NULL,
          step_type TEXT NOT NULL,
          step_name TEXT,
          
          -- Execution details
          agent_id TEXT,
          status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled')),
          started_at TEXT,
          completed_at TEXT,
          duration_ms INTEGER,
          
          -- Step data and results
          input_data TEXT DEFAULT '{}', -- JSON input data
          output_data TEXT DEFAULT '{}', -- JSON output data
          context_data TEXT DEFAULT '{}', -- JSON context at execution
          
          -- Dependencies and requirements
          dependencies TEXT DEFAULT '[]', -- JSON array of dependency step IDs
          requirements TEXT DEFAULT '[]', -- JSON array of requirements
          
          -- Results and metrics
          confidence_score REAL,
          quality_score REAL,
          artifacts TEXT DEFAULT '[]', -- JSON array of artifact paths
          recommendations TEXT DEFAULT '[]', -- JSON array of recommendations
          
          -- Error handling
          error_message TEXT,
          error_details TEXT, -- JSON error details
          retry_count INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          
          -- AI usage tracking
          tokens_used INTEGER,
          model_used TEXT,
          ai_cost_estimate REAL DEFAULT 0.0,
          
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          
          FOREIGN KEY (workflow_execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
          FOREIGN KEY (agent_id) REFERENCES agent_states(id) ON DELETE SET NULL
        );
        
        -- Workflow templates for reusable workflows
        CREATE TABLE IF NOT EXISTS workflow_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          
          -- Template definition
          steps TEXT NOT NULL, -- JSON array of workflow steps
          default_context TEXT DEFAULT '{}', -- JSON default context
          estimated_duration_ms INTEGER,
          
          -- Template metadata
          tags TEXT DEFAULT '[]', -- JSON array of tags
          test_files TEXT DEFAULT '[]', -- JSON array of associated test files
          success_rate REAL DEFAULT 0.0,
          usage_count INTEGER DEFAULT 0,
          
          -- Status
          is_active BOOLEAN DEFAULT TRUE,
          
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );
        
        -- Performance indices for workflow tables
        CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
        CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
        CREATE INDEX IF NOT EXISTS idx_workflow_executions_started ON workflow_executions(started_at);
        CREATE INDEX IF NOT EXISTS idx_workflow_executions_priority ON workflow_executions(priority, status);
        
        CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_workflow ON workflow_step_executions(workflow_execution_id);
        CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status ON workflow_step_executions(status);
        CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_agent ON workflow_step_executions(agent_id);
        CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_started ON workflow_step_executions(started_at);
        
        CREATE INDEX IF NOT EXISTS idx_workflow_templates_category ON workflow_templates(category);
        CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON workflow_templates(is_active);
        
        -- Triggers to update updated_at timestamps
        CREATE TRIGGER IF NOT EXISTS workflow_executions_updated_at
          AFTER UPDATE ON workflow_executions
          FOR EACH ROW
        BEGIN
          UPDATE workflow_executions 
          SET updated_at = datetime('now', 'utc') 
          WHERE id = NEW.id;
        END;
        
        CREATE TRIGGER IF NOT EXISTS workflow_step_executions_updated_at
          AFTER UPDATE ON workflow_step_executions
          FOR EACH ROW
        BEGIN
          UPDATE workflow_step_executions 
          SET updated_at = datetime('now', 'utc') 
          WHERE id = NEW.id;
        END;
        
        CREATE TRIGGER IF NOT EXISTS workflow_templates_updated_at
          AFTER UPDATE ON workflow_templates
          FOR EACH ROW
        BEGIN
          UPDATE workflow_templates 
          SET updated_at = datetime('now', 'utc') 
          WHERE id = NEW.id;
        END;
      `);
      
      logger.debug('Workflow execution schema initialized');
    } catch (error) {
      logger.error('Failed to initialize workflow schema', { error });
      throw error;
    }
  }

  // Schedule CRUD operations
  async createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>): Promise<Schedule> {
    const stmt = this.db.prepare(`
      INSERT INTO schedules (
        id, suite_id, suite_name, user_id, timezone, run_at_utc, run_at_local,
        recurrence_type, recurrence_interval, recurrence_days, recurrence_end_date, notes, tags,
        priority, status, execution_options, next_run_at, max_retries, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'utc'), datetime('now', 'utc')
      )
    `);

    const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      stmt.run(
        id,
        schedule.suite_id,
        schedule.suite_name,
        schedule.user_id || null,
        schedule.timezone,
        schedule.run_at_utc,
        schedule.run_at_local,
        schedule.recurrence_type || 'none',
        schedule.recurrence_interval || 1,
        (schedule as any).recurrence_days || null,
        schedule.recurrence_end_date || null,
        schedule.notes || null,
        schedule.tags || null,
        schedule.priority || 5,
        schedule.status || 'scheduled',
        schedule.execution_options || null,
        schedule.next_run_at || null,
        schedule.max_retries || 3
      );

      const created = this.getScheduleById(id);
      if (!created) {
        throw new Error('Failed to retrieve created schedule');
      }

      logger.info('Schedule created successfully', { scheduleId: id, suiteId: schedule.suite_id });
      return created;
    } catch (error) {
      logger.error('Failed to create schedule', { error, schedule });
      throw new SchedulerError('VALIDATION_ERROR', 'Failed to create schedule', error);
    }
  }

  getScheduleById(id: string): Schedule | null {
    const stmt = this.db.prepare('SELECT * FROM schedules WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapScheduleRow(row) : null;
  }

  async updateSchedule(id: string, updates: Partial<Schedule>): Promise<Schedule> {
    const existing = this.getScheduleById(id);
    if (!existing) {
      throw new SchedulerError('NOT_FOUND', `Schedule ${id} not found`);
    }

    const allowedFields = [
      'run_at_utc', 'run_at_local', 'timezone', 'notes', 'tags', 'priority',
      'execution_options', 'status', 'next_run_at', 'claimed_at', 'claimed_by',
      'retry_count', 'last_run_id', 'recurrence_type', 'recurrence_interval', 
      'recurrence_days', 'recurrence_end_date'
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    setClauses.push('updated_at = datetime(\'now\', \'utc\')');
    values.push(id);

    const sql = `UPDATE schedules SET ${setClauses.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    
    try {
      stmt.run(...values);
      const updated = this.getScheduleById(id);
      if (!updated) {
        throw new Error('Failed to retrieve updated schedule');
      }
      
      logger.info('Schedule updated successfully', { scheduleId: id, fields: Object.keys(updates) });
      return updated;
    } catch (error) {
      logger.error('Failed to update schedule', { error, scheduleId: id, updates });
      throw new SchedulerError('VALIDATION_ERROR', 'Failed to update schedule', error);
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM schedules WHERE id = ?');
    const result = stmt.run(id);
    
    if (result.changes === 0) {
      throw new SchedulerError('NOT_FOUND', `Schedule ${id} not found`);
    }
    
    logger.info('Schedule deleted successfully', { scheduleId: id });
  }

  async querySchedules(filters: {
    status?: string[];
    suite_id?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
    offset?: number;
    order_by?: string;
    order_dir?: 'asc' | 'desc';
  }): Promise<{ schedules: Schedule[]; total: number }> {
    
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters.status && filters.status.length > 0) {
      const placeholders = filters.status.map(() => '?').join(',');
      whereClause += ` AND status IN (${placeholders})`;
      params.push(...filters.status);
    }

    if (filters.suite_id) {
      whereClause += ' AND suite_id = ?';
      params.push(filters.suite_id);
    }

    if (filters.from_date) {
      whereClause += ' AND run_at_utc >= ?';
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      whereClause += ' AND run_at_utc <= ?';
      params.push(filters.to_date);
    }

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM schedules ${whereClause}`;
    const countStmt = this.db.prepare(countSql);
    const { total } = countStmt.get(...params) as { total: number };

    // Data query with ordering and pagination
    const orderBy = filters.order_by || 'run_at_utc';
    const orderDir = filters.order_dir || 'asc';
    const limit = Math.min(filters.limit || 50, 100);
    const offset = filters.offset || 0;

    const dataSql = `
      SELECT * FROM schedules 
      ${whereClause} 
      ORDER BY ${orderBy} ${orderDir.toUpperCase()}
      LIMIT ? OFFSET ?
    `;
    
    const dataStmt = this.db.prepare(dataSql);
    const rows = dataStmt.all(...params, limit, offset) as any[];

    const schedules = rows.map(row => this.mapScheduleRow(row));

    return { schedules, total };
  }

  // Worker coordination methods
  async claimSchedule(scheduleId: string, workerId: string, claimDurationMs: number = 300000): Promise<boolean> {
    const expireTime = new Date(Date.now() + claimDurationMs).toISOString();
    const now = new Date().toISOString();

    // Atomic claim operation - only claim if not already claimed or claim expired
    const stmt = this.db.prepare(`
      UPDATE schedules 
      SET claimed_at = ?, claimed_by = ?, status = 'running'
      WHERE id = ? 
        AND status = 'scheduled' 
        AND (claimed_at IS NULL OR claimed_at < datetime('now', '-5 minutes', 'utc'))
    `);

    const result = stmt.run(now, workerId, scheduleId);
    const claimed = result.changes > 0;
    
    if (claimed) {
      logger.info('Schedule claimed by worker', { scheduleId, workerId });
    }
    
    return claimed;
  }

  async releaseScheduleClaim(scheduleId: string, workerId: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE schedules 
      SET claimed_at = NULL, claimed_by = NULL
      WHERE id = ? AND claimed_by = ?
    `);

    stmt.run(scheduleId, workerId);
    logger.info('Schedule claim released', { scheduleId, workerId });
  }

  async getClaimableSchedules(limit: number = 10): Promise<Schedule[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM schedules 
      WHERE status = 'scheduled' 
        AND run_at_utc <= datetime('now', 'utc')
        AND (claimed_at IS NULL OR claimed_at < datetime('now', '-5 minutes', 'utc'))
      ORDER BY priority DESC, run_at_utc ASC
      LIMIT ?
    `);

    const rows = stmt.all(limit) as any[];
    return rows.map(row => this.mapScheduleRow(row));
  }

  // Schedule run operations
  async createScheduleRun(run: Omit<ScheduleRun, 'id'>): Promise<ScheduleRun> {
    const stmt = this.db.prepare(`
      INSERT INTO schedule_runs (
        id, schedule_id, started_at, finished_at, duration_ms, status, exit_code,
        error_message, tests_total, tests_passed, tests_failed, tests_skipped,
        artifacts_path, log_output, result_summary, attempt_number, retry_reason,
        environment, browser, test_runner_version
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    const id = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      stmt.run(
        id,
        run.schedule_id,
        run.started_at,
        run.finished_at || null,
        run.duration_ms || null,
        run.status,
        run.exit_code || null,
        run.error_message || null,
        run.tests_total || 0,
        run.tests_passed || 0,
        run.tests_failed || 0,
        run.tests_skipped || 0,
        run.artifacts_path || null,
        run.log_output || null,
        run.result_summary || null,
        run.attempt_number || 1,
        run.retry_reason || null,
        run.environment || 'local',
        run.browser || null,
        run.test_runner_version || null
      );

      const created = this.getScheduleRunById(id);
      if (!created) {
        throw new Error('Failed to retrieve created schedule run');
      }

      logger.info('Schedule run created', { runId: id, scheduleId: run.schedule_id });
      return created;
    } catch (error) {
      logger.error('Failed to create schedule run', { error, run });
      throw new SchedulerError('VALIDATION_ERROR', 'Failed to create schedule run', error);
    }
  }

  getScheduleRunById(id: string): ScheduleRun | null {
    const stmt = this.db.prepare('SELECT * FROM schedule_runs WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapScheduleRunRow(row) : null;
  }

  async updateScheduleRun(id: string, updates: Partial<ScheduleRun>): Promise<ScheduleRun> {
    const existing = this.getScheduleRunById(id);
    if (!existing) {
      throw new SchedulerError('NOT_FOUND', `Schedule run ${id} not found`);
    }

    const allowedFields = [
      'finished_at', 'duration_ms', 'status', 'exit_code', 'error_message',
      'tests_total', 'tests_passed', 'tests_failed', 'tests_skipped',
      'artifacts_path', 'log_output', 'result_summary'
    ];

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return existing;
    }

    values.push(id);
    const sql = `UPDATE schedule_runs SET ${setClauses.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    
    try {
      stmt.run(...values);
      const updated = this.getScheduleRunById(id);
      if (!updated) {
        throw new Error('Failed to retrieve updated schedule run');
      }
      
      logger.info('Schedule run updated', { runId: id, fields: Object.keys(updates) });
      return updated;
    } catch (error) {
      logger.error('Failed to update schedule run', { error, runId: id, updates });
      throw new SchedulerError('VALIDATION_ERROR', 'Failed to update schedule run', error);
    }
  }

  async getScheduleRuns(scheduleId: string, limit: number = 20): Promise<ScheduleRun[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM schedule_runs 
      WHERE schedule_id = ? 
      ORDER BY started_at DESC 
      LIMIT ?
    `);
    
    const rows = stmt.all(scheduleId, limit) as any[];
    return rows.map(row => this.mapScheduleRunRow(row));
  }

  // Utility methods
  private mapScheduleRow(row: any): Schedule {
    return {
      id: row.id,
      suite_id: row.suite_id,
      suite_name: row.suite_name,
      user_id: row.user_id || undefined,
      timezone: row.timezone,
      run_at_utc: row.run_at_utc,
      run_at_local: row.run_at_local,
      recurrence_type: row.recurrence_type as any,
      recurrence_interval: row.recurrence_interval,
      recurrence_end_date: row.recurrence_end_date || undefined,
      notes: row.notes || undefined,
      tags: row.tags || undefined,
      priority: row.priority,
      status: row.status as any,
      created_at: row.created_at,
      updated_at: row.updated_at,
      execution_options: row.execution_options || undefined,
      last_run_id: row.last_run_id || undefined,
      next_run_at: row.next_run_at || undefined,
      claimed_at: row.claimed_at || undefined,
      claimed_by: row.claimed_by || undefined,
      retry_count: row.retry_count,
      max_retries: row.max_retries,
    };
  }

  private mapScheduleRunRow(row: any): ScheduleRun {
    return {
      id: row.id,
      schedule_id: row.schedule_id,
      started_at: row.started_at,
      finished_at: row.finished_at || undefined,
      duration_ms: row.duration_ms || undefined,
      status: row.status as any,
      exit_code: row.exit_code || undefined,
      error_message: row.error_message || undefined,
      tests_total: row.tests_total || 0,
      tests_passed: row.tests_passed || 0,
      tests_failed: row.tests_failed || 0,
      tests_skipped: row.tests_skipped || 0,
      artifacts_path: row.artifacts_path || undefined,
      log_output: row.log_output || undefined,
      result_summary: row.result_summary || undefined,
      attempt_number: row.attempt_number || 1,
      retry_reason: row.retry_reason || undefined,
      environment: row.environment || 'local',
      browser: row.browser || undefined,
      test_runner_version: row.test_runner_version || undefined,
    };
  }

  async close(): Promise<void> {
    this.db.close();
    logger.info('Database connection closed');
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  // Cleanup old records
  private validateSchemaIntegrity(): void {
    try {
      // Validate critical tables exist
      const criticalTables = [
        'agent_states',
        'agent_tasks', 
        'agent_workflows',
        'workflow_executions',
        'workflow_step_executions',
        'tests',
        'test_tags'
      ];

      for (const tableName of criticalTables) {
        const tableExists = this.db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND name=?
        `).get(tableName);
        
        if (!tableExists) {
          throw new Error(`Critical table missing: ${tableName}`);
        }
      }
      
      // Validate foreign key constraints
      this.db.exec('PRAGMA foreign_key_check;');
      
      logger.info('Database schema integrity validated successfully');
    } catch (error) {
      logger.error('Schema integrity validation failed', { error });
      throw new SchedulerError('SCHEMA_INTEGRITY_ERROR', 'Database schema integrity validation failed', error);
    }
  }

  async cleanup(olderThanDays: number = 90): Promise<{ schedules: number; runs: number; agents: number; workflows: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoff = cutoffDate.toISOString();

    // Delete old completed/failed schedules and their runs
    const deleteRunsStmt = this.db.prepare(`
      DELETE FROM schedule_runs 
      WHERE schedule_id IN (
        SELECT id FROM schedules 
        WHERE status IN ('completed', 'failed', 'canceled') 
          AND updated_at < ?
      )
    `);
    
    const deleteSchedulesStmt = this.db.prepare(`
      DELETE FROM schedules 
      WHERE status IN ('completed', 'failed', 'canceled') 
        AND updated_at < ?
    `);

    const transaction = this.db.transaction(() => {
      const runsResult = deleteRunsStmt.run(cutoff);
      const schedulesResult = deleteSchedulesStmt.run(cutoff);
      return { schedules: schedulesResult.changes, runs: runsResult.changes };
    });

    // Clean up old agent tasks and health checks
    const deleteOldAgentTasksStmt = this.db.prepare(`
      DELETE FROM agent_tasks 
      WHERE created_at < ? AND status IN ('success', 'error', 'timeout', 'cancelled')
    `);
    
    const deleteOldHealthChecksStmt = this.db.prepare(`
      DELETE FROM agent_health_checks 
      WHERE timestamp < ?
    `);
    
    // Clean up old workflow executions
    const deleteOldWorkflowsStmt = this.db.prepare(`
      DELETE FROM workflow_executions 
      WHERE created_at < ? AND status IN ('completed', 'failed', 'cancelled')
    `);
    
    const cleanupTransaction = this.db.transaction(() => {
      const runsResult = deleteRunsStmt.run(cutoff);
      const schedulesResult = deleteSchedulesStmt.run(cutoff);
      const agentTasksResult = deleteOldAgentTasksStmt.run(cutoff);
      const healthChecksResult = deleteOldHealthChecksStmt.run(cutoff);
      const workflowsResult = deleteOldWorkflowsStmt.run(cutoff);
      
      return { 
        schedules: schedulesResult.changes, 
        runs: runsResult.changes,
        agents: agentTasksResult.changes + healthChecksResult.changes,
        workflows: workflowsResult.changes
      };
    });

    const result = cleanupTransaction();
    logger.info('Database cleanup completed', { 
      ...result, 
      olderThanDays, 
      cutoffDate: cutoff 
    });

    return result;
  }

  private createCITablesManually(): void {
    logger.info('Creating CI/CD tables manually as fallback');

    // Create basic CI runs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ci_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        status TEXT CHECK(status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'skipped')) NOT NULL DEFAULT 'pending',
        environment TEXT CHECK(environment IN ('development', 'testing', 'staging', 'production')) NOT NULL,
        branch TEXT NOT NULL,
        test_suite_path TEXT DEFAULT 'C:/Users/gals/seleniumpythontests-1/playwright_tests/',
        parallel_workers INTEGER DEFAULT 4,
        total_tests INTEGER DEFAULT 0,
        passed_tests INTEGER DEFAULT 0,
        failed_tests INTEGER DEFAULT 0,
        test_success_rate REAL DEFAULT 0.0,
        quality_gate_passed BOOLEAN DEFAULT FALSE,
        deploy_server TEXT DEFAULT 'DevTest',
        deploy_path TEXT DEFAULT 'C:\\inetpub\\WeSign',
        deployment_status TEXT CHECK(deployment_status IN ('not_started', 'deploying', 'deployed', 'failed', 'rolled_back')),
        started_at TEXT,
        completed_at TEXT,
        duration INTEGER,
        error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        created_by TEXT,
        tenant_id TEXT
      )
    `);

    // Create basic CI stages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ci_stages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stage_id TEXT UNIQUE NOT NULL,
        ci_run_id TEXT NOT NULL,
        name TEXT NOT NULL,
        stage_type TEXT CHECK(stage_type IN ('build', 'test', 'quality_gate', 'deploy', 'rollback')) NOT NULL,
        status TEXT CHECK(status IN ('pending', 'running', 'success', 'failed', 'cancelled', 'skipped')) NOT NULL DEFAULT 'pending',
        sequence_number INTEGER NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        duration INTEGER,
        output_log TEXT,
        error_log TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        FOREIGN KEY (ci_run_id) REFERENCES ci_runs(run_id) ON DELETE CASCADE
      )
    `);

    // Create basic CI artifacts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ci_artifacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        artifact_id TEXT UNIQUE NOT NULL,
        ci_run_id TEXT NOT NULL,
        ci_stage_id TEXT,
        name TEXT NOT NULL,
        artifact_type TEXT CHECK(artifact_type IN ('report', 'screenshot', 'video', 'log', 'package')) NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        FOREIGN KEY (ci_run_id) REFERENCES ci_runs(run_id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_ci_runs_status ON ci_runs(status);
      CREATE INDEX IF NOT EXISTS idx_ci_runs_environment ON ci_runs(environment);
      CREATE INDEX IF NOT EXISTS idx_ci_stages_run_id ON ci_stages(ci_run_id);
      CREATE INDEX IF NOT EXISTS idx_ci_artifacts_run_id ON ci_artifacts(ci_run_id);
    `);

    logger.info('Basic CI/CD tables created successfully');
  }
}

// Singleton instance
let dbInstance: SchedulerDatabase | null = null;

export function getDatabase(): SchedulerDatabase {
  if (!dbInstance) {
    const dbPath = process.env.DATABASE_PATH || 'data/scheduler.db';
    dbInstance = new SchedulerDatabase(dbPath);
  }
  return dbInstance;
}

// Additional database utility functions for sub-agents system
export async function initializeFullDatabase(): Promise<void> {
  try {
    const db = getDatabase();
    await db.healthCheck();
    
    // Initialize test discovery database
    await testDiscoveryService.initializeDatabase();
    
    logger.info('Full database initialization completed successfully');
  } catch (error) {
    logger.error('Full database initialization failed', { error });
    throw error;
  }
}

export async function validateDatabaseIntegrity(): Promise<boolean> {
  try {
    const db = getDatabase();
    
    // Check database health
    const healthy = await db.healthCheck();
    if (!healthy) {
      return false;
    }
    
    // Validate schema integrity is already done in initializeSchema
    return true;
  } catch (error) {
    logger.error('Database integrity validation failed', { error });
    return false;
  }
}

export async function getDatabaseStats(): Promise<{
  agents: number;
  workflows: number;
  tasks: number;
  tests: number;
  healthChecks: number;
}> {
  try {
    const db = getDatabase();
    const dbInstance = (db as any).db;
    
    const stats = {
      agents: 0,
      workflows: 0,
      tasks: 0,
      tests: 0,
      healthChecks: 0
    };
    
    // Count agents
    try {
      const agentsResult = dbInstance.prepare('SELECT COUNT(*) as count FROM agent_states').get();
      stats.agents = agentsResult?.count || 0;
    } catch (e) { /* table may not exist */ }
    
    // Count workflows
    try {
      const workflowsResult = dbInstance.prepare('SELECT COUNT(*) as count FROM workflow_executions').get();
      stats.workflows = workflowsResult?.count || 0;
    } catch (e) { /* table may not exist */ }
    
    // Count tasks
    try {
      const tasksResult = dbInstance.prepare('SELECT COUNT(*) as count FROM agent_tasks').get();
      stats.tasks = tasksResult?.count || 0;
    } catch (e) { /* table may not exist */ }
    
    // Count tests
    try {
      const testsResult = dbInstance.prepare('SELECT COUNT(*) as count FROM tests WHERE is_active = 1').get();
      stats.tests = testsResult?.count || 0;
    } catch (e) { /* table may not exist */ }
    
    // Count health checks
    try {
      const healthResult = dbInstance.prepare('SELECT COUNT(*) as count FROM agent_health_checks').get();
      stats.healthChecks = healthResult?.count || 0;
    } catch (e) { /* table may not exist */ }
    
    return stats;
  } catch (error) {
    logger.error('Failed to get database stats', { error });
    return {
      agents: 0,
      workflows: 0,
      tasks: 0,
      tests: 0,
      healthChecks: 0
    };
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
}