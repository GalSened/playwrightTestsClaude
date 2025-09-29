import { logger } from '@/utils/logger';
import { ChatOpenAI } from '@langchain/openai';
import * as fs from 'fs';
import * as path from 'path';

export interface ScreenshotKnowledge {
  id: string;
  filename: string;
  uiElements: Array<{
    type: 'button' | 'input' | 'text' | 'menu' | 'icon';
    text: string;
    position: { x: number; y: number };
    confidence: number;
  }>;
  workflow: string;
  instructions: {
    hebrew: string;
    english: string;
  };
  extractedAt: string;
}

export interface TestCaseKnowledge {
  id: string;
  testFile: string;
  functionality: string;
  steps: Array<{
    action: string;
    element: string;
    description: string;
  }>;
  assertions: string[];
  workflows: string[];
  knowledge: {
    hebrew: string;
    english: string;
  };
}

/**
 * Multi-Modal Knowledge Processor
 * Extracts WeSign knowledge from screenshots, test cases, and documents
 */
export class MultiModalKnowledgeProcessor {
  private llm: ChatOpenAI;
  private processedScreenshots = new Map<string, ScreenshotKnowledge>();
  private processedTests = new Map<string, TestCaseKnowledge>();

  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o', // GPT-4 with vision capabilities
      temperature: 0.3,
      maxTokens: 2000
    });
  }

  /**
   * Process WeSign screenshots to extract UI knowledge
   */
  async processScreenshots(screenshotDir: string): Promise<ScreenshotKnowledge[]> {
    const results: ScreenshotKnowledge[] = [];

    try {
      const screenshotFiles = fs.readdirSync(screenshotDir)
        .filter(file => /\.(png|jpg|jpeg)$/i.test(file));

      logger.info('Processing WeSign screenshots', {
        directory: screenshotDir,
        count: screenshotFiles.length
      });

      for (const filename of screenshotFiles) {
        const filePath = path.join(screenshotDir, filename);

        try {
          const knowledge = await this.extractScreenshotKnowledge(filePath, filename);
          results.push(knowledge);
          this.processedScreenshots.set(knowledge.id, knowledge);
        } catch (error) {
          logger.warn(`Failed to process screenshot ${filename}:`, error);
        }
      }

      logger.info('Screenshot processing completed', {
        processed: results.length,
        failed: screenshotFiles.length - results.length
      });

      return results;

    } catch (error) {
      logger.error('Screenshot processing failed:', error);
      return [];
    }
  }

  /**
   * Extract knowledge from a single screenshot using AI vision
   */
  private async extractScreenshotKnowledge(filePath: string, filename: string): Promise<ScreenshotKnowledge> {
    // Read image file
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `
Analyze this WeSign platform screenshot and extract the following information:

1. Identify all UI elements (buttons, inputs, menus, text labels)
2. Determine what WeSign functionality is shown
3. Create step-by-step instructions for the workflow shown
4. Provide instructions in both Hebrew and English

Please respond in JSON format:
{
  "uiElements": [{"type": "button", "text": "Add Contact", "position": {"x": 100, "y": 200}, "confidence": 0.9}],
  "workflow": "Contact Management",
  "instructions": {
    "hebrew": "הוראות בעברית...",
    "english": "English instructions..."
  }
}`;

    try {
      const response = await this.llm.invoke([
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ]);

      const analysisResult = JSON.parse(response.content as string);

      return {
        id: `screenshot_${filename}_${Date.now()}`,
        filename,
        uiElements: analysisResult.uiElements || [],
        workflow: analysisResult.workflow || 'Unknown',
        instructions: analysisResult.instructions || {
          hebrew: 'לא זמין',
          english: 'Not available'
        },
        extractedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.warn(`AI analysis failed for ${filename}, using fallback`, error);

      // Fallback: extract basic info from filename
      const workflow = this.inferWorkflowFromFilename(filename);

      return {
        id: `screenshot_${filename}_${Date.now()}`,
        filename,
        uiElements: [],
        workflow,
        instructions: {
          hebrew: `תמונת מסך של ${workflow} ב-WeSign`,
          english: `Screenshot of ${workflow} in WeSign`
        },
        extractedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Process Playwright test files to extract workflow knowledge
   */
  async processTestFiles(testDir: string): Promise<TestCaseKnowledge[]> {
    const results: TestCaseKnowledge[] = [];

    try {
      const testFiles = this.findTestFiles(testDir);

      logger.info('Processing WeSign test files', {
        directory: testDir,
        count: testFiles.length
      });

      for (const testFile of testFiles) {
        try {
          const knowledge = await this.extractTestKnowledge(testFile);
          if (knowledge) {
            results.push(knowledge);
            this.processedTests.set(knowledge.id, knowledge);
          }
        } catch (error) {
          logger.warn(`Failed to process test file ${testFile}:`, error);
        }
      }

      logger.info('Test file processing completed', {
        processed: results.length,
        failed: testFiles.length - results.length
      });

      return results;

    } catch (error) {
      logger.error('Test file processing failed:', error);
      return [];
    }
  }

  /**
   * Extract WeSign workflow knowledge from test files
   */
  private async extractTestKnowledge(testFilePath: string): Promise<TestCaseKnowledge | null> {
    try {
      const content = fs.readFileSync(testFilePath, 'utf-8');

      // Parse test file content with AI
      const prompt = `
Analyze this Playwright test file for WeSign functionality and extract:

1. Main functionality being tested
2. Step-by-step user actions
3. Assertions and expected behavior
4. Business workflows covered
5. Create user guidance in Hebrew and English

Test file content:
\`\`\`
${content.substring(0, 5000)} // Limit content size
\`\`\`

Respond in JSON format:
{
  "functionality": "Contact Management",
  "steps": [{"action": "click", "element": "Add Contact", "description": "User clicks add contact button"}],
  "assertions": ["Contact should be added", "Email should be validated"],
  "workflows": ["Add Contact", "Validate Contact"],
  "knowledge": {
    "hebrew": "הדרכה בעברית...",
    "english": "English guidance..."
  }
}`;

      const response = await this.llm.invoke(prompt);
      const analysisResult = JSON.parse(response.content as string);

      return {
        id: `test_${path.basename(testFilePath)}_${Date.now()}`,
        testFile: testFilePath,
        functionality: analysisResult.functionality || 'Unknown',
        steps: analysisResult.steps || [],
        assertions: analysisResult.assertions || [],
        workflows: analysisResult.workflows || [],
        knowledge: analysisResult.knowledge || {
          hebrew: 'לא זמין',
          english: 'Not available'
        }
      };

    } catch (error) {
      logger.warn(`Failed to analyze test file ${testFilePath}:`, error);
      return null;
    }
  }

  /**
   * Generate comprehensive WeSign knowledge from all processed sources
   */
  async generateComprehensiveKnowledge(): Promise<{
    screenshots: ScreenshotKnowledge[];
    tests: TestCaseKnowledge[];
    combinedKnowledge: {
      workflows: string[];
      features: string[];
      userGuides: {
        hebrew: string[];
        english: string[];
      };
    };
  }> {
    const screenshots = Array.from(this.processedScreenshots.values());
    const tests = Array.from(this.processedTests.values());

    // Combine knowledge from all sources
    const workflows = new Set<string>();
    const features = new Set<string>();
    const hebrewGuides: string[] = [];
    const englishGuides: string[] = [];

    // Extract from screenshots
    screenshots.forEach(screenshot => {
      workflows.add(screenshot.workflow);
      hebrewGuides.push(screenshot.instructions.hebrew);
      englishGuides.push(screenshot.instructions.english);
    });

    // Extract from tests
    tests.forEach(test => {
      features.add(test.functionality);
      test.workflows.forEach(workflow => workflows.add(workflow));
      hebrewGuides.push(test.knowledge.hebrew);
      englishGuides.push(test.knowledge.english);
    });

    return {
      screenshots,
      tests,
      combinedKnowledge: {
        workflows: Array.from(workflows),
        features: Array.from(features),
        userGuides: {
          hebrew: hebrewGuides.filter(guide => guide && guide !== 'לא זמין'),
          english: englishGuides.filter(guide => guide && guide !== 'Not available')
        }
      }
    };
  }

  /**
   * Find all test files in directory
   */
  private findTestFiles(dir: string): string[] {
    const testFiles: string[] = [];

    const scanDir = (directory: string) => {
      try {
        const items = fs.readdirSync(directory);

        for (const item of items) {
          const fullPath = path.join(directory, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (stat.isFile() && this.isTestFile(item)) {
            testFiles.push(fullPath);
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan directory ${directory}:`, error);
      }
    };

    scanDir(dir);
    return testFiles;
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filename: string): boolean {
    return /\.(test|spec)\.(js|ts|py)$/i.test(filename) ||
           filename.includes('test_') ||
           filename.includes('_test');
  }

  /**
   * Infer workflow from screenshot filename
   */
  private inferWorkflowFromFilename(filename: string): string {
    const workflows: { [key: string]: string } = {
      'contact': 'Contact Management',
      'document': 'Document Management',
      'template': 'Template Management',
      'sign': 'Digital Signature',
      'dashboard': 'Dashboard Navigation',
      'login': 'Authentication',
      'report': 'Reporting',
      'settings': 'Settings Management'
    };

    const lowerFilename = filename.toLowerCase();
    for (const [key, workflow] of Object.entries(workflows)) {
      if (lowerFilename.includes(key)) {
        return workflow;
      }
    }

    return 'General WeSign Functionality';
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      processedScreenshots: this.processedScreenshots.size,
      processedTests: this.processedTests.size,
      totalKnowledgeItems: this.processedScreenshots.size + this.processedTests.size,
      lastProcessed: new Date().toISOString()
    };
  }

  /**
   * Search processed knowledge
   */
  searchKnowledge(query: string): {
    screenshots: ScreenshotKnowledge[];
    tests: TestCaseKnowledge[];
  } {
    const queryLower = query.toLowerCase();

    const matchingScreenshots = Array.from(this.processedScreenshots.values())
      .filter(screenshot =>
        screenshot.workflow.toLowerCase().includes(queryLower) ||
        screenshot.instructions.english.toLowerCase().includes(queryLower) ||
        screenshot.instructions.hebrew.includes(queryLower)
      );

    const matchingTests = Array.from(this.processedTests.values())
      .filter(test =>
        test.functionality.toLowerCase().includes(queryLower) ||
        test.workflows.some(workflow => workflow.toLowerCase().includes(queryLower)) ||
        test.knowledge.english.toLowerCase().includes(queryLower) ||
        test.knowledge.hebrew.includes(queryLower)
      );

    return {
      screenshots: matchingScreenshots,
      tests: matchingTests
    };
  }
}

export default MultiModalKnowledgeProcessor;