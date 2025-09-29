import { logger } from '@/utils/logger';
import { ChatOpenAI } from '@langchain/openai';
import { OpenAIEmbeddings } from '@langchain/openai';
// Use alternative tokenizer for compatibility
// import { encode, decode } from 'gpt-tokenizer';
import { saveVector, VectorEntry } from './vectorStore';
import fs from 'fs';
import path from 'path';

export interface ExtractOptions {
  chunkSizeTokens: number;  // Default: 1000
  overlapTokens: number;    // Default: 200
  langs: Array<'en' | 'he'>; // Default: ['en', 'he']
  generateHebrew: boolean;  // Default: true
  namespace: string;        // Default: 'qa-intel'
}

export interface InDoc {
  id: string;
  version: string;
  path: string;
  content: string;
  type?: string;
}

export interface OutEntry {
  id: string;
  text: string;
  metadata: ExtractMetadata;
  vector?: number[];
}

export interface ExtractMetadata {
  lang: 'en' | 'he';
  version: string;
  sourcePath: string;
  chunkIndex: number;
  section: string;
  type: string;
  createdAt: string;
  tokenCount: number;
  confidence?: number;
}

export interface ParsedSection {
  title: string;
  content: string;
  level: number;
  startIndex: number;
  endIndex: number;
  subsections?: ParsedSection[];
}

/**
 * Professional Knowledge Extractor with chunking and bilingual support
 * Handles large documents by splitting into manageable chunks with overlap
 * Generates Hebrew content aligned with English sections
 */
export class ProfessionalKnowledgeExtractor {
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for knowledge extraction');
    }

    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.3, // Lower temperature for consistent extraction
      maxTokens: 2000,
      timeout: 120000
    });

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-large',
      dimensions: 1536
    });
  }

  /**
   * Main extraction function with chunking and bilingual support
   */
  async extractDocument(doc: InDoc, opts: ExtractOptions = this.getDefaultOptions()): Promise<OutEntry[]> {
    logger.info('Starting document extraction with chunking', {
      docId: doc.id,
      contentLength: doc.content.length,
      options: opts
    });

    try {
      // Parse document into sections for better context preservation
      const sections = this.parsePRDSections(doc.content);

      // Create chunks with intelligent boundaries (prefer section breaks)
      const chunks = this.createIntelligentChunks(doc.content, sections, opts);

      const allEntries: OutEntry[] = [];

      // Process each chunk for each language
      for (const [chunkIndex, chunk] of chunks.entries()) {
        logger.info(`Processing chunk ${chunkIndex + 1}/${chunks.length}`, {
          section: chunk.section,
          tokenCount: chunk.tokenCount
        });

        for (const lang of opts.langs) {
          try {
            const entry = await this.processChunk(chunk, lang, chunkIndex, doc, opts);
            if (entry) {
              allEntries.push(entry);

              // Save to vector store immediately to avoid memory issues
              await saveVector(entry, opts.namespace);
            }
          } catch (error) {
            logger.error(`Failed to process chunk ${chunkIndex} for language ${lang}:`, error);
            // Continue with other chunks/languages
          }
        }

        // Rate limiting to avoid OpenAI throttling
        await this.delay(1000);
      }

      logger.info('Document extraction completed', {
        docId: doc.id,
        totalEntries: allEntries.length,
        chunksProcessed: chunks.length,
        languages: opts.langs
      });

      return allEntries;

    } catch (error) {
      logger.error('Document extraction failed:', error);
      throw error;
    }
  }

  /**
   * Create intelligent chunks that respect document structure
   */
  private createIntelligentChunks(content: string, sections: ParsedSection[], opts: ExtractOptions): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    for (const section of sections) {
      const sectionTokens = this.countTokens(section.content);

      if (sectionTokens <= opts.chunkSizeTokens) {
        // Section fits in one chunk
        chunks.push({
          content: section.content,
          section: section.title,
          tokenCount: sectionTokens,
          startIndex: section.startIndex,
          endIndex: section.endIndex
        });
      } else {
        // Split large section into overlapping chunks
        const sectionChunks = this.splitSectionIntoChunks(section, opts);
        chunks.push(...sectionChunks);
      }
    }

    return chunks;
  }

  /**
   * Split a large section into overlapping chunks
   */
  private splitSectionIntoChunks(section: ParsedSection, opts: ExtractOptions): DocumentChunk[] {
    // Alternative chunking approach using character-based estimation
    const content = section.content;
    const chunks: DocumentChunk[] = [];

    // Estimate tokens using character count (roughly 4 characters per token)
    const estimatedTokens = Math.ceil(content.length / 4);
    const charactersPerChunk = opts.chunkSizeTokens * 4;
    const overlapCharacters = opts.overlapTokens * 4;

    let startIndex = 0;
    let chunkNumber = 1;

    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + charactersPerChunk, content.length);
      const chunkContent = content.slice(startIndex, endIndex);

      chunks.push({
        content: chunkContent,
        section: `${section.title} (Part ${chunkNumber})`,
        tokenCount: Math.ceil(chunkContent.length / 4), // Estimate tokens
        startIndex: section.startIndex + startIndex,
        endIndex: section.startIndex + endIndex
      });

      // Move start position with overlap consideration
      startIndex = endIndex - Math.min(overlapCharacters, endIndex - startIndex);
      chunkNumber++;
    }

    return chunks;
  }

  /**
   * Process a single chunk for a specific language
   */
  private async processChunk(
    chunk: DocumentChunk,
    lang: 'en' | 'he',
    chunkIndex: number,
    doc: InDoc,
    opts: ExtractOptions
  ): Promise<OutEntry | null> {
    try {
      let processedContent: string;
      let confidence = 1.0;

      if (lang === 'en') {
        // For English, use content as-is but clean it up
        processedContent = this.cleanEnglishContent(chunk.content);
      } else {
        // For Hebrew, generate Hebrew version if needed
        if (opts.generateHebrew) {
          const hebrewResult = await this.generateHebrewContent(chunk.content, chunk.section);
          processedContent = hebrewResult.content;
          confidence = hebrewResult.confidence;
        } else {
          // Skip Hebrew generation if not requested
          return null;
        }
      }

      // Generate embedding
      const vector = await this.embeddings.embedQuery(processedContent);

      // Create entry
      const entry: OutEntry = {
        id: `${doc.id}:${lang}:${chunkIndex}`,
        text: processedContent,
        metadata: {
          lang,
          version: doc.version,
          sourcePath: doc.path,
          chunkIndex,
          section: chunk.section,
          type: doc.type || 'document',
          createdAt: new Date().toISOString(),
          tokenCount: chunk.tokenCount,
          confidence
        },
        vector
      };

      return entry;

    } catch (error) {
      logger.error(`Failed to process chunk for language ${lang}:`, error);
      return null;
    }
  }

  /**
   * Generate Hebrew content from English using AI
   */
  private async generateHebrewContent(englishContent: string, section: string): Promise<{content: string; confidence: number}> {
    const prompt = `
You are a professional Hebrew translator specializing in technical documentation for software platforms.

TASK: Translate the following WeSign platform documentation section into professional Hebrew.

REQUIREMENTS:
1. Maintain technical accuracy and terminology
2. Use appropriate Hebrew technical terms (e.g., מסמך for document, קשר for contact)
3. Preserve step-by-step instructions and formatting
4. Adapt for Hebrew RTL reading patterns
5. Keep Hebrew text natural and professional

SECTION: ${section}

ENGLISH CONTENT:
${englishContent}

Provide ONLY the Hebrew translation, maintaining the same structure and technical detail.
`;

    try {
      const response = await this.llm.invoke(prompt);
      const hebrewContent = response.content as string;

      // Simple confidence calculation based on content length and coherence
      const confidence = this.calculateHebrewConfidence(englishContent, hebrewContent);

      return {
        content: hebrewContent.trim(),
        confidence
      };

    } catch (error) {
      logger.error('Hebrew content generation failed:', error);
      return {
        content: `תוכן זה זמין באנגלית בלבד: ${englishContent.substring(0, 100)}...`,
        confidence: 0.3
      };
    }
  }

  /**
   * Calculate confidence score for Hebrew translation
   */
  private calculateHebrewConfidence(english: string, hebrew: string): number {
    // Basic heuristics for translation quality
    const englishLength = english.length;
    const hebrewLength = hebrew.length;

    // Hebrew text should be roughly 70-130% of English length
    const lengthRatio = hebrewLength / englishLength;
    const lengthScore = lengthRatio >= 0.7 && lengthRatio <= 1.3 ? 1.0 : 0.5;

    // Check for Hebrew characters
    const hebrewCharPattern = /[\u0590-\u05FF]/g;
    const hebrewCharCount = (hebrew.match(hebrewCharPattern) || []).length;
    const hebrewCharScore = hebrewCharCount > hebrew.length * 0.3 ? 1.0 : 0.3;

    // Check for technical terms preservation
    const technicalTerms = ['WeSign', 'API', 'URL', 'JSON', 'HTTP'];
    const preservedTerms = technicalTerms.filter(term =>
      english.includes(term) && hebrew.includes(term)
    ).length;
    const termScore = technicalTerms.length > 0 ? preservedTerms / technicalTerms.length : 1.0;

    // Combined confidence score
    const confidence = (lengthScore * 0.4 + hebrewCharScore * 0.4 + termScore * 0.2);

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Clean English content for consistency
   */
  private cleanEnglishContent(content: string): string {
    return content
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')     // Normalize line breaks
      .trim();
  }

  /**
   * Parse PRD content into structured sections
   */
  private parsePRDSections(content: string): ParsedSection[] {
    const lines = content.split('\n');
    const sections: ParsedSection[] = [];
    let currentSection: ParsedSection | null = null;
    let currentIndex = 0;

    for (const [lineIndex, line] of lines.entries()) {
      const trimmedLine = line.trim();

      // Main section headers (## or ###)
      if (trimmedLine.match(/^#{2,3}\s+/)) {
        if (currentSection) {
          currentSection.endIndex = currentIndex;
          sections.push(currentSection);
        }

        const level = (trimmedLine.match(/^#+/) || [''])[0].length;
        currentSection = {
          title: trimmedLine.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, ''),
          content: '',
          level,
          startIndex: currentIndex,
          endIndex: 0,
          subsections: []
        };
      }

      // Add content to current section
      if (currentSection && trimmedLine) {
        currentSection.content += line + '\n';
      }

      currentIndex += line.length + 1; // +1 for newline
    }

    // Don't forget the last section
    if (currentSection) {
      currentSection.endIndex = currentIndex;
      sections.push(currentSection);
    }

    return sections.filter(section => section.content.trim().length > 0);
  }

  /**
   * Count tokens in text
   */
  private countTokens(text: string): number {
    // Use character-based token estimation (roughly 4 characters per token)
    // This is a reasonable approximation for English and Hebrew text
    return Math.ceil(text.length / 4);
  }

  /**
   * Get default extraction options
   */
  private getDefaultOptions(): ExtractOptions {
    return {
      chunkSizeTokens: 1000,
      overlapTokens: 200,
      langs: ['en', 'he'],
      generateHebrew: true,
      namespace: 'qa-intel'
    };
  }

  /**
   * Simple delay utility for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface DocumentChunk {
  content: string;
  section: string;
  tokenCount: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Factory function for easy instantiation
 */
export function createKnowledgeExtractor(): ProfessionalKnowledgeExtractor {
  return new ProfessionalKnowledgeExtractor();
}

/**
 * Utility function to extract from a file path
 */
export async function extractFromFile(
  filePath: string,
  options?: Partial<ExtractOptions>
): Promise<OutEntry[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const doc: InDoc = {
    id: path.basename(filePath, path.extname(filePath)),
    version: '1.0.0',
    path: filePath,
    content,
    type: path.extname(filePath).substring(1)
  };

  const extractor = createKnowledgeExtractor();
  const finalOptions = { ...extractor['getDefaultOptions'](), ...options };

  return await extractor.extractDocument(doc, finalOptions);
}

export default ProfessionalKnowledgeExtractor;