/**
 * Unit tests for document chunking functionality
 * Tests the ProfessionalKnowledgeExtractor's chunking capabilities
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { ProfessionalKnowledgeExtractor, InDoc, ExtractOptions } from '../../../src/services/ai/knowledgeExtractor';

// Mock dependencies
jest.mock('@langchain/openai');
jest.mock('../../../src/services/ai/vectorStore');
jest.mock('../../../src/utils/logger');

describe('Document Chunking', () => {
  let extractor: ProfessionalKnowledgeExtractor;
  let mockDoc: InDoc;
  let testOptions: ExtractOptions;

  beforeAll(() => {
    // Mock environment variables
    process.env.OPENAI_API_KEY = 'test-key';

    // Create extractor instance
    extractor = new ProfessionalKnowledgeExtractor();

    // Setup test document
    mockDoc = {
      id: 'test-doc',
      version: '1.0.0',
      path: '/test/document.md',
      content: '',
      type: 'markdown'
    };

    // Setup test options
    testOptions = {
      chunkSizeTokens: 100,
      overlapTokens: 20,
      langs: ['en'],
      generateHebrew: false,
      namespace: 'test'
    };
  });

  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('Section Parsing', () => {
    it('should parse PRD sections correctly', () => {
      const content = `
# Main Title

## Section 1
This is section 1 content.

### Subsection 1.1
This is subsection content.

## Section 2
This is section 2 content.
      `.trim();

      mockDoc.content = content;

      // Access private method for testing
      const sections = (extractor as any).parsePRDSections(content);

      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('Section 1');
      expect(sections[0].level).toBe(2);
      expect(sections[0].content).toContain('This is section 1 content');
      expect(sections[1].title).toBe('Section 2');
    });

    it('should handle nested sections', () => {
      const content = `
### 2.1. User Authentication
Authentication system overview.

#### 2.1.1. Login Process
Step-by-step login process.

#### 2.1.2. Password Reset
Password reset functionality.

### 2.2. User Management
User management features.
      `.trim();

      const sections = (extractor as any).parsePRDSections(content);

      expect(sections).toHaveLength(2);
      expect(sections[0].title).toBe('User Authentication');
      expect(sections[1].title).toBe('User Management');
    });

    it('should handle empty sections gracefully', () => {
      const content = `
## Empty Section

## Another Empty Section

## Section With Content
This section has actual content.
      `.trim();

      const sections = (extractor as any).parsePRDSections(content);

      // Should filter out empty sections
      expect(sections).toHaveLength(1);
      expect(sections[0].title).toBe('Section With Content');
    });
  });

  describe('Token Counting', () => {
    it('should count tokens accurately', () => {
      const testTexts = [
        'Hello world',
        'This is a longer sentence with more words.',
        'שלום עולם זהו טקסט בעברית'
      ];

      for (const text of testTexts) {
        const count = (extractor as any).countTokens(text);
        expect(count).toBeGreaterThan(0);
        expect(count).toBeLessThan(text.length); // Should be more efficient than character count
      }
    });

    it('should handle empty text', () => {
      const count = (extractor as any).countTokens('');
      expect(count).toBe(0);
    });

    it('should handle special characters', () => {
      const specialText = '{"key": "value", "array": [1, 2, 3]}';
      const count = (extractor as any).countTokens(specialText);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Intelligent Chunking', () => {
    it('should create chunks that respect token limits', () => {
      const longContent = 'Lorem ipsum '.repeat(200); // Create long content
      const sections = [{
        title: 'Long Section',
        content: longContent,
        level: 2,
        startIndex: 0,
        endIndex: longContent.length,
        subsections: []
      }];

      const chunks = (extractor as any).createIntelligentChunks(longContent, sections, testOptions);

      expect(chunks.length).toBeGreaterThan(1); // Should split into multiple chunks

      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeLessThanOrEqual(testOptions.chunkSizeTokens);
        expect(chunk.content).toBeTruthy();
        expect(chunk.section).toBeTruthy();
      }
    });

    it('should handle small sections that fit in one chunk', () => {
      const shortContent = 'This is a short section.';
      const sections = [{
        title: 'Short Section',
        content: shortContent,
        level: 2,
        startIndex: 0,
        endIndex: shortContent.length,
        subsections: []
      }];

      const chunks = (extractor as any).createIntelligentChunks(shortContent, sections, testOptions);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(shortContent);
      expect(chunks[0].section).toBe('Short Section');
    });

    it('should create overlapping chunks correctly', () => {
      const content = 'Word '.repeat(50); // 50 words
      const sections = [{
        title: 'Test Section',
        content: content,
        level: 2,
        startIndex: 0,
        endIndex: content.length,
        subsections: []
      }];

      const options: ExtractOptions = {
        chunkSizeTokens: 20,
        overlapTokens: 5,
        langs: ['en'],
        generateHebrew: false,
        namespace: 'test'
      };

      const chunks = (extractor as any).createIntelligentChunks(content, sections, options);

      if (chunks.length > 1) {
        // Check that consecutive chunks have some overlap
        for (let i = 0; i < chunks.length - 1; i++) {
          const currentChunk = chunks[i];
          const nextChunk = chunks[i + 1];

          expect(currentChunk.endIndex).toBeGreaterThan(nextChunk.startIndex);
        }
      }
    });
  });

  describe('Section Splitting', () => {
    it('should split large sections with proper overlap', () => {
      const largeSection = {
        title: 'Large Section',
        content: 'Token '.repeat(150), // 150 tokens worth of content
        level: 2,
        startIndex: 0,
        endIndex: 900,
        subsections: []
      };

      const options: ExtractOptions = {
        chunkSizeTokens: 50,
        overlapTokens: 10,
        langs: ['en'],
        generateHebrew: false,
        namespace: 'test'
      };

      const chunks = (extractor as any).splitSectionIntoChunks(largeSection, options);

      expect(chunks.length).toBeGreaterThan(1);

      // Check chunk naming
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].section).toBe(`Large Section (Part ${i + 1})`);
      }

      // Check token limits
      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeLessThanOrEqual(options.chunkSizeTokens);
      }
    });

    it('should handle edge cases in section splitting', () => {
      const tinySection = {
        title: 'Tiny Section',
        content: 'Small',
        level: 2,
        startIndex: 0,
        endIndex: 5,
        subsections: []
      };

      const chunks = (extractor as any).splitSectionIntoChunks(tinySection, testOptions);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Small');
      expect(chunks[0].section).toBe('Tiny Section (Part 1)');
    });
  });

  describe('Content Cleaning', () => {
    it('should clean English content properly', () => {
      const messyContent = '  This   has    multiple   spaces\n\n\n\nand many newlines  ';
      const cleaned = (extractor as any).cleanEnglishContent(messyContent);

      expect(cleaned).toBe('This has multiple spaces\n\nand many newlines');
    });

    it('should preserve necessary formatting', () => {
      const contentWithFormatting = 'Line 1\nLine 2\n\nParagraph break\nAnother line';
      const cleaned = (extractor as any).cleanEnglishContent(contentWithFormatting);

      expect(cleaned).toContain('\n');
      expect(cleaned).not.toMatch(/\s{2,}/); // No multiple spaces
    });
  });

  describe('Hebrew Confidence Calculation', () => {
    it('should calculate confidence for good Hebrew translation', () => {
      const english = 'Hello world, this is a test document.';
      const hebrew = 'שלום עולם, זהו מסמך בדיקה.';

      const confidence = (extractor as any).calculateHebrewConfidence(english, hebrew);

      expect(confidence).toBeGreaterThan(0.7);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should give lower confidence for poor translation', () => {
      const english = 'This is a comprehensive technical document.';
      const hebrew = 'טקסט קצר'; // Very short Hebrew text

      const confidence = (extractor as any).calculateHebrewConfidence(english, hebrew);

      expect(confidence).toBeLessThan(0.7);
      expect(confidence).toBeGreaterThanOrEqual(0.3); // Minimum confidence
    });

    it('should handle edge cases', () => {
      const confidence1 = (extractor as any).calculateHebrewConfidence('', '');
      expect(confidence1).toBeGreaterThanOrEqual(0.3);

      const confidence2 = (extractor as any).calculateHebrewConfidence('English only', 'English only');
      expect(confidence2).toBeLessThan(0.7); // Should detect lack of Hebrew
    });

    it('should preserve technical terms', () => {
      const english = 'WeSign API documentation with JSON and HTTP examples.';
      const hebrew = 'תיעוד WeSign API עם דוגמאות JSON ו-HTTP.';

      const confidence = (extractor as any).calculateHebrewConfidence(english, hebrew);

      expect(confidence).toBeGreaterThan(0.8); // High confidence for preserved technical terms
    });
  });

  describe('Integration Tests', () => {
    it('should handle realistic PRD content', async () => {
      const realisticContent = `
# Product Requirements Document

## 2.1. User Management
The system shall provide comprehensive user management capabilities.

### 2.1.1. User Registration
Users can register with email and password.

### 2.1.2. User Authentication
Multi-factor authentication support.

## 2.2. Document Management
The platform handles various document types.

### 2.2.1. Upload Process
Drag and drop file upload interface.
      `.trim();

      mockDoc.content = realisticContent;

      // Test that the extractor can process this without errors
      const sections = (extractor as any).parsePRDSections(realisticContent);
      expect(sections.length).toBeGreaterThan(0);

      const chunks = (extractor as any).createIntelligentChunks(realisticContent, sections, testOptions);
      expect(chunks.length).toBeGreaterThan(0);

      for (const chunk of chunks) {
        expect(chunk.content).toBeTruthy();
        expect(chunk.section).toBeTruthy();
        expect(chunk.tokenCount).toBeGreaterThan(0);
      }
    }, 10000); // Extended timeout for realistic content

    it('should maintain content integrity across chunks', () => {
      const content = `
## Important Section
This section contains critical information that should not be lost.
It has multiple sentences and important details.
The chunking process should preserve all content.
      `.trim();

      const sections = [{
        title: 'Important Section',
        content: content,
        level: 2,
        startIndex: 0,
        endIndex: content.length,
        subsections: []
      }];

      const smallChunkOptions: ExtractOptions = {
        chunkSizeTokens: 10, // Very small chunks to force splitting
        overlapTokens: 3,
        langs: ['en'],
        generateHebrew: false,
        namespace: 'test'
      };

      const chunks = (extractor as any).createIntelligentChunks(content, sections, smallChunkOptions);

      // Combine all chunk content
      const combinedContent = chunks.map(c => c.content).join(' ');

      // Should contain key phrases from original
      expect(combinedContent).toContain('critical information');
      expect(combinedContent).toContain('multiple sentences');
      expect(combinedContent).toContain('preserve all content');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed content gracefully', () => {
      const malformedContent = '## Section\n\n### \n\n## Another';

      expect(() => {
        (extractor as any).parsePRDSections(malformedContent);
      }).not.toThrow();
    });

    it('should handle extremely long sections', () => {
      const extremelyLongContent = 'Word '.repeat(10000); // Very long content

      const sections = [{
        title: 'Extreme Section',
        content: extremelyLongContent,
        level: 2,
        startIndex: 0,
        endIndex: extremelyLongContent.length,
        subsections: []
      }];

      expect(() => {
        (extractor as any).createIntelligentChunks(extremelyLongContent, sections, testOptions);
      }).not.toThrow();
    });

    it('should handle empty document', () => {
      const emptyContent = '';

      const sections = (extractor as any).parsePRDSections(emptyContent);
      expect(sections).toHaveLength(0);

      const chunks = (extractor as any).createIntelligentChunks(emptyContent, sections, testOptions);
      expect(chunks).toHaveLength(0);
    });
  });
});