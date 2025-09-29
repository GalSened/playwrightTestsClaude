import { Request, Response, NextFunction } from 'express';
import { getAIDataPersistenceService } from '@/services/ai/aiDataPersistence';
import { logger } from '@/utils/logger';

export interface AIRequestContext {
  aiService?: string;
  modelUsed?: string;
  startTime?: number;
  inputTokens?: number;
}

// Extend Express Request to include AI context
declare global {
  namespace Express {
    interface Request {
      aiContext?: AIRequestContext;
    }
  }
}

/**
 * Middleware to capture AI request context before processing
 */
export function captureAIRequestContext(service: string, model?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.aiContext = {
      aiService: service,
      modelUsed: model || 'gpt-4o',
      startTime: Date.now(),
      inputTokens: 0
    };

    // Estimate input tokens (rough approximation: 4 chars per token)
    const inputText = JSON.stringify(req.body);
    req.aiContext.inputTokens = Math.ceil(inputText.length / 4);

    next();
  };
}

/**
 * Middleware to capture and save AI response data
 */
export function saveAIResponseData() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    const persistenceService = getAIDataPersistenceService();

    res.send = function(data: any) {
      try {
        if (req.aiContext && res.statusCode === 200) {
          const processingTime = Date.now() - (req.aiContext.startTime || 0);

          // Parse response data
          let responseData;
          try {
            responseData = typeof data === 'string' ? JSON.parse(data) : data;
          } catch {
            responseData = { rawResponse: data };
          }

          // Estimate output tokens
          const outputText = JSON.stringify(responseData);
          const outputTokens = Math.ceil(outputText.length / 4);
          const totalTokens = (req.aiContext.inputTokens || 0) + outputTokens;

          // Determine data type based on endpoint
          const endpoint = req.path;
          let dataType: any = 'model_output';

          if (endpoint.includes('/chat')) dataType = 'conversation';
          else if (endpoint.includes('/predict')) dataType = 'prediction';
          else if (endpoint.includes('/analyze')) dataType = 'analysis';
          else if (endpoint.includes('/heal')) dataType = 'healing';
          else if (endpoint.includes('/quality')) dataType = 'quality';
          else if (endpoint.includes('/performance')) dataType = 'performance';
          else if (endpoint.includes('/insights')) dataType = 'insight';

          // Save AI data asynchronously (don't block response)
          setImmediate(async () => {
            try {
              const aiDataEntry = {
                id: `${req.aiContext!.aiService}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: dataType,
                source: req.aiContext!.aiService || 'unknown',
                timestamp: new Date().toISOString(),
                data: {
                  request: {
                    method: req.method,
                    path: req.path,
                    body: req.body,
                    query: req.query,
                    headers: {
                      'user-agent': req.get('user-agent'),
                      'content-type': req.get('content-type')
                    }
                  },
                  response: responseData,
                  processing_context: {
                    endpoint,
                    statusCode: res.statusCode
                  }
                },
                metadata: {
                  model_used: req.aiContext!.modelUsed,
                  tokens_used: totalTokens,
                  processing_time_ms: processingTime,
                  cost_estimate: estimateAICost(totalTokens, req.aiContext!.modelUsed || 'gpt-4o')
                },
                related_entities: extractRelatedEntities(req.body, responseData)
              };

              await persistenceService.saveAIData(aiDataEntry);

              // Also save specific data based on type
              if (dataType === 'conversation' && req.body.message && responseData.response) {
                await persistenceService.saveConversation(
                  req.body.sessionId || 'default',
                  req.body.message,
                  responseData.response,
                  {
                    model_used: req.aiContext!.modelUsed,
                    tokens_used: totalTokens,
                    processing_time_ms: processingTime,
                    context: req.body.context
                  }
                );
              }

              logger.info('AI response data saved successfully', {
                service: req.aiContext!.aiService,
                type: dataType,
                tokens: totalTokens,
                processingTime
              });

            } catch (error) {
              logger.error('Failed to save AI response data', {
                error,
                service: req.aiContext?.aiService,
                endpoint
              });
            }
          });
        }
      } catch (error) {
        logger.error('Error in AI data capture middleware', { error });
      }

      // Call original send method
      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Estimate AI cost based on tokens and model
 */
function estimateAICost(tokens: number, model: string): number {
  const costPerToken: Record<string, number> = {
    'gpt-4o': 0.00003, // $0.03 per 1K tokens (approximate)
    'gpt-4o-mini': 0.00001, // $0.01 per 1K tokens
    'gpt-4': 0.00006, // $0.06 per 1K tokens
    'text-embedding-3-small': 0.00000002 // $0.00002 per 1K tokens
  };

  const rate = costPerToken[model] || costPerToken['gpt-4o'];
  return (tokens / 1000) * rate;
}

/**
 * Extract related entity IDs from request/response data
 */
function extractRelatedEntities(requestBody: any, responseData: any): string[] {
  const entities: Set<string> = new Set();

  // Common ID patterns to look for
  const idPatterns = [
    'testId', 'test_id', 'runId', 'run_id', 'workflowId', 'workflow_id',
    'scheduleId', 'schedule_id', 'agentId', 'agent_id', 'sessionId', 'session_id'
  ];

  // Extract from request body
  idPatterns.forEach(pattern => {
    if (requestBody?.[pattern]) {
      entities.add(String(requestBody[pattern]));
    }
  });

  // Extract from response data
  const extractFromObject = (obj: any, prefix = '') => {
    if (typeof obj !== 'object' || obj === null) return;

    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (idPatterns.some(pattern => fullKey.toLowerCase().includes(pattern.toLowerCase()))) {
        if (typeof obj[key] === 'string' || typeof obj[key] === 'number') {
          entities.add(String(obj[key]));
        }
      }

      if (typeof obj[key] === 'object') {
        extractFromObject(obj[key], fullKey);
      }
    });
  };

  extractFromObject(responseData);

  return Array.from(entities).filter(id => id && id.length > 3); // Filter out short/empty IDs
}

/**
 * Middleware specifically for chat conversations
 */
export function captureChatData() {
  return captureAIRequestContext('ai-chat', 'gpt-4o');
}

/**
 * Middleware for healing requests
 */
export function captureHealingData() {
  return captureAIRequestContext('visual-healing', 'gpt-4o');
}

/**
 * Middleware for performance analysis
 */
export function capturePerformanceData() {
  return captureAIRequestContext('performance-intelligence', 'internal-ml');
}

/**
 * Middleware for predictive analytics
 */
export function capturePredictiveData() {
  return captureAIRequestContext('predictive-analytics', 'internal-ml');
}

/**
 * Middleware for quality assessment
 */
export function captureQualityData() {
  return captureAIRequestContext('quality-assessment', 'gpt-4o');
}

export default {
  captureAIRequestContext,
  saveAIResponseData,
  captureChatData,
  captureHealingData,
  capturePerformanceData,
  capturePredictiveData,
  captureQualityData
};