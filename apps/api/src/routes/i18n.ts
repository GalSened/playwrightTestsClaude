import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import LanguageDetectionService, {
  SUPPORTED_LANGUAGES,
  LanguageDetectionResult
} from '@/services/i18n/language-detection';

const router = Router();

/**
 * POST /api/i18n/detect-language
 * Detect the language of provided text
 */
router.post('/detect-language', async (req: Request, res: Response) => {
  try {
    const { text, detectMultiple = false } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text parameter is required and must be a string'
      });
    }

    if (text.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'text length cannot exceed 10,000 characters'
      });
    }

    const languageService = new LanguageDetectionService();

    let results: LanguageDetectionResult[] = [];

    if (detectMultiple) {
      results = await languageService.detectMultipleLanguages(text);
    } else {
      const singleResult = await languageService.detectLanguage(text);
      results = [singleResult];
    }

    // Enrich results with language information
    const enrichedResults = results.map(result => ({
      ...result,
      languageInfo: languageService.getLanguageInfo(result.language),
      isSupported: languageService.isLanguageSupported(result.language)
    }));

    res.json({
      success: true,
      results: enrichedResults,
      primaryLanguage: enrichedResults[0],
      multipleLanguages: enrichedResults.length > 1,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Language detection failed:', error);
    res.status(500).json({
      success: false,
      error: 'Language detection failed'
    });
  }
});

/**
 * GET /api/i18n/supported-languages
 * Get list of all supported languages
 */
router.get('/supported-languages', (req: Request, res: Response) => {
  try {
    const languageService = new LanguageDetectionService();
    const languages = languageService.getSupportedLanguages();

    // Group by script for better organization
    const groupedByScript = languages.reduce((acc, lang) => {
      if (!acc[lang.script]) {
        acc[lang.script] = [];
      }
      acc[lang.script].push(lang);
      return acc;
    }, {} as Record<string, typeof languages>);

    // Count by text direction
    const rtlCount = languages.filter(lang => lang.direction === 'rtl').length;
    const ltrCount = languages.filter(lang => lang.direction === 'ltr').length;

    res.json({
      success: true,
      languages,
      groupedByScript,
      statistics: {
        total: languages.length,
        withTestSupport: languages.filter(lang => lang.testAutomationSupport).length,
        rtlLanguages: rtlCount,
        ltrLanguages: ltrCount,
        scripts: Object.keys(groupedByScript).length
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get supported languages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported languages'
    });
  }
});

/**
 * POST /api/i18n/test-recommendations
 * Generate localization testing recommendations
 */
router.post('/test-recommendations', async (req: Request, res: Response) => {
  try {
    const { text, testContext = '', targetLanguages = [] } = req.body;

    if (!text && targetLanguages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Either text for detection or targetLanguages array is required'
      });
    }

    const languageService = new LanguageDetectionService();
    let detectedLanguages: LanguageDetectionResult[] = [];

    // If text is provided, detect languages
    if (text) {
      detectedLanguages = await languageService.detectMultipleLanguages(text);
    }

    // Add target languages if specified
    if (targetLanguages.length > 0) {
      for (const langCode of targetLanguages) {
        if (languageService.isLanguageSupported(langCode)) {
          detectedLanguages.push({
            language: langCode,
            confidence: 1.0,
            script: languageService.getLanguageInfo(langCode)?.script || 'Unknown'
          });
        }
      }
    }

    // Remove duplicates
    const uniqueLanguages = detectedLanguages.filter((lang, index, arr) =>
      arr.findIndex(l => l.language === lang.language) === index
    );

    // Generate recommendations
    const recommendations = await languageService.generateLocalizationRecommendations(
      uniqueLanguages,
      testContext
    );

    // Categorize recommendations
    const categorizedRecommendations = {
      ui: recommendations.filter(rec => rec.toLowerCase().includes('ui') || rec.toLowerCase().includes('element')),
      layout: recommendations.filter(rec => rec.toLowerCase().includes('layout') || rec.toLowerCase().includes('alignment')),
      data: recommendations.filter(rec => rec.toLowerCase().includes('data') || rec.toLowerCase().includes('format')),
      browser: recommendations.filter(rec => rec.toLowerCase().includes('browser') || rec.toLowerCase().includes('setting')),
      cultural: recommendations.filter(rec => rec.toLowerCase().includes('cultural') || rec.toLowerCase().includes('signature')),
      encoding: recommendations.filter(rec => rec.toLowerCase().includes('encoding') || rec.toLowerCase().includes('character')),
      general: recommendations.filter(rec =>
        !rec.toLowerCase().includes('ui') &&
        !rec.toLowerCase().includes('layout') &&
        !rec.toLowerCase().includes('data') &&
        !rec.toLowerCase().includes('browser') &&
        !rec.toLowerCase().includes('cultural') &&
        !rec.toLowerCase().includes('encoding')
      )
    };

    // Generate test priority matrix
    const priorityMatrix = uniqueLanguages.map(lang => {
      const langInfo = languageService.getLanguageInfo(lang.language);
      let priority = 'medium';

      if (lang.confidence > 0.8) priority = 'high';
      else if (lang.confidence < 0.5) priority = 'low';

      if (langInfo?.direction === 'rtl') priority = 'high'; // RTL always high priority
      if (langInfo?.script !== 'Latin') priority = 'high'; // Non-Latin scripts high priority

      return {
        language: lang.language,
        languageInfo: langInfo,
        confidence: lang.confidence,
        priority,
        testComplexity: langInfo?.direction === 'rtl' ? 'high' :
                       langInfo?.script === 'Latin' ? 'low' : 'medium'
      };
    });

    res.json({
      success: true,
      detectedLanguages: uniqueLanguages,
      recommendations: {
        all: recommendations,
        categorized: categorizedRecommendations
      },
      priorityMatrix,
      testingStrategy: {
        highPriorityLanguages: priorityMatrix.filter(p => p.priority === 'high'),
        rtlLanguages: priorityMatrix.filter(p => p.languageInfo?.direction === 'rtl'),
        nonLatinScripts: priorityMatrix.filter(p => p.languageInfo?.script !== 'Latin'),
        recommendedTestOrder: priorityMatrix.sort((a, b) =>
          (b.priority === 'high' ? 2 : b.priority === 'medium' ? 1 : 0) -
          (a.priority === 'high' ? 2 : a.priority === 'medium' ? 1 : 0)
        )
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate test recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate test recommendations'
    });
  }
});

/**
 * GET /api/i18n/language-info/:code
 * Get detailed information about a specific language
 */
router.get('/language-info/:code', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const languageService = new LanguageDetectionService();

    const languageInfo = languageService.getLanguageInfo(code);

    if (!languageInfo) {
      return res.status(404).json({
        success: false,
        error: `Language '${code}' not supported`
      });
    }

    // Generate testing guidelines for this specific language
    const testingGuidelines = {
      textDirection: languageInfo.direction,
      scriptComplexity: languageInfo.script === 'Latin' ? 'low' :
                       languageInfo.script === 'Cyrillic' ? 'medium' : 'high',
      layoutConsiderations: languageInfo.direction === 'rtl' ? [
        'Test right-to-left text alignment',
        'Verify UI element mirroring',
        'Check scroll bar positioning',
        'Validate date/time display formats'
      ] : [
        'Standard left-to-right layout testing',
        'Character encoding validation',
        'Font rendering verification'
      ],
      browserSupport: {
        recommended: ['Chrome', 'Firefox', 'Safari', 'Edge'],
        osSettings: languageInfo.region ? [
          `Set OS locale to ${languageInfo.code}-${languageInfo.region}`,
          `Configure regional number/date formats`,
          `Test with local keyboard layouts`
        ] : [
          `Set OS locale to ${languageInfo.code}`,
          `Configure basic language settings`
        ]
      },
      commonTestCases: [
        'Login form validation messages',
        'Document upload error messages',
        'Signature workflow instructions',
        'Email notifications',
        'Date/time formatting',
        'Currency display (if applicable)'
      ]
    };

    res.json({
      success: true,
      language: languageInfo,
      isSupported: languageService.isLanguageSupported(code),
      testingGuidelines,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Failed to get language info for ${req.params.code}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to get language information'
    });
  }
});

/**
 * POST /api/i18n/validate-translations
 * Validate translations for WeSign UI elements
 */
router.post('/validate-translations', async (req: Request, res: Response) => {
  try {
    const { translations, sourceLanguage = 'en', validateKeys = [] } = req.body;

    if (!translations || typeof translations !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'translations object is required'
      });
    }

    const languageService = new LanguageDetectionService();
    const validationResults: Record<string, any> = {};

    for (const [langCode, texts] of Object.entries(translations)) {
      if (!languageService.isLanguageSupported(langCode)) {
        validationResults[langCode] = {
          isSupported: false,
          error: `Language ${langCode} is not supported`
        };
        continue;
      }

      const langInfo = languageService.getLanguageInfo(langCode);
      const textValidation: Record<string, any> = {};

      for (const [key, text] of Object.entries(texts as Record<string, string>)) {
        // Skip validation if specific keys are requested and this isn't one
        if (validateKeys.length > 0 && !validateKeys.includes(key)) {
          continue;
        }

        // Detect language of the text
        const detection = await languageService.detectLanguage(text);

        textValidation[key] = {
          text,
          detectedLanguage: detection.language,
          confidence: detection.confidence,
          isCorrectLanguage: detection.language === langCode,
          textLength: text.length,
          direction: langInfo?.direction,
          warnings: []
        };

        // Add warnings for potential issues
        if (detection.confidence < 0.7) {
          textValidation[key].warnings.push('Low confidence in language detection');
        }

        if (detection.language !== langCode && detection.confidence > 0.5) {
          textValidation[key].warnings.push(`Text appears to be in ${detection.language}, not ${langCode}`);
        }

        if (langInfo?.direction === 'rtl' && /^[a-zA-Z0-9\s]+$/.test(text)) {
          textValidation[key].warnings.push('RTL language contains only Latin characters');
        }

        if (text.length > 200) {
          textValidation[key].warnings.push('Text might be too long for UI element');
        }

        if (!text.trim()) {
          textValidation[key].warnings.push('Empty or whitespace-only text');
        }
      }

      validationResults[langCode] = {
        isSupported: true,
        languageInfo: langInfo,
        textValidations: textValidation,
        summary: {
          totalTexts: Object.keys(textValidation).length,
          correctLanguage: Object.values(textValidation).filter((t: any) => t.isCorrectLanguage).length,
          hasWarnings: Object.values(textValidation).filter((t: any) => t.warnings.length > 0).length
        }
      };
    }

    const overallSummary = {
      totalLanguages: Object.keys(validationResults).length,
      supportedLanguages: Object.values(validationResults).filter((r: any) => r.isSupported).length,
      languagesWithIssues: Object.values(validationResults).filter((r: any) =>
        r.isSupported && r.summary.hasWarnings > 0
      ).length
    };

    res.json({
      success: true,
      validationResults,
      summary: overallSummary,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Translation validation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Translation validation failed'
    });
  }
});

export { router as i18nRouter };