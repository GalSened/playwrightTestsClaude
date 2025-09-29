/**
 * AI Configuration for QA Intelligence Platform
 * Centralized configuration for all AI services, embeddings, and vector operations
 */

export interface AIConfig {
  // Embedding configuration
  embeddings: {
    model: string;
    dimensions: number;
    provider: 'openai' | 'huggingface' | 'local';
    apiKey?: string;
    batchSize: number;
    timeout: number;
  };

  // Vector store configuration
  vectorStore: {
    type: 'local' | 'pinecone' | 'weaviate';
    namespace: string;
    indexPath?: string;
    dimensions: number;
    similarity: 'cosine' | 'euclidean' | 'dot';
    pinecone?: {
      apiKey: string;
      environment: string;
      indexName: string;
    };
  };

  // Retrieval configuration
  retrieval: {
    topK: number;
    topP: number;
    threshold: number;
    maxContextTokens: number;
    chunkSize: number;
    chunkOverlap: number;
    rerankEnabled: boolean;
  };

  // Language model configuration
  languageModel: {
    provider: 'openai' | 'anthropic' | 'local';
    model: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    fallbackModel?: string;
  };

  // Knowledge extraction configuration
  knowledgeExtraction: {
    chunkSizeTokens: number;
    overlapTokens: number;
    supportedLanguages: string[];
    generateBilingual: boolean;
    confidenceThreshold: number;
  };

  // Cache configuration
  cache: {
    enabled: boolean;
    ttl: number; // Time to live in seconds
    maxSize: number; // Maximum number of cached responses
    storage: 'memory' | 'redis' | 'file';
  };

  // Performance configuration
  performance: {
    batchProcessing: boolean;
    maxConcurrentRequests: number;
    requestQueueSize: number;
    enableMetrics: boolean;
  };
}

/**
 * Default AI configuration
 */
export const defaultAIConfig: AIConfig = {
  embeddings: {
    model: 'text-embedding-3-large',
    dimensions: 1536,
    provider: 'openai',
    batchSize: 100,
    timeout: 30000
  },

  vectorStore: {
    type: 'local',
    namespace: 'qa-intel',
    dimensions: 1536,
    similarity: 'cosine',
    indexPath: undefined // Will be set dynamically
  },

  retrieval: {
    topK: 10,
    topP: 0.9,
    threshold: 0.7,
    maxContextTokens: 10000,
    chunkSize: 1000,
    chunkOverlap: 200,
    rerankEnabled: false
  },

  languageModel: {
    provider: 'openai',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 2000,
    timeout: 120000,
    fallbackModel: 'gpt-4-turbo'
  },

  knowledgeExtraction: {
    chunkSizeTokens: 1000,
    overlapTokens: 200,
    supportedLanguages: ['en', 'he'],
    generateBilingual: true,
    confidenceThreshold: 0.7
  },

  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    maxSize: 1000,
    storage: 'memory'
  },

  performance: {
    batchProcessing: true,
    maxConcurrentRequests: 10,
    requestQueueSize: 100,
    enableMetrics: true
  }
};

/**
 * Environment-specific configuration overrides
 */
export const environmentConfigs = {
  development: {
    vectorStore: {
      type: 'local' as const,
      namespace: 'qa-intel-dev'
    },
    languageModel: {
      temperature: 0.3, // More deterministic for development
      timeout: 60000
    },
    cache: {
      enabled: true,
      ttl: 1800, // 30 minutes in dev
      storage: 'memory' as const
    },
    performance: {
      maxConcurrentRequests: 5,
      enableMetrics: true
    }
  },

  production: {
    vectorStore: {
      type: 'local' as const, // Can be changed to 'pinecone' when ready
      namespace: 'qa-intel-prod'
    },
    languageModel: {
      temperature: 0.7,
      timeout: 120000,
      fallbackModel: 'gpt-4-turbo'
    },
    cache: {
      enabled: true,
      ttl: 7200, // 2 hours in production
      storage: 'memory' as const // Consider Redis for production scaling
    },
    performance: {
      maxConcurrentRequests: 20,
      requestQueueSize: 200,
      enableMetrics: true
    }
  },

  test: {
    vectorStore: {
      type: 'local' as const,
      namespace: 'qa-intel-test'
    },
    languageModel: {
      temperature: 0.1, // Very deterministic for testing
      maxTokens: 500,
      timeout: 30000
    },
    cache: {
      enabled: false, // Disable cache in tests
      storage: 'memory' as const
    },
    performance: {
      maxConcurrentRequests: 2,
      enableMetrics: false
    }
  }
};

/**
 * Language-specific configurations
 */
export const languageConfigs = {
  english: {
    modelSuffix: '_en',
    stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'],
    tokenizer: 'tiktoken',
    promptTemplate: 'english_qa_template'
  },

  hebrew: {
    modelSuffix: '_he',
    stopWords: ['של', 'את', 'על', 'אל', 'בתוך', 'כמו', 'עם', 'או', 'אבל', 'רק'],
    tokenizer: 'custom_hebrew',
    promptTemplate: 'hebrew_qa_template',
    rtlSupport: true
  }
};

/**
 * Bilingual configuration for Hebrew-English support
 */
export const bilingualConfig = {
  defaultLanguage: 'english' as const,
  fallbackLanguage: 'english' as const,
  autoDetectLanguage: true,
  crossLanguageSearch: true,
  translateThreshold: 0.8,

  keywordMappings: {
    // Contact management
    contact: ['קשר', 'איש קשר', 'אנשי קשר'],
    document: ['מסמך', 'מסמכים'],
    template: ['תבנית', 'תבניות'],
    signature: ['חתימה', 'חתימות'],

    // Actions
    add: ['הוסף', 'הוספה', 'יצירה'],
    edit: ['ערוך', 'עריכה'],
    delete: ['מחק', 'מחיקה'],
    send: ['שלח', 'שליחה'],
    upload: ['העלה', 'העלאה'],

    // System terms
    system: ['מערכת'],
    user: ['משתמש', 'משתמשים'],
    platform: ['פלטפורמה', 'מערכת']
  }
};

/**
 * Performance monitoring configuration
 */
export const performanceConfig = {
  metrics: {
    enabled: true,
    interval: 60000, // 1 minute
    retention: 86400000, // 24 hours

    tracked: [
      'response_time',
      'embedding_generation_time',
      'vector_search_time',
      'cache_hit_rate',
      'error_rate',
      'throughput',
      'token_usage',
      'cost_estimation'
    ]
  },

  alerts: {
    enabled: true,
    thresholds: {
      response_time: 5000, // 5 seconds
      error_rate: 0.1, // 10%
      cache_hit_rate: 0.5, // 50%
      queue_size: 50
    }
  },

  optimization: {
    adaptiveChunking: true,
    dynamicThreshold: true,
    loadBalancing: true,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      recoveryTimeout: 30000
    }
  }
};

/**
 * Security configuration
 */
export const securityConfig = {
  rateLimit: {
    enabled: true,
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    skipSuccessfulRequests: false
  },

  inputValidation: {
    maxQueryLength: 2000,
    allowedCharacters: /^[\u0000-\u007F\u0590-\u05FF\s]+$/, // ASCII + Hebrew
    sanitizeInput: true,
    blockSqlInjection: true
  },

  dataProtection: {
    encryptEmbeddings: false, // Can be enabled for sensitive data
    anonymizeQueries: false,
    auditLog: true,
    retentionPeriod: 2592000000 // 30 days
  }
};

/**
 * Load configuration based on environment
 */
export function loadAIConfig(): AIConfig {
  const env = process.env.NODE_ENV || 'development';
  const envConfig = environmentConfigs[env as keyof typeof environmentConfigs] || environmentConfigs.development;

  // Deep merge default config with environment-specific overrides
  const config = deepMerge(defaultAIConfig, envConfig);

  // Apply environment variables if present
  if (process.env.OPENAI_API_KEY) {
    config.embeddings.apiKey = process.env.OPENAI_API_KEY;
  }

  if (process.env.PINECONE_API_KEY) {
    config.vectorStore.pinecone = {
      apiKey: process.env.PINECONE_API_KEY,
      environment: process.env.PINECONE_ENVIRONMENT || 'us-west1-gcp',
      indexName: process.env.PINECONE_INDEX || 'qa-intel'
    };
  }

  // Validate configuration
  validateAIConfig(config);

  return config;
}

/**
 * Validate AI configuration
 */
function validateAIConfig(config: AIConfig): void {
  // Check required API keys
  if (config.embeddings.provider === 'openai' && !config.embeddings.apiKey && !process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured - some features may not work');
  }

  // Validate vector dimensions
  if (config.vectorStore.dimensions !== config.embeddings.dimensions) {
    throw new Error('Vector store dimensions must match embedding dimensions');
  }

  // Validate chunk sizes
  if (config.knowledgeExtraction.chunkSizeTokens <= config.knowledgeExtraction.overlapTokens) {
    throw new Error('Chunk size must be larger than overlap size');
  }

  // Validate retrieval parameters
  if (config.retrieval.topK <= 0 || config.retrieval.topK > 100) {
    throw new Error('topK must be between 1 and 100');
  }

  if (config.retrieval.threshold < 0 || config.retrieval.threshold > 1) {
    throw new Error('Threshold must be between 0 and 1');
  }
}

/**
 * Deep merge utility for configuration objects
 */
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Export the loaded configuration
 */
export const aiConfig = loadAIConfig();

/**
 * Configuration validation and health check
 */
export function getConfigHealth(): {
  status: 'healthy' | 'warning' | 'error';
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }>;
} {
  const checks = [];

  // Check API keys
  checks.push({
    name: 'OpenAI API Key',
    status: process.env.OPENAI_API_KEY ? 'pass' : 'warn',
    message: process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured - some features disabled'
  });

  // Check vector store configuration
  checks.push({
    name: 'Vector Store',
    status: aiConfig.vectorStore.type === 'local' ? 'pass' : 'warn',
    message: `Using ${aiConfig.vectorStore.type} storage`
  });

  // Check performance settings
  checks.push({
    name: 'Performance',
    status: aiConfig.performance.enableMetrics ? 'pass' : 'warn',
    message: aiConfig.performance.enableMetrics ? 'Metrics enabled' : 'Metrics disabled'
  });

  // Check bilingual support
  checks.push({
    name: 'Bilingual Support',
    status: aiConfig.knowledgeExtraction.supportedLanguages.includes('he') ? 'pass' : 'warn',
    message: `Languages: ${aiConfig.knowledgeExtraction.supportedLanguages.join(', ')}`
  });

  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  return {
    status: failCount > 0 ? 'error' : warnCount > 0 ? 'warning' : 'healthy',
    checks
  };
}

export default aiConfig;