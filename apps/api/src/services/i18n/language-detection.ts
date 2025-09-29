import { ChatOpenAI } from '@langchain/openai';
import { logger } from '@/utils/logger';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  dialect?: string;
  script?: string;
  region?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  direction: 'ltr' | 'rtl';
  region?: string;
  testAutomationSupport: boolean;
}

// Supported languages for WeSign platform
export const SUPPORTED_LANGUAGES: Record<string, SupportedLanguage> = {
  'en': {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    direction: 'ltr',
    region: 'US',
    testAutomationSupport: true
  },
  'he': {
    code: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    script: 'Hebrew',
    direction: 'rtl',
    region: 'IL',
    testAutomationSupport: true
  },
  'ar': {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    script: 'Arabic',
    direction: 'rtl',
    testAutomationSupport: true
  },
  'es': {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'fr': {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'de': {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'it': {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'pt': {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'ru': {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    script: 'Cyrillic',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'zh': {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    script: 'Simplified Chinese',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'ja': {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    script: 'Hiragana/Katakana/Kanji',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'ko': {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    script: 'Hangul',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'hi': {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'th': {
    code: 'th',
    name: 'Thai',
    nativeName: 'ไทย',
    script: 'Thai',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'vi': {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'tr': {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'pl': {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'nl': {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'sv': {
    code: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'da': {
    code: 'da',
    name: 'Danish',
    nativeName: 'Dansk',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'no': {
    code: 'no',
    name: 'Norwegian',
    nativeName: 'Norsk',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  },
  'fi': {
    code: 'fi',
    name: 'Finnish',
    nativeName: 'Suomi',
    script: 'Latin',
    direction: 'ltr',
    testAutomationSupport: true
  }
};

export class LanguageDetectionService {
  private llm: ChatOpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('placeholder')) {
      this.llm = new ChatOpenAI({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'gpt-4o',
        temperature: 0.1,
        maxTokens: 1000
      });
    }
  }

  /**
   * Detect the language of given text using AI
   */
  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    try {
      // Fallback pattern-based detection if AI is not available
      if (!this.llm) {
        return this.patternBasedDetection(text);
      }

      const prompt = `
Analyze the following text and determine its language. Provide your analysis in JSON format:

Text: "${text.substring(0, 500)}"

Respond with JSON containing:
- language: ISO 639-1 language code (e.g., "en", "he", "ar", "es")
- confidence: confidence score from 0.0 to 1.0
- dialect: specific dialect if detected (optional)
- script: writing system (e.g., "Latin", "Hebrew", "Arabic", "Cyrillic")
- region: likely region code if applicable (optional)

Focus on languages supported by digital signature platforms: English, Hebrew, Arabic, Spanish, French, German, Italian, Portuguese, Russian, Chinese, Japanese, Korean, Hindi, Thai, Vietnamese, Turkish, Polish, Dutch, Swedish, Danish, Norwegian, Finnish.
      `;

      const response = await this.llm.invoke(prompt);
      const result = JSON.parse(response.content.toString());

      // Validate the result
      if (!result.language || !result.confidence) {
        throw new Error('Invalid AI response format');
      }

      return {
        language: result.language,
        confidence: Math.min(Math.max(result.confidence, 0), 1),
        dialect: result.dialect,
        script: result.script,
        region: result.region
      };

    } catch (error) {
      logger.warn('AI language detection failed, falling back to pattern-based:', error);
      return this.patternBasedDetection(text);
    }
  }

  /**
   * Pattern-based language detection as fallback
   */
  private patternBasedDetection(text: string): LanguageDetectionResult {
    const sample = text.substring(0, 200).toLowerCase();

    // Hebrew detection
    if (/[\u0590-\u05FF]/.test(text)) {
      return {
        language: 'he',
        confidence: 0.9,
        script: 'Hebrew',
        region: 'IL'
      };
    }

    // Arabic detection
    if (/[\u0600-\u06FF]/.test(text)) {
      return {
        language: 'ar',
        confidence: 0.9,
        script: 'Arabic'
      };
    }

    // Chinese detection
    if (/[\u4e00-\u9fff]/.test(text)) {
      return {
        language: 'zh',
        confidence: 0.85,
        script: 'Simplified Chinese'
      };
    }

    // Japanese detection
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) {
      return {
        language: 'ja',
        confidence: 0.85,
        script: 'Hiragana/Katakana'
      };
    }

    // Korean detection
    if (/[\uac00-\ud7af]/.test(text)) {
      return {
        language: 'ko',
        confidence: 0.85,
        script: 'Hangul'
      };
    }

    // Russian/Cyrillic detection
    if (/[\u0400-\u04FF]/.test(text)) {
      return {
        language: 'ru',
        confidence: 0.8,
        script: 'Cyrillic'
      };
    }

    // Spanish indicators
    if (/\b(el|la|de|que|y|en|un|es|se|no|te|lo|le|da|su|por|son|con|para|este|está|todo|pero|más|hacer|ser|puede|dónde|tiempo|persona|año|vez|señor|muy|hasta|deben|aquí|también|después|primera|mucho|ante|querer|saber|pasado|cómo|algo|tanto|nuevo|creer|tal|vida|ir|nacional|otros|decir|parte|grande|incluso|aunque|durante|poder|acabar|sistema|público|algún|mismo|llegar|resultar|pues|mil|realizar|momento|sin|cada|menos|casa|conocer|curso|particular|trabajo|lado|medio|historia|país|razón|llegar)\b/.test(sample)) {
      return {
        language: 'es',
        confidence: 0.7,
        script: 'Latin'
      };
    }

    // French indicators
    if (/\b(le|de|et|à|un|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas|tout|plus|par|grand|le|ce|lui|ou|elle|très|comme|autre|son|chaque|fois|depuis|entre|quelque|chose|pendant|nouveau|année|jour|mois|année|temps|moment|place|pays|maison|homme|femme|enfant|école|ville|même|aussi|encore|déjà|toujours|jamais|souvent|puis|alors|donc|enfin|voici|voilà)\b/.test(sample)) {
      return {
        language: 'fr',
        confidence: 0.7,
        script: 'Latin'
      };
    }

    // German indicators
    if (/\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|eine|als|auch|es|an|werden|aus|er|hat|dass|sie|nach|wird|bei|einer|um|am|sind|noch|wie|einem|über|einen|so|zum|war|haben|nur|oder|aber|vor|zur|bis|unter|während|man|kann|soll|ich|wenn|schon|mehr)\b/.test(sample)) {
      return {
        language: 'de',
        confidence: 0.7,
        script: 'Latin'
      };
    }

    // Italian indicators
    if (/\b(il|la|di|che|e|da|in|un|a|per|non|una|su|con|le|si|lo|come|del|della|questo|alla|nel|anche|se|gli|più|essere|tutto|fare|molto|anni|dire|grande|stesso|altro|mai|suo|dopo|vita|tempo|lei|mio|solo|prima|poi|bene|casa|dove|quando|ancora|tanto|quale|mentre|sempre|però|tutti)\b/.test(sample)) {
      return {
        language: 'it',
        confidence: 0.7,
        script: 'Latin'
      };
    }

    // Default to English
    return {
      language: 'en',
      confidence: 0.6,
      script: 'Latin',
      region: 'US'
    };
  }

  /**
   * Detect multiple languages in mixed content
   */
  async detectMultipleLanguages(text: string): Promise<LanguageDetectionResult[]> {
    try {
      if (!this.llm) {
        const primary = this.patternBasedDetection(text);
        return [primary];
      }

      const prompt = `
Analyze the following text and identify ALL languages present. The text may contain multiple languages.

Text: "${text.substring(0, 1000)}"

Respond with a JSON array of language detections, each containing:
- language: ISO 639-1 language code
- confidence: confidence score from 0.0 to 1.0
- portion: estimated percentage of text in this language (0-100)
- script: writing system

Sort by confidence score (highest first).
      `;

      const response = await this.llm.invoke(prompt);
      const results = JSON.parse(response.content.toString());

      if (!Array.isArray(results)) {
        return [await this.detectLanguage(text)];
      }

      return results.map((result: any) => ({
        language: result.language,
        confidence: Math.min(Math.max(result.confidence, 0), 1),
        script: result.script,
        dialect: result.dialect,
        region: result.region
      }));

    } catch (error) {
      logger.warn('Multi-language detection failed:', error);
      return [await this.detectLanguage(text)];
    }
  }

  /**
   * Check if a language is supported for test automation
   */
  isLanguageSupported(languageCode: string): boolean {
    const language = SUPPORTED_LANGUAGES[languageCode];
    return language ? language.testAutomationSupport : false;
  }

  /**
   * Get language information
   */
  getLanguageInfo(languageCode: string): SupportedLanguage | null {
    return SUPPORTED_LANGUAGES[languageCode] || null;
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Object.values(SUPPORTED_LANGUAGES);
  }

  /**
   * Generate localization recommendations for test automation
   */
  async generateLocalizationRecommendations(
    detectedLanguages: LanguageDetectionResult[],
    testContext: string
  ): Promise<string[]> {
    try {
      if (!this.llm) {
        return this.getBasicRecommendations(detectedLanguages);
      }

      const languageList = detectedLanguages
        .map(lang => `${lang.language} (${lang.confidence * 100}% confidence)`)
        .join(', ');

      const prompt = `
Generate test automation localization recommendations for a WeSign digital signature platform.

Detected Languages: ${languageList}
Test Context: "${testContext}"

Provide specific, actionable recommendations for:
1. Locale-specific test data
2. UI element localization testing
3. Text direction and layout considerations
4. Cultural considerations for digital signatures
5. Browser/OS language settings for testing
6. Error message translations
7. Date/time format testing
8. Currency and number format testing

Focus on practical WeSign testing scenarios and return as a JSON array of recommendation strings.
      `;

      const response = await this.llm.invoke(prompt);
      const recommendations = JSON.parse(response.content.toString());

      return Array.isArray(recommendations) ? recommendations : this.getBasicRecommendations(detectedLanguages);

    } catch (error) {
      logger.warn('Failed to generate AI recommendations:', error);
      return this.getBasicRecommendations(detectedLanguages);
    }
  }

  private getBasicRecommendations(detectedLanguages: LanguageDetectionResult[]): string[] {
    const recommendations: string[] = [];

    for (const lang of detectedLanguages) {
      const langInfo = this.getLanguageInfo(lang.language);
      if (!langInfo) continue;

      recommendations.push(`Test UI elements in ${langInfo.name} (${langInfo.nativeName})`);

      if (langInfo.direction === 'rtl') {
        recommendations.push(`Verify right-to-left text alignment for ${langInfo.name}`);
        recommendations.push(`Test layout mirroring for RTL languages like ${langInfo.name}`);
      }

      recommendations.push(`Validate ${langInfo.name} character encoding and display`);
      recommendations.push(`Test browser language settings for ${langInfo.name}`);

      if (langInfo.script !== 'Latin') {
        recommendations.push(`Verify non-Latin script rendering for ${langInfo.name} (${langInfo.script})`);
      }
    }

    return recommendations;
  }
}

export default LanguageDetectionService;