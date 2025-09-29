import { ChatOpenAI } from '@langchain/openai';
import { logger } from '@/utils/logger';
import { searchVectors, VectorSearchResult } from './vectorStore';

interface KnowledgeEntry {
  id: string;
  topics: string[];
  keywords: string[];
  responses: {
    hebrew: string;
    english: string;
  };
  confidence: number;
  followUpQuestions?: {
    hebrew: string[];
    english: string[];
  };
  recommendations?: {
    hebrew: string[];
    english: string[];
  };
}

interface SmartResponse {
  answer: string;
  confidence: number;
  sources: number;
  executionTime: number;
  recommendations?: string[];
  followUpQuestions?: string[];
  relatedTopics?: string[];
  language: 'hebrew' | 'english' | 'mixed';
}

interface LanguageDetectionResult {
  language: 'hebrew' | 'english' | 'mixed';
  confidence: number;
  patterns: {
    hebrew: number;
    english: number;
    mixed: number;
  };
}

/**
 * Enhanced Smart WeSign Knowledge System with improved language detection
 * and bilingual keyword mapping for accurate query routing
 */
export class SmartWeSignKnowledge {
  private llm: ChatOpenAI;
  private knowledgeBase: KnowledgeEntry[];
  private responseCache: Map<string, { response: SmartResponse; timestamp: number; hits: number }> = new Map();
  private cacheStats = { hits: 0, misses: 0, size: 0 };
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 500; // Increased from 100

  // Enhanced bilingual keyword mappings
  private bilingualMappings: Map<string, string[]> = new Map();

  // Language detection cache (lightweight)
  private languageCache: Map<string, LanguageDetectionResult> = new Map();
  private readonly LANGUAGE_CACHE_SIZE = 1000;
  private readonly LANGUAGE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured, using static knowledge only');
    }

    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000
    });

    this.initializeKnowledgeBase();
    this.initializeBilingualMappings();
  }

  /**
   * Enhanced language detection with caching and improved accuracy
   */
  private detectLanguage(text: string): LanguageDetectionResult {
    // Create cache key (first 50 chars should be sufficient for language detection)
    const cacheKey = text.substring(0, 50).toLowerCase().trim();

    // Check cache first
    if (this.languageCache.has(cacheKey)) {
      const cached = this.languageCache.get(cacheKey)!;
      // Check if cache entry is still valid (within TTL)
      if (Date.now() - (cached as any).timestamp < this.LANGUAGE_CACHE_TTL_MS) {
        return cached;
      } else {
        this.languageCache.delete(cacheKey);
      }
    }

    // Perform language detection
    const result = this.performLanguageDetection(text);

    // Cache the result with timestamp
    (result as any).timestamp = Date.now();
    this.languageCache.set(cacheKey, result);

    // Evict old cache entries if cache gets too large
    if (this.languageCache.size > this.LANGUAGE_CACHE_SIZE) {
      const firstKey = this.languageCache.keys().next().value;
      this.languageCache.delete(firstKey);
    }

    return result;
  }

  /**
   * Actual language detection logic (extracted for caching)
   */
  private performLanguageDetection(text: string): LanguageDetectionResult {
    const cleanText = text.toLowerCase().trim();

    // Hebrew patterns with improved detection
    const hebrewPatterns = [
      /[\u0590-\u05FF]/g,                          // Hebrew Unicode range
      /\b(איך|מה|כיצד|למה|מתי|איפה|מי|האם)\b/g,     // Hebrew question words
      /\b(קשר|מסמך|תבנית|חתימה|משתמש|דוח|מערכת)\b/g, // WeSign Hebrew terms
      /\b(להוסיף|לערוך|למחוק|לשלוח|לחתום|להעלות)\b/g, // Hebrew action verbs
      /\b(איש\s+קשר|מסמכים|תבניות|חתימות)\b/g,      // Hebrew compound terms
      /\b(ב-?WeSign|במערכת|לחותמים|הנמענים)\b/g      // Hebrew with platform terms
    ];

    // English patterns with WeSign-specific terms
    const englishPatterns = [
      /\b(how|what|when|where|why|who|can|do|does)\b/gi,    // English question words
      /\b(contact|document|template|sign|user|report|system)\b/gi, // WeSign English terms
      /\b(add|edit|delete|send|create|upload|download)\b/gi,       // English action verbs
      /\b(contacts|documents|templates|signatures|users)\b/gi,     // English plurals
      /\b(WeSign|signing|signer|recipient|workflow)\b/gi           // Platform-specific terms
    ];

    // Mixed language patterns (common in bilingual environments)
    const mixedPatterns = [
      /WeSign.*[\u0590-\u05FF]/g,                    // Platform name + Hebrew
      /[\u0590-\u05FF].*WeSign/g,                    // Hebrew + platform name
      /\b(API|URL|JSON|HTTP|PDF).*[\u0590-\u05FF]/g, // Technical terms + Hebrew
      /[\u0590-\u05FF].*(API|URL|JSON|HTTP|PDF)\b/g  // Hebrew + technical terms
    ];

    // Calculate pattern scores
    const hebrewScore = this.calculatePatternScore(cleanText, hebrewPatterns);
    const englishScore = this.calculatePatternScore(cleanText, englishPatterns);
    const mixedScore = this.calculatePatternScore(cleanText, mixedPatterns);

    // Character-based analysis
    const hebrewChars = (cleanText.match(/[\u0590-\u05FF]/g) || []).length;
    const englishChars = (cleanText.match(/[a-zA-Z]/g) || []).length;
    const totalChars = hebrewChars + englishChars;

    // Character ratio scores
    const hebrewCharRatio = totalChars > 0 ? hebrewChars / totalChars : 0;
    const englishCharRatio = totalChars > 0 ? englishChars / totalChars : 0;

    // Combined scoring with weights
    const finalHebrewScore = (hebrewScore * 0.6) + (hebrewCharRatio * 0.4);
    const finalEnglishScore = (englishScore * 0.6) + (englishCharRatio * 0.4);
    const finalMixedScore = mixedScore * 0.8; // Mixed patterns are strong indicators

    // Determine language with confidence
    let language: 'hebrew' | 'english' | 'mixed';
    let confidence: number;

    if (finalMixedScore > 0.3) {
      language = 'mixed';
      confidence = finalMixedScore;
    } else if (finalHebrewScore > finalEnglishScore && finalHebrewScore > 0.2) {
      language = 'hebrew';
      confidence = finalHebrewScore;
    } else if (finalEnglishScore > finalHebrewScore && finalEnglishScore > 0.2) {
      language = 'english';
      confidence = finalEnglishScore;
    } else {
      // Fallback to character-based detection
      if (hebrewCharRatio > 0.6) {
        language = 'hebrew';
        confidence = hebrewCharRatio;
      } else if (englishCharRatio > 0.6) {
        language = 'english';
        confidence = englishCharRatio;
      } else {
        language = 'mixed';
        confidence = 0.5;
      }
    }

    logger.info('Language detection completed', {
      text: text.substring(0, 50),
      detected: language,
      confidence,
      scores: {
        hebrew: finalHebrewScore,
        english: finalEnglishScore,
        mixed: finalMixedScore
      },
      charRatio: { hebrewCharRatio, englishCharRatio },
      charCounts: { hebrewChars, englishChars, totalChars }
    });

    return {
      language,
      confidence: Math.min(1.0, Math.max(0.1, confidence)),
      patterns: {
        hebrew: finalHebrewScore,
        english: finalEnglishScore,
        mixed: finalMixedScore
      }
    };
  }

  /**
   * Calculate pattern matching score for language detection
   */
  private calculatePatternScore(text: string, patterns: RegExp[]): number {
    let totalMatches = 0;
    const words = text.split(/\s+/).filter(w => w.length > 1);
    const wordCount = Math.max(words.length, 1);

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        totalMatches += matches.length;
      }
    }

    return totalMatches / wordCount;
  }

  /**
   * Main query processing method with enhanced language routing
   */
  async processQuery(query: string): Promise<SmartResponse> {
    const startTime = Date.now();
    const cacheKey = this.createCacheKey(query);

    // Check cache first with TTL validation
    if (this.responseCache.has(cacheKey)) {
      const cachedEntry = this.responseCache.get(cacheKey)!;
      const isExpired = Date.now() - cachedEntry.timestamp > this.CACHE_TTL_MS;

      if (!isExpired) {
        // Update hit stats and move to end (LRU)
        cachedEntry.hits++;
        this.responseCache.delete(cacheKey);
        this.responseCache.set(cacheKey, cachedEntry);
        this.cacheStats.hits++;

        logger.info('Returning cached response', {
          query: query.substring(0, 50),
          hits: cachedEntry.hits,
          age: `${Math.round((Date.now() - cachedEntry.timestamp) / 1000)}s`,
          cacheRetrievalTime: Date.now() - startTime
        });

        // Return cached response with updated execution time (cache retrieval time)
        const cachedResponse = {
          ...cachedEntry.response,
          executionTime: Date.now() - startTime,
          cached: true
        };
        return cachedResponse;
      } else {
        // Remove expired entry
        this.responseCache.delete(cacheKey);
        logger.debug('Cache entry expired, will regenerate', { query: query.substring(0, 50) });
      }
    }

    this.cacheStats.misses++;

    try {
      // Enhanced language detection
      const languageResult = this.detectLanguage(query);

      logger.info('Processing query with enhanced language detection', {
        query: query.substring(0, 100),
        detectedLanguage: languageResult.language,
        confidence: languageResult.confidence
      });

      // Try vector search first (from new standardized vector store)
      let vectorResults: VectorSearchResult[] = [];
      try {
        logger.info('Attempting vector search', {
          query: query.substring(0, 100),
          language: languageResult.language,
          queryLength: query.length
        });

        vectorResults = await searchVectors(query, {
          namespace: 'qa-intel',
          topK: 5,
          threshold: 0.7,
          filter: {
            lang: languageResult.language === 'mixed' ? undefined : languageResult.language
          }
        });

        logger.info('Vector search completed', {
          resultsCount: vectorResults.length,
          query: query.substring(0, 50)
        });
      } catch (error) {
        logger.error('Vector search failed, falling back to static knowledge', {
          error: error.message,
          query: query.substring(0, 100)
        });
      }

      // Search static knowledge base with bilingual support
      const staticMatches = this.searchStaticKnowledge(query, languageResult.language);

      // Combine and rank results
      const combinedResults = this.combineResults(vectorResults, staticMatches, languageResult);

      logger.info('Combined search results', {
        vectorResults: vectorResults.length,
        staticMatches: staticMatches.length,
        combinedResults: combinedResults.length,
        query: query.substring(0, 50)
      });

      if (combinedResults.length === 0) {
        logger.warn('No search results found, using fallback response', {
          query: query.substring(0, 100)
        });
        return this.createFallbackResponse(query, languageResult);
      }

      // Generate enhanced response
      const response = await this.generateEnhancedResponse(
        query,
        combinedResults,
        languageResult
      );

      const executionTime = Date.now() - startTime;
      const finalResponse: SmartResponse = {
        ...response,
        executionTime,
        language: languageResult.language
      };

      // Cache the response with TTL and hit tracking
      this.responseCache.set(cacheKey, {
        response: finalResponse,
        timestamp: Date.now(),
        hits: 0
      });

      // LRU eviction if cache gets too large
      this.evictOldCacheEntries();
      this.cacheStats.size = this.responseCache.size;

      return finalResponse;

    } catch (error) {
      logger.error('Query processing failed:', error);
      return this.createErrorResponse(query, error as Error);
    }
  }

  /**
   * Search static knowledge base with enhanced bilingual support
   */
  private searchStaticKnowledge(query: string, language: 'hebrew' | 'english' | 'mixed'): KnowledgeEntry[] {
    const queryLower = query.toLowerCase();
    const matches: { entry: KnowledgeEntry; score: number }[] = [];

    logger.info('Static knowledge search', {
      query: queryLower,
      language,
      totalEntries: this.knowledgeBase.length
    });

    for (const entry of this.knowledgeBase) {
      let score = 0;

      // Check topics with language preference
      const relevantTopics = language === 'hebrew'
        ? entry.topics.filter(t => /[\u0590-\u05FF]/.test(t))
        : entry.topics.filter(t => /[a-zA-Z]/.test(t));

      for (const topic of relevantTopics) {
        if (queryLower.includes(topic.toLowerCase())) {
          score += 2.0;
        }
      }

      // Check keywords with bilingual mapping
      for (const keyword of entry.keywords) {
        if (queryLower.includes(keyword.toLowerCase())) {
          score += 1.5;
          logger.info('Keyword match found', {
            entryId: entry.id,
            keyword,
            query: queryLower,
            score
          });
        }

        // Check bilingual mappings
        const mappedTerms = this.bilingualMappings.get(keyword.toLowerCase()) || [];
        for (const mappedTerm of mappedTerms) {
          if (queryLower.includes(mappedTerm)) {
            score += 1.2;
          }
        }
      }

      // Partial matching for compound terms
      const queryWords = queryLower.split(/\s+/);
      for (const word of queryWords) {
        if (word.length > 2) {
          for (const keyword of entry.keywords) {
            if (keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase())) {
              score += 0.5;
            }
          }
        }
      }

      if (score > 0) {
        matches.push({ entry, score });
      }
    }

    // Sort by score and return top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(m => m.entry);
  }

  /**
   * Combine vector and static results with intelligent ranking
   */
  private combineResults(
    vectorResults: VectorSearchResult[],
    staticResults: KnowledgeEntry[],
    languageResult: LanguageDetectionResult
  ): Array<{type: 'vector' | 'static'; data: any; score: number}> {
    const combined: Array<{type: 'vector' | 'static'; data: any; score: number}> = [];

    // Add vector results with boosted scores
    for (const result of vectorResults) {
      let adjustedScore = result.score;

      // Boost score if language matches
      if (result.metadata.lang === languageResult.language) {
        adjustedScore *= 1.2;
      }

      combined.push({
        type: 'vector',
        data: result,
        score: adjustedScore
      });
    }

    // Add static results
    for (const entry of staticResults) {
      combined.push({
        type: 'static',
        data: entry,
        score: entry.confidence
      });
    }

    // Sort by score and return top results
    return combined
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }

  /**
   * Generate enhanced response with context and recommendations
   */
  private async generateEnhancedResponse(
    query: string,
    results: Array<{type: 'vector' | 'static'; data: any; score: number}>,
    languageResult: LanguageDetectionResult
  ): Promise<Omit<SmartResponse, 'executionTime' | 'language'>> {
    if (results.length === 0) {
      return this.createFallbackResponse(query, languageResult);
    }

    // Build context from all relevant results
    const context = results.map(result => {
      if (result.type === 'static') {
        const entry = result.data as KnowledgeEntry;
        return languageResult.language === 'hebrew'
          ? entry.responses.hebrew
          : entry.responses.english;
      } else {
        const vectorData = result.data as VectorSearchResult;
        return vectorData.text;
      }
    }).join('\n\n');

    // Always generate contextual response with AI if OpenAI is available
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')) {
      try {
        logger.info('Generating contextual answer with AI', {
          query: query.substring(0, 100),
          contextLength: context.length,
          language: languageResult.language,
          resultsCount: results.length
        });

        const answer = await this.generateContextualAnswer(query, context, languageResult.language);
        const confidence = this.calculateContextualConfidence(query, results, answer);

        logger.info('Contextual answer generated successfully', {
          answerLength: answer.length,
          confidence,
          query: query.substring(0, 50)
        });

        // Get enhanced recommendations and follow-up questions
        const { recommendations, followUpQuestions } = await this.generateMetadata(query, answer, languageResult.language);

        return {
          answer,
          confidence,
          sources: results.length,
          recommendations,
          followUpQuestions,
          relatedTopics: this.extractRelatedTopics(results)
        };
      } catch (error) {
        logger.error('Contextual answer generation failed:', error);
        // Fallback to first result
        const primaryResult = results[0];
        if (primaryResult.type === 'static') {
          const entry = primaryResult.data as KnowledgeEntry;
          return {
            answer: languageResult.language === 'hebrew'
              ? entry.responses.hebrew
              : entry.responses.english,
            confidence: entry.confidence,
            sources: results.length,
            recommendations: languageResult.language === 'hebrew'
              ? entry.recommendations?.hebrew || []
              : entry.recommendations?.english || [],
            followUpQuestions: languageResult.language === 'hebrew'
              ? entry.followUpQuestions?.hebrew || []
              : entry.followUpQuestions?.english || [],
            relatedTopics: this.extractRelatedTopics(results)
          };
        } else {
          const vectorData = primaryResult.data as VectorSearchResult;
          return {
            answer: vectorData.text,
            confidence: vectorData.score,
            sources: results.length,
            recommendations: [],
            followUpQuestions: [],
            relatedTopics: this.extractRelatedTopics(results)
          };
        }
      }
    }

    // Fallback when OpenAI is not available
    const primaryResult = results[0];
    if (primaryResult.type === 'static') {
      const entry = primaryResult.data as KnowledgeEntry;
      return {
        answer: languageResult.language === 'hebrew'
          ? entry.responses.hebrew
          : entry.responses.english,
        confidence: entry.confidence,
        sources: results.length,
        recommendations: languageResult.language === 'hebrew'
          ? entry.recommendations?.hebrew || []
          : entry.recommendations?.english || [],
        followUpQuestions: languageResult.language === 'hebrew'
          ? entry.followUpQuestions?.hebrew || []
          : entry.followUpQuestions?.english || [],
        relatedTopics: this.extractRelatedTopics(results)
      };
    } else {
      const vectorData = primaryResult.data as VectorSearchResult;
      return {
        answer: vectorData.text,
        confidence: vectorData.score,
        sources: results.length,
        recommendations: [],
        followUpQuestions: [],
        relatedTopics: this.extractRelatedTopics(results)
      };
    }
  }

  /**
   * Generate contextual answer based on query and retrieved context
   */
  private async generateContextualAnswer(query: string, context: string, language: 'hebrew' | 'english' | 'mixed'): Promise<string> {
    const isHebrew = language === 'hebrew';

    const prompt = isHebrew ? `
אתה מומחה WeSign המסייע למשתמשים בפלטפורמת החתימה הדיגיטלית.

שאלת המשתמש: ${query}

מידע רלוונטי מבסיס הידע:
${context}

הנחיות:
1. ענה באופן ספציפי על השאלה שנשאלה
2. השתמש במידע מבסיס הידע לתמיכה בתשובה
3. כתב בעברית ברורה ומקצועית
4. כלול צעדים ברורים ומספרים אם רלוונטי
5. אם המידע לא מספיק, ציין זאת בבירור

תשובה מפורטת:` : `
You are a WeSign expert helping users with the digital signature platform.

User question: ${query}

Relevant information from knowledge base:
${context}

Guidelines:
1. Answer specifically to the question asked
2. Use the knowledge base information to support your answer
3. Write in clear, professional language
4. Include clear numbered steps if relevant
5. If information is insufficient, state this clearly

Detailed answer:`;

    try {
      const response = await this.llm.invoke(prompt);
      return (response.content as string).trim();
    } catch (error) {
      logger.error('Contextual answer generation failed:', error);
      throw error;
    }
  }

  /**
   * Calculate confidence based on context relevance and answer quality
   */
  private calculateContextualConfidence(query: string, results: Array<{type: 'vector' | 'static'; data: any; score: number}>, answer: string): number {
    // Base confidence from search results
    const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;

    // Boost confidence if answer is substantial and relevant
    const answerLength = answer.length;
    const lengthBoost = Math.min(0.2, answerLength / 1000); // Up to 0.2 boost for longer answers

    // Check if answer contains query keywords
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const answerLower = answer.toLowerCase();
    const keywordMatches = queryWords.filter(word => answerLower.includes(word)).length;
    const keywordBoost = Math.min(0.2, (keywordMatches / queryWords.length) * 0.2);

    // Calculate final confidence
    const finalConfidence = Math.min(1.0, avgScore + lengthBoost + keywordBoost);
    return Math.max(0.3, finalConfidence); // Minimum 30% confidence
  }

  /**
   * Generate contextual metadata (recommendations and follow-up questions)
   */
  private async generateMetadata(query: string, answer: string, language: 'hebrew' | 'english' | 'mixed'): Promise<{recommendations: string[], followUpQuestions: string[]}> {
    const isHebrew = language === 'hebrew';

    const prompt = isHebrew ? `
בהתבסס על השאלה והתשובה הבאות, צור:
1. 3 המלצות מועילות
2. 3 שאלות המשך רלוונטיות

שאלה: ${query}
תשובה: ${answer}

פורמט התשובה:
RECOMMENDATIONS:
- המלצה 1
- המלצה 2
- המלצה 3

FOLLOW_UP:
- שאלה 1?
- שאלה 2?
- שאלה 3?` : `
Based on the following question and answer, generate:
1. 3 helpful recommendations
2. 3 relevant follow-up questions

Question: ${query}
Answer: ${answer}

Response format:
RECOMMENDATIONS:
- Recommendation 1
- Recommendation 2
- Recommendation 3

FOLLOW_UP:
- Question 1?
- Question 2?
- Question 3?`;

    try {
      const response = await this.llm.invoke(prompt);
      const content = response.content as string;

      const recommendations: string[] = [];
      const followUpQuestions: string[] = [];

      const lines = content.split('\n');
      let currentSection = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.includes('RECOMMENDATIONS:')) {
          currentSection = 'recommendations';
        } else if (trimmed.includes('FOLLOW_UP:')) {
          currentSection = 'followup';
        } else if (trimmed.startsWith('-') && trimmed.length > 2) {
          const item = trimmed.substring(1).trim();
          if (currentSection === 'recommendations') {
            recommendations.push(item);
          } else if (currentSection === 'followup') {
            followUpQuestions.push(item);
          }
        }
      }

      return {
        recommendations: recommendations.slice(0, 3),
        followUpQuestions: followUpQuestions.slice(0, 3)
      };
    } catch (error) {
      logger.warn('Metadata generation failed, using defaults:', error);
      return {
        recommendations: isHebrew
          ? ['בדוק את המסמך לפני השליחה', 'הגדר סדר חתימה ברור', 'השתמש בהודעות מותאמות אישית']
          : ['Review document before sending', 'Set clear signing order', 'Use personalized messages'],
        followUpQuestions: isHebrew
          ? ['איך אני יכול לבטל תהליך חתימה?', 'מה הסטטוסים השונים של מסמך?', 'איך אני מוסיף שדות חתימה מרובים?']
          : ['How can I cancel a signing process?', 'What are the different document statuses?', 'How do I add multiple signature fields?']
      };
    }
  }

  /**
   * Enhance answer with AI for better context and clarity
   */
  private async enhanceWithAI(query: string, baseAnswer: string, language: 'hebrew' | 'english' | 'mixed'): Promise<string> {
    const isHebrew = language === 'hebrew';

    const prompt = isHebrew ? `
שפר את התשובה הבאה כך שתהיה יותר מפורטת ומועילה למשתמש WeSign.

שאלת המשתמש: ${query}
תשובה בסיסית: ${baseAnswer}

הנחיות:
1. שמור על הדיוק הטכני
2. הוסף פרטים מועילים
3. השתמש בעברית ברורה ומקצועית
4. כלול צעדים ברורים אם רלוונטי

תשובה משופרת:` : `
Enhance the following answer to be more detailed and helpful for WeSign users.

User question: ${query}
Base answer: ${baseAnswer}

Guidelines:
1. Maintain technical accuracy
2. Add helpful details
3. Use clear, professional language
4. Include clear steps if relevant

Enhanced answer:`;

    try {
      const response = await this.llm.invoke(prompt);
      return response.content as string;
    } catch (error) {
      logger.error('AI enhancement failed:', error);
      return baseAnswer;
    }
  }

  /**
   * Extract related topics from search results
   */
  private extractRelatedTopics(results: Array<{type: 'vector' | 'static'; data: any}>): string[] {
    const topics = new Set<string>();

    for (const result of results) {
      if (result.type === 'static') {
        const entry = result.data as KnowledgeEntry;
        entry.topics.forEach(topic => topics.add(topic));
      } else {
        const vectorData = result.data as VectorSearchResult;
        if (vectorData.metadata.section) {
          topics.add(vectorData.metadata.section);
        }
      }
    }

    return Array.from(topics).slice(0, 5);
  }

  /**
   * Create fallback response for unmatched queries
   */
  private createFallbackResponse(query: string, languageResult: LanguageDetectionResult): SmartResponse {
    const isHebrew = languageResult.language === 'hebrew';

    const fallbackMessage = isHebrew
      ? 'מצטער, לא מצאתי מידע ספציפי על השאלה שלך. אנא נסה לנסח את השאלה אחרת או פנה לתמיכה טכנית של WeSign.'
      : 'I apologize, but I could not find specific information about your question. Please try rephrasing your question or contact WeSign technical support.';

    return {
      answer: fallbackMessage,
      confidence: 0.3,
      sources: 0,
      executionTime: 0,
      language: languageResult.language,
      recommendations: isHebrew
        ? ['נסה שאלה יותר ספציפית', 'פנה לתמיכה טכנית', 'עיין במדריך המשתמש']
        : ['Try a more specific question', 'Contact technical support', 'Check the user manual']
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(query: string, error: Error): SmartResponse {
    logger.error('Creating error response:', error);

    return {
      answer: 'An error occurred while processing your query. Please try again.',
      confidence: 0.1,
      sources: 0,
      executionTime: 0,
      language: 'english'
    };
  }

  /**
   * Initialize bilingual keyword mappings for better cross-language search
   */
  private initializeBilingualMappings(): void {
    const mappings: [string, string[]][] = [
      // Contact management
      ['contact', ['קשר', 'איש קשר', 'אנשי קשר']],
      ['קשר', ['contact', 'contacts']],
      ['add', ['הוסף', 'הוספה', 'יצירה']],
      ['הוסף', ['add', 'create', 'new']],

      // Document management
      ['document', ['מסמך', 'מסמכים']],
      ['מסמך', ['document', 'documents', 'file']],
      ['upload', ['העלה', 'העלאה']],
      ['העלה', ['upload', 'load']],

      // Signing process
      ['sign', ['חתום', 'חתימה']],
      ['חתימה', ['sign', 'signature', 'signing']],
      ['signature', ['חתימה', 'חתימות']],

      // Template management
      ['template', ['תבנית', 'תבניות']],
      ['תבנית', ['template', 'templates']],

      // System terms
      ['system', ['מערכת']],
      ['מערכת', ['system', 'platform']],
      ['user', ['משתמש', 'משתמשים']],
      ['משתמש', ['user', 'users']],

      // Actions
      ['edit', ['ערוך', 'עריכה']],
      ['ערוך', ['edit', 'modify', 'change']],
      ['delete', ['מחק', 'מחיקה']],
      ['מחק', ['delete', 'remove']],
      ['send', ['שלח', 'שליחה']],
      ['שלח', ['send', 'submit']]
    ];

    for (const [key, values] of mappings) {
      this.bilingualMappings.set(key.toLowerCase(), values.map(v => v.toLowerCase()));
    }
  }

  /**
   * Initialize static knowledge base with bilingual content
   */
  private initializeKnowledgeBase(): void {
    this.knowledgeBase = [
      {
        id: 'contact_management',
        topics: ['contacts', 'add contact', 'איש קשר', 'הוספת איש קשר', 'contact management', 'ניהול קשרים'],
        keywords: ['contact', 'add', 'create', 'איש', 'קשר', 'הוסף', 'הוספה', 'יצירת', 'ניהול'],
        responses: {
          hebrew: 'להוספת איש קשר חדש ב-WeSign:\n\n1. היכנס למערכת WeSign\n2. לחץ על "אנשי קשר" בתפריט הראשי\n3. לחץ על כפתור "הוסף איש קשר" (+)\n4. מלא את הפרטים הנדרשים:\n   - שם מלא\n   - כתובת אימייל\n   - מספר טלפון (אופציונלי)\n   - ארגון (אופציונלי)\n5. לחץ על "שמור"\n\nהאיש קשר יתווסף לרשימה ויוכל לקבל מסמכים לחתימה.',
          english: 'To add a new contact in WeSign:\n\n1. Log into your WeSign account\n2. Click on "Contacts" in the main menu\n3. Click the "Add Contact" button (+)\n4. Fill in the required information:\n   - Full name\n   - Email address\n   - Phone number (optional)\n   - Organization (optional)\n5. Click "Save"\n\nThe contact will be added to your list and can receive documents for signing.'
        },
        confidence: 0.95,
        followUpQuestions: {
          hebrew: [
            'איך אני יכול לערוך איש קשר קיים?',
            'איך אני מחק איש קשר?',
            'איך אני מייבא אנשי קשר מקובץ Excel?'
          ],
          english: [
            'How do I edit an existing contact?',
            'How do I delete a contact?',
            'How do I import contacts from an Excel file?'
          ]
        },
        recommendations: {
          hebrew: [
            'הוסף אנשי קשר לפני שליחת מסמכים',
            'ארגן את אנשי הקשר בקבוצות לקלות ניהול',
            'וודא שכתובות האימייל נכונות'
          ],
          english: [
            'Add contacts before sending documents',
            'Organize contacts in groups for easier management',
            'Verify email addresses are correct'
          ]
        }
      },
      {
        id: 'document_signing',
        topics: ['signing', 'signature', 'document', 'חתימה', 'מסמך', 'חתימה דיגיטלית'],
        keywords: ['sign', 'signature', 'document', 'upload', 'חתימה', 'מסמך', 'העלאה', 'שליחה', 'דיגיטלי'],
        responses: {
          hebrew: 'תהליך חתימה על מסמכים ב-WeSign:\n\n1. הכנת המסמך:\n   - העלה קובץ PDF, Word או תמונה\n   - הוסף שדות חתימה ונתונים נדרשים\n\n2. שליחה לחתימה:\n   - בחר נמענים מרשימת אנשי הקשר\n   - הגדר סדר חתימה (אם נדרש)\n   - הוסף הודעה אישית\n\n3. מעקב וניהול:\n   - קבל התראות על סטטוס החתימה\n   - שלח תזכורות לחותמים\n   - הורד מסמך חתום\n\nהמערכת תומכת בחתימה דיגיטלית מאובטחת ומוכרת חוקית.',
          english: 'Document signing process in WeSign:\n\n1. Document preparation:\n   - Upload PDF, Word, or image files\n   - Add signature fields and required data\n\n2. Send for signing:\n   - Select recipients from your contacts\n   - Set signing order (if required)\n   - Add personal message\n\n3. Track and manage:\n   - Receive status notifications\n   - Send reminders to signers\n   - Download signed document\n\nThe system supports secure digital signatures that are legally recognized.'
        },
        confidence: 0.9,
        followUpQuestions: {
          hebrew: [
            'איך אני יכול לבטל תהליך חתימה?',
            'מה הסטטוסים השונים של מסמך?',
            'איך אני מוסיף שדות חתימה מרובים?'
          ],
          english: [
            'How can I cancel a signing process?',
            'What are the different document statuses?',
            'How do I add multiple signature fields?'
          ]
        },
        recommendations: {
          hebrew: [
            'בדוק את המסמך לפני השליחה',
            'הגדר סדר חתימה ברור',
            'השתמש בהודעות מותאמות אישית'
          ],
          english: [
            'Review the document before sending',
            'Set a clear signing order',
            'Use personalized messages'
          ]
        }
      },
      {
        id: 'template_management',
        topics: ['templates', 'template', 'תבניות', 'תבנית', 'template creation'],
        keywords: ['template', 'templates', 'create', 'תבנית', 'תבניות', 'יצירה', 'שימוש'],
        responses: {
          hebrew: 'ניהול תבניות ב-WeSign:\n\n1. יצירת תבנית:\n   - בחר "תבניות" מהתפריט\n   - לחץ "צור תבנית חדשה"\n   - העלה מסמך בסיס\n   - הוסף שדות קבועים (חתימה, תאריך, טקסט)\n\n2. שימוש בתבנית:\n   - בחר תבנית קיימת\n   - התאם פרטים ספציפיים\n   - שלח לחתימה\n\nתבניות חוסכות זמן ומבטיחות עקביות.',
          english: 'Template management in WeSign:\n\n1. Create template:\n   - Select "Templates" from menu\n   - Click "Create New Template"\n   - Upload base document\n   - Add fixed fields (signature, date, text)\n\n2. Use template:\n   - Select existing template\n   - Customize specific details\n   - Send for signing\n\nTemplates save time and ensure consistency.'
        },
        confidence: 0.85,
        followUpQuestions: {
          hebrew: [
            'איך אני עורך תבנית קיימת?',
            'איך אני משתף תבנית עם צוות?',
            'איך אני מגדיר שדות חובה בתבנית?'
          ],
          english: [
            'How do I edit an existing template?',
            'How do I share a template with my team?',
            'How do I set required fields in a template?'
          ]
        },
        recommendations: {
          hebrew: [
            'צור תבניות לתהליכים חוזרים',
            'השתמש בשמות תבניות ברורים',
            'בדוק תבניות לפני שימוש ראשון'
          ],
          english: [
            'Create templates for recurring processes',
            'Use clear template names',
            'Test templates before first use'
          ]
        }
      },
      {
        id: 'document_fields',
        topics: ['fields', 'document fields', 'שדות', 'שדות במסמך', 'field types', 'סוגי שדות'],
        keywords: ['field', 'fields', 'add', 'שדות', 'שדה', 'הוסף', 'סוג', 'type', 'signature', 'text', 'date', 'checkbox'],
        responses: {
          hebrew: 'שדות שניתן להוסיף למסמך ב-WeSign:\n\n📝 **שדות טקסט:**\n   • שדה טקסט רגיל - לכתיבת טקסט חופשי\n   • שדה שם מלא - לחתימה וזיהוי\n   • שדה אימייל - לכתובת אימייל\n   • שדה תאריך - לבחירת תאריך\n\n✍️ **שדות חתימה:**\n   • חתימה דיגיטלית - חתימה מאובטחת\n   • ראשי תיבות - חתימה מקוצרת\n   • חותמת - חותמת ארגונית\n\n☑️ **שדות אינטראקטיביים:**\n   • תיבת סימון - כן/לא\n   • כפתורי רדיו - בחירה מרובה\n   • רשימה נפתחת - בחירה מרשימה\n   • שדה מספר - מספרים בלבד\n\n📄 **שדות נוספים:**\n   • שדה תמונה - העלאת תמונה\n   • שדה קובץ - צירוף קובץ\n   • שדה חישוב - חישובים אוטומטיים',
          english: 'Fields you can add to a WeSign document:\n\n📝 **Text Fields:**\n   • Text field - for free text input\n   • Full name field - for signature and identification\n   • Email field - for email address\n   • Date field - for date selection\n\n✍️ **Signature Fields:**\n   • Digital signature - secure signature\n   • Initials - abbreviated signature\n   • Stamp - organizational stamp\n\n☑️ **Interactive Fields:**\n   • Checkbox - yes/no options\n   • Radio buttons - multiple choice\n   • Dropdown list - selection from list\n   • Number field - numbers only\n\n📄 **Additional Fields:**\n   • Image field - image upload\n   • File field - file attachment\n   • Calculation field - automatic calculations'
        },
        confidence: 0.95,
        followUpQuestions: {
          hebrew: [
            'איך אני מגדיר שדה כחובה?',
            'איך אני משנה גודל של שדה?',
            'איך אני מחק שדה מהמסמך?'
          ],
          english: [
            'How do I make a field required?',
            'How do I resize a field?',
            'How do I delete a field from the document?'
          ]
        },
        recommendations: {
          hebrew: [
            'השתמש בשמות שדות ברורים ומובנים',
            'סמן שדות חשובים כחובה',
            'בדוק את מיקום השדות לפני שליחה'
          ],
          english: [
            'Use clear and understandable field names',
            'Mark important fields as required',
            'Check field placement before sending'
          ]
        }
      }
    ];
  }

  /**
   * Create cache key for response caching with normalization
   */
  private createCacheKey(query: string): string {
    // Normalize query for better cache hits
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')  // Multiple spaces to single space
      .replace(/[?,!.]+$/g, ''); // Remove trailing punctuation

    return Buffer.from(normalized).toString('base64').substring(0, 32);
  }

  /**
   * Evict old cache entries using LRU + expired entries
   */
  private evictOldCacheEntries(): void {
    const now = Date.now();

    // First, remove expired entries
    for (const [key, entry] of this.responseCache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL_MS) {
        this.responseCache.delete(key);
      }
    }

    // If still too large, remove least recently used entries
    if (this.responseCache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.responseCache.entries());
      // Sort by timestamp (oldest first) then by hits (least used first)
      entries.sort((a, b) => {
        const timeDiff = a[1].timestamp - b[1].timestamp;
        return timeDiff !== 0 ? timeDiff : a[1].hits - b[1].hits;
      });

      // Remove oldest entries
      const toRemove = entries.slice(0, this.responseCache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => this.responseCache.delete(key));

      logger.debug('Cache eviction completed', {
        removedEntries: toRemove.length,
        currentSize: this.responseCache.size
      });
    }
  }

  /**
   * Clear response cache
   */
  clearCache(): void {
    this.responseCache.clear();
    this.cacheStats = { hits: 0, misses: 0, size: 0 };
    logger.info('Response cache cleared');
  }

  /**
   * Get enhanced cache statistics
   */
  getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
    avgHitsPerEntry: number;
    keys: string[];
  } {
    const totalRequests = this.cacheStats.hits + this.cacheStats.misses;
    const hitRate = totalRequests > 0 ? (this.cacheStats.hits / totalRequests) : 0;

    const entries = Array.from(this.responseCache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const avgHitsPerEntry = entries.length > 0 ? (totalHits / entries.length) : 0;

    return {
      size: this.responseCache.size,
      hits: this.cacheStats.hits,
      misses: this.cacheStats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests,
      avgHitsPerEntry: Math.round(avgHitsPerEntry * 100) / 100,
      keys: Array.from(this.responseCache.keys())
    };
  }

  /**
   * Get knowledge base statistics
   */
  getStats(): {
    knowledgeBaseSize: number;
    cacheSize: number;
    totalTopics: number;
    supportedLanguages: string[];
    lastUpdated: string;
  } {
    const allTopics = new Set<string>();

    for (const entry of this.knowledgeBase) {
      entry.topics.forEach(topic => allTopics.add(topic));
    }

    return {
      knowledgeBaseSize: this.knowledgeBase.length,
      cacheSize: this.responseCache.size,
      totalTopics: allTopics.size,
      supportedLanguages: ['hebrew', 'english'],
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Main chat interface - compatible with existing API
   */
  async chat(question: string, language?: string): Promise<any> {
    try {
      const response = await this.processQuery(question);

      return {
        success: true,
        answer: response.answer,
        confidence: response.confidence,
        sources: response.sources,
        executionTime: response.executionTime,
        language: response.language,
        recommendations: response.recommendations,
        followUpQuestions: response.followUpQuestions,
        relatedTopics: response.relatedTopics,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Chat processing failed:', error);

      return {
        success: false,
        answer: 'I apologize, but I encountered an error processing your question. Please try again.',
        confidence: 0.1,
        sources: 0,
        executionTime: 0,
        language: language || 'english',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

export default SmartWeSignKnowledge;