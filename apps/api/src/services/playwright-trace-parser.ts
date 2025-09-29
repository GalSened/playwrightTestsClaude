import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { extract } from 'yauzl';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { logger } from '../utils/logger';
import {
  PlaywrightTrace,
  PlaywrightTraceEntry,
  TraceStep,
  TraceArtifact,
  ConsoleLog,
  NetworkLog
} from '../types/trace';

interface PlaywrightAction {
  name: string;
  startTime: number;
  endTime: number;
  error?: string;
  stack?: any[];
  result?: any;
  inputSnapshot?: string;
  outputSnapshot?: string;
  point?: { x: number; y: number };
  selector?: string;
  url?: string;
  expected?: any;
  received?: any;
}

interface PlaywrightEvent {
  type: string;
  time: number;
  data: any;
}

interface ParsedTraceData {
  steps: Omit<TraceStep, 'id' | 'runId' | 'createdAt'>[];
  artifacts: Omit<TraceArtifact, 'id' | 'runId' | 'createdAt'>[];
  logs: Omit<ConsoleLog, 'id' | 'runId' | 'createdAt'>[];
  networkLogs: Omit<NetworkLog, 'id' | 'runId' | 'createdAt'>[];
}

export class PlaywrightTraceParser {
  private tempDir: string;

  constructor(tempDir?: string) {
    this.tempDir = tempDir || process.env.TEMP_DIR || './temp';
  }

  async parseTrace(traceFilePath: string): Promise<ParsedTraceData> {
    logger.info('Starting trace parsing', { traceFilePath });

    try {
      // Check if trace file exists
      await fs.access(traceFilePath);
      
      // Create temp directory for extraction
      const extractDir = join(this.tempDir, `trace_${Date.now()}`);
      await fs.mkdir(extractDir, { recursive: true });

      try {
        // Extract trace.zip
        await this.extractTraceFile(traceFilePath, extractDir);

        // Parse the extracted trace data
        const traceData = await this.parseExtractedTrace(extractDir);

        // Clean up temp directory
        await this.cleanupTempDir(extractDir);

        logger.info('Trace parsing completed', {
          traceFilePath,
          stepsCount: traceData.steps.length,
          artifactsCount: traceData.artifacts.length,
          logsCount: traceData.logs.length,
          networkLogsCount: traceData.networkLogs.length
        });

        return traceData;

      } catch (error) {
        // Clean up temp directory on error
        await this.cleanupTempDir(extractDir);
        throw error;
      }

    } catch (error) {
      logger.error('Failed to parse trace file', { traceFilePath, error });
      throw new Error(`Failed to parse trace file: ${error.message}`);
    }
  }

  private async extractTraceFile(traceFilePath: string, extractDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      extract(traceFilePath, { dir: extractDir }, (err) => {
        if (err) {
          reject(new Error(`Failed to extract trace file: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  private async parseExtractedTrace(extractDir: string): Promise<ParsedTraceData> {
    const traceData: ParsedTraceData = {
      steps: [],
      artifacts: [],
      logs: [],
      networkLogs: []
    };

    try {
      // Look for trace files in the extracted directory
      const files = await fs.readdir(extractDir);
      
      // Find the main trace file (usually trace.json or similar)
      let traceJsonPath: string | null = null;
      for (const file of files) {
        if (file.endsWith('.trace') || file.endsWith('.json')) {
          traceJsonPath = join(extractDir, file);
          break;
        }
      }

      if (!traceJsonPath) {
        // Look for trace data in subdirectories
        for (const file of files) {
          const filePath = join(extractDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.isDirectory()) {
            const subFiles = await fs.readdir(filePath);
            for (const subFile of subFiles) {
              if (subFile.endsWith('.trace') || (subFile.includes('trace') && subFile.endsWith('.json'))) {
                traceJsonPath = join(filePath, subFile);
                break;
              }
            }
            if (traceJsonPath) break;
          }
        }
      }

      if (!traceJsonPath) {
        throw new Error('No trace file found in extracted archive');
      }

      // Parse the main trace file
      const traceContent = await fs.readFile(traceJsonPath, 'utf8');
      
      // Try to parse as JSON first, then as JSONL (JSON Lines)
      let traceEntries: any[] = [];
      
      try {
        // Try parsing as single JSON object
        const parsed = JSON.parse(traceContent);
        if (Array.isArray(parsed)) {
          traceEntries = parsed;
        } else if (parsed.entries) {
          traceEntries = parsed.entries;
        } else if (parsed.events) {
          traceEntries = parsed.events;
        } else {
          traceEntries = [parsed];
        }
      } catch {
        // Try parsing as JSONL
        const lines = traceContent.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            traceEntries.push(JSON.parse(line));
          } catch (error) {
            logger.warn('Failed to parse trace line', { line: line.substring(0, 100), error });
          }
        }
      }

      // Process trace entries
      await this.processTraceEntries(traceEntries, traceData, extractDir);

      // Look for additional artifacts in the extracted directory
      await this.processArtifacts(extractDir, traceData);

      return traceData;

    } catch (error) {
      logger.error('Failed to parse extracted trace', { extractDir, error });
      throw error;
    }
  }

  private async processTraceEntries(entries: any[], traceData: ParsedTraceData, extractDir: string): Promise<void> {
    const actions: PlaywrightAction[] = [];
    const events: PlaywrightEvent[] = [];
    
    let stepIndex = 0;
    let currentTestName = 'Unknown Test';

    for (const entry of entries) {
      try {
        // Identify entry type and process accordingly
        if (entry.type === 'action' || entry.method) {
          // This is an action entry
          const action = this.parseAction(entry, stepIndex++);
          if (action) {
            actions.push(action);
          }
        } else if (entry.type === 'event' || entry.category) {
          // This is an event entry
          const event = this.parseEvent(entry);
          if (event) {
            events.push(event);
          }
        } else if (entry.type === 'console') {
          // Console log entry
          const consoleLog = this.parseConsoleLog(entry);
          if (consoleLog) {
            traceData.logs.push(consoleLog);
          }
        } else if (entry.type === 'network') {
          // Network log entry
          const networkLog = this.parseNetworkLog(entry);
          if (networkLog) {
            traceData.networkLogs.push(networkLog);
          }
        } else if (entry.type === 'test' || entry.title) {
          // Test metadata
          currentTestName = entry.title || entry.name || currentTestName;
        }
      } catch (error) {
        logger.warn('Failed to process trace entry', { entry: JSON.stringify(entry).substring(0, 200), error });
      }
    }

    // Convert actions to steps
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const step = this.actionToStep(action, i, currentTestName);
      if (step) {
        traceData.steps.push(step);
      }
    }

    // Process events for additional context
    this.processEvents(events, traceData);
  }

  private parseAction(entry: any, index: number): PlaywrightAction | null {
    try {
      const startTime = entry.startTime || entry.time || Date.now();
      const endTime = entry.endTime || entry.time || startTime;
      
      return {
        name: entry.name || entry.method || entry.action || `Action ${index + 1}`,
        startTime,
        endTime,
        error: entry.error?.message || entry.error,
        stack: entry.stack,
        result: entry.result,
        inputSnapshot: entry.inputSnapshot,
        outputSnapshot: entry.outputSnapshot || entry.afterSnapshot,
        point: entry.point,
        selector: entry.selector || entry.params?.selector,
        url: entry.url || entry.params?.url,
        expected: entry.expected,
        received: entry.received || entry.actual
      };
    } catch (error) {
      logger.warn('Failed to parse action entry', { entry, error });
      return null;
    }
  }

  private parseEvent(entry: any): PlaywrightEvent | null {
    try {
      return {
        type: entry.type || entry.category || 'unknown',
        time: entry.time || entry.timestamp || Date.now(),
        data: entry.data || entry
      };
    } catch (error) {
      logger.warn('Failed to parse event entry', { entry, error });
      return null;
    }
  }

  private parseConsoleLog(entry: any): Omit<ConsoleLog, 'id' | 'runId' | 'createdAt'> | null {
    try {
      return {
        stepId: undefined, // Will be linked later if needed
        timestamp: new Date(entry.time || entry.timestamp || Date.now()).toISOString(),
        level: entry.level || entry.type || 'log',
        source: entry.source || 'console',
        message: entry.message || entry.text || String(entry.args?.[0] || ''),
        stackTrace: entry.stack,
        url: entry.url,
        lineNumber: entry.lineNumber || entry.line,
        columnNumber: entry.columnNumber || entry.column,
        args: entry.args
      };
    } catch (error) {
      logger.warn('Failed to parse console log', { entry, error });
      return null;
    }
  }

  private parseNetworkLog(entry: any): Omit<NetworkLog, 'id' | 'runId' | 'createdAt'> | null {
    try {
      return {
        stepId: undefined, // Will be linked later if needed
        timestamp: new Date(entry.time || entry.timestamp || Date.now()).toISOString(),
        method: entry.method || entry.request?.method || 'GET',
        url: entry.url || entry.request?.url || '',
        statusCode: entry.statusCode || entry.response?.status,
        statusText: entry.statusText || entry.response?.statusText,
        requestHeaders: entry.request?.headers,
        responseHeaders: entry.response?.headers,
        requestBody: entry.request?.body,
        responseBody: entry.response?.body,
        requestSize: entry.request?.size,
        responseSize: entry.response?.size,
        duration: entry.duration || entry.responseTime,
        failed: entry.failed || (entry.statusCode >= 400),
        failureReason: entry.failureReason || entry.error
      };
    } catch (error) {
      logger.warn('Failed to parse network log', { entry, error });
      return null;
    }
  }

  private actionToStep(action: PlaywrightAction, index: number, testName: string): Omit<TraceStep, 'id' | 'runId' | 'createdAt'> | null {
    try {
      const duration = action.endTime - action.startTime;
      const status = action.error ? 'failed' : 'passed';

      return {
        testId: undefined, // Will be set by the caller
        testName,
        stepIndex: index,
        actionType: this.extractActionType(action.name),
        actionName: this.formatActionName(action.name),
        selector: action.selector,
        url: action.url,
        expectedValue: action.expected ? JSON.stringify(action.expected) : undefined,
        actualValue: action.received ? JSON.stringify(action.received) : undefined,
        startedAt: new Date(action.startTime).toISOString(),
        finishedAt: new Date(action.endTime).toISOString(),
        duration: duration > 0 ? duration : undefined,
        status,
        errorMessage: action.error,
        stackTrace: action.stack ? JSON.stringify(action.stack) : undefined,
        retryCount: this.extractRetryCount(action),
        screenshotBefore: action.inputSnapshot,
        screenshotAfter: action.outputSnapshot,
        videoTimestamp: action.startTime / 1000 // Convert to seconds
      };
    } catch (error) {
      logger.warn('Failed to convert action to step', { action, error });
      return null;
    }
  }

  private extractActionType(actionName: string): string {
    if (!actionName) return 'unknown';
    
    const name = actionName.toLowerCase();
    if (name.includes('click')) return 'click';
    if (name.includes('fill') || name.includes('type')) return 'fill';
    if (name.includes('goto') || name.includes('navigate')) return 'navigate';
    if (name.includes('expect') || name.includes('assert')) return 'expect';
    if (name.includes('wait')) return 'wait';
    if (name.includes('select')) return 'select';
    if (name.includes('check') || name.includes('uncheck')) return 'check';
    if (name.includes('hover')) return 'hover';
    if (name.includes('scroll')) return 'scroll';
    if (name.includes('screenshot')) return 'screenshot';
    
    return 'action';
  }

  private formatActionName(actionName: string): string {
    if (!actionName) return 'Unknown Action';
    
    // Convert camelCase to readable format
    return actionName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, str => str.toUpperCase());
  }

  private processEvents(events: PlaywrightEvent[], traceData: ParsedTraceData): void {
    // Process events to enhance existing data or create additional artifacts
    for (const event of events) {
      try {
        if (event.type === 'screenshot' && event.data?.path) {
          // Add screenshot artifacts
          const artifact: Omit<TraceArtifact, 'id' | 'runId' | 'createdAt'> = {
            stepId: undefined,
            artifactType: 'screenshot',
            name: basename(event.data.path),
            filePath: event.data.path,
            mimeType: 'image/png',
            metadata: {
              timestamp: event.time,
              source: 'playwright-trace'
            }
          };
          traceData.artifacts.push(artifact);
        } else if (event.type === 'video' && event.data?.path) {
          // Add video artifacts
          const artifact: Omit<TraceArtifact, 'id' | 'runId' | 'createdAt'> = {
            stepId: undefined,
            artifactType: 'video',
            name: basename(event.data.path),
            filePath: event.data.path,
            mimeType: 'video/webm',
            metadata: {
              timestamp: event.time,
              source: 'playwright-trace'
            }
          };
          traceData.artifacts.push(artifact);
        }
      } catch (error) {
        logger.warn('Failed to process event', { event, error });
      }
    }
  }

  private async processArtifacts(extractDir: string, traceData: ParsedTraceData): Promise<void> {
    try {
      const files = await fs.readdir(extractDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const ext = extname(file.name).toLowerCase();
          const filePath = join(extractDir, file.name);
          
          if (['.png', '.jpg', '.jpeg'].includes(ext)) {
            // Screenshot artifact
            const artifact: Omit<TraceArtifact, 'id' | 'runId' | 'createdAt'> = {
              stepId: undefined,
              artifactType: 'screenshot',
              name: file.name,
              filePath,
              mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
              metadata: {
                source: 'trace-extraction'
              }
            };
            traceData.artifacts.push(artifact);
          } else if (['.webm', '.mp4'].includes(ext)) {
            // Video artifact
            const artifact: Omit<TraceArtifact, 'id' | 'runId' | 'createdAt'> = {
              stepId: undefined,
              artifactType: 'video',
              name: file.name,
              filePath,
              mimeType: ext === '.webm' ? 'video/webm' : 'video/mp4',
              metadata: {
                source: 'trace-extraction'
              }
            };
            traceData.artifacts.push(artifact);
          } else if (['.html', '.htm'].includes(ext)) {
            // HTML report artifact
            const artifact: Omit<TraceArtifact, 'id' | 'runId' | 'createdAt'> = {
              stepId: undefined,
              artifactType: 'report',
              name: file.name,
              filePath,
              mimeType: 'text/html',
              metadata: {
                source: 'trace-extraction'
              }
            };
            traceData.artifacts.push(artifact);
          }
        } else if (file.isDirectory()) {
          // Recursively process subdirectories
          await this.processArtifacts(join(extractDir, file.name), traceData);
        }
      }
    } catch (error) {
      logger.warn('Failed to process artifacts directory', { extractDir, error });
    }
  }

  private async cleanupTempDir(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
      logger.debug('Cleaned up temp directory', { dir });
    } catch (error) {
      logger.warn('Failed to cleanup temp directory', { dir, error });
    }
  }

  // Additional utility methods for different trace formats
  async parseTraceFromDirectory(traceDir: string): Promise<ParsedTraceData> {
    logger.info('Parsing trace from directory', { traceDir });
    
    const traceData = await this.parseExtractedTrace(traceDir);
    return traceData;
  }

  async validateTraceFile(traceFilePath: string): Promise<{
    valid: boolean;
    format?: 'zip' | 'json' | 'jsonl';
    size?: number;
    error?: string;
  }> {
    try {
      const stats = await fs.stat(traceFilePath);
      const ext = extname(traceFilePath).toLowerCase();
      
      if (ext === '.zip') {
        const zipValid = await this.validateZipContents(traceFilePath);
        return { valid: zipValid, format: 'zip', size: stats.size };
      } else if (ext === '.json') {
        // Validate JSON format
        const content = await fs.readFile(traceFilePath, 'utf8');
        JSON.parse(content);
        return { valid: true, format: 'json', size: stats.size };
      } else if (ext === '.jsonl') {
        // Validate JSONL format
        const content = await fs.readFile(traceFilePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        for (const line of lines.slice(0, 10)) { // Validate first 10 lines
          JSON.parse(line);
        }
        return { valid: true, format: 'jsonl', size: stats.size };
      } else {
        return { valid: false, error: `Unsupported trace file format: ${ext}` };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  private extractRetryCount(action: any): number {
    // Extract retry information from action metadata
    if (action.metadata && action.metadata.retryIndex !== undefined) {
      return action.metadata.retryIndex;
    }
    
    // Check for retry indicators in action name or properties
    const actionName = action.name || '';
    if (actionName.includes('retry') || actionName.includes('Retry')) {
      const retryMatch = actionName.match(/retry[:\s]*(\d+)/i);
      if (retryMatch) {
        return parseInt(retryMatch[1], 10);
      }
    }
    
    // Check for retry count in test info
    if (action.testInfo && action.testInfo.retry !== undefined) {
      return action.testInfo.retry;
    }
    
    return 0; // Default to 0 if no retry information found
  }

  private async validateZipContents(zipFilePath: string): Promise<boolean> {
    try {
      const AdmZip = await import('adm-zip');
      const zip = new AdmZip.default(zipFilePath);
      const entries = zip.getEntries();
      
      // Basic validation - check if zip contains expected trace files
      const hasTraceEntries = entries.some(entry => 
        entry.entryName.includes('.json') || 
        entry.entryName.includes('trace.jsonl') ||
        entry.entryName.includes('resources/') ||
        entry.entryName.includes('screenshots/')
      );
      
      // Check if zip is not empty and contains valid entries
      return entries.length > 0 && hasTraceEntries;
    } catch (error) {
      logger.warn('Failed to validate zip contents', { zipFilePath, error });
      return false;
    }
  }
}