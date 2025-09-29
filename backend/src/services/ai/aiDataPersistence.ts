import { logger } from '@/utils/logger';
import { getDatabase } from '@/database/database';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface AIDataEntry {
  id: string;
  type: 'conversation' | 'prediction' | 'analysis' | 'healing' | 'quality' | 'performance' | 'insight' | 'model_output';
  source: string; // Which AI service generated this
  timestamp: string;
  data: any; // The actual AI-generated data
  metadata: {
    model_used?: string;
    tokens_used?: number;
    confidence_score?: number;
    processing_time_ms?: number;
    cost_estimate?: number;
  };
  related_entities?: string[]; // Related test IDs, workflow IDs, etc.
}

export class AIDataPersistenceService {
  private db: any;
  private dataDir: string;

  constructor() {
    this.db = (getDatabase() as any).db;
    this.dataDir = join(process.cwd(), 'data', 'ai-generated');
    this.initializeStorage();
  }

  private initializeStorage(): void {
    try {
      // Ensure data directory exists
      if (!existsSync(this.dataDir)) {
        mkdirSync(this.dataDir, { recursive: true });
      }

      // Create AI data persistence table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ai_data_entries (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL CHECK (type IN (
            'conversation', 'prediction', 'analysis', 'healing',
            'quality', 'performance', 'insight', 'model_output'
          )),
          source TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          data_json TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          related_entities TEXT DEFAULT '[]',
          file_path TEXT, -- Path to file if data is stored externally
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );

        CREATE INDEX IF NOT EXISTS idx_ai_data_type ON ai_data_entries(type);
        CREATE INDEX IF NOT EXISTS idx_ai_data_source ON ai_data_entries(source);
        CREATE INDEX IF NOT EXISTS idx_ai_data_timestamp ON ai_data_entries(timestamp);

        -- AI chat conversations
        CREATE TABLE IF NOT EXISTS ai_conversations (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          user_message TEXT NOT NULL,
          ai_response TEXT NOT NULL,
          model_used TEXT,
          tokens_used INTEGER,
          processing_time_ms INTEGER,
          timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          context_json TEXT DEFAULT '{}',
          feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5)
        );

        CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON ai_conversations(session_id);
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_timestamp ON ai_conversations(timestamp);

        -- AI predictions and forecasts
        CREATE TABLE IF NOT EXISTS ai_predictions (
          id TEXT PRIMARY KEY,
          prediction_type TEXT NOT NULL,
          target_entity TEXT NOT NULL, -- test ID, workflow ID, etc.
          prediction_value TEXT NOT NULL,
          confidence_score REAL,
          model_used TEXT,
          input_features TEXT, -- JSON of input data
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          actual_outcome TEXT, -- For validation
          accuracy_score REAL -- When actual outcome is known
        );

        -- AI analysis results
        CREATE TABLE IF NOT EXISTS ai_analysis_results (
          id TEXT PRIMARY KEY,
          analysis_type TEXT NOT NULL,
          subject_id TEXT NOT NULL, -- What was analyzed
          results_json TEXT NOT NULL,
          recommendations TEXT DEFAULT '[]',
          confidence_score REAL,
          model_used TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
        );

        -- AI healing suggestions
        CREATE TABLE IF NOT EXISTS ai_healing_suggestions (
          id TEXT PRIMARY KEY,
          test_id TEXT,
          original_selector TEXT,
          suggested_selector TEXT,
          healing_strategy TEXT,
          confidence_score REAL,
          success_rate REAL,
          screenshot_path TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
          applied BOOLEAN DEFAULT FALSE,
          application_result TEXT
        );
      `);

      logger.info('AI data persistence storage initialized');
    } catch (error) {
      logger.error('Failed to initialize AI data persistence', { error });
      throw error;
    }
  }

  async saveAIData(entry: AIDataEntry): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ai_data_entries
        (id, type, source, timestamp, data_json, metadata_json, related_entities)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        entry.id,
        entry.type,
        entry.source,
        entry.timestamp,
        JSON.stringify(entry.data),
        JSON.stringify(entry.metadata),
        JSON.stringify(entry.related_entities || [])
      );

      // Also save to file for backup
      const fileName = `${entry.type}-${entry.source}-${Date.now()}.json`;
      const filePath = join(this.dataDir, fileName);
      writeFileSync(filePath, JSON.stringify(entry, null, 2));

      logger.info('AI data saved successfully', {
        id: entry.id,
        type: entry.type,
        source: entry.source
      });
    } catch (error) {
      logger.error('Failed to save AI data', { error, entryId: entry.id });
      throw error;
    }
  }

  async saveConversation(
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    metadata: {
      model_used?: string;
      tokens_used?: number;
      processing_time_ms?: number;
      context?: any;
    } = {}
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ai_conversations
        (id, session_id, user_message, ai_response, model_used, tokens_used, processing_time_ms, context_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      stmt.run(
        id,
        sessionId,
        userMessage,
        aiResponse,
        metadata.model_used || 'gpt-4o',
        metadata.tokens_used || 0,
        metadata.processing_time_ms || 0,
        JSON.stringify(metadata.context || {})
      );

      // Also save as AI data entry
      await this.saveAIData({
        id: `${id}_data`,
        type: 'conversation',
        source: 'ai-chat',
        timestamp: new Date().toISOString(),
        data: { userMessage, aiResponse },
        metadata: {
          model_used: metadata.model_used,
          tokens_used: metadata.tokens_used,
          processing_time_ms: metadata.processing_time_ms
        }
      });

      logger.info('AI conversation saved', { conversationId: id, sessionId });
    } catch (error) {
      logger.error('Failed to save AI conversation', { error, sessionId });
      throw error;
    }
  }

  async savePrediction(
    predictionType: string,
    targetEntity: string,
    predictionValue: any,
    metadata: {
      confidence_score?: number;
      model_used?: string;
      input_features?: any;
    } = {}
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ai_predictions
        (id, prediction_type, target_entity, prediction_value, confidence_score, model_used, input_features)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const id = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      stmt.run(
        id,
        predictionType,
        targetEntity,
        JSON.stringify(predictionValue),
        metadata.confidence_score || null,
        metadata.model_used || 'internal-ml',
        JSON.stringify(metadata.input_features || {})
      );

      // Also save as AI data entry
      await this.saveAIData({
        id: `${id}_data`,
        type: 'prediction',
        source: 'predictive-analytics',
        timestamp: new Date().toISOString(),
        data: { predictionType, targetEntity, predictionValue },
        metadata: {
          model_used: metadata.model_used,
          confidence_score: metadata.confidence_score
        },
        related_entities: [targetEntity]
      });

      logger.info('AI prediction saved', { predictionId: id, type: predictionType });
    } catch (error) {
      logger.error('Failed to save AI prediction', { error, predictionType });
      throw error;
    }
  }

  async saveAnalysisResult(
    analysisType: string,
    subjectId: string,
    results: any,
    recommendations: string[] = [],
    metadata: {
      confidence_score?: number;
      model_used?: string;
    } = {}
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ai_analysis_results
        (id, analysis_type, subject_id, results_json, recommendations, confidence_score, model_used)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      stmt.run(
        id,
        analysisType,
        subjectId,
        JSON.stringify(results),
        JSON.stringify(recommendations),
        metadata.confidence_score || null,
        metadata.model_used || 'gpt-4o'
      );

      // Also save as AI data entry
      await this.saveAIData({
        id: `${id}_data`,
        type: 'analysis',
        source: 'ai-analysis',
        timestamp: new Date().toISOString(),
        data: { analysisType, subjectId, results, recommendations },
        metadata: {
          model_used: metadata.model_used,
          confidence_score: metadata.confidence_score
        },
        related_entities: [subjectId]
      });

      logger.info('AI analysis result saved', { analysisId: id, type: analysisType });
    } catch (error) {
      logger.error('Failed to save AI analysis result', { error, analysisType });
      throw error;
    }
  }

  async saveHealingSuggestion(
    testId: string,
    originalSelector: string,
    suggestedSelector: string,
    healingStrategy: string,
    metadata: {
      confidence_score?: number;
      success_rate?: number;
      screenshot_path?: string;
    } = {}
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO ai_healing_suggestions
        (id, test_id, original_selector, suggested_selector, healing_strategy, confidence_score, success_rate, screenshot_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const id = `healing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      stmt.run(
        id,
        testId,
        originalSelector,
        suggestedSelector,
        healingStrategy,
        metadata.confidence_score || null,
        metadata.success_rate || null,
        metadata.screenshot_path || null
      );

      // Also save as AI data entry
      await this.saveAIData({
        id: `${id}_data`,
        type: 'healing',
        source: 'visual-healing-ai',
        timestamp: new Date().toISOString(),
        data: { testId, originalSelector, suggestedSelector, healingStrategy },
        metadata: {
          confidence_score: metadata.confidence_score
        },
        related_entities: [testId]
      });

      logger.info('AI healing suggestion saved', { healingId: id, testId });
    } catch (error) {
      logger.error('Failed to save AI healing suggestion', { error, testId });
      throw error;
    }
  }

  async getAIDataByType(type: string, limit: number = 100): Promise<any[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM ai_data_entries
        WHERE type = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `);

      const rows = stmt.all(type, limit);
      return rows.map((row: any) => ({
        ...row,
        data: JSON.parse(row.data_json),
        metadata: JSON.parse(row.metadata_json),
        related_entities: JSON.parse(row.related_entities || '[]')
      }));
    } catch (error) {
      logger.error('Failed to get AI data by type', { error, type });
      return [];
    }
  }

  async getConversationHistory(sessionId?: string, limit: number = 50): Promise<any[]> {
    try {
      const stmt = sessionId
        ? this.db.prepare(`
            SELECT * FROM ai_conversations
            WHERE session_id = ?
            ORDER BY timestamp DESC
            LIMIT ?
          `)
        : this.db.prepare(`
            SELECT * FROM ai_conversations
            ORDER BY timestamp DESC
            LIMIT ?
          `);

      return sessionId ? stmt.all(sessionId, limit) : stmt.all(limit);
    } catch (error) {
      logger.error('Failed to get conversation history', { error, sessionId });
      return [];
    }
  }

  async getDataStats(): Promise<{
    totalEntries: number;
    entriesByType: Record<string, number>;
    conversationsTotal: number;
    predictionsTotal: number;
    analysisTotal: number;
    healingSuggestionsTotal: number;
  }> {
    try {
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM ai_data_entries');
      const totalResult = totalStmt.get();

      const typeStmt = this.db.prepare(`
        SELECT type, COUNT(*) as count
        FROM ai_data_entries
        GROUP BY type
      `);
      const typeResults = typeStmt.all();

      const conversationsStmt = this.db.prepare('SELECT COUNT(*) as count FROM ai_conversations');
      const conversationsResult = conversationsStmt.get();

      const predictionsStmt = this.db.prepare('SELECT COUNT(*) as count FROM ai_predictions');
      const predictionsResult = predictionsStmt.get();

      const analysisStmt = this.db.prepare('SELECT COUNT(*) as count FROM ai_analysis_results');
      const analysisResult = analysisStmt.get();

      const healingStmt = this.db.prepare('SELECT COUNT(*) as count FROM ai_healing_suggestions');
      const healingResult = healingStmt.get();

      const entriesByType: Record<string, number> = {};
      typeResults.forEach((row: any) => {
        entriesByType[row.type] = row.count;
      });

      return {
        totalEntries: totalResult.count,
        entriesByType,
        conversationsTotal: conversationsResult.count,
        predictionsTotal: predictionsResult.count,
        analysisTotal: analysisResult.count,
        healingSuggestionsTotal: healingResult.count
      };
    } catch (error) {
      logger.error('Failed to get AI data stats', { error });
      return {
        totalEntries: 0,
        entriesByType: {},
        conversationsTotal: 0,
        predictionsTotal: 0,
        analysisTotal: 0,
        healingSuggestionsTotal: 0
      };
    }
  }

  async exportAIData(fromDate?: string, toDate?: string): Promise<string> {
    try {
      const whereClause = [];
      const params: any[] = [];

      if (fromDate) {
        whereClause.push('timestamp >= ?');
        params.push(fromDate);
      }

      if (toDate) {
        whereClause.push('timestamp <= ?');
        params.push(toDate);
      }

      const sql = `
        SELECT * FROM ai_data_entries
        ${whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : ''}
        ORDER BY timestamp DESC
      `;

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);

      const exportData = rows.map((row: any) => ({
        ...row,
        data: JSON.parse(row.data_json),
        metadata: JSON.parse(row.metadata_json),
        related_entities: JSON.parse(row.related_entities || '[]')
      }));

      const exportPath = join(this.dataDir, `ai-data-export-${Date.now()}.json`);
      writeFileSync(exportPath, JSON.stringify(exportData, null, 2));

      logger.info('AI data exported successfully', {
        exportPath,
        recordCount: rows.length
      });

      return exportPath;
    } catch (error) {
      logger.error('Failed to export AI data', { error });
      throw error;
    }
  }
}

// Singleton instance
let persistenceService: AIDataPersistenceService | null = null;

export function getAIDataPersistenceService(): AIDataPersistenceService {
  if (!persistenceService) {
    persistenceService = new AIDataPersistenceService();
  }
  return persistenceService;
}

export default AIDataPersistenceService;