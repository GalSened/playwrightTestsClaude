/**
 * Unit tests for language detection functionality
 * Tests the SmartWeSignKnowledge language detection capabilities
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import SmartWeSignKnowledge from '../../../src/services/ai/smartWeSignKnowledge';

// Mock dependencies
jest.mock('@langchain/openai');
jest.mock('../../../src/services/ai/vectorStore');
jest.mock('../../../src/utils/logger');

describe('Language Detection', () => {
  let knowledgeSystem: SmartWeSignKnowledge;

  beforeAll(() => {
    // Mock environment to avoid API calls
    process.env.OPENAI_API_KEY = 'test-key';
    knowledgeSystem = new SmartWeSignKnowledge();
  });

  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('Basic Language Detection', () => {
    it('should detect English correctly', () => {
      const englishQueries = [
        'How do I add a new contact?',
        'What is the document signing process?',
        'Can you help me with WeSign?',
        'I need to upload a file to the system',
        'Where can I find the user manual?'
      ];

      for (const query of englishQueries) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(result.language).toBe('english');
        expect(result.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect Hebrew correctly', () => {
      const hebrewQueries = [
        'איך אני מוסיף איש קשר חדש?',
        'מה זה תהליך החתימה על מסמכים?',
        'אתה יכול לעזור לי עם WeSign?',
        'איך אני מעלה קובץ למערכת?',
        'איפה אני מוצא את המדריך למשתמש?'
      ];

      for (const query of hebrewQueries) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(result.language).toBe('hebrew');
        expect(result.confidence).toBeGreaterThan(0.5);
      }
    });

    it('should detect mixed language content', () => {
      const mixedQueries = [
        'איך אני מתחבר ל-WeSign API?',
        'How do I use תבניות in the system?',
        'WeSign מערכת לניהול מסמכים',
        'I need help with חתימות דיגיטליות',
        'Where is the קשרים section?'
      ];

      for (const query of mixedQueries) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(['mixed', 'hebrew', 'english']).toContain(result.language);
        expect(result.confidence).toBeGreaterThan(0.3);
      }
    });
  });

  describe('Pattern Matching', () => {
    it('should recognize Hebrew question words', () => {
      const hebrewQuestionWords = [
        'איך אני עושה משהו?',
        'מה זה הדבר הזה?',
        'כיצד להשתמש במערכת?',
        'למה זה לא עובד?',
        'מתי אני יכול לראות תוצאות?',
        'איפה אני מוצא את הכפתור?',
        'מי יכול לעזור לי?',
        'האם זה אפשרי?'
      ];

      for (const query of hebrewQuestionWords) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(result.language).toBe('hebrew');
        expect(result.patterns.hebrew).toBeGreaterThan(0);
      }
    });

    it('should recognize English question words', () => {
      const englishQuestionWords = [
        'How do I do something?',
        'What is this thing?',
        'When can I see results?',
        'Where do I find the button?',
        'Who can help me?',
        'Why is this not working?',
        'Can I do this action?',
        'Does this feature exist?'
      ];

      for (const query of englishQuestionWords) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(result.language).toBe('english');
        expect(result.patterns.english).toBeGreaterThan(0);
      }
    });

    it('should recognize WeSign-specific Hebrew terms', () => {
      const hebrewWeSignTerms = [
        'איך אני מוסיף קשר חדש?',
        'איפה אני מוצא את המסמכים?',
        'כיצד ליצור תבנית חדשה?',
        'מה זה חתימה דיגיטלית?',
        'איך אני מנהל משתמשים במערכת?',
        'איפה הדוחות של החתימות?'
      ];

      for (const query of hebrewWeSignTerms) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(result.language).toBe('hebrew');
        expect(result.patterns.hebrew).toBeGreaterThan(0);
      }
    });

    it('should recognize WeSign-specific English terms', () => {
      const englishWeSignTerms = [
        'How do I add a contact?',
        'Where are my documents?',
        'How to create a template?',
        'What is digital signature?',
        'How do I manage users?',
        'Where are the signing reports?'
      ];

      for (const query of englishWeSignTerms) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(result.language).toBe('english');
        expect(result.patterns.english).toBeGreaterThan(0);
      }
    });
  });

  describe('Character-based Detection', () => {
    it('should handle predominantly Hebrew character content', () => {
      const hebrewText = 'זהו טקסט בעברית בלבד עם הרבה מילים בעברית כדי לבדוק את זיהוי השפה';
      const result = (knowledgeSystem as any).detectLanguage(hebrewText);

      expect(result.language).toBe('hebrew');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle predominantly English character content', () => {
      const englishText = 'This is pure English text with many English words to test language detection';
      const result = (knowledgeSystem as any).detectLanguage(englishText);

      expect(result.language).toBe('english');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should handle balanced mixed content', () => {
      const mixedText = 'This is mixed text with עברית and English combined together';
      const result = (knowledgeSystem as any).detectLanguage(mixedText);

      expect(['mixed', 'english']).toContain(result.language);
      expect(result.confidence).toBeGreaterThan(0.3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty or very short text', () => {
      const edgeCases = ['', ' ', 'a', 'ת', '?', '123'];

      for (const text of edgeCases) {
        const result = (knowledgeSystem as any).detectLanguage(text);
        expect(['english', 'hebrew', 'mixed']).toContain(result.language);
        expect(result.confidence).toBeGreaterThanOrEqual(0.1);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('should handle numbers and special characters', () => {
      const specialCases = [
        '123456789',
        '!@#$%^&*()',
        'WeSign 2023',
        'API v1.2.3',
        'HTTP 404 שגיאה',
        'JSON { "key": "value" }'
      ];

      for (const text of specialCases) {
        const result = (knowledgeSystem as any).detectLanguage(text);
        expect(['english', 'hebrew', 'mixed']).toContain(result.language);
        expect(result.confidence).toBeGreaterThanOrEqual(0.1);
      }
    });

    it('should handle technical terms mixed with Hebrew', () => {
      const technicalMixed = [
        'איך אני משתמש ב-API של WeSign?',
        'מה זה JSON response?',
        'איפה אני מוצא את ה-URL?',
        'כיצד לשלוח HTTP request?',
        'מה המשמעות של PDF signature?'
      ];

      for (const text of technicalMixed) {
        const result = (knowledgeSystem as any).detectLanguage(text);
        expect(['mixed', 'hebrew']).toContain(result.language);
        expect(result.patterns.mixed).toBeGreaterThanOrEqual(0);
      }
    });

    it('should handle very long text', () => {
      const longHebrew = 'זהו טקסט ארוך מאוד בעברית '.repeat(50);
      const longEnglish = 'This is a very long English text '.repeat(50);

      const hebrewResult = (knowledgeSystem as any).detectLanguage(longHebrew);
      expect(hebrewResult.language).toBe('hebrew');

      const englishResult = (knowledgeSystem as any).detectLanguage(longEnglish);
      expect(englishResult.language).toBe('english');
    });
  });

  describe('Pattern Score Calculation', () => {
    it('should calculate pattern scores correctly', () => {
      const text = 'איך אני מוסיף contact ל-WeSign?';
      const hebrewPatterns = [/[\u0590-\u05FF]/g, /\b(איך|מה)\b/g];
      const englishPatterns = [/\b(contact|WeSign)\b/gi];

      const hebrewScore = (knowledgeSystem as any).calculatePatternScore(text, hebrewPatterns);
      const englishScore = (knowledgeSystem as any).calculatePatternScore(text, englishPatterns);

      expect(hebrewScore).toBeGreaterThan(0);
      expect(englishScore).toBeGreaterThan(0);
      expect(typeof hebrewScore).toBe('number');
      expect(typeof englishScore).toBe('number');
    });

    it('should normalize scores by word count', () => {
      const shortText = 'איך';
      const longText = 'איך אני עושה משהו עם המערכת הזאת שהיא מורכבת';

      const shortScore = (knowledgeSystem as any).calculatePatternScore(shortText, [/\b(איך)\b/g]);
      const longScore = (knowledgeSystem as any).calculatePatternScore(longText, [/\b(איך)\b/g]);

      expect(shortScore).toBeGreaterThan(longScore); // Shorter text should have higher relative score
    });

    it('should handle patterns with no matches', () => {
      const text = 'This is English text';
      const hebrewPatterns = [/[\u0590-\u05FF]/g];

      const score = (knowledgeSystem as any).calculatePatternScore(text, hebrewPatterns);
      expect(score).toBe(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should return confidence within valid range', () => {
      const testCases = [
        'How do I add a contact?',
        'איך אני מוסיף איש קשר?',
        'WeSign API documentation',
        'תיעוד WeSign',
        '',
        '123',
        'Mixed עברית and English'
      ];

      for (const text of testCases) {
        const result = (knowledgeSystem as any).detectLanguage(text);
        expect(result.confidence).toBeGreaterThanOrEqual(0.1);
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      }
    });

    it('should provide higher confidence for clear language cases', () => {
      const clearEnglish = 'This is definitely English text with no Hebrew characters';
      const clearHebrew = 'זהו בהחלט טקסט בעברית בלי תווים באנגלית';

      const englishResult = (knowledgeSystem as any).detectLanguage(clearEnglish);
      const hebrewResult = (knowledgeSystem as any).detectLanguage(clearHebrew);

      expect(englishResult.confidence).toBeGreaterThan(0.8);
      expect(hebrewResult.confidence).toBeGreaterThan(0.8);
    });

    it('should provide lower confidence for ambiguous cases', () => {
      const ambiguousCases = [
        'API',
        'WeSign',
        '123',
        'URL',
        'JSON'
      ];

      for (const text of ambiguousCases) {
        const result = (knowledgeSystem as any).detectLanguage(text);
        expect(result.confidence).toBeLessThan(0.9); // Should be less confident for ambiguous cases
      }
    });
  });

  describe('Real-world Test Cases', () => {
    it('should handle realistic user queries', () => {
      const realQueries = [
        // English user queries
        'How do I upload a document to WeSign?',
        'Can I add multiple signers to one document?',
        'What file formats are supported?',
        'How do I track the signing progress?',
        'Where can I download the signed document?',

        // Hebrew user queries
        'איך אני מעלה מסמך ל-WeSign?',
        'אני יכול להוסיף כמה חותמים למסמך אחד?',
        'איזה פורמטים של קבצים נתמכים?',
        'איך אני עוקב אחרי התקדמות החתימה?',
        'איפה אני יכול להוריד את המסמך החתום?',

        // Mixed queries (realistic bilingual scenarios)
        'איך אני משתמש ב-WeSign API?',
        'מה זה digital signature בעברית?',
        'How do I create תבנית for documents?',
        'WeSign לא עובד - מה לעשות?'
      ];

      for (const query of realQueries) {
        const result = (knowledgeSystem as any).detectLanguage(query);

        // Should detect a valid language
        expect(['english', 'hebrew', 'mixed']).toContain(result.language);

        // Should have reasonable confidence
        expect(result.confidence).toBeGreaterThan(0.3);

        // Should have pattern information
        expect(result.patterns).toBeDefined();
        expect(typeof result.patterns.hebrew).toBe('number');
        expect(typeof result.patterns.english).toBe('number');
        expect(typeof result.patterns.mixed).toBe('number');
      }
    });

    it('should handle user typos and informal language', () => {
      const informalQueries = [
        'how 2 add contact???',
        'איך מוסיפיםםםם איש קשר',
        'HELP WITH WESIGN!!!',
        'איכס לא עובד הדבר הזה',
        'pls help with signing process',
        'תעזור לי עם החתימה פליזזזז'
      ];

      for (const query of informalQueries) {
        const result = (knowledgeSystem as any).detectLanguage(query);

        // Should still detect language despite informal style
        expect(['english', 'hebrew', 'mixed']).toContain(result.language);
        expect(result.confidence).toBeGreaterThan(0.2);
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle batch detection efficiently', () => {
      const batchQueries = [];

      // Generate test batch
      for (let i = 0; i < 100; i++) {
        batchQueries.push(`Test query number ${i} for batch processing`);
        batchQueries.push(`שאלת בדיקה מספר ${i} לעיבוד אצווה`);
      }

      const startTime = Date.now();

      for (const query of batchQueries) {
        const result = (knowledgeSystem as any).detectLanguage(query);
        expect(result).toBeDefined();
        expect(result.language).toBeDefined();
        expect(result.confidence).toBeDefined();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should process reasonably quickly (less than 1 second for 200 queries)
      expect(duration).toBeLessThan(1000);
    });

    it('should be deterministic for same input', () => {
      const testQueries = [
        'How do I add a contact?',
        'איך אני מוסיף איש קשר?',
        'WeSign mixed עברית query'
      ];

      for (const query of testQueries) {
        const result1 = (knowledgeSystem as any).detectLanguage(query);
        const result2 = (knowledgeSystem as any).detectLanguage(query);
        const result3 = (knowledgeSystem as any).detectLanguage(query);

        // Should return exactly the same results
        expect(result1.language).toBe(result2.language);
        expect(result1.language).toBe(result3.language);
        expect(result1.confidence).toBe(result2.confidence);
        expect(result1.confidence).toBe(result3.confidence);
      }
    });

    it('should handle concurrent detection requests', async () => {
      const queries = [
        'English query 1',
        'English query 2',
        'שאלה בעברית 1',
        'שאלה בעברית 2',
        'Mixed query with עברית'
      ];

      // Simulate concurrent requests
      const promises = queries.map(query =>
        Promise.resolve((knowledgeSystem as any).detectLanguage(query))
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.language).toBeDefined();
        expect(result.confidence).toBeDefined();
      }
    });
  });
});