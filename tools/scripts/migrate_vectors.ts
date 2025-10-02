#!/usr/bin/env ts-node

/**
 * Vector Migration Script for QA Intelligence Platform
 *
 * This script migrates existing vector data to the standardized vector store.
 * It handles data from multiple sources and ensures consistency in the new system.
 */

import { logger } from '../backend/src/utils/logger';
import { StandardizedVectorStore, createVectorStore } from '../backend/src/services/ai/vectorStore';
import { createKnowledgeExtractor } from '../backend/src/services/ai/knowledgeExtractor';
import Database from 'better-sqlite3';
import { join } from 'path';
import fs from 'fs';

interface LegacyVectorEntry {
  id: string;
  content: string;
  type: string;
  source: string;
  metadata: string;
  embedding: Buffer | null;
  created_at: string;
}

interface MigrationOptions {
  sourceDb?: string;
  targetNamespace?: string;
  dryRun?: boolean;
  regenerateEmbeddings?: boolean;
  batchSize?: number;
}

class VectorMigrationService {
  private sourceDb: Database.Database;
  private targetStore: StandardizedVectorStore;
  private options: Required<MigrationOptions>;

  constructor(options: MigrationOptions = {}) {
    this.options = {
      sourceDb: options.sourceDb || join(process.cwd(), 'data', 'scheduler.db'),
      targetNamespace: options.targetNamespace || 'qa-intel',
      dryRun: options.dryRun || false,
      regenerateEmbeddings: options.regenerateEmbeddings || false,
      batchSize: options.batchSize || 50
    };

    // Initialize source database
    this.sourceDb = new Database(this.options.sourceDb);

    // Initialize target vector store
    this.targetStore = createVectorStore({
      type: 'local',
      namespace: this.options.targetNamespace,
      dimensions: 1536
    });
  }

  /**
   * Main migration execution
   */
  async migrate(): Promise<MigrationReport> {
    logger.info('Starting vector migration', this.options);

    const report: MigrationReport = {
      startTime: new Date().toISOString(),
      endTime: '',
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: [],
      summary: ''
    };

    try {
      // Initialize target store
      await this.targetStore.initialize();

      // Step 1: Migrate from knowledge_base_enhanced table
      const enhancedReport = await this.migrateKnowledgeBaseEnhanced();
      this.mergeReports(report, enhancedReport);

      // Step 2: Migrate from any legacy vector tables
      const legacyReport = await this.migrateLegacyVectors();
      this.mergeReports(report, legacyReport);

      // Step 3: Re-process PRD document if needed
      if (this.options.regenerateEmbeddings) {
        const prdReport = await this.reprocessPRDDocument();
        this.mergeReports(report, prdReport);
      }

      // Step 4: Validate migration
      const validationReport = await this.validateMigration();
      report.validation = validationReport;

      report.endTime = new Date().toISOString();
      report.summary = this.generateSummary(report);

      logger.info('Vector migration completed', {
        totalRecords: report.totalRecords,
        migratedRecords: report.migratedRecords,
        errors: report.errorRecords
      });

      return report;

    } catch (error) {
      logger.error('Migration failed:', error);
      report.endTime = new Date().toISOString();
      report.errors.push({
        type: 'MIGRATION_FAILURE',
        message: error.message,
        context: 'Main migration process'
      });
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Migrate from knowledge_base_enhanced table
   */
  private async migrateKnowledgeBaseEnhanced(): Promise<Partial<MigrationReport>> {
    logger.info('Migrating from knowledge_base_enhanced table');

    const report: Partial<MigrationReport> = {
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: []
    };

    try {
      // Check if table exists
      const tableExists = this.sourceDb.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='knowledge_base_enhanced'
      `).get();

      if (!tableExists) {
        logger.info('knowledge_base_enhanced table not found, skipping');
        return report;
      }

      // Get all records
      const records = this.sourceDb.prepare(`
        SELECT * FROM knowledge_base_enhanced ORDER BY created_at
      `).all() as LegacyVectorEntry[];

      report.totalRecords = records.length;

      if (records.length === 0) {
        logger.info('No records found in knowledge_base_enhanced table');
        return report;
      }

      // Process in batches
      for (let i = 0; i < records.length; i += this.options.batchSize) {
        const batch = records.slice(i, i + this.options.batchSize);

        for (const record of batch) {
          try {
            await this.migrateSingleRecord(record, 'knowledge_base_enhanced');
            report.migratedRecords!++;
          } catch (error) {
            report.errorRecords!++;
            report.errors!.push({
              type: 'RECORD_MIGRATION_ERROR',
              message: error.message,
              context: `Record ID: ${record.id}`
            });
          }
        }

        // Log progress
        logger.info(`Migrated batch ${Math.floor(i / this.options.batchSize) + 1}`, {
          processed: Math.min(i + this.options.batchSize, records.length),
          total: records.length
        });
      }

    } catch (error) {
      logger.error('Failed to migrate knowledge_base_enhanced:', error);
      report.errors!.push({
        type: 'TABLE_MIGRATION_ERROR',
        message: error.message,
        context: 'knowledge_base_enhanced table'
      });
    }

    return report;
  }

  /**
   * Migrate a single record to the new vector store
   */
  private async migrateSingleRecord(record: LegacyVectorEntry, source: string): Promise<void> {
    if (this.options.dryRun) {
      logger.debug('DRY RUN: Would migrate record', { id: record.id, source });
      return;
    }

    try {
      // Parse metadata
      let metadata: any = {};
      try {
        metadata = JSON.parse(record.metadata || '{}');
      } catch (error) {
        logger.warn('Failed to parse metadata, using defaults', { recordId: record.id });
      }

      // Enhanced metadata with migration info
      const enhancedMetadata = {
        ...metadata,
        migrationSource: source,
        migratedAt: new Date().toISOString(),
        originalId: record.id,
        lang: this.detectLanguage(record.content),
        type: record.type || 'migrated',
        version: '1.0.0'
      };

      // Extract or regenerate vector
      let vector: number[] | undefined;

      if (record.embedding && !this.options.regenerateEmbeddings) {
        // Try to convert existing embedding
        try {
          const float64Array = new Float64Array(record.embedding.buffer);
          vector = Array.from(float64Array);
        } catch (error) {
          logger.warn('Failed to parse existing embedding, will regenerate', { recordId: record.id });
        }
      }

      // Create new vector entry
      const vectorEntry = {
        id: `migrated_${record.id}`,
        text: record.content,
        metadata: enhancedMetadata,
        vector
      };

      // Save to new vector store
      await this.targetStore.addVector(vectorEntry, this.options.targetNamespace);

      logger.debug('Record migrated successfully', {
        id: record.id,
        newId: vectorEntry.id,
        hasVector: !!vector
      });

    } catch (error) {
      logger.error('Failed to migrate single record:', error);
      throw error;
    }
  }

  /**
   * Migrate any legacy vector tables
   */
  private async migrateLegacyVectors(): Promise<Partial<MigrationReport>> {
    logger.info('Checking for legacy vector tables');

    const report: Partial<MigrationReport> = {
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: []
    };

    // Check for other potential vector tables
    const tables = this.sourceDb.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE '%vector%' OR name LIKE '%embedding%'
    `).all() as Array<{name: string}>;

    logger.info('Found potential vector tables', { tables: tables.map(t => t.name) });

    // For now, we'll focus on the main table, but this can be extended
    // to handle other legacy formats as needed

    return report;
  }

  /**
   * Re-process PRD document with new chunking
   */
  private async reprocessPRDDocument(): Promise<Partial<MigrationReport>> {
    logger.info('Re-processing PRD document with enhanced chunking');

    const report: Partial<MigrationReport> = {
      totalRecords: 0,
      migratedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      errors: []
    };

    try {
      // Check if PRD file exists
      const prdPath = join(process.cwd(), 'PRODUCT_REQUIREMENTS_DOCUMENT.md');

      if (!fs.existsSync(prdPath)) {
        logger.warn('PRD file not found, skipping re-processing', { path: prdPath });
        return report;
      }

      if (this.options.dryRun) {
        logger.info('DRY RUN: Would re-process PRD document', { path: prdPath });
        return report;
      }

      // Use enhanced knowledge extractor
      const extractor = createKnowledgeExtractor();

      const entries = await extractor.extractDocument({
        id: 'prd_reprocessed',
        version: '2.0.0',
        path: prdPath,
        content: fs.readFileSync(prdPath, 'utf-8'),
        type: 'prd'
      }, {
        chunkSizeTokens: 1000,
        overlapTokens: 200,
        langs: ['en', 'he'],
        generateHebrew: true,
        namespace: this.options.targetNamespace
      });

      report.totalRecords = entries.length;
      report.migratedRecords = entries.length;

      logger.info('PRD re-processing completed', {
        entriesGenerated: entries.length,
        languages: ['en', 'he']
      });

    } catch (error) {
      logger.error('PRD re-processing failed:', error);
      report.errors!.push({
        type: 'PRD_PROCESSING_ERROR',
        message: error.message,
        context: 'PRD document re-processing'
      });
      report.errorRecords = 1;
    }

    return report;
  }

  /**
   * Validate migration results
   */
  private async validateMigration(): Promise<ValidationReport> {
    logger.info('Validating migration results');

    const validation: ValidationReport = {
      vectorCount: 0,
      namespaceStats: {},
      languageDistribution: {},
      typeDistribution: {},
      sampleQueries: []
    };

    try {
      // Get overall stats
      const stats = await this.targetStore.getStats(this.options.targetNamespace);
      validation.vectorCount = stats.totalVectors;
      validation.namespaceStats = stats;

      // Test sample queries to ensure functionality
      const testQueries = [
        'How do I add a contact?',
        'איך אני מוסיף איש קשר?',
        'What is document signing?',
        'מה זה חתימה דיגיטלית?'
      ];

      for (const query of testQueries) {
        try {
          const results = await this.targetStore.searchVectors(query, {
            namespace: this.options.targetNamespace,
            topK: 3,
            threshold: 0.5
          });

          validation.sampleQueries.push({
            query,
            resultCount: results.length,
            topScore: results[0]?.score || 0,
            success: results.length > 0
          });

        } catch (error) {
          validation.sampleQueries.push({
            query,
            resultCount: 0,
            topScore: 0,
            success: false,
            error: error.message
          });
        }
      }

      logger.info('Migration validation completed', validation);

    } catch (error) {
      logger.error('Migration validation failed:', error);
      throw error;
    }

    return validation;
  }

  /**
   * Detect language of content for metadata
   */
  private detectLanguage(content: string): 'en' | 'he' | 'mixed' {
    const hebrewChars = (content.match(/[\u0590-\u05FF]/g) || []).length;
    const englishChars = (content.match(/[a-zA-Z]/g) || []).length;
    const total = hebrewChars + englishChars;

    if (total === 0) return 'en';

    const hebrewRatio = hebrewChars / total;

    if (hebrewRatio > 0.7) return 'he';
    if (hebrewRatio < 0.3) return 'en';
    return 'mixed';
  }

  /**
   * Merge migration reports
   */
  private mergeReports(target: MigrationReport, source: Partial<MigrationReport>): void {
    target.totalRecords += source.totalRecords || 0;
    target.migratedRecords += source.migratedRecords || 0;
    target.skippedRecords += source.skippedRecords || 0;
    target.errorRecords += source.errorRecords || 0;

    if (source.errors) {
      target.errors.push(...source.errors);
    }
  }

  /**
   * Generate migration summary
   */
  private generateSummary(report: MigrationReport): string {
    const duration = new Date(report.endTime).getTime() - new Date(report.startTime).getTime();
    const successRate = report.totalRecords > 0
      ? Math.round((report.migratedRecords / report.totalRecords) * 100)
      : 0;

    return `
Migration completed in ${Math.round(duration / 1000)}s
Success rate: ${successRate}% (${report.migratedRecords}/${report.totalRecords})
Errors: ${report.errorRecords}
Validation: ${report.validation?.sampleQueries.filter(q => q.success).length || 0}/${report.validation?.sampleQueries.length || 0} queries successful
    `.trim();
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    try {
      this.sourceDb.close();
      await this.targetStore.close();
      logger.info('Migration cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }
}

// Interfaces
interface MigrationReport {
  startTime: string;
  endTime: string;
  totalRecords: number;
  migratedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  errors: Array<{
    type: string;
    message: string;
    context: string;
  }>;
  summary: string;
  validation?: ValidationReport;
}

interface ValidationReport {
  vectorCount: number;
  namespaceStats: any;
  languageDistribution: Record<string, number>;
  typeDistribution: Record<string, number>;
  sampleQueries: Array<{
    query: string;
    resultCount: number;
    topScore: number;
    success: boolean;
    error?: string;
  }>;
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--source-db':
        options.sourceDb = value;
        break;
      case '--namespace':
        options.targetNamespace = value;
        break;
      case '--dry-run':
        options.dryRun = true;
        i--; // No value for this flag
        break;
      case '--regenerate-embeddings':
        options.regenerateEmbeddings = true;
        i--; // No value for this flag
        break;
      case '--batch-size':
        options.batchSize = parseInt(value);
        break;
      case '--help':
        console.log(`
Vector Migration Script

Usage: ts-node scripts/migrate_vectors.ts [options]

Options:
  --source-db <path>         Source database path (default: data/scheduler.db)
  --namespace <namespace>    Target namespace (default: qa-intel)
  --dry-run                  Run without making changes
  --regenerate-embeddings    Regenerate all embeddings
  --batch-size <number>      Batch size for processing (default: 50)
  --help                     Show this help message

Examples:
  ts-node scripts/migrate_vectors.ts --dry-run
  ts-node scripts/migrate_vectors.ts --namespace production --regenerate-embeddings
        `);
        process.exit(0);
    }
  }

  try {
    console.log('🚀 Starting Vector Migration');
    console.log('Options:', options);

    const migrator = new VectorMigrationService(options);
    const report = await migrator.migrate();

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Migration Report:');
    console.log(report.summary);

    if (report.validation) {
      console.log('\n🔍 Validation Results:');
      console.log(`Vector count: ${report.validation.vectorCount}`);
      console.log(`Successful queries: ${report.validation.sampleQueries.filter(q => q.success).length}/${report.validation.sampleQueries.length}`);
    }

    if (report.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      report.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.type}: ${error.message} (${error.context})`);
      });
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { VectorMigrationService, MigrationOptions, MigrationReport };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
}