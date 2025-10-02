/**
 * Extractive Summarizer
 *
 * Generate TL;DR summaries with citations from evidence
 */

import type { H4RResult } from '../h4r/types.js';
import type { TLDRSummary } from './types.js';

/**
 * Sentence with metadata
 */
interface ScoredSentence {
  text: string;
  itemId: string;
  score: number;
  position: number;
}

/**
 * Extractive summarizer
 */
export class Summarizer {
  /**
   * Split text into sentences
   */
  private static splitSentences(text: string): string[] {
    // Simple sentence splitter (handles . ! ?)
    // Real implementation would use more sophisticated NLP
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Extract text from content (handles various formats)
   */
  private static extractText(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (typeof content === 'object' && content !== null) {
      // Try common text fields
      const obj = content as Record<string, unknown>;
      if (obj.text && typeof obj.text === 'string') {
        return obj.text;
      }
      if (obj.message && typeof obj.message === 'string') {
        return obj.message;
      }
      if (obj.description && typeof obj.description === 'string') {
        return obj.description;
      }

      // Fallback: stringify
      return JSON.stringify(content);
    }

    return String(content);
  }

  /**
   * Score sentence relevance
   * Simple heuristic: combine item score with position bias
   */
  private static scoreSentence(
    sentence: string,
    itemScore: number,
    position: number,
    totalSentences: number
  ): number {
    // Position bias: earlier sentences score higher
    const positionScore = 1 - position / Math.max(totalSentences, 1);

    // Length bias: prefer moderate length (20-100 chars)
    const length = sentence.length;
    const lengthScore =
      length < 20
        ? length / 20
        : length > 100
          ? Math.max(0, 1 - (length - 100) / 100)
          : 1.0;

    // Keyword bonus (simple version)
    const hasKeywords =
      /\b(error|fail|success|fix|issue|problem|solution)\b/i.test(
        sentence
      );
    const keywordBonus = hasKeywords ? 0.2 : 0;

    // Combine scores
    return (
      itemScore * 0.5 + positionScore * 0.3 + lengthScore * 0.2 + keywordBonus
    );
  }

  /**
   * Generate extractive summary
   *
   * @param results - H4R results to summarize
   * @param numSentences - Target number of sentences (default: 5)
   * @returns TL;DR summary with citations
   */
  static summarize(
    results: H4RResult[],
    numSentences: number = 5
  ): TLDRSummary {
    if (results.length === 0) {
      return {
        summary: 'No evidence available.',
        citations: [],
        sentenceCount: 1,
      };
    }

    const scoredSentences: ScoredSentence[] = [];

    // Extract and score sentences from each result
    for (const result of results) {
      const text = this.extractText(result.content);
      const sentences = this.splitSentences(text);

      sentences.forEach((sentence, idx) => {
        const score = this.scoreSentence(
          sentence,
          result.score,
          idx,
          sentences.length
        );

        scoredSentences.push({
          text: sentence,
          itemId: result.id,
          score,
          position: idx,
        });
      });
    }

    // Sort by score and take top N
    const topSentences = scoredSentences
      .sort((a, b) => b.score - a.score)
      .slice(0, numSentences);

    // Reorder by original position for coherence
    topSentences.sort((a, b) => {
      // Compare item IDs first (keep same source together)
      if (a.itemId !== b.itemId) {
        return a.itemId.localeCompare(b.itemId);
      }
      // Then by position within item
      return a.position - b.position;
    });

    // Build summary text
    const summaryText = topSentences.map((s) => s.text).join('. ') + '.';

    // Collect unique citations
    const citations = Array.from(
      new Set(topSentences.map((s) => s.itemId))
    );

    return {
      summary: summaryText,
      citations,
      sentenceCount: topSentences.length,
    };
  }
}
