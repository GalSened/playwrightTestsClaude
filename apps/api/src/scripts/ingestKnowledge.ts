import { config } from 'dotenv';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { KnowledgeService } from '../services/ai/knowledgeService';
import { TestIngestionService } from '../services/ai/testIngestion';

// Load environment variables
config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class DocumentIngestionScript {
  private knowledgeService: KnowledgeService;
  private testIngestionService: TestIngestionService;

  constructor() {
    this.knowledgeService = new KnowledgeService();
    this.testIngestionService = new TestIngestionService();
  }

  async ingestDocuments() {
    console.log('🚀 Starting comprehensive document ingestion...\n');
    
    let totalIngested = 0;
    const results = {
      prd: 0,
      api: 0,
      existingDocs: 0,
      tests: 0,
      testPatterns: 0
    };

    // 1. Check and ingest PRD
    console.log('📋 Checking for PRD document...');
    const prdResult = await this.ingestPRD();
    results.prd = prdResult.count;
    totalIngested += prdResult.count;

    // 2. Check and ingest API documentation
    console.log('\n🔌 Checking for API documentation...');
    const apiResult = await this.ingestAPI();
    results.api = apiResult.count;
    totalIngested += apiResult.count;

    // 3. Ingest existing documentation in docs folder
    console.log('\n📚 Ingesting existing documentation...');
    const existingResult = await this.ingestExistingDocs();
    results.existingDocs = existingResult.count;
    totalIngested += existingResult.count;

    // 4. Ingest existing tests from database
    console.log('\n🧪 Ingesting existing tests...');
    const testResult = await this.testIngestionService.ingestExistingTests();
    if (testResult.success) {
      results.tests = testResult.ingested;
      totalIngested += testResult.ingested;
    }

    // 5. Create test patterns if they don't exist
    console.log('\n🎯 Adding test patterns...');
    const patternsResult = await this.createTestPatterns();
    results.testPatterns = patternsResult.count;
    totalIngested += patternsResult.count;

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 INGESTION SUMMARY');
    console.log('='.repeat(50));
    console.log(`📋 PRD Documents: ${results.prd}`);
    console.log(`🔌 API Documentation: ${results.api}`);
    console.log(`📚 Existing Docs: ${results.existingDocs}`);
    console.log(`🧪 Test Cases: ${results.tests}`);
    console.log(`🎯 Test Patterns: ${results.testPatterns}`);
    console.log('─'.repeat(30));
    console.log(`✅ Total Documents Ingested: ${totalIngested}`);
    
    return { 
      success: true, 
      totalIngested,
      breakdown: results
    };
  }

  private async ingestPRD(): Promise<{ count: number, files: string[] }> {
    const prdPaths = [
      join(process.cwd(), '../docs/prd/wesign-prd.md'),
      join(process.cwd(), '../docs/prd/wesign-prd.txt'),
      join(process.cwd(), '../docs/prd/prd.md'),
      join(process.cwd(), '../docs/prd/requirements.md')
    ];
    
    let count = 0;
    const files = [];
    
    for (const prdPath of prdPaths) {
      if (existsSync(prdPath)) {
        console.log(`   ✅ Found PRD: ${prdPath}`);
        const content = readFileSync(prdPath, 'utf-8');
        console.log(`   📄 PRD length: ${content.length} characters`);
        
        await this.knowledgeService.ingestDocument(content, {
          source: 'prd-document',
          type: 'requirements',
          filePath: prdPath,
          title: 'WeSign Product Requirements Document',
          category: 'product-requirements'
        });
        
        count++;
        files.push(prdPath);
      }
    }
    
    if (count === 0) {
      console.log('   ⚠️  No PRD found. Expected locations:');
      prdPaths.forEach(path => console.log(`     - ${path}`));
    }
    
    return { count, files };
  }

  private async ingestAPI(): Promise<{ count: number, files: string[] }> {
    const apiDir = join(process.cwd(), '../docs/api/');
    let count = 0;
    const files = [];
    
    if (!existsSync(apiDir)) {
      console.log(`   ⚠️  API directory not found: ${apiDir}`);
      return { count, files };
    }
    
    const apiFiles = readdirSync(apiDir);
    
    for (const file of apiFiles) {
      const filePath = join(apiDir, file);
      const ext = extname(file).toLowerCase();
      
      if (['.json', '.yaml', '.yml'].includes(ext)) {
        console.log(`   ✅ Found API file: ${file}`);
        const content = readFileSync(filePath, 'utf-8');
        
        let processedContent = content;
        if (ext === '.json') {
          try {
            const parsed = JSON.parse(content);
            processedContent = this.formatPostmanCollection(parsed);
          } catch (e) {
            console.log(`   ⚠️  Could not parse JSON, using raw content`);
          }
        }
        
        await this.knowledgeService.ingestDocument(processedContent, {
          source: 'api-documentation',
          type: 'api-spec',
          filePath: filePath,
          fileName: file,
          title: `API Documentation: ${file}`,
          category: 'api-reference'
        });
        
        count++;
        files.push(filePath);
      }
    }
    
    if (count === 0) {
      console.log(`   ⚠️  No API files found in ${apiDir}`);
      console.log('   📝 Expected formats: .json (Postman), .yaml/.yml (OpenAPI)');
    }
    
    return { count, files };
  }

  private async ingestExistingDocs(): Promise<{ count: number, files: string[] }> {
    const docsDir = join(process.cwd(), '../docs/');
    let count = 0;
    const files = [];
    
    if (!existsSync(docsDir)) {
      return { count, files };
    }
    
    const docFiles = readdirSync(docsDir);
    
    for (const file of docFiles) {
      const filePath = join(docsDir, file);
      const stat = statSync(filePath);
      
      if (stat.isFile() && file.endsWith('.md')) {
        console.log(`   ✅ Found doc: ${file}`);
        const content = readFileSync(filePath, 'utf-8');
        
        await this.knowledgeService.ingestDocument(content, {
          source: 'existing-documentation',
          type: 'documentation',
          filePath: filePath,
          fileName: file,
          title: file.replace('.md', '').replace(/_/g, ' '),
          category: 'project-docs'
        });
        
        count++;
        files.push(filePath);
      }
    }
    
    console.log(`   📄 Ingested ${count} existing documentation files`);
    return { count, files };
  }

  private async createTestPatterns(): Promise<{ count: number }> {
    const patternsDir = join(process.cwd(), '../docs/test-patterns/');
    
    // Create some default test pattern documentation if the folder is empty
    if (!existsSync(patternsDir) || readdirSync(patternsDir).length === 0) {
      console.log('   📝 Creating default test patterns...');
      
      const patterns = [
        {
          title: 'Login Test Patterns',
          content: `# Login Test Patterns for WeSign

## Standard Login Flow
\`\`\`typescript
test('successful login with valid credentials', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email"]', 'admin@demo.com');
  await page.fill('[data-testid="password"]', 'demo123');
  await page.click('[data-testid="login-button"]');
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
});
\`\`\`

## Error Handling
\`\`\`typescript  
test('login with invalid credentials shows error', async ({ page }) => {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email"]', 'invalid@example.com');
  await page.fill('[data-testid="password"]', 'wrongpassword');
  await page.click('[data-testid="login-button"]');
  await expect(page.locator('.error-message')).toBeVisible();
});
\`\`\``
        },
        {
          title: 'Document Management Patterns',
          content: `# Document Management Test Patterns

## Document Upload
\`\`\`typescript
test('upload document successfully', async ({ page }) => {
  await page.goto('/documents');
  await page.setInputFiles('[data-testid="file-input"]', 'test-document.pdf');
  await page.click('[data-testid="upload-button"]');
  await expect(page.locator('.upload-success')).toBeVisible();
});
\`\`\`

## Document Signing Flow
\`\`\`typescript
test('complete document signing process', async ({ page }) => {
  await page.goto('/documents');
  await page.click('[data-testid="sign-document-1"]');
  await page.fill('[data-testid="signature-field"]', 'John Doe');
  await page.click('[data-testid="confirm-signature"]');
  await expect(page.locator('.signature-complete')).toBeVisible();
});
\`\`\``
        }
      ];
      
      let count = 0;
      for (const pattern of patterns) {
        await this.knowledgeService.ingestDocument(pattern.content, {
          source: 'test-patterns',
          type: 'test-patterns',
          title: pattern.title,
          category: 'testing-patterns'
        });
        count++;
      }
      
      console.log(`   ✅ Added ${count} default test patterns`);
      return { count };
    }
    
    return { count: 0 };
  }

  private formatPostmanCollection(collection: any): string {
    if (collection.info && collection.item) {
      let formatted = `# ${collection.info.name || 'API Collection'}\n\n`;
      if (collection.info.description) {
        formatted += `${collection.info.description}\n\n`;
      }
      
      // Process items (endpoints)
      const processItems = (items: any[], level = 2) => {
        let content = '';
        for (const item of items) {
          if (item.item) {
            // It's a folder
            content += `${'#'.repeat(level)} ${item.name}\n\n`;
            content += processItems(item.item, level + 1);
          } else if (item.request) {
            // It's an endpoint
            content += `${'#'.repeat(level)} ${item.name}\n\n`;
            if (item.request.method && item.request.url) {
              content += `**Method:** ${item.request.method}\n`;
              const url = typeof item.request.url === 'string' ? item.request.url : item.request.url.raw || '';
              content += `**URL:** ${url}\n\n`;
            }
            if (item.request.description) {
              content += `${item.request.description}\n\n`;
            }
          }
        }
        return content;
      };
      
      formatted += processItems(collection.item);
      return formatted;
    }
    
    return JSON.stringify(collection, null, 2);
  }
}

async function main() {
  try {
    console.log('🔧 Checking configuration...');
    
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder')) {
      console.log('❌ OpenAI API key not configured');
      console.log('💡 Please add your OpenAI API key to backend/.env');
      return;
    }
    
    console.log('✅ OpenAI configured');
    
    if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY.includes('placeholder')) {
      console.log('⚠️  Pinecone not configured - knowledge base features limited');
    } else {
      console.log('✅ Pinecone configured');
    }
    
    const ingestionScript = new DocumentIngestionScript();
    const result = await ingestionScript.ingestDocuments();
    
    if (result.success) {
      console.log(`\n🎉 Ingestion completed successfully!`);
      console.log(`💡 Total documents processed: ${result.totalIngested}`);
    }
    
  } catch (error) {
    console.error('❌ Error during ingestion:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DocumentIngestionScript };