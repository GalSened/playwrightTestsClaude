import { logger } from '@/utils/logger';

export interface LanguageDetectionResult {
  language: 'hebrew' | 'english' | 'mixed';
  confidence: number;
  patterns: {
    hebrew: number;
    english: number;
    mixed: number;
  };
  details: {
    hebrewChars: number;
    englishChars: number;
    totalChars: number;
    hebrewWords: number;
    englishWords: number;
    mixedPatterns: number;
  };
}

/**
 * Advanced Language Processor with robust Hebrew detection
 * Fixes critical Hebrew processing failures in the original system
 */
export class AdvancedLanguageProcessor {
  private readonly hebrewUnicodeStart = 0x0590;
  private readonly hebrewUnicodeEnd = 0x05FF;

  // Enhanced Hebrew patterns with proper Unicode handling
  private readonly hebrewPatterns = {
    // Question words - properly escaped for Hebrew
    questionWords: /\b(?:איך|מה|כיצד|למה|מתי|איפה|מי|האם|מדוע)\b/gu,

    // WeSign specific Hebrew terms
    wesignTerms: /\b(?:קשר|מסמך|תבנית|חתימה|משתמש|דוח|מערכת|חתום|העלאה|הורדה)\b/gu,

    // Hebrew action verbs
    actionVerbs: /\b(?:להוסיף|לערוך|למחוק|לשלוח|לחתום|להעלות|ליצור|לפתוח|לסגור)\b/gu,

    // Compound Hebrew terms for WeSign
    compoundTerms: /\b(?:איש\s+קשר|אנשי\s+קשר|מסמכים|תבניות|חתימות|דוח\s+מפורט)\b/gu,

    // Hebrew with platform integration
    platformIntegration: /\b(?:ב-?WeSign|במערכת|לחותמים|הנמענים|בפלטפורמה)\b/gu
  };

  private readonly englishPatterns = {
    // Question words
    questionWords: /\b(?:how|what|when|where|why|who|can|do|does|will|would|should)\b/gi,

    // WeSign specific English terms
    wesignTerms: /\b(?:contact|document|template|sign|user|report|system|signature|upload|download)\b/gi,

    // Action verbs
    actionVerbs: /\b(?:add|edit|delete|send|create|upload|download|open|close|save)\b/gi,

    // Plurals
    plurals: /\b(?:contacts|documents|templates|signatures|users|reports|files)\b/gi,

    // Platform specific
    platformTerms: /\b(?:WeSign|signing|signer|recipient|workflow|dashboard|account)\b/gi
  };

  private readonly mixedPatterns = {
    // Platform name with Hebrew
    platformHebrew: /(?:WeSign.*[\u0590-\u05FF]|[\u0590-\u05FF].*WeSign)/gu,

    // Technical terms with Hebrew
    techHebrew: /\b(?:API|URL|JSON|HTTP|PDF|XML|HTML).*[\u0590-\u05FF]/gu,

    // Hebrew with technical terms
    hebrewTech: /[\u0590-\u05FF].*\b(?:API|URL|JSON|HTTP|PDF|XML|HTML)\b/gu,

    // Email patterns with Hebrew
    emailHebrew: /[\u0590-\u05FF].*@.*\.com|@.*\.com.*[\u0590-\u05FF]/gu
  };

  /**
   * Advanced language detection with proper Unicode handling
   */
  detectLanguage(text: string): LanguageDetectionResult {
    if (!text || text.trim().length === 0) {
      return this.createDefaultResult();
    }

    const cleanText = text.trim();

    // Character-level analysis with proper Unicode handling
    const charAnalysis = this.analyzeCharacters(cleanText);

    // Pattern-based analysis
    const patternAnalysis = this.analyzePatterns(cleanText);

    // Word-level analysis
    const wordAnalysis = this.analyzeWords(cleanText);

    // Combine all analysis results
    const result = this.combineAnalysisResults(charAnalysis, patternAnalysis, wordAnalysis);

    logger.info('Advanced language detection completed', {
      text: text.substring(0, 50) + '...',
      detected: result.language,
      confidence: result.confidence,
      details: result.details
    });

    return result;
  }

  /**
   * Analyze character composition with proper Unicode handling
   */
  private analyzeCharacters(text: string): {
    hebrewChars: number;
    englishChars: number;
    totalChars: number;
    hebrewRatio: number;
    englishRatio: number;
  } {
    let hebrewChars = 0;
    let englishChars = 0;

    // Iterate through each character with proper Unicode handling
    for (const char of text) {
      const codePoint = char.codePointAt(0);
      if (codePoint) {
        if (codePoint >= this.hebrewUnicodeStart && codePoint <= this.hebrewUnicodeEnd) {
          hebrewChars++;
        } else if (/[a-zA-Z]/.test(char)) {
          englishChars++;
        }
      }
    }

    const totalChars = hebrewChars + englishChars;
    const hebrewRatio = totalChars > 0 ? hebrewChars / totalChars : 0;
    const englishRatio = totalChars > 0 ? englishChars / totalChars : 0;

    return {
      hebrewChars,
      englishChars,
      totalChars,
      hebrewRatio,
      englishRatio
    };
  }

  /**
   * Analyze patterns with improved matching
   */
  private analyzePatterns(text: string): {
    hebrewScore: number;
    englishScore: number;
    mixedScore: number;
  } {
    const hebrewScore = this.calculatePatternScore(text, Object.values(this.hebrewPatterns));
    const englishScore = this.calculatePatternScore(text, Object.values(this.englishPatterns));
    const mixedScore = this.calculatePatternScore(text, Object.values(this.mixedPatterns));

    return { hebrewScore, englishScore, mixedScore };
  }

  /**
   * Word-level analysis for better context understanding
   */
  private analyzeWords(text: string): {
    hebrewWords: number;
    englishWords: number;
    totalWords: number;
  } {
    const words = text.split(/\s+/).filter(word => word.trim().length > 0);
    let hebrewWords = 0;
    let englishWords = 0;

    for (const word of words) {
      const hasHebrew = /[\u0590-\u05FF]/.test(word);
      const hasEnglish = /[a-zA-Z]/.test(word);

      if (hasHebrew && !hasEnglish) {
        hebrewWords++;
      } else if (hasEnglish && !hasHebrew) {
        englishWords++;
      }
      // Mixed words don't count towards either language
    }

    return {
      hebrewWords,
      englishWords,
      totalWords: words.length
    };
  }

  /**
   * Improved pattern score calculation
   */
  private calculatePatternScore(text: string, patterns: RegExp[]): number {
    let totalMatches = 0;
    let totalPossibleMatches = 0;

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        totalMatches += matches.length;
      }
      totalPossibleMatches += 1; // Each pattern could potentially match once
    }

    return totalPossibleMatches > 0 ? totalMatches / totalPossibleMatches : 0;
  }

  /**
   * Combine all analysis results with intelligent weighting
   */
  private combineAnalysisResults(
    charAnalysis: any,
    patternAnalysis: any,
    wordAnalysis: any
  ): LanguageDetectionResult {
    // Weighted scoring system
    const weights = {
      characters: 0.4,  // Character-level analysis is most reliable
      patterns: 0.4,    // Pattern matching for domain-specific terms
      words: 0.2        // Word-level analysis for context
    };

    // Calculate weighted scores
    const hebrewScore =
      (charAnalysis.hebrewRatio * weights.characters) +
      (patternAnalysis.hebrewScore * weights.patterns) +
      ((wordAnalysis.hebrewWords / Math.max(wordAnalysis.totalWords, 1)) * weights.words);

    const englishScore =
      (charAnalysis.englishRatio * weights.characters) +
      (patternAnalysis.englishScore * weights.patterns) +
      ((wordAnalysis.englishWords / Math.max(wordAnalysis.totalWords, 1)) * weights.words);

    const mixedScore = patternAnalysis.mixedScore * 0.8; // Mixed patterns are strong indicators

    // Determine language with confidence
    let language: 'hebrew' | 'english' | 'mixed';
    let confidence: number;

    if (mixedScore > 0.2) {
      language = 'mixed';
      confidence = Math.min(0.95, mixedScore + 0.1);
    } else if (hebrewScore > englishScore && hebrewScore > 0.15) {
      language = 'hebrew';
      confidence = Math.min(0.95, hebrewScore + 0.05);
    } else if (englishScore > hebrewScore && englishScore > 0.15) {
      language = 'english';
      confidence = Math.min(0.95, englishScore + 0.05);
    } else {
      // Fallback to character-based detection with higher thresholds
      if (charAnalysis.hebrewRatio > 0.7) {
        language = 'hebrew';
        confidence = charAnalysis.hebrewRatio;
      } else if (charAnalysis.englishRatio > 0.7) {
        language = 'english';
        confidence = charAnalysis.englishRatio;
      } else {
        language = 'mixed';
        confidence = 0.6;
      }
    }

    return {
      language,
      confidence,
      patterns: {
        hebrew: hebrewScore,
        english: englishScore,
        mixed: mixedScore
      },
      details: {
        hebrewChars: charAnalysis.hebrewChars,
        englishChars: charAnalysis.englishChars,
        totalChars: charAnalysis.totalChars,
        hebrewWords: wordAnalysis.hebrewWords,
        englishWords: wordAnalysis.englishWords,
        mixedPatterns: patternAnalysis.mixedScore
      }
    };
  }

  private createDefaultResult(): LanguageDetectionResult {
    return {
      language: 'english',
      confidence: 0.5,
      patterns: { hebrew: 0, english: 0, mixed: 0 },
      details: {
        hebrewChars: 0,
        englishChars: 0,
        totalChars: 0,
        hebrewWords: 0,
        englishWords: 0,
        mixedPatterns: 0
      }
    };
  }
}

export default AdvancedLanguageProcessor;