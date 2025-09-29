import { config } from 'dotenv';
import { join } from 'path';
import Database from 'better-sqlite3';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';

config();

export class LangChainRAGService {
  private db: Database.Database;
  private llm: ChatOpenAI;
  private promptTemplate: PromptTemplate;

  constructor() {
    this.db = new Database(join(process.cwd(), 'data/scheduler.db'));
    
    // Initialize ChatOpenAI with LangChain
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0, // Most accurate, deterministic responses
    });

    // Create an enhanced, assumption-free prompt for WeSign
    this.promptTemplate = PromptTemplate.fromTemplate(`
SYSTEM IDENTITY: You are the WeSign Expert Assistant - a precise, fact-based AI specialist with comprehensive knowledge of WeSign electronic document signing platform.

🚨 CRITICAL DIRECTIVE: MAKE ZERO ASSUMPTIONS. Only provide information explicitly contained in your knowledge base. If information is missing, clearly state what is unknown.

=== WESIGN PLATFORM INTELLIGENCE ===

🎯 VERIFIED FACTS ONLY:
• WeSign Environment: https://devtest.comda.co.il
• Demo Credentials: admin@demo.com / demo123  
• Platform Type: Electronic document signing platform (similar to DocuSign)
• Languages: Hebrew (RTL layout) + English (LTR layout)
• Knowledge Base: 7,387+ chunks including 310 WeSign-specific design documents
• Test Framework: 634+ Playwright/Pytest automated tests

🔍 RESPONSE REQUIREMENTS:

1. **ACCURACY MANDATE**:
   - ONLY cite information from provided context
   - If unsure, state "Based on available documentation..." or "The provided information indicates..."
   - Never guess or extrapolate beyond documented facts
   - Always specify source confidence level

2. **BILINGUAL EXCELLENCE**:
   - Hebrew Text: Must specify RTL handling requirements
   - English Text: Must specify LTR layout considerations  
   - UI Elements: Always mention both language versions when relevant
   - Character Encoding: Address Hebrew Unicode requirements when applicable

3. **TECHNICAL PRECISION**:
   - Code Examples: Production-ready, tested selectors for both languages
   - URLs: Always use https://devtest.comda.co.il unless context specifies otherwise
   - Credentials: Use admin@demo.com / demo123 for demo environment
   - Browser Support: Specify Chrome, Firefox, Safari, Edge compatibility when relevant

4. **CONTEXT-DRIVEN RESPONSES**:
   - Testing Questions: Include specific Playwright/Pytest examples
   - Workflow Questions: Provide step-by-step procedures with exact UI elements
   - Troubleshooting: Reference actual error patterns from knowledge base
   - Configuration: Use only documented settings and parameters

5. **LANGUAGE-SPECIFIC HANDLING**:
   - Hebrew Queries: Respond with Hebrew UI considerations, RTL layout impacts
   - English Queries: Include standard LTR UI behavior
   - Mixed Language: Address both scenarios explicitly
   - Character Sets: Mention UTF-8 encoding requirements for Hebrew

=== ENHANCED KNOWLEDGE BASE CONTEXT ===
{context}

=== USER QUERY ===
User Question: {question}

=== RESPONSE GENERATION PROTOCOL ===

📋 STRUCTURED RESPONSE FORMAT:

**DIRECT ANSWER** (Based on documentation):
[Primary answer citing specific sources]

**DETAILED EXPLANATION** (When applicable):
[Step-by-step breakdown with exact procedures]

**BILINGUAL CONSIDERATIONS** (For Hebrew/English):
[Specific RTL/LTR requirements and differences]

**TECHNICAL IMPLEMENTATION** (When requested):
[Code examples with language-specific selectors]

**ENVIRONMENT SETUP** (When relevant):
[Demo credentials, URLs, and configuration]

**LIMITATIONS & UNKNOWNS** (When applicable):
[Clearly state what information is not available]

🎯 EXPERT RESPONSE (NO ASSUMPTIONS, FACTS ONLY):
`);
  }

  async retrieveContext(query: string, maxResults: number = 10): Promise<string> {
    try {
      console.log(`🔍 Enhanced context retrieval for query: "${query}" (max results: ${maxResults})`);
      
      // Detect language (Hebrew vs English)
      const isHebrew = /[\u0590-\u05FF]/.test(query);
      console.log(`📝 Language detected: ${isHebrew ? 'Hebrew' : 'English'}`);
      
      // Query classification for better context selection
      const queryType = this.classifyQuery(query);
      console.log(`🎯 Query classified as: ${queryType.type}, modules: [${queryType.modules.join(', ')}]`);
      
      // Always get WeSign system definition first
      const systemDef = this.db.prepare(`
        SELECT content, source, metadata FROM knowledge_base_enhanced 
        WHERE type = 'system' OR source = 'core' OR content LIKE '%WeSign%definition%'
        ORDER BY created_at DESC
        LIMIT 1
      `).get() as { content?: string; source?: string; metadata?: string };

      // Enhanced search with multiple strategies
      const searchTerms = this.generateSearchTerms(query, isHebrew);
      console.log(`🔎 Generated search terms: [${searchTerms.join(', ')}]`);
      
      // Priority 1: WeSign-design specific content (our recent additions)
      const wesignDesignDocs = this.db.prepare(`
        SELECT content, source, metadata FROM knowledge_base_enhanced 
        WHERE metadata LIKE '%wesign-design%'
        AND (${searchTerms.map(() => 'content LIKE ?').join(' OR ')})
        ORDER BY created_at DESC
        LIMIT 4
      `).all(...searchTerms.map(term => `%${term}%`)) as Array<{content: string; source: string; metadata: string}>;
      
      // Priority 2: Specific WeSign workflow/functionality docs
      const functionalDocs = this.db.prepare(`
        SELECT content, source, metadata FROM knowledge_base_enhanced 
        WHERE (
          source LIKE '%wesign%' OR 
          content LIKE '%document%workflow%' OR
          content LIKE '%signature%process%' OR
          content LIKE '%WeSign%functionality%' OR
          ${searchTerms.map(() => 'content LIKE ?').join(' OR ')}
        )
        AND metadata NOT LIKE '%wesign-design%'
        ORDER BY 
          CASE 
            WHEN source = 'live-scan' THEN 0 
            WHEN metadata LIKE '%wesign%' THEN 1
            ELSE 2 
          END, 
          LENGTH(content) DESC,
          created_at DESC
        LIMIT 6
      `).all(...searchTerms.map(term => `%${term}%`)) as Array<{content: string; source: string; metadata: string}>;
      
      // Get current system status and test data for live context
      const liveContext = await this.getLiveSystemContext(queryType);
      
      // Build comprehensive context
      let context = '';
      
      // Add system definition
      if (systemDef?.content) {
        context += '=== WESIGN SYSTEM DEFINITION ===\n' + systemDef.content + '\n\n';
      }
      
      // Add live system context
      if (liveContext) {
        context += '=== CURRENT SYSTEM STATUS ===\n' + liveContext + '\n\n';
      }
      
      // Add WeSign design documents (most authoritative)
      if (wesignDesignDocs.length > 0) {
        context += '=== WESIGN OFFICIAL DESIGN DOCUMENTATION ===\n';
        wesignDesignDocs.forEach((doc, i) => {
          context += `\n--- WeSign Design Doc ${i + 1} ---\n${doc.content}\n`;
        });
        context += '\n';
      }
      
      // Add functional documentation
      if (functionalDocs.length > 0) {
        context += '=== WESIGN FUNCTIONALITY & WORKFLOW DETAILS ===\n';
        functionalDocs.forEach((doc, i) => {
          context += `\n--- Functional Doc ${i + 1} ---\n${doc.content}\n`;
        });
      }
      
      // Add language-specific guidance
      if (isHebrew) {
        context += `\n=== HEBREW LANGUAGE CONSIDERATIONS ===\n`;
        context += `- WeSign supports Hebrew RTL (right-to-left) interface\n`;
        context += `- All WeSign pages have Hebrew translations\n`;
        context += `- Hebrew text requires proper encoding and display\n`;
        context += `- Test environment supports both Hebrew and English interfaces\n\n`;
      }
      
      // Log context stats
      const contextLength = context.length;
      const docCount = wesignDesignDocs.length + functionalDocs.length + (systemDef ? 1 : 0);
      console.log(`📋 Context assembled: ${contextLength} chars, ${docCount} documents, live data: ${liveContext ? 'included' : 'none'}`);
      
      // Return comprehensive context (increased from 2000 to 8000 chars)
      return context.substring(0, 8000);
      
    } catch (error) {
      console.error('❌ Enhanced context retrieval error:', error);
      // Fallback with basic WeSign facts - NO ASSUMPTIONS
      return `CRITICAL: Context retrieval failed. Using minimal fallback data.

=== BASIC WESIGN FACTS (VERIFIED) ===
WeSign Environment: https://devtest.comda.co.il
Demo Credentials: admin@demo.com / demo123
Platform Type: Electronic document signing (like DocuSign)
Languages: Hebrew (RTL) + English (LTR)
Current Knowledge Base: 7,387+ chunks, 310 WeSign-specific design documents
Test Framework: Playwright/Pytest with 634+ automated tests

WARNING: Limited context available. Responses may be incomplete.`;
    }
  }

  /**
   * Classify query to better select relevant context
   */
  private classifyQuery(query: string): {
    type: 'workflow' | 'testing' | 'troubleshooting' | 'configuration' | 'general';
    modules: string[];
    complexity: 'simple' | 'medium' | 'complex';
  } {
    const lowerQuery = query.toLowerCase();
    const hebrewQuery = query;
    
    // Detect type
    let type: 'workflow' | 'testing' | 'troubleshooting' | 'configuration' | 'general' = 'general';
    if (lowerQuery.includes('workflow') || lowerQuery.includes('process') || lowerQuery.includes('step') || lowerQuery.includes('how') || 
        hebrewQuery.includes('תהליך') || hebrewQuery.includes('שלבים') || hebrewQuery.includes('איך')) {
      type = 'workflow';
    } else if (lowerQuery.includes('test') || lowerQuery.includes('automation') || lowerQuery.includes('playwright') || 
               lowerQuery.includes('pytest') || hebrewQuery.includes('בדיקה') || hebrewQuery.includes('אוטומציה')) {
      type = 'testing';
    } else if (lowerQuery.includes('error') || lowerQuery.includes('problem') || lowerQuery.includes('fail') || 
               lowerQuery.includes('issue') || hebrewQuery.includes('שגיאה') || hebrewQuery.includes('בעיה')) {
      type = 'troubleshooting';
    } else if (lowerQuery.includes('config') || lowerQuery.includes('setting') || lowerQuery.includes('setup') ||
               hebrewQuery.includes('הגדרה') || hebrewQuery.includes('קונפיגורציה')) {
      type = 'configuration';
    }
    
    // Detect modules
    const modules: string[] = [];
    const moduleKeywords = {
      'auth': ['login', 'authentication', 'password', 'session', 'התחברות', 'אימות'],
      'documents': ['document', 'upload', 'signature', 'sign', 'pdf', 'מסמך', 'העלאה', 'חתימה'],
      'contacts': ['contact', 'signer', 'email', 'person', 'קשר', 'חותם', 'אימייל'],
      'templates': ['template', 'form', 'field', 'תבנית', 'טופס', 'שדה'],
      'dashboard': ['dashboard', 'overview', 'summary', 'לוח', 'סיכום'],
      'admin': ['admin', 'management', 'user', 'role', 'מנהל', 'ניהול', 'משתמש'],
      'integrations': ['integration', 'api', 'webhook', 'payment', 'אינטגרציה', 'תשלום']
    };
    
    for (const [module, keywords] of Object.entries(moduleKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword) || hebrewQuery.includes(keyword))) {
        modules.push(module);
      }
    }
    
    // Detect complexity
    const complexity = query.length > 100 || modules.length > 2 ? 'complex' : 
                      query.length > 50 || modules.length > 0 ? 'medium' : 'simple';
    
    return { type, modules, complexity };
  }

  /**
   * Generate comprehensive search terms for better knowledge retrieval
   */
  private generateSearchTerms(query: string, isHebrew: boolean): string[] {
    const terms = new Set<string>();
    
    // Add original query parts
    const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    words.forEach(word => terms.add(word));
    
    // Add WeSign-specific terms
    terms.add('wesign');
    terms.add('document');
    terms.add('signature');
    
    if (isHebrew) {
      // Add Hebrew-specific terms
      terms.add('עברית');
      terms.add('RTL');
      terms.add('מימין לשמאל');
      terms.add('ווסיין');
      terms.add('מסמך');
      terms.add('חתימה');
    } else {
      // Add English-specific terms
      terms.add('english');
      terms.add('LTR');
      terms.add('left to right');
    }
    
    // Add common workflow terms based on query content
    if (query.toLowerCase().includes('workflow') || query.includes('תהליך')) {
      terms.add('workflow');
      terms.add('process');
      terms.add('step');
      terms.add('procedure');
    }
    
    if (query.toLowerCase().includes('test') || query.includes('בדיקה')) {
      terms.add('playwright');
      terms.add('pytest');
      terms.add('automation');
      terms.add('test');
    }
    
    return Array.from(terms).slice(0, 8); // Limit search terms
  }

  /**
   * Get current system context and live data
   */
  private async getLiveSystemContext(queryType: any): Promise<string> {
    try {
      // Get current test execution status
      const testExecutions = this.db.prepare(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM tests 
        WHERE created_at > datetime('now', '-24 hours')
      `).get() as { total: number; passed: number; failed: number } | undefined;
      
      let liveContext = `=== CURRENT SYSTEM STATUS (Last 24 Hours) ===\n`;
      
      if (testExecutions && testExecutions.total > 0) {
        const successRate = Math.round((testExecutions.passed / testExecutions.total) * 100);
        liveContext += `Test Executions: ${testExecutions.total} total, ${testExecutions.passed} passed, ${testExecutions.failed} failed\n`;
        liveContext += `Success Rate: ${successRate}%\n`;
        
        if (testExecutions.failed > 0) {
          liveContext += `⚠️ WARNING: ${testExecutions.failed} failed tests in last 24 hours\n`;
        }
      } else {
        liveContext += `No recent test executions found\n`;
      }
      
      // Add environment status
      liveContext += `WeSign Environment: https://devtest.comda.co.il (ACTIVE)\n`;
      liveContext += `Demo Access: admin@demo.com / demo123\n`;
      liveContext += `Knowledge Base: 7,387+ chunks active, 310 WeSign design docs\n`;
      liveContext += `Timestamp: ${new Date().toISOString()}\n`;
      
      return liveContext;
      
    } catch (error) {
      console.warn('Failed to get live system context:', error);
      return `=== BASIC SYSTEM STATUS ===\nWeSign Environment: https://devtest.comda.co.il\nDemo Access: admin@demo.com / demo123\nKnowledge Base: 7,387+ chunks available\n`;
    }
  }

  async chat(question: string): Promise<{ answer: string; context: string; sources: number }> {
    try {
      // Retrieve relevant context
      const context = await this.retrieveContext(question);
      
      // Create the RAG chain
      const ragChain = RunnableSequence.from([
        {
          context: () => context,
          question: (input: { question: string }) => input.question,
        },
        this.promptTemplate,
        this.llm,
      ]);

      // Execute the chain
      const response = await ragChain.invoke({ question });
      
      return {
        answer: response.content as string,
        context: context.substring(0, 500) + '...',
        sources: context.split('---').length,
      };
      
    } catch (error) {
      console.error('RAG chat error:', error);
      return {
        answer: 'I apologize, but I encountered an error processing your question about WeSign. Please ensure the system is properly configured.',
        context: '',
        sources: 0,
      };
    }
  }

  async testRAG(): Promise<void> {
    console.log('🧪 Testing LangChain RAG for WeSign...\n');

    const testQuestions = [
      'What is WeSign?',
      'List the main features of WeSign',
      'Generate a Playwright test for document upload',
      'How do I test WeSign signatures?'
    ];

    for (const question of testQuestions) {
      console.log(`❓ Question: "${question}"`);
      console.log('─'.repeat(50));
      
      const result = await this.chat(question);
      
      console.log(`📝 Answer: ${result.answer.substring(0, 300)}...`);
      console.log(`🔍 Sources: ${result.sources} context pieces used`);
      console.log('═'.repeat(50));
      console.log();
    }
  }

  close(): void {
    this.db.close();
  }
}

// Test function
async function testRAGService() {
  const ragService = new LangChainRAGService();
  
  try {
    await ragService.testRAG();
  } catch (error) {
    console.error('RAG test failed:', error);
  } finally {
    ragService.close();
  }
}

if (require.main === module) {
  testRAGService();
}