import { config } from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { logger } from '@/utils/logger';

config();

export interface TestGenerationRequest {
  testType: 'playwright' | 'pytest';
  module: 'auth' | 'documents' | 'contacts' | 'templates' | 'dashboard' | 'admin' | 'integrations';
  action: string;
  language: 'en' | 'he' | 'both';
  customParams?: {
    selectors?: string[];
    testData?: any;
    assertions?: string[];
    description?: string;
  };
}

export interface TestGenerationResult {
  success: boolean;
  code: string;
  filename: string;
  description: string;
  testType: string;
  dependencies: string[];
  setupInstructions: string[];
  error?: string;
}

export class TestGeneratorService {
  private llm: ChatOpenAI;
  private promptTemplate: PromptTemplate;

  constructor() {
    // Initialize GPT-4o for test generation with maximum accuracy
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0, // Most accurate, deterministic code generation
    });

    // Create specialized prompt for test generation
    this.promptTemplate = PromptTemplate.fromTemplate(`
SYSTEM IDENTITY: You are the WeSign Test Generator - an elite AI code architect specializing in generating production-ready test automation code for WeSign platform.

CORE MISSION: Generate precise, robust, and immediately executable test code that follows industry best practices and handles WeSign's bilingual nature.

=== WESIGN TEST GENERATION INTELLIGENCE ===

Target Platform: WeSign Electronic Document Signing
• URL: https://devtest.comda.co.il
• Credentials: admin@demo.com / demo123  
• Languages: Hebrew (RTL) + English (LTR)
• Framework: 311-test automation suite

Test Architecture Requirements:
• Module Structure: {module} module testing
• Action Focus: {action} functionality
• Test Type: {testType} framework
• Language Support: {language} UI elements
• Custom Parameters: {customParams}

=== CODE GENERATION PROTOCOL ===

FRAMEWORK STANDARDS:

For Playwright (TypeScript):
• Use @playwright/test framework
• Implement Page Object Model patterns
• Include proper typing with TypeScript interfaces
• Add comprehensive error handling and retries
• Use data-testid attributes when available
• Implement bilingual selector strategies
• Include screenshot capture on failure

For Pytest (Python):
• Use pytest-playwright framework  
• Follow Python PEP 8 style guidelines
• Implement fixture-based setup/teardown
• Include parametrized tests for bilingual testing
• Add comprehensive logging and assertions
• Use page object pattern with Python classes
• Include HTML report generation

BILINGUAL SELECTOR STRATEGY:
• Hebrew Text: Use regex patterns like /hebrew|english/i
• RTL Layout: Handle right-to-left element positioning  
• Language Toggle: Test UI language switching
• Fallback Selectors: Multiple selector strategies for robustness

CODE QUALITY REQUIREMENTS:
✓ Production-ready: Immediately executable without modifications
✓ Self-documenting: Clear variable names and comments
✓ Error-resilient: Timeout handling, element waiting, retry logic
✓ Maintainable: Modular structure with reusable components  
✓ Comprehensive: Full test scenario coverage with setup/teardown
✓ Bilingual-aware: Handles both Hebrew and English UI elements
✓ Best Practices: Follows framework conventions and testing patterns

=== GENERATION INSTRUCTIONS ===

OUTPUT STRUCTURE:
1. File header with description and metadata
2. Imports and dependencies
3. Configuration and setup
4. Page object classes (if applicable)
5. Test functions/methods with comprehensive coverage
6. Helper functions for bilingual support
7. Cleanup and teardown procedures

NAMING CONVENTIONS:
• Files: kebab-case (e.g., document-upload-test.spec.ts)
• Classes: PascalCase (e.g., DocumentUploadPage)
• Functions: camelCase (e.g., uploadDocument)
• Variables: camelCase with descriptive names

GENERATE PRODUCTION-READY CODE:
`);
  }

  async generateTest(request: TestGenerationRequest): Promise<TestGenerationResult> {
    try {
      logger.info('Generating test code', { 
        testType: request.testType, 
        module: request.module, 
        action: request.action 
      });

      // Create the generation chain
      const generationChain = RunnableSequence.from([
        {
          testType: () => request.testType,
          module: () => request.module,
          action: () => request.action,
          language: () => request.language,
          customParams: () => JSON.stringify(request.customParams || {}),
        },
        this.promptTemplate,
        this.llm,
      ]);

      // Execute the generation
      const response = await generationChain.invoke({
        testType: request.testType,
        module: request.module,
        action: request.action,
        language: request.language,
        customParams: request.customParams || {}
      });

      const generatedCode = response.content as string;

      // Extract metadata from generated code
      const filename = this.generateFilename(request);
      const description = this.generateDescription(request);
      const dependencies = this.extractDependencies(request.testType);
      const setupInstructions = this.generateSetupInstructions(request.testType);

      return {
        success: true,
        code: generatedCode,
        filename,
        description,
        testType: request.testType,
        dependencies,
        setupInstructions
      };

    } catch (error) {
      logger.error('Test generation failed', { error, request });
      return {
        success: false,
        code: '',
        filename: '',
        description: '',
        testType: request.testType,
        dependencies: [],
        setupInstructions: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private generateFilename(request: TestGenerationRequest): string {
    const { testType, module, action, language } = request;
    const langSuffix = language === 'both' ? 'bilingual' : language;
    const extension = testType === 'playwright' ? '.spec.ts' : '.py';
    
    return `${module}-${action.replace(/\s+/g, '-').toLowerCase()}-${langSuffix}${extension}`;
  }

  private generateDescription(request: TestGenerationRequest): string {
    const { testType, module, action, language } = request;
    const langDesc = language === 'both' ? 'bilingual' : `${language} language`;
    
    return `${testType} test for WeSign ${module} module - ${action} functionality with ${langDesc} support`;
  }

  private extractDependencies(testType: 'playwright' | 'pytest'): string[] {
    if (testType === 'playwright') {
      return [
        '@playwright/test',
        'typescript',
        '@types/node'
      ];
    } else {
      return [
        'pytest',
        'playwright',
        'pytest-playwright',
        'pytest-html'
      ];
    }
  }

  private generateSetupInstructions(testType: 'playwright' | 'pytest'): string[] {
    if (testType === 'playwright') {
      return [
        'npm install @playwright/test',
        'npx playwright install',
        'Create playwright.config.ts with baseURL: "https://devtest.comda.co.il"',
        'Run with: npx playwright test'
      ];
    } else {
      return [
        'pip install pytest playwright pytest-playwright pytest-html',
        'playwright install',
        'Create pytest.ini with base configuration',
        'Run with: pytest --headed --html=report.html'
      ];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testResponse = await this.llm.invoke('Test connection');
      return !!testResponse.content;
    } catch (error) {
      logger.error('Test generator health check failed', { error });
      return false;
    }
  }
}

// Singleton instance
let testGeneratorInstance: TestGeneratorService | null = null;

export function getTestGeneratorService(): TestGeneratorService {
  if (!testGeneratorInstance) {
    testGeneratorInstance = new TestGeneratorService();
  }
  return testGeneratorInstance;
}