import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import TestCodeGenerator, { TestGenerationRequest } from '@/services/ai/test-code-generator';

const router = Router();

/**
 * POST /api/test-code-generation/generate
 * Generate test automation code based on requirements
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      type,
      description,
      framework = 'playwright',
      language = 'python',
      testType = 'e2e',
      pageUrl,
      existingCode,
      requirements = [],
      testData,
      locators,
      codeStyle
    } = req.body;

    // Validation
    if (!type || !description) {
      return res.status(400).json({
        success: false,
        error: 'type and description are required'
      });
    }

    const validTypes = ['page_object', 'test_case', 'locator_strategy', 'data_factory', 'utility', 'full_workflow'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `type must be one of: ${validTypes.join(', ')}`
      });
    }

    const validFrameworks = ['playwright', 'selenium', 'cypress'];
    if (!validFrameworks.includes(framework)) {
      return res.status(400).json({
        success: false,
        error: `framework must be one of: ${validFrameworks.join(', ')}`
      });
    }

    const validLanguages = ['python', 'javascript', 'typescript'];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        error: `language must be one of: ${validLanguages.join(', ')}`
      });
    }

    const generationRequest: TestGenerationRequest = {
      type,
      description,
      framework,
      language,
      testType,
      pageUrl,
      existingCode,
      requirements,
      testData,
      locators,
      codeStyle
    };

    const generator = new TestCodeGenerator();
    const generatedCode = await generator.generateTestCode(generationRequest);
    generator.close();

    res.json({
      success: true,
      generatedCode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Test code generation failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Test code generation failed'
    });
  }
});

/**
 * POST /api/test-code-generation/improve
 * Improve existing test code based on suggestions
 */
router.post('/improve', async (req: Request, res: Response) => {
  try {
    const { code, improvements = [] } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'code is required'
      });
    }

    if (!Array.isArray(improvements) || improvements.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'improvements array is required and must not be empty'
      });
    }

    const generator = new TestCodeGenerator();
    const improvedCode = await generator.improveExistingCode(code, improvements);
    generator.close();

    res.json({
      success: true,
      improvedCode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Code improvement failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Code improvement failed'
    });
  }
});

/**
 * GET /api/test-code-generation/history
 * Get history of generated code
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    const numLimit = parseInt(limit as string, 10);

    if (isNaN(numLimit) || numLimit < 1 || numLimit > 100) {
      return res.status(400).json({
        success: false,
        error: 'limit must be a number between 1 and 100'
      });
    }

    const generator = new TestCodeGenerator();
    const history = await generator.getGeneratedCodeHistory(numLimit);
    generator.close();

    res.json({
      success: true,
      history,
      count: history.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get code generation history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get code generation history'
    });
  }
});

/**
 * GET /api/test-code-generation/code/:id
 * Get specific generated code by ID
 */
router.get('/code/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'code ID is required'
      });
    }

    const generator = new TestCodeGenerator();
    const generatedCode = await generator.getGeneratedCodeById(id);
    generator.close();

    if (!generatedCode) {
      return res.status(404).json({
        success: false,
        error: 'Generated code not found'
      });
    }

    res.json({
      success: true,
      generatedCode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get generated code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get generated code'
    });
  }
});

/**
 * GET /api/test-code-generation/stats
 * Get code generation statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const generator = new TestCodeGenerator();
    const stats = await generator.getCodeGenerationStats();
    generator.close();

    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get code generation stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get code generation stats'
    });
  }
});

/**
 * POST /api/test-code-generation/templates
 * Get code templates for specific scenarios
 */
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { scenario, framework = 'playwright', language = 'python' } = req.body;

    if (!scenario) {
      return res.status(400).json({
        success: false,
        error: 'scenario is required'
      });
    }

    // Predefined templates for common scenarios
    const templates = {
      'login_test': {
        description: 'User login functionality test',
        type: 'test_case',
        requirements: [
          'Test valid login with correct credentials',
          'Test invalid login with wrong password',
          'Test empty field validation',
          'Test account lockout after multiple failures'
        ]
      },
      'form_submission': {
        description: 'Form submission with validation',
        type: 'test_case',
        requirements: [
          'Test form submission with valid data',
          'Test required field validation',
          'Test input format validation',
          'Test form reset functionality'
        ]
      },
      'navigation_menu': {
        description: 'Navigation menu page object',
        type: 'page_object',
        requirements: [
          'Include all navigation elements',
          'Add hover and click methods',
          'Include breadcrumb navigation',
          'Support mobile responsive menu'
        ]
      },
      'api_data_factory': {
        description: 'API test data factory',
        type: 'data_factory',
        requirements: [
          'Generate realistic user data',
          'Support different user roles',
          'Include invalid data scenarios',
          'Support bulk data generation'
        ]
      },
      'file_upload': {
        description: 'File upload test workflow',
        type: 'full_workflow',
        requirements: [
          'Test various file types and sizes',
          'Test upload progress monitoring',
          'Test file validation errors',
          'Test upload cancellation'
        ]
      }
    };

    const template = templates[scenario as keyof typeof templates];

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found for scenario',
        availableScenarios: Object.keys(templates)
      });
    }

    // Generate code using the template
    const generationRequest: TestGenerationRequest = {
      type: template.type as any,
      description: template.description,
      framework: framework as any,
      language: language as any,
      testType: 'e2e',
      requirements: template.requirements
    };

    const generator = new TestCodeGenerator();
    const generatedCode = await generator.generateTestCode(generationRequest);
    generator.close();

    res.json({
      success: true,
      scenario,
      template,
      generatedCode,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Template generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Template generation failed'
    });
  }
});

/**
 * POST /api/test-code-generation/batch-generate
 * Generate multiple related test components in a batch
 */
router.post('/batch-generate', async (req: Request, res: Response) => {
  try {
    const {
      requests = [],
      framework = 'playwright',
      language = 'python',
      projectName = 'Test Project'
    } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'requests array is required and must not be empty'
      });
    }

    if (requests.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 requests allowed per batch'
      });
    }

    const generator = new TestCodeGenerator();
    const results = [];

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      try {
        const generationRequest: TestGenerationRequest = {
          framework: framework as any,
          language: language as any,
          testType: 'e2e',
          ...request
        };

        const generatedCode = await generator.generateTestCode(generationRequest);
        results.push({
          index: i,
          success: true,
          generatedCode
        });
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: error instanceof Error ? error.message : 'Generation failed'
        });
      }
    }

    generator.close();

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    res.json({
      success: true,
      projectName,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        successRate: Math.round((successCount / results.length) * 100)
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Batch generation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Batch generation failed'
    });
  }
});

export { router as testCodeGenerationRouter };