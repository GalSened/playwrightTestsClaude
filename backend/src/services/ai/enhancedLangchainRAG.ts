import { config } from 'dotenv';
import { join } from 'path';
import Database from 'better-sqlite3';
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ConversationSummaryBufferMemory } from 'langchain/memory';
import { BufferWindowMemory } from 'langchain/memory';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { logger } from '@/utils/logger';

config();

export interface ConversationContext {
  userId: string;
  sessionId: string;
  testContext?: {
    testId?: string;
    testName?: string;
    failure?: any;
    url?: string;
  };
  preferences?: {
    language?: 'hebrew' | 'english' | 'mixed';
    detailLevel?: 'brief' | 'detailed' | 'expert';
    focusAreas?: string[];
  };
}

export interface EnhancedRAGResponse {
  answer: string;
  context: string;
  sources: number;
  confidence: number;
  conversationMemory: string;
  recommendations: string[];
  followUpQuestions: string[];
  relatedTopics: string[];
  executionTime: number;
}

export interface KnowledgeInsight {
  topic: string;
  relevance: number;
  actionable: boolean;
  category: 'testing' | 'debugging' | 'optimization' | 'learning';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export class EnhancedLangChainRAGService {
  private db: Database.Database;
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private conversationMemories: Map<string, ConversationSummaryBufferMemory>;
  private vectorStore: MemoryVectorStore;
  private promptTemplate: PromptTemplate;
  private knowledgeGraph: Map<string, Set<string>>;

  constructor() {
    this.db = new Database(join(process.cwd(), 'data/scheduler.db'));
    this.conversationMemories = new Map();
    this.knowledgeGraph = new Map();
    
    // Enhanced ChatOpenAI with advanced features
    this.llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o',
      temperature: 0.1, // Balance between consistency and creativity
      maxTokens: 3000, // Increased for detailed responses
      topP: 0.9,
      frequencyPenalty: 0.1,
      presencePenalty: 0.1,
    });

    // Enhanced embeddings for better semantic understanding
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-large', // Upgraded to large model
      dimensions: 1536,
    });

    this.initializeVectorStore();
    this.initializePromptTemplate();
    this.buildKnowledgeGraph();
  }

  private async initializeVectorStore(): Promise<void> {
    try {
      // Load existing knowledge base into vector store
      const knowledgeItems = this.db.prepare(`
        SELECT content, metadata, type, source FROM knowledge_base_enhanced
      `).all() as Array<{content: string; metadata: string; type: string; source: string}>;

      // Chunk large documents to avoid token limit issues
      const documents: Document[] = [];
      for (const [index, item] of knowledgeItems.entries()) {
        const chunks = this.chunkContent(item.content, 1000); // 1000 tokens per chunk

        for (const [chunkIndex, chunk] of chunks.entries()) {
          documents.push(new Document({
            pageContent: chunk,
            metadata: {
              ...JSON.parse(item.metadata || '{}'),
              type: item.type,
              source: item.source,
              id: `kb_${index}_chunk_${chunkIndex}`,
              originalId: `kb_${index}`,
              chunkIndex,
              totalChunks: chunks.length
            }
          }));
        }
      }

      this.vectorStore = await MemoryVectorStore.fromDocuments(documents, this.embeddings);
      logger.info(`Vector store initialized with ${documents.length} document chunks from ${knowledgeItems.length} original documents`);
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
      this.vectorStore = new MemoryVectorStore(this.embeddings);
    }
  }

  /**
   * Chunk content into smaller pieces to avoid token limits
   */
  private chunkContent(content: string, maxTokens: number = 1000): string[] {
    const chunks: string[] = [];

    // Estimate tokens using character count (roughly 4 characters per token)
    const maxChars = maxTokens * 4;

    if (content.length <= maxChars) {
      return [content];
    }

    // Split by paragraphs first to maintain context
    const paragraphs = content.split(/\n\s*\n/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length <= maxChars) {
        currentChunk += paragraph + '\n\n';
      } else {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }

        // If single paragraph is too large, split it further
        if (paragraph.length > maxChars) {
          const sentences = paragraph.split(/[.!?]+/);
          let sentenceChunk = '';

          for (const sentence of sentences) {
            if ((sentenceChunk + sentence).length <= maxChars) {
              sentenceChunk += sentence + '. ';
            } else {
              if (sentenceChunk.trim()) {
                chunks.push(sentenceChunk.trim());
              }
              sentenceChunk = sentence + '. ';
            }
          }

          if (sentenceChunk.trim()) {
            currentChunk = sentenceChunk;
          } else {
            currentChunk = '';
          }
        } else {
          currentChunk = paragraph + '\n\n';
        }
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  }

  private initializePromptTemplate(): void {
    this.promptTemplate = PromptTemplate.fromTemplate(`
SYSTEM IDENTITY: You are the WeSign AI Expert Assistant - an advanced, context-aware AI mentor with deep understanding of WeSign testing, comprehensive conversation memory, and predictive insights capabilities.

🧠 ENHANCED CONVERSATION CONTEXT:
Previous Conversation: {conversationMemory}
Current Question Context: {questionContext}
User Preferences: Language={language}, Detail Level={detailLevel}

🎯 COMPREHENSIVE KNOWLEDGE BASE:
{context}

🔍 ADVANCED RESPONSE REQUIREMENTS:

**CRITICAL**: You MUST respond in the user's language. If language={hebrew}, respond entirely in Hebrew. If language={english}, respond entirely in English. If language={mixed}, use the primary language of the user's question.

1. **MEMORY-ENHANCED RESPONSES**:
   - Reference previous conversation points when relevant
   - Build upon previously discussed topics
   - Acknowledge user's learning progression
   - Maintain conversation continuity

2. **PREDICTIVE INTELLIGENCE**:
   - Anticipate follow-up questions based on context
   - Suggest related topics for exploration
   - Identify potential issues before they arise
   - Recommend proactive actions

3. **MULTI-MODAL UNDERSTANDING**:
   - Analyze test failures with full context awareness
   - Consider visual, textual, and behavioral patterns
   - Integrate DOM, console, and network data insights
   - Apply bilingual expertise (Hebrew/English)

4. **ACTIONABLE INSIGHTS GENERATION**:
   - Provide specific, implementable recommendations
   - Prioritize actions by impact and complexity
   - Include success metrics for suggestions
   - Reference exact code examples and selectors

5. **CONTINUOUS LEARNING INTEGRATION**:
   - Learn from user interactions and preferences
   - Adapt responses to user expertise level
   - Suggest optimization opportunities
   - Recommend learning resources

=== USER QUERY ===
Question: {question}
Test Context: {testContext}

=== ENHANCED RESPONSE PROTOCOL ===

**DIRECT ANSWER** (Memory-enhanced, context-aware):
[Primary answer incorporating conversation history and predictive insights]

**DETAILED ANALYSIS** (When applicable):
[Deep dive with multi-modal analysis and pattern recognition]

**ACTIONABLE RECOMMENDATIONS** (Prioritized):
[Specific actions ranked by impact, with success metrics]

**PREDICTIVE INSIGHTS** (Proactive guidance):
[Anticipated issues, optimization opportunities, learning suggestions]

**FOLLOW-UP EXPLORATION** (Conversation continuity):
[Related questions, deeper topics, learning progression]

**BILINGUAL CONSIDERATIONS** (Hebrew/English optimization):
[Language-specific insights, RTL/LTR considerations, cultural UI patterns]

🚀 INTELLIGENT RESPONSE WITH MEMORY & PREDICTIONS:
`);
  }

  private buildKnowledgeGraph(): void {
    try {
      const relationships = this.db.prepare(`
        SELECT DISTINCT type, source, content FROM knowledge_base_enhanced
      `).all() as Array<{type: string; source: string; content: string}>;

      // Build knowledge graph for topic relationships
      relationships.forEach(item => {
        const topics = this.extractTopics(item.content);
        topics.forEach(topic => {
          if (!this.knowledgeGraph.has(topic)) {
            this.knowledgeGraph.set(topic, new Set());
          }
          topics.forEach(relatedTopic => {
            if (topic !== relatedTopic) {
              this.knowledgeGraph.get(topic)?.add(relatedTopic);
            }
          });
        });
      });

      logger.info(`Knowledge graph built with ${this.knowledgeGraph.size} topics`);
    } catch (error) {
      logger.error('Failed to build knowledge graph:', error);
    }
  }

  private extractTopics(content: string): string[] {
    // Enhanced topic extraction with WeSign-specific terms
    const topicPatterns = [
      // WeSign functionality
      /document.*(?:upload|signing|workflow)/gi,
      /signature.*(?:field|process|verification)/gi,
      /contact.*(?:management|integration)/gi,
      /template.*(?:creation|management)/gi,
      
      // Testing concepts
      /playwright.*(?:test|automation)/gi,
      /self.*healing.*(?:pattern|strategy)/gi,
      /bilingual.*(?:testing|support)/gi,
      
      // Technical terms
      /(?:hebrew|english).*(?:interface|ui)/gi,
      /(?:rtl|ltr).*layout/gi,
      /dom.*(?:analysis|structure)/gi
    ];

    const topics: string[] = [];
    topicPatterns.forEach(pattern => {
      const matches = content.match(pattern) || [];
      topics.push(...matches.map(match => match.toLowerCase().trim()));
    });

    return [...new Set(topics)]; // Remove duplicates
  }

  /**
   * Get or create conversation memory for a user session
   */
  private async getConversationMemory(sessionId: string): Promise<ConversationSummaryBufferMemory> {
    if (!this.conversationMemories.has(sessionId)) {
      const memory = new ConversationSummaryBufferMemory({
        llm: this.llm,
        maxTokenLimit: 2000,
        returnMessages: true,
      });

      // Load previous conversation from database if exists
      try {
        const previousConversations = this.db.prepare(`
          SELECT question, answer FROM conversation_history 
          WHERE session_id = ? 
          ORDER BY created_at DESC 
          LIMIT 10
        `).all(sessionId) as Array<{question: string; answer: string}>;

        // Add previous conversations to memory
        for (const conv of previousConversations.reverse()) {
          await memory.saveContext(
            { input: conv.question },
            { output: conv.answer }
          );
        }
      } catch (error) {
        logger.debug('No previous conversations found for session:', sessionId);
      }

      this.conversationMemories.set(sessionId, memory);
    }

    return this.conversationMemories.get(sessionId)!;
  }

  /**
   * Enhanced context retrieval with semantic similarity and conversation awareness
   */
  async retrieveEnhancedContext(
    query: string, 
    conversationContext: ConversationContext,
    maxResults: number = 12
  ): Promise<{context: string; insights: KnowledgeInsight[]}> {
    try {
      const startTime = Date.now();
      
      // Multi-strategy context retrieval
      const [vectorResults, keywordResults, conversationRelated] = await Promise.all([
        this.vectorStore.similaritySearch(query, Math.floor(maxResults * 0.6)),
        this.keywordBasedRetrieval(query, Math.floor(maxResults * 0.3)),
        this.getConversationRelatedContext(conversationContext, Math.floor(maxResults * 0.1))
      ]);

      // Combine and deduplicate results
      const allResults = [...vectorResults, ...keywordResults, ...conversationRelated];
      const uniqueResults = this.deduplicateResults(allResults);

      // Generate insights from retrieved context
      const insights = await this.generateKnowledgeInsights(uniqueResults, query);

      // Build comprehensive context
      let context = this.buildEnhancedContext(uniqueResults, conversationContext);
      
      const retrievalTime = Date.now() - startTime;
      logger.info(`Enhanced context retrieval completed in ${retrievalTime}ms`, {
        vectorResults: vectorResults.length,
        keywordResults: keywordResults.length,
        conversationRelated: conversationRelated.length,
        totalInsights: insights.length
      });

      return { context, insights };
    } catch (error) {
      logger.error('Enhanced context retrieval failed:', error);
      return { 
        context: 'Limited context available due to retrieval error.',
        insights: []
      };
    }
  }

  private async keywordBasedRetrieval(query: string, limit: number): Promise<Document[]> {
    const keywords = this.extractKeywords(query);
    const results: Document[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const dbResults = this.db.prepare(`
          SELECT content, metadata, type, source 
          FROM knowledge_base_enhanced 
          WHERE content LIKE ? 
          ORDER BY 
            CASE 
              WHEN metadata LIKE '%wesign%' THEN 0 
              WHEN type = 'wesign-design' THEN 1 
              ELSE 2 
            END
          LIMIT ?
        `).all(`%${keyword}%`, Math.ceil(limit / keywords.length)) as Array<{
          content: string; metadata: string; type: string; source: string;
        }>;

        results.push(...dbResults.map(item => new Document({
          pageContent: item.content,
          metadata: {
            ...JSON.parse(item.metadata || '{}'),
            type: item.type,
            source: item.source,
            retrievalMethod: 'keyword'
          }
        })));
      } catch (error) {
        logger.debug(`Keyword retrieval failed for: ${keyword}`);
      }
    }

    return results.slice(0, limit);
  }

  private async getConversationRelatedContext(
    conversationContext: ConversationContext,
    limit: number
  ): Promise<Document[]> {
    if (!conversationContext.testContext?.testId) return [];

    try {
      // Get context related to current test or similar tests
      const relatedTests = this.db.prepare(`
        SELECT content, metadata, type, source 
        FROM knowledge_base_enhanced 
        WHERE metadata LIKE ? OR content LIKE ?
        LIMIT ?
      `).all(
        `%${conversationContext.testContext.testId}%`,
        `%${conversationContext.testContext.testName || ''}%`,
        limit
      ) as Array<{content: string; metadata: string; type: string; source: string}>;

      return relatedTests.map(item => new Document({
        pageContent: item.content,
        metadata: {
          ...JSON.parse(item.metadata || '{}'),
          type: item.type,
          source: item.source,
          retrievalMethod: 'conversation-context'
        }
      }));
    } catch (error) {
      logger.debug('Conversation context retrieval failed:', error);
      return [];
    }
  }

  private deduplicateResults(results: Document[]): Document[] {
    const seen = new Set<string>();
    return results.filter(doc => {
      const key = doc.pageContent.substring(0, 100);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async generateKnowledgeInsights(
    documents: Document[], 
    query: string
  ): Promise<KnowledgeInsight[]> {
    const insights: KnowledgeInsight[] = [];
    
    // Analyze document types and generate insights
    const docTypes = documents.map(doc => doc.metadata.type);
    const uniqueTypes = [...new Set(docTypes)];

    for (const type of uniqueTypes) {
      const typeCount = docTypes.filter(t => t === type).length;
      const relevance = Math.min(typeCount / documents.length, 1.0);
      
      insights.push({
        topic: this.getTopicFromType(type),
        relevance,
        actionable: this.isActionableType(type),
        category: this.categorizeTopic(type),
        priority: relevance > 0.7 ? 'high' : relevance > 0.4 ? 'medium' : 'low'
      });
    }

    // Add query-specific insights
    if (query.toLowerCase().includes('error') || query.toLowerCase().includes('fail')) {
      insights.push({
        topic: 'debugging-and-error-analysis',
        relevance: 0.9,
        actionable: true,
        category: 'debugging',
        priority: 'high'
      });
    }

    return insights.slice(0, 5); // Top 5 insights
  }

  private buildEnhancedContext(
    documents: Document[], 
    conversationContext: ConversationContext
  ): string {
    let context = '=== COMPREHENSIVE KNOWLEDGE CONTEXT ===\n\n';

    // Group documents by type for better organization
    const groupedDocs = documents.reduce((groups, doc) => {
      const type = doc.metadata.type || 'general';
      if (!groups[type]) groups[type] = [];
      groups[type].push(doc);
      return groups;
    }, {} as Record<string, Document[]>);

    // Add context sections in priority order
    const priorityOrder = ['wesign-design', 'system-core', 'api-reference', 'test-guidance', 'general'];
    
    for (const type of priorityOrder) {
      if (groupedDocs[type]) {
        context += `\n--- ${type.toUpperCase()} KNOWLEDGE ---\n`;
        groupedDocs[type].forEach((doc, index) => {
          context += `${index + 1}. ${doc.pageContent.substring(0, 800)}\n\n`;
        });
      }
    }

    // Add user context if available
    if (conversationContext.preferences) {
      context += '\n=== USER CONTEXT ===\n';
      context += `Language Preference: ${conversationContext.preferences.language || 'mixed'}\n`;
      context += `Detail Level: ${conversationContext.preferences.detailLevel || 'detailed'}\n`;
      if (conversationContext.preferences.focusAreas?.length) {
        context += `Focus Areas: ${conversationContext.preferences.focusAreas.join(', ')}\n`;
      }
    }

    return context.substring(0, 10000); // Expanded context limit
  }

  /**
   * Enhanced chat with conversation memory and predictive insights
   */
  async enhancedChat(
    question: string,
    conversationContext: ConversationContext
  ): Promise<EnhancedRAGResponse> {
    const startTime = Date.now();

    try {
      // Get conversation memory
      const memory = await this.getConversationMemory(conversationContext.sessionId);
      const conversationMemory = await memory.loadMemoryVariables({});

      // Retrieve enhanced context with insights
      const { context, insights } = await this.retrieveEnhancedContext(question, conversationContext);

      // Prepare enhanced prompt variables
      const promptVariables = {
        context,
        question,
        conversationMemory: conversationMemory.history || '',
        questionContext: JSON.stringify(conversationContext.testContext || {}),
        language: conversationContext.preferences?.language || 'mixed',
        detailLevel: conversationContext.preferences?.detailLevel || 'detailed',
        testContext: conversationContext.testContext ? JSON.stringify(conversationContext.testContext) : 'No test context'
      };

      // Create enhanced RAG chain
      const ragChain = RunnableSequence.from([
        {
          ...promptVariables,
          context: () => context,
          question: (input: { question: string }) => input.question,
          conversationMemory: () => conversationMemory.history || '',
          questionContext: () => JSON.stringify(conversationContext.testContext || {}),
          language: () => conversationContext.preferences?.language || 'mixed',
          detailLevel: () => conversationContext.preferences?.detailLevel || 'detailed',
          testContext: () => conversationContext.testContext ? JSON.stringify(conversationContext.testContext) : 'No test context'
        },
        this.promptTemplate,
        this.llm,
      ]);

      // Execute enhanced RAG
      const response = await ragChain.invoke({ question });
      const answer = response.content as string;

      // Save conversation to memory and database
      await memory.saveContext({ input: question }, { output: answer });
      await this.saveConversationToDatabase(conversationContext, question, answer);

      // Generate follow-up questions and recommendations
      const followUpQuestions = await this.generateFollowUpQuestions(question, answer, insights);
      const recommendations = await this.generateRecommendations(answer, insights);
      const relatedTopics = this.findRelatedTopics(question);

      const executionTime = Date.now() - startTime;

      return {
        answer,
        context: context.substring(0, 500) + '...',
        sources: context.split('---').length,
        confidence: this.calculateConfidence(insights, context),
        conversationMemory: conversationMemory.history || '',
        recommendations,
        followUpQuestions,
        relatedTopics,
        executionTime
      };
    } catch (error) {
      logger.error('Enhanced RAG chat failed:', error);
      
      return {
        answer: 'I apologize, but I encountered an error processing your question. Please try rephrasing or check system configuration.',
        context: '',
        sources: 0,
        confidence: 0,
        conversationMemory: '',
        recommendations: [],
        followUpQuestions: [],
        relatedTopics: [],
        executionTime: Date.now() - startTime
      };
    }
  }

  private async generateFollowUpQuestions(
    question: string, 
    answer: string, 
    insights: KnowledgeInsight[]
  ): Promise<string[]> {
    const followUps: string[] = [];

    // Generate based on insights
    insights.forEach(insight => {
      if (insight.actionable && insight.priority === 'high') {
        followUps.push(`How can I implement ${insight.topic} in my WeSign tests?`);
      }
      if (insight.category === 'optimization') {
        followUps.push(`What are the best practices for ${insight.topic}?`);
      }
    });

    // Add contextual follow-ups based on question type
    if (question.toLowerCase().includes('error')) {
      followUps.push('How can I prevent this error in the future?');
      followUps.push('Are there similar errors I should watch out for?');
    }

    if (question.toLowerCase().includes('test')) {
      followUps.push('How can I make this test more robust?');
      followUps.push('What edge cases should I consider for this test?');
    }

    return followUps.slice(0, 3); // Top 3 follow-ups
  }

  private async generateRecommendations(
    answer: string, 
    insights: KnowledgeInsight[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // High-priority actionable insights become recommendations
    insights
      .filter(insight => insight.actionable && insight.priority === 'high')
      .forEach(insight => {
        recommendations.push(`Consider implementing ${insight.topic} improvements`);
      });

    // Add general best practice recommendations
    if (answer.toLowerCase().includes('playwright')) {
      recommendations.push('Use page object model for better test maintainability');
      recommendations.push('Implement wait strategies for reliable test execution');
    }

    if (answer.toLowerCase().includes('hebrew') || answer.toLowerCase().includes('bilingual')) {
      recommendations.push('Test both RTL and LTR layouts for comprehensive coverage');
      recommendations.push('Validate Hebrew text rendering and encoding');
    }

    return recommendations.slice(0, 4); // Top 4 recommendations
  }

  private findRelatedTopics(question: string): string[] {
    const questionTopics = this.extractTopics(question);
    const relatedTopics = new Set<string>();

    questionTopics.forEach(topic => {
      const related = this.knowledgeGraph.get(topic);
      if (related) {
        related.forEach(relatedTopic => relatedTopics.add(relatedTopic));
      }
    });

    return Array.from(relatedTopics).slice(0, 5);
  }

  private calculateConfidence(insights: KnowledgeInsight[], context: string): number {
    if (insights.length === 0) return 0.3;
    
    const avgRelevance = insights.reduce((sum, insight) => sum + insight.relevance, 0) / insights.length;
    const contextQuality = Math.min(context.length / 5000, 1.0); // Context richness factor
    const highPriorityInsights = insights.filter(i => i.priority === 'high').length;
    
    return Math.min(
      (avgRelevance * 0.4) + (contextQuality * 0.3) + (highPriorityInsights * 0.1) + 0.2,
      1.0
    );
  }

  private async saveConversationToDatabase(
    conversationContext: ConversationContext,
    question: string,
    answer: string
  ): Promise<void> {
    try {
      // Create conversation_history table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS conversation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          test_context TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const stmt = this.db.prepare(`
        INSERT INTO conversation_history (user_id, session_id, question, answer, test_context)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        conversationContext.userId,
        conversationContext.sessionId,
        question,
        answer,
        JSON.stringify(conversationContext.testContext || {})
      );
    } catch (error) {
      logger.error('Failed to save conversation to database:', error);
    }
  }

  // Helper methods
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but']);
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 5);
  }

  private getTopicFromType(type: string): string {
    const typeMap: Record<string, string> = {
      'wesign-design': 'WeSign Application Design',
      'system-core': 'System Architecture',
      'api-reference': 'API Integration',
      'test-guidance': 'Testing Best Practices',
      'general': 'General Knowledge'
    };
    return typeMap[type] || type;
  }

  private isActionableType(type: string): boolean {
    return ['test-guidance', 'api-reference', 'wesign-design'].includes(type);
  }

  private categorizeTopic(type: string): 'testing' | 'debugging' | 'optimization' | 'learning' {
    const categoryMap: Record<string, any> = {
      'test-guidance': 'testing',
      'wesign-design': 'learning',
      'api-reference': 'optimization',
      'system-core': 'optimization'
    };
    return categoryMap[type] || 'learning';
  }

  async close(): void {
    this.db.close();
  }
}

export default EnhancedLangChainRAGService;