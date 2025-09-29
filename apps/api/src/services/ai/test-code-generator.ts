import { ChatOpenAI } from '@langchain/openai';
import { logger } from '@/utils/logger';
import Database from 'better-sqlite3';
import { join } from 'path';

export interface TestGenerationRequest {
  type: 'page_object' | 'test_case' | 'locator_strategy' | 'data_factory' | 'utility' | 'full_workflow';
  description: string;
  framework: 'playwright' | 'selenium' | 'cypress';
  language: 'python' | 'javascript' | 'typescript';
  testType: 'unit' | 'integration' | 'e2e' | 'api';
  pageUrl?: string;
  existingCode?: string;
  requirements?: string[];
  testData?: Record<string, any>;
  locators?: Record<string, string>;
  codeStyle?: 'pytest' | 'unittest' | 'jest' | 'mocha';
}

export interface GeneratedCode {
  id: string;
  type: string;
  code: string;
  explanation: string;
  dependencies: string[];
  testInstructions: string[];
  qualityScore: number;
  suggestions: string[];
  createdAt: string;
}

export interface CodeQualityAnalysis {
  score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion';
    message: string;
    line?: number;
    severity: 'high' | 'medium' | 'low';
  }>;
  strengths: string[];
  improvements: string[];
}

export class TestCodeGenerator {
  private llm: ChatOpenAI;
  private db: Database.Database;

  constructor() {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder')) {
      throw new Error('OpenAI API key is required for test code generation');
    }

    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.1,
      maxTokens: 4000
    });

    // Initialize database for storing generated code
    this.db = new Database(join(process.cwd(), 'data/generated-code.db'));
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generated_code (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        framework TEXT NOT NULL,
        language TEXT NOT NULL,
        description TEXT NOT NULL,
        code TEXT NOT NULL,
        explanation TEXT,
        dependencies TEXT,
        test_instructions TEXT,
        quality_score REAL,
        suggestions TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_generated_type ON generated_code(type);
      CREATE INDEX IF NOT EXISTS idx_generated_framework ON generated_code(framework);
      CREATE INDEX IF NOT EXISTS idx_generated_language ON generated_code(language);
      CREATE INDEX IF NOT EXISTS idx_generated_created ON generated_code(created_at);
    `);
  }

  async generateTestCode(request: TestGenerationRequest): Promise<GeneratedCode> {
    try {
      logger.info('Generating test code', { type: request.type, framework: request.framework, language: request.language });

      const prompt = this.buildGenerationPrompt(request);
      const response = await this.llm.invoke(prompt);

      let result;
      try {
        result = JSON.parse(response.content.toString());
      } catch (parseError) {
        // If JSON parsing fails, extract code from markdown blocks
        const content = response.content.toString();
        const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)\n```/);

        result = {
          code: codeMatch ? codeMatch[1] : content,
          explanation: "Generated code (parsed from response)",
          dependencies: [],
          testInstructions: [],
          suggestions: []
        };
      }

      // Analyze code quality
      const qualityAnalysis = await this.analyzeCodeQuality(result.code, request);

      const generatedCode: GeneratedCode = {
        id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: request.type,
        code: result.code,
        explanation: result.explanation || 'Generated test code',
        dependencies: Array.isArray(result.dependencies) ? result.dependencies : [],
        testInstructions: Array.isArray(result.testInstructions) ? result.testInstructions : [],
        qualityScore: qualityAnalysis.score,
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
        createdAt: new Date().toISOString()
      };

      // Store in database
      this.storeGeneratedCode(generatedCode, request);

      logger.info('Test code generated successfully', { id: generatedCode.id, qualityScore: generatedCode.qualityScore });

      return generatedCode;
    } catch (error) {
      logger.error('Failed to generate test code:', error);
      throw new Error(`Test code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildGenerationPrompt(request: TestGenerationRequest): string {
    const basePrompt = `
You are an expert test automation engineer specializing in ${request.framework} with ${request.language}. Generate high-quality, production-ready test code.

Task: Generate a ${request.type} for ${request.description}

Requirements:
- Framework: ${request.framework}
- Language: ${request.language}
- Test Type: ${request.testType}
- Code Style: ${request.codeStyle || 'standard'}

${request.pageUrl ? `Target URL: ${request.pageUrl}` : ''}
${request.requirements ? `Specific Requirements:\n${request.requirements.map(r => `- ${r}`).join('\n')}` : ''}
${request.existingCode ? `Existing Code to Enhance:\n\`\`\`\n${request.existingCode}\n\`\`\`` : ''}
${request.locators ? `Provided Locators:\n${JSON.stringify(request.locators, null, 2)}` : ''}
${request.testData ? `Test Data:\n${JSON.stringify(request.testData, null, 2)}` : ''}

Best Practices to Follow:
1. Use clear, descriptive names for methods and variables
2. Implement proper error handling and assertions
3. Add comprehensive comments and docstrings
4. Follow ${request.framework} and ${request.language} conventions
5. Make code maintainable and reusable
6. Include proper wait strategies and synchronization
7. Implement data-driven testing where appropriate
8. Use Page Object Model patterns for UI tests
9. Add logging and debugging capabilities
10. Consider accessibility and cross-browser compatibility

Respond with a JSON object containing:
{
  "code": "// Complete, runnable code here",
  "explanation": "Clear explanation of what the code does and how to use it",
  "dependencies": ["list", "of", "required", "imports", "or", "packages"],
  "testInstructions": ["step", "by", "step", "instructions", "to", "run", "the", "tests"],
  "suggestions": ["additional", "improvements", "or", "variations"]
}`;

    return this.addTypeSpecificGuidance(basePrompt, request);
  }

  private addTypeSpecificGuidance(prompt: string, request: TestGenerationRequest): string {
    switch (request.type) {
      case 'page_object':
        return prompt + `

Page Object Specific Guidelines:
- Create a class representing the page with clear method names
- Include locators as private/protected properties
- Implement action methods that return appropriate values
- Add validation methods for page state
- Include navigation methods if applicable
- Use fluent interfaces where appropriate
- Handle dynamic content and loading states
- Add error handling for missing elements`;

      case 'test_case':
        return prompt + `

Test Case Specific Guidelines:
- Structure tests with clear Arrange, Act, Assert pattern
- Use descriptive test method names that explain the scenario
- Include setup and teardown methods
- Implement proper test data management
- Add parametrized tests for multiple scenarios
- Include negative test cases
- Add performance and security considerations
- Use appropriate assertions and validations`;

      case 'locator_strategy':
        return prompt + `

Locator Strategy Guidelines:
- Prefer data-testid and accessibility attributes
- Create fallback locator strategies
- Include CSS selector alternatives
- Add XPath for complex scenarios
- Implement dynamic locator handling
- Consider multilingual support
- Add locator validation methods
- Include performance-optimized selectors`;

      case 'data_factory':
        return prompt + `

Data Factory Guidelines:
- Create methods for generating test data
- Support different data types and formats
- Include realistic and edge case data
- Implement data cleanup strategies
- Support internationalization
- Add data validation methods
- Include database seeding capabilities
- Support API data generation`;

      case 'utility':
        return prompt + `

Utility Function Guidelines:
- Create reusable helper functions
- Include proper error handling
- Add comprehensive documentation
- Support different input types
- Include validation and sanitization
- Add logging and debugging features
- Consider performance optimization
- Make functions framework-agnostic where possible`;

      case 'full_workflow':
        return prompt + `

Full Workflow Guidelines:
- Combine multiple page objects and utilities
- Implement end-to-end user journeys
- Include comprehensive error handling
- Add detailed logging and reporting
- Support configuration management
- Include parallel execution capabilities
- Add retry mechanisms for flaky tests
- Implement proper test isolation`;

      default:
        return prompt;
    }
  }

  private async analyzeCodeQuality(code: string, request: TestGenerationRequest): Promise<CodeQualityAnalysis> {
    try {
      const analysisPrompt = `
Analyze the following ${request.language} code for ${request.framework} test automation and provide a quality assessment:

\`\`\`${request.language}
${code}
\`\`\`

Evaluate based on:
1. Code clarity and readability
2. Best practice adherence
3. Error handling
4. Test reliability and maintainability
5. Framework-specific patterns
6. Performance considerations
7. Security aspects

Respond with JSON:
{
  "score": 0.85,
  "issues": [
    {
      "type": "warning",
      "message": "Consider adding explicit wait conditions",
      "line": 15,
      "severity": "medium"
    }
  ],
  "strengths": ["Good use of Page Object pattern", "Clear method names"],
  "improvements": ["Add error handling", "Include logging"]
}

Score should be 0.0 to 1.0 (1.0 being perfect).
      `;

      const response = await this.llm.invoke(analysisPrompt);
      const analysis = JSON.parse(response.content.toString());

      return {
        score: Math.min(Math.max(analysis.score || 0.5, 0), 1),
        issues: Array.isArray(analysis.issues) ? analysis.issues : [],
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
        improvements: Array.isArray(analysis.improvements) ? analysis.improvements : []
      };
    } catch (error) {
      logger.warn('Code quality analysis failed:', error);
      return {
        score: 0.5,
        issues: [],
        strengths: [],
        improvements: ['Manual code review recommended']
      };
    }
  }

  private storeGeneratedCode(generatedCode: GeneratedCode, request: TestGenerationRequest): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO generated_code (
          id, type, framework, language, description, code, explanation,
          dependencies, test_instructions, quality_score, suggestions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        generatedCode.id,
        request.type,
        request.framework,
        request.language,
        request.description,
        generatedCode.code,
        generatedCode.explanation,
        JSON.stringify(generatedCode.dependencies),
        JSON.stringify(generatedCode.testInstructions),
        generatedCode.qualityScore,
        JSON.stringify(generatedCode.suggestions)
      );
    } catch (error) {
      logger.error('Failed to store generated code:', error);
    }
  }

  async improveExistingCode(code: string, improvements: string[]): Promise<GeneratedCode> {
    try {
      const prompt = `
Improve the following test code based on the specified improvements:

Current Code:
\`\`\`
${code}
\`\`\`

Requested Improvements:
${improvements.map(imp => `- ${imp}`).join('\n')}

Provide the improved code with:
1. All requested improvements implemented
2. Maintained functionality
3. Better code quality and readability
4. Enhanced error handling
5. Improved performance where possible

Respond with JSON containing the improved code and explanation.
      `;

      const response = await this.llm.invoke(prompt);
      let result;

      try {
        result = JSON.parse(response.content.toString());
      } catch (parseError) {
        const content = response.content.toString();
        const codeMatch = content.match(/```(?:\w+)?\n([\s\S]*?)\n```/);

        result = {
          code: codeMatch ? codeMatch[1] : content,
          explanation: "Improved code",
          dependencies: [],
          testInstructions: [],
          suggestions: []
        };
      }

      return {
        id: `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'improvement',
        code: result.code,
        explanation: result.explanation || 'Improved code based on suggestions',
        dependencies: result.dependencies || [],
        testInstructions: result.testInstructions || [],
        qualityScore: 0.8,
        suggestions: result.suggestions || [],
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to improve code:', error);
      throw new Error(`Code improvement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getGeneratedCodeHistory(limit: number = 20): Promise<any[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT id, type, framework, language, description, quality_score, created_at
        FROM generated_code
        ORDER BY created_at DESC
        LIMIT ?
      `);

      return stmt.all(limit) as any[];
    } catch (error) {
      logger.error('Failed to get code history:', error);
      return [];
    }
  }

  async getGeneratedCodeById(id: string): Promise<GeneratedCode | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM generated_code WHERE id = ?
      `);

      const row = stmt.get(id) as any;

      if (!row) return null;

      return {
        id: row.id,
        type: row.type,
        code: row.code,
        explanation: row.explanation,
        dependencies: JSON.parse(row.dependencies || '[]'),
        testInstructions: JSON.parse(row.test_instructions || '[]'),
        qualityScore: row.quality_score,
        suggestions: JSON.parse(row.suggestions || '[]'),
        createdAt: row.created_at
      };
    } catch (error) {
      logger.error('Failed to get generated code by ID:', error);
      return null;
    }
  }

  async getCodeGenerationStats(): Promise<Record<string, any>> {
    try {
      const stats = {
        totalGenerated: 0,
        byType: {} as Record<string, number>,
        byFramework: {} as Record<string, number>,
        byLanguage: {} as Record<string, number>,
        averageQuality: 0,
        recentGeneration: [] as any[]
      };

      // Total generated
      const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM generated_code');
      stats.totalGenerated = (totalStmt.get() as any).count;

      // By type
      const typeStmt = this.db.prepare(`
        SELECT type, COUNT(*) as count
        FROM generated_code
        GROUP BY type
      `);
      const typeResults = typeStmt.all() as any[];
      for (const result of typeResults) {
        stats.byType[result.type] = result.count;
      }

      // By framework
      const frameworkStmt = this.db.prepare(`
        SELECT framework, COUNT(*) as count
        FROM generated_code
        GROUP BY framework
      `);
      const frameworkResults = frameworkStmt.all() as any[];
      for (const result of frameworkResults) {
        stats.byFramework[result.framework] = result.count;
      }

      // By language
      const languageStmt = this.db.prepare(`
        SELECT language, COUNT(*) as count
        FROM generated_code
        GROUP BY language
      `);
      const languageResults = languageStmt.all() as any[];
      for (const result of languageResults) {
        stats.byLanguage[result.language] = result.count;
      }

      // Average quality
      const qualityStmt = this.db.prepare('SELECT AVG(quality_score) as avg FROM generated_code');
      stats.averageQuality = Number(((qualityStmt.get() as any).avg || 0).toFixed(2));

      // Recent generation
      const recentStmt = this.db.prepare(`
        SELECT type, framework, language, quality_score, created_at
        FROM generated_code
        ORDER BY created_at DESC
        LIMIT 5
      `);
      stats.recentGeneration = recentStmt.all();

      return stats;
    } catch (error) {
      logger.error('Failed to get code generation stats:', error);
      return {};
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

export default TestCodeGenerator;