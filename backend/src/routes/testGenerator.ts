import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getTestGeneratorService, type TestGenerationRequest } from '@/services/ai/testGeneratorService';
import { asyncHandler } from '@/middleware/error-handler';
import { logger } from '@/utils/logger';

const router = Router();

// Validation schema for test generation request
const TestGenerationSchema = z.object({
  testType: z.enum(['playwright', 'pytest']),
  module: z.enum(['auth', 'documents', 'contacts', 'templates', 'dashboard', 'admin', 'integrations']),
  action: z.string().min(1).max(100),
  language: z.enum(['en', 'he', 'both']).default('both'),
  customParams: z.object({
    selectors: z.array(z.string()).optional(),
    testData: z.any().optional(),
    assertions: z.array(z.string()).optional(),
    description: z.string().optional()
  }).optional()
});

/**
 * POST /api/test-generator/generate
 * Generate test code based on specified parameters
 */
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const validation = TestGenerationSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request parameters',
      details: validation.error.errors
    });
  }

  const request: TestGenerationRequest = validation.data;
  
  logger.info('Generating test code', {
    testType: request.testType,
    module: request.module,
    action: request.action,
    language: request.language
  });

  const testGenerator = getTestGeneratorService();
  const result = await testGenerator.generateTest(request);

  if (result.success) {
    res.json({
      success: true,
      result: {
        code: result.code,
        filename: result.filename,
        description: result.description,
        testType: result.testType,
        dependencies: result.dependencies,
        setupInstructions: result.setupInstructions
      },
      metadata: {
        timestamp: new Date().toISOString(),
        request: {
          testType: request.testType,
          module: request.module,
          action: request.action,
          language: request.language
        }
      }
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Test generation failed',
      details: result.error
    });
  }
}));

/**
 * GET /api/test-generator/templates
 * Get available test templates and examples
 */
router.get('/templates', asyncHandler(async (req: Request, res: Response) => {
  const templates = {
    modules: [
      { id: 'auth', name: 'Authentication', description: 'Login, logout, session management' },
      { id: 'documents', name: 'Document Management', description: 'Upload, merge, prepare documents' },
      { id: 'contacts', name: 'Contact Management', description: 'Add, edit, manage signers' },
      { id: 'templates', name: 'Document Templates', description: 'Create and use templates' },
      { id: 'dashboard', name: 'Dashboard', description: 'Main dashboard functionality' },
      { id: 'admin', name: 'Administration', description: 'User and system administration' },
      { id: 'integrations', name: 'Integrations', description: 'Third-party integrations' }
    ],
    actions: {
      auth: ['login', 'logout', 'forgot-password', 'change-password', 'session-timeout'],
      documents: ['upload', 'merge', 'prepare', 'send', 'sign', 'download', 'delete'],
      contacts: ['add-contact', 'edit-contact', 'delete-contact', 'import-contacts', 'contact-groups'],
      templates: ['create-template', 'edit-template', 'use-template', 'share-template'],
      dashboard: ['view-statistics', 'recent-documents', 'pending-signatures', 'notifications'],
      admin: ['user-management', 'system-settings', 'audit-logs', 'permissions'],
      integrations: ['api-access', 'webhook-setup', 'third-party-auth', 'data-sync']
    },
    languages: [
      { id: 'en', name: 'English', description: 'English UI elements only' },
      { id: 'he', name: 'Hebrew', description: 'Hebrew UI elements only' },
      { id: 'both', name: 'Bilingual', description: 'Test both Hebrew and English' }
    ],
    testTypes: [
      { 
        id: 'playwright', 
        name: 'Playwright (TypeScript)', 
        description: 'TypeScript-based UI automation with Playwright',
        features: ['Cross-browser testing', 'TypeScript support', 'Visual debugging', 'Parallel execution']
      },
      { 
        id: 'pytest', 
        name: 'Pytest (Python)', 
        description: 'Python-based testing with pytest-playwright',
        features: ['Python ecosystem', 'Flexible fixtures', 'Rich reporting', 'Easy parametrization']
      }
    ]
  };

  res.json({
    success: true,
    templates,
    metadata: {
      totalModules: templates.modules.length,
      totalTestTypes: templates.testTypes.length,
      supportedLanguages: templates.languages.length
    }
  });
}));

/**
 * GET /api/test-generator/health
 * Health check for the test generator service
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const testGenerator = getTestGeneratorService();
  const healthy = await testGenerator.healthCheck();
  
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    status: healthy ? 'healthy' : 'unhealthy',
    service: 'WeSign Test Generator',
    timestamp: new Date().toISOString()
  });
}));

/**
 * POST /api/test-generator/validate
 * Validate test generation parameters without generating code
 */
router.post('/validate', asyncHandler(async (req: Request, res: Response) => {
  const validation = TestGenerationSchema.safeParse(req.body);
  
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      valid: false,
      errors: validation.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
    });
  }

  res.json({
    success: true,
    valid: true,
    message: 'Parameters are valid for test generation',
    estimatedComplexity: calculateComplexity(validation.data),
    suggestedFilename: generateSuggestedFilename(validation.data)
  });
}));

// Helper functions
function calculateComplexity(request: TestGenerationRequest): 'simple' | 'medium' | 'complex' {
  let complexity = 0;
  
  // Add complexity based on module
  if (['documents', 'integrations'].includes(request.module)) complexity += 2;
  else if (['templates', 'admin'].includes(request.module)) complexity += 1;
  
  // Add complexity based on language
  if (request.language === 'both') complexity += 1;
  
  // Add complexity based on custom parameters
  if (request.customParams) {
    if (request.customParams.selectors?.length) complexity += 1;
    if (request.customParams.assertions?.length) complexity += 1;
  }
  
  if (complexity <= 1) return 'simple';
  if (complexity <= 3) return 'medium';
  return 'complex';
}

function generateSuggestedFilename(request: TestGenerationRequest): string {
  const { testType, module, action, language } = request;
  const langSuffix = language === 'both' ? 'bilingual' : language;
  const extension = testType === 'playwright' ? '.spec.ts' : '.py';
  
  return `${module}-${action.replace(/\s+/g, '-').toLowerCase()}-${langSuffix}${extension}`;
}

export default router;