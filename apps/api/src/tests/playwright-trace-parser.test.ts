import { PlaywrightTraceParser } from '../services/playwright-trace-parser';
import { promises as fs } from 'fs';
import { join } from 'path';

// Mock fs operations
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    stat: jest.fn(),
    rm: jest.fn()
  }
}));

// Mock yauzl for zip extraction
jest.mock('yauzl', () => ({
  extract: jest.fn()
}));

const mockFs = fs as jest.Mocked<typeof fs>;
const { extract } = require('yauzl');

describe('PlaywrightTraceParser', () => {
  let parser: PlaywrightTraceParser;
  const tempDir = join(__dirname, '../../test-data/temp');

  beforeEach(() => {
    parser = new PlaywrightTraceParser(tempDir);
    jest.clearAllMocks();
  });

  describe('parseTrace', () => {
    const traceFilePath = '/path/to/trace.zip';

    test('should parse a valid trace file', async () => {
      // Mock file exists
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      // Mock zip extraction
      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      // Mock directory reading
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mock trace content
      const mockTraceContent = JSON.stringify([
        {
          type: 'action',
          name: 'page.click',
          startTime: 1000,
          endTime: 2000,
          selector: 'button[data-testid="login"]',
          params: {
            selector: 'button[data-testid="login"]',
            url: 'https://example.com'
          }
        },
        {
          type: 'console',
          time: 1500,
          level: 'error',
          message: 'Test error',
          url: 'https://example.com',
          lineNumber: 42
        },
        {
          type: 'network',
          time: 1200,
          method: 'POST',
          url: 'https://api.example.com/login',
          statusCode: 200,
          duration: 150
        }
      ]);

      mockFs.readFile.mockResolvedValue(mockTraceContent);

      // Mock cleanup
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace(traceFilePath);

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].actionName).toBe('Page Click');
      expect(result.steps[0].selector).toBe('button[data-testid="login"]');
      expect(result.steps[0].duration).toBe(1000);

      expect(result.logs).toHaveLength(1);
      expect(result.logs[0].level).toBe('error');
      expect(result.logs[0].message).toBe('Test error');

      expect(result.networkLogs).toHaveLength(1);
      expect(result.networkLogs[0].method).toBe('POST');
      expect(result.networkLogs[0].statusCode).toBe(200);

      expect(mockFs.rm).toHaveBeenCalled(); // Cleanup called
    });

    test('should handle JSONL format traces', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      // JSONL format (JSON Lines)
      const mockTraceContent = [
        '{"type": "action", "name": "page.fill", "startTime": 1000, "endTime": 1500}',
        '{"type": "action", "name": "page.click", "startTime": 2000, "endTime": 2200}'
      ].join('\n');

      mockFs.readFile.mockResolvedValue(mockTraceContent);
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace(traceFilePath);

      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].actionName).toBe('Page Fill');
      expect(result.steps[1].actionName).toBe('Page Click');
    });

    test('should handle traces in subdirectories', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      // First readdir returns directory
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'data', isFile: () => false, isDirectory: () => true }
      ] as any);

      // Second readdir returns trace file in subdirectory
      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockFs.readFile.mockResolvedValue(JSON.stringify([]));
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace(traceFilePath);

      expect(result).toBeDefined();
      expect(mockFs.readdir).toHaveBeenCalledTimes(2);
    });

    test('should handle missing trace file', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([]);
      mockFs.rm.mockResolvedValue(undefined);

      await expect(parser.parseTrace(traceFilePath)).rejects.toThrow('No trace file found');
    });

    test('should handle zip extraction errors', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(new Error('Failed to extract'));
      });

      mockFs.rm.mockResolvedValue(undefined);

      await expect(parser.parseTrace(traceFilePath)).rejects.toThrow('Failed to extract trace file');
    });

    test('should handle file access errors', async () => {
      mockFs.access.mockRejectedValue(new Error('File not found'));

      await expect(parser.parseTrace(traceFilePath)).rejects.toThrow('Failed to parse trace file');
    });

    test('should cleanup temp directory on error', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(new Error('Extraction failed'));
      });

      mockFs.rm.mockResolvedValue(undefined);

      await expect(parser.parseTrace(traceFilePath)).rejects.toThrow();
      expect(mockFs.rm).toHaveBeenCalled();
    });

    test('should process artifacts from extracted directory', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockImplementation((path: string) => {
        if (path.includes('extracted')) {
          return Promise.resolve([
            { name: 'trace.json', isFile: () => true, isDirectory: () => false },
            { name: 'screenshot.png', isFile: () => true, isDirectory: () => false },
            { name: 'video.webm', isFile: () => true, isDirectory: () => false },
            { name: 'report.html', isFile: () => true, isDirectory: () => false }
          ] as any);
        }
        return Promise.resolve([]);
      });

      mockFs.readFile.mockResolvedValue(JSON.stringify([]));
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace(traceFilePath);

      expect(result.artifacts).toHaveLength(3); // screenshot, video, report
      expect(result.artifacts.find(a => a.name === 'screenshot.png')).toBeDefined();
      expect(result.artifacts.find(a => a.name === 'video.webm')).toBeDefined();
      expect(result.artifacts.find(a => a.name === 'report.html')).toBeDefined();
    });
  });

  describe('parseTraceFromDirectory', () => {
    test('should parse trace from directory', async () => {
      const traceDir = '/path/to/trace';

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockFs.readFile.mockResolvedValue(JSON.stringify([]));

      const result = await parser.parseTraceFromDirectory(traceDir);

      expect(result).toBeDefined();
      expect(result.steps).toBeDefined();
      expect(result.artifacts).toBeDefined();
      expect(result.logs).toBeDefined();
      expect(result.networkLogs).toBeDefined();
    });
  });

  describe('validateTraceFile', () => {
    test('should validate zip files', async () => {
      const traceFile = '/path/to/trace.zip';
      
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      const result = await parser.validateTraceFile(traceFile);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('zip');
      expect(result.size).toBe(1024);
    });

    test('should validate JSON files', async () => {
      const traceFile = '/path/to/trace.json';
      
      mockFs.stat.mockResolvedValue({ size: 2048 } as any);
      mockFs.readFile.mockResolvedValue('{"valid": "json"}');

      const result = await parser.validateTraceFile(traceFile);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('json');
      expect(result.size).toBe(2048);
    });

    test('should validate JSONL files', async () => {
      const traceFile = '/path/to/trace.jsonl';
      
      mockFs.stat.mockResolvedValue({ size: 512 } as any);
      mockFs.readFile.mockResolvedValue('{"line": 1}\n{"line": 2}');

      const result = await parser.validateTraceFile(traceFile);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('jsonl');
    });

    test('should reject invalid file formats', async () => {
      const traceFile = '/path/to/trace.txt';
      
      mockFs.stat.mockResolvedValue({ size: 100 } as any);

      const result = await parser.validateTraceFile(traceFile);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported trace file format');
    });

    test('should handle invalid JSON', async () => {
      const traceFile = '/path/to/trace.json';
      
      mockFs.stat.mockResolvedValue({ size: 100 } as any);
      mockFs.readFile.mockResolvedValue('invalid json');

      const result = await parser.validateTraceFile(traceFile);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle file not found', async () => {
      const traceFile = '/path/to/nonexistent.json';
      
      mockFs.stat.mockRejectedValue(new Error('File not found'));

      const result = await parser.validateTraceFile(traceFile);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });

  describe('Action parsing', () => {
    test('should extract action type correctly', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      const mockActions = [
        { name: 'page.click', startTime: 1000, endTime: 2000 },
        { name: 'page.fill', startTime: 2000, endTime: 3000 },
        { name: 'page.goto', startTime: 3000, endTime: 4000 },
        { name: 'expect.toBeVisible', startTime: 4000, endTime: 5000 },
        { name: 'page.waitForTimeout', startTime: 5000, endTime: 6000 },
        { name: 'unknown.action', startTime: 6000, endTime: 7000 }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockActions));
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace('/path/to/trace.zip');

      expect(result.steps).toHaveLength(6);
      expect(result.steps[0].actionType).toBe('click');
      expect(result.steps[1].actionType).toBe('fill');
      expect(result.steps[2].actionType).toBe('navigate');
      expect(result.steps[3].actionType).toBe('expect');
      expect(result.steps[4].actionType).toBe('wait');
      expect(result.steps[5].actionType).toBe('action'); // fallback
    });

    test('should handle failed actions', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      const mockAction = {
        name: 'page.click',
        startTime: 1000,
        endTime: 2000,
        error: 'Element not found'
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify([mockAction]));
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace('/path/to/trace.zip');

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].status).toBe('failed');
      expect(result.steps[0].errorMessage).toBe('Element not found');
    });

    test('should handle actions with snapshots', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      const mockAction = {
        name: 'page.click',
        startTime: 1000,
        endTime: 2000,
        inputSnapshot: 'before.png',
        outputSnapshot: 'after.png'
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify([mockAction]));
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace('/path/to/trace.zip');

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].screenshotBefore).toBe('before.png');
      expect(result.steps[0].screenshotAfter).toBe('after.png');
    });
  });

  describe('Event processing', () => {
    test('should process screenshot events as artifacts', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      const mockEvents = [
        {
          type: 'screenshot',
          time: 1000,
          data: { path: 'screenshot.png' }
        },
        {
          type: 'video',
          time: 2000,
          data: { path: 'recording.webm' }
        }
      ];

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockEvents));
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace('/path/to/trace.zip');

      expect(result.artifacts).toHaveLength(2);
      expect(result.artifacts[0].artifactType).toBe('screenshot');
      expect(result.artifacts[0].name).toBe('screenshot.png');
      expect(result.artifacts[1].artifactType).toBe('video');
      expect(result.artifacts[1].name).toBe('recording.webm');
    });
  });

  describe('Error handling', () => {
    test('should handle malformed trace entries gracefully', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      // Mix of valid and invalid entries
      const mockTraceContent = [
        '{"name": "valid.action", "startTime": 1000, "endTime": 2000}',
        'invalid json line',
        '{"name": "another.valid", "startTime": 3000, "endTime": 4000}'
      ].join('\n');

      mockFs.readFile.mockResolvedValue(mockTraceContent);
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace('/path/to/trace.zip');

      // Should process valid entries and skip invalid ones
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].actionName).toBe('Valid Action');
      expect(result.steps[1].actionName).toBe('Another Valid');
    });

    test('should handle empty trace files', async () => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.mkdir.mockResolvedValue(undefined);

      extract.mockImplementation((path: string, options: any, callback: Function) => {
        callback(null);
      });

      mockFs.readdir.mockResolvedValueOnce([
        { name: 'trace.json', isFile: () => true, isDirectory: () => false }
      ] as any);

      mockFs.readFile.mockResolvedValue('');
      mockFs.rm.mockResolvedValue(undefined);

      const result = await parser.parseTrace('/path/to/trace.zip');

      expect(result.steps).toHaveLength(0);
      expect(result.logs).toHaveLength(0);
      expect(result.networkLogs).toHaveLength(0);
      expect(result.artifacts).toHaveLength(0);
    });
  });
});