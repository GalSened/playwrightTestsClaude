import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/error-handler';
import { logger } from '@/utils/logger';
import Database from 'better-sqlite3';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation schema for adding generated test to bank
const AddGeneratedTestSchema = z.object({
  generatedCode: z.string().min(1),
  filename: z.string().min(1),
  testType: z.enum(['playwright', 'pytest']),
  module: z.string().min(1),
  action: z.string().min(1),
  language: z.enum(['en', 'he', 'both']),
  selectionMode: z.enum(['all', 'selected', 'single', 'none']),
  selectedTests: z.array(z.string()).optional(),
  metadata: z.object({
    category: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    tags: z.array(z.string()),
    description: z.string()
  })
});

/**
 * POST /api/test-bank/generated
 * Add generated test(s) to the test bank
 */
router.post('/generated', asyncHandler(async (req: Request, res: Response) => {
  const validation = AddGeneratedTestSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request parameters',
      details: validation.error.errors
    });
  }

  const data = validation.data;
  
  logger.info('Adding generated test to bank', {
    filename: data.filename,
    testType: data.testType,
    module: data.module,
    selectionMode: data.selectionMode,
    selectedTestsCount: data.selectedTests?.length || 0
  });

  // Initialize test database connection
  let db: Database.Database;
  try {
    db = new Database(join(process.cwd(), 'data/scheduler.db'));
    
    // Initialize test discovery schema if needed
    try {
      const schemaPath = join(__dirname, '../database/test-discovery-schema.sql');
      const fs = require('fs');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      db.exec(schema);
    } catch (schemaError) {
      logger.warn('Could not initialize test discovery schema', { error: schemaError });
    }
    
    // Run migration to add generated test support
    try {
      const migrationPath = join(__dirname, '../database/migrations/add-generated-tests-support.sql');
      const fs = require('fs');
      const migration = fs.readFileSync(migrationPath, 'utf8');
      db.exec(migration);
    } catch (migrationError) {
      logger.warn('Migration already applied or failed', { error: migrationError });
    }
  } catch (dbError) {
    logger.error('Failed to initialize database', { error: dbError });
    throw dbError;
  }

  try {
    // Generate unique test file path for generated tests
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testFilePath = `generated/${data.module}/${data.filename.replace(/\.(spec\.ts|\.py)$/, '')}-${timestamp}${data.testType === 'playwright' ? '.spec.ts' : '.py'}`;
    
    // Parse and extract individual tests based on selection mode
    const individualTests = parseTestCode(data.generatedCode, data.testType);
    
    let testsToAdd: Array<{
      name: string;
      description: string;
      type: string;
      code: string;
    }> = [];

    switch (data.selectionMode) {
      case 'all':
        testsToAdd = individualTests;
        break;
      case 'selected':
        testsToAdd = individualTests.filter(test => 
          data.selectedTests?.includes(test.name) || data.selectedTests?.includes(test.name.replace(/_/g, ' '))
        );
        break;
      case 'single':
        const mainTest = individualTests.find(test => test.type === 'test') || individualTests[0];
        if (mainTest) testsToAdd = [mainTest];
        break;
      case 'none':
        return res.json({
          success: true,
          message: 'Code generated but not added to test bank',
          testsGenerated: individualTests.length
        });
    }

    if (testsToAdd.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No tests selected for addition to test bank'
      });
    }

    // Add each test to the database
    const addedTests = [];
    
    for (let i = 0; i < testsToAdd.length; i++) {
      const test = testsToAdd[i];
      const testFileName = testsToAdd.length > 1 ? 
        `${testFilePath.replace(/\.(spec\.ts|\.py)$/, '')}-${i + 1}${data.testType === 'playwright' ? '.spec.ts' : '.py'}` : 
        testFilePath;

      const result = db.prepare(`
        INSERT INTO tests (
          id, name, description, file_path, status, module, language, test_type, framework,
          source_type, generated_metadata, parent_request_id, selection_mode, tags, priority,
          created_at, updated_at, test_name, function_name, category, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?)
      `).run(
        uuidv4(), // id
        test.name,
        test.description || data.metadata.description,
        testFileName,
        'active',
        data.module,
        data.language,
        test.type,
        data.testType,
        'generated', // source_type
        JSON.stringify({
          originalAction: data.action,
          generatedAt: new Date().toISOString(),
          fullCode: data.generatedCode,
          individualTestCode: test.code,
          category: data.metadata.category,
          testIndex: i
        }),
        null, // parent_request_id - could be used for grouping related generations
        data.selectionMode,
        data.metadata.tags.join(','),
        data.metadata.priority,
        test.name, // test_name (legacy field)
        test.name, // function_name (legacy field)
        data.metadata.category, // category (legacy field)
        1 // is_active (legacy field)
      );

      addedTests.push({
        id: result.lastID,
        name: test.name,
        description: test.description,
        filePath: testFileName,
        type: test.type
      });
    }

    // Write the actual test files to filesystem (optional, for execution)
    const fs = require('fs');
    const path = require('path');
    
    for (let i = 0; i < testsToAdd.length; i++) {
      const test = testsToAdd[i];
      const testFileName = addedTests[i].filePath;
      const fullPath = path.join(process.cwd(), 'tests', testFileName);
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      fs.mkdirSync(dir, { recursive: true });
      
      // Write test file
      const fileContent = testsToAdd.length === 1 ? 
        data.generatedCode : 
        generateIndividualTestFile(test, data.testType, data.module);
        
      fs.writeFileSync(fullPath, fileContent);
    }

    res.json({
      success: true,
      message: `Successfully added ${addedTests.length} test(s) to test bank`,
      testsAdded: addedTests,
      metadata: {
        selectionMode: data.selectionMode,
        totalGenerated: individualTests.length,
        totalAdded: addedTests.length,
        module: data.module,
        category: data.metadata.category,
        priority: data.metadata.priority
      }
    });

  } catch (error) {
    logger.error('Failed to add generated test to bank', { error, data });
    res.status(500).json({
      success: false,
      error: 'Failed to add test to bank',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

/**
 * Parse generated test code to extract individual test functions
 */
function parseTestCode(code: string, testType: string): Array<{
  name: string;
  description: string;
  type: string;
  code: string;
}> {
  const tests: Array<{
    name: string;
    description: string;
    type: string;
    code: string;
  }> = [];

  if (testType === 'pytest') {
    // Parse Python test functions
    const functionRegex = /def ((?:test_|setup_|teardown_)\w+)\([^)]*\):([\s\S]*?)(?=\ndef |$)/g;
    let match;
    
    while ((match = functionRegex.exec(code)) !== null) {
      const functionName = match[1];
      const functionBody = match[2];
      const fullFunction = `def ${functionName}${match[0].substring(match[1].length + 3)}`;
      
      let type = 'test';
      if (functionName.startsWith('setup_')) type = 'setup';
      else if (functionName.startsWith('teardown_')) type = 'cleanup';
      else if (!functionName.startsWith('test_')) type = 'helper';

      tests.push({
        name: functionName,
        description: extractPythonDocstring(functionBody) || functionName.replace(/_/g, ' '),
        type,
        code: fullFunction
      });
    }
  } else {
    // Parse TypeScript/Playwright tests
    const testRegex = /test\(['"`](.*?)['"`],.*?{([\s\S]*?)}\);/g;
    const describeRegex = /describe\(['"`](.*?)['"`],.*?{([\s\S]*?)}\);/g;
    
    let match;
    let testIndex = 1;
    
    while ((match = testRegex.exec(code)) !== null) {
      const testName = match[1];
      const testBody = match[2];
      
      tests.push({
        name: `test_${testIndex}_${testName.replace(/\s+/g, '_').toLowerCase()}`,
        description: testName,
        type: 'test',
        code: match[0]
      });
      testIndex++;
    }
    
    while ((match = describeRegex.exec(code)) !== null) {
      const suiteName = match[1];
      
      tests.push({
        name: `suite_${suiteName.replace(/\s+/g, '_').toLowerCase()}`,
        description: `Test suite: ${suiteName}`,
        type: 'setup',
        code: match[0]
      });
    }
  }

  return tests;
}

/**
 * Extract docstring from Python function body
 */
function extractPythonDocstring(functionBody: string): string | null {
  const docstringMatch = functionBody.match(/^\s*[\'\"]{3}([\s\S]*?)[\'\"]{3}/);
  return docstringMatch ? docstringMatch[1].trim() : null;
}

/**
 * Generate individual test file content for a specific test
 */
function generateIndividualTestFile(test: any, testType: string, module: string): string {
  if (testType === 'pytest') {
    return `"""
Generated test for WeSign ${module} module
Test: ${test.description}
Generated by QA Intelligence Test Generator
"""

import pytest
from playwright.sync_api import Page

${test.code}
`;
  } else {
    return `/**
 * Generated test for WeSign ${module} module
 * Test: ${test.description}
 * Generated by QA Intelligence Test Generator
 */

import { test, expect } from '@playwright/test';

${test.code}
`;
  }
}

export default router;