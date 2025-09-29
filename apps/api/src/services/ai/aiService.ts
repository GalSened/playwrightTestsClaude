import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { logger } from '@/utils/logger';

export class AIService {
  private openai: OpenAI;
  private pinecone: Pinecone;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || ''
    });
  }
  
  async testConnection() {
    try {
      logger.info('Testing AI service connections...');
      
      // Test OpenAI
      let openaiResult = false;
      let openaiMessage = '';
      
      try {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('placeholder') || process.env.OPENAI_API_KEY.includes('here')) {
          throw new Error('OpenAI API key not configured properly');
        }
        
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini', // Use a known working model
          messages: [{ role: 'user', content: 'Test connection - respond with "OK"' }],
          max_completion_tokens: 10 // Use correct parameter name
        });
        
        openaiResult = true;
        openaiMessage = completion.choices[0].message.content || 'Connected';
        logger.info('OpenAI connection successful');
      } catch (error) {
        openaiMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('OpenAI connection failed:', openaiMessage);
      }
      
      // Test Pinecone
      let pineconeResult = false;
      let pineconeMessage = '';
      
      try {
        if (!process.env.PINECONE_API_KEY || process.env.PINECONE_API_KEY.includes('placeholder') || process.env.PINECONE_API_KEY.includes('here')) {
          throw new Error('Pinecone API key not configured properly');
        }
        
        const indexName = process.env.PINECONE_INDEX_NAME || 'wesign-knowledge';
        const index = this.pinecone.Index(indexName);
        const stats = await index.describeIndexStats();
        
        pineconeResult = true;
        pineconeMessage = `Index found with ${stats.totalVectorCount || 0} vectors`;
        logger.info('Pinecone connection successful');
      } catch (error) {
        pineconeMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Pinecone connection failed:', pineconeMessage);
      }
      
      return { 
        openai: openaiResult, 
        pinecone: pineconeResult,
        messages: {
          openai: openaiMessage,
          pinecone: pineconeMessage
        },
        status: openaiResult && pineconeResult ? 'success' : 'partial'
      };
    } catch (error) {
      logger.error('AI service connection test failed:', error);
      return { 
        openai: false, 
        pinecone: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      };
    }
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        input: text
      });
      return response.data[0].embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }
  
  async chatCompletion(messages: any[], options: any = {}) {
    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        messages,
        max_tokens: options.maxTokens || parseInt(process.env.MAX_TOKENS || '2000'),
        reasoning_effort: options.reasoning_effort || 'minimal', // Most accurate, deterministic
        verbosity: options.verbosity || 'high', // Comprehensive WeSign mentor responses
        ...options
      });
      
      return response;
    } catch (error) {
      logger.error('Chat completion failed:', error);
      throw error;
    }
  }
}