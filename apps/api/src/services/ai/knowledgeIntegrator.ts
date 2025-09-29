import { logger } from '@/utils/logger';
import { ExtractedKnowledge, ProfessionalKnowledgeExtractor } from './knowledgeExtractor';
import SmartWeSignKnowledge from './smartWeSignKnowledge';
import fs from 'fs';

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

export class SmartKnowledgeIntegrator {
  private extractor: ProfessionalKnowledgeExtractor;
  private smartKnowledge: SmartWeSignKnowledge;

  constructor(smartKnowledge: SmartWeSignKnowledge) {
    this.extractor = new ProfessionalKnowledgeExtractor();
    this.smartKnowledge = smartKnowledge;
  }

  /**
   * Extract and integrate knowledge from PRD file
   */
  async integrateFromPRD(prdFilePath: string): Promise<void> {
    logger.info('Starting PRD knowledge integration', { prdFilePath });

    try {
      // Read PRD content
      const prdContent = fs.readFileSync(prdFilePath, 'utf-8');

      // Extract knowledge using AI
      const extractedKnowledge = await this.extractor.extractFromPRD(prdContent);

      // Convert to SmartWeSignKnowledge format
      const convertedKnowledge = this.convertToSmartKnowledgeFormat(extractedKnowledge);

      // Integrate with existing knowledge base
      await this.integrateKnowledge(convertedKnowledge);

      // Generate performance report
      const stats = this.extractor.getExtractionStats();
      logger.info('PRD knowledge integration completed', {
        ...stats,
        sourceFile: prdFilePath
      });

    } catch (error) {
      logger.error('Failed to integrate PRD knowledge:', error);
      throw error;
    }
  }

  /**
   * Convert extracted knowledge to SmartWeSignKnowledge format
   */
  private convertToSmartKnowledgeFormat(extractedKnowledge: ExtractedKnowledge[]): KnowledgeEntry[] {
    return extractedKnowledge.map(knowledge => ({
      id: knowledge.id,
      topics: knowledge.topics,
      keywords: this.enhanceKeywords(knowledge.keywords, knowledge.topics, knowledge.category),
      responses: {
        hebrew: this.enhanceResponse(knowledge.responses.hebrew, knowledge, 'hebrew'),
        english: this.enhanceResponse(knowledge.responses.english, knowledge, 'english')
      },
      confidence: this.calculateEnhancedConfidence(knowledge),
      followUpQuestions: knowledge.followUpQuestions,
      recommendations: knowledge.recommendations
    }));
  }

  /**
   * Enhance keywords with intelligent variations
   */
  private enhanceKeywords(baseKeywords: string[], topics: string[], category: string): string[] {
    const enhanced = new Set(baseKeywords);

    // Add topic variations
    topics.forEach(topic => {
      enhanced.add(topic);
      // Add word variations
      topic.split(' ').forEach(word => {
        if (word.length > 2) enhanced.add(word);
      });
    });

    // Add category-specific keywords
    const categoryKeywords = this.getCategoryKeywords(category);
    categoryKeywords.forEach(keyword => enhanced.add(keyword));

    // Add Hebrew-English pairs for common terms
    const bilingualPairs = {
      'contact': 'קשר',
      'contacts': 'אנשי קשר',
      'document': 'מסמך',
      'documents': 'מסמכים',
      'template': 'תבנית',
      'templates': 'תבניות',
      'signature': 'חתימה',
      'sign': 'חתם',
      'upload': 'העלאה',
      'download': 'הורדה',
      'merge': 'איחוד',
      'send': 'שלח',
      'file': 'קובץ',
      'files': 'קבצים'
    };

    Array.from(enhanced).forEach(keyword => {
      const normalizedKeyword = keyword.toLowerCase();
      if (bilingualPairs[normalizedKeyword]) {
        enhanced.add(bilingualPairs[normalizedKeyword]);
      }
      // Reverse lookup
      Object.entries(bilingualPairs).forEach(([eng, heb]) => {
        if (keyword === heb) enhanced.add(eng);
      });
    });

    return Array.from(enhanced);
  }

  /**
   * Get category-specific keywords
   */
  private getCategoryKeywords(category: string): string[] {
    const categoryKeywords = {
      'document_management': ['document', 'file', 'upload', 'download', 'save', 'open', 'מסמך', 'קובץ', 'העלאה', 'הורדה'],
      'contact_management': ['contact', 'person', 'email', 'phone', 'אדם', 'איש קשר', 'מייל', 'טלפון'],
      'template_management': ['template', 'form', 'create', 'תבנית', 'טופס', 'יצירה'],
      'signature_workflow': ['signature', 'sign', 'approve', 'חתימה', 'חתם', 'אישור'],
      'navigation': ['menu', 'navigate', 'go to', 'תפריט', 'ניווט', 'לך ל'],
      'home_dashboard': ['home', 'dashboard', 'main', 'בית', 'ראשי', 'לוח בקרה']
    };

    return categoryKeywords[category] || [];
  }

  /**
   * Enhance response with contextual information
   */
  private enhanceResponse(response: string, knowledge: ExtractedKnowledge, language: 'hebrew' | 'english'): string {
    if (!response) return '';

    let enhanced = response;

    // Add contextual prefixes for better user experience
    const contextPrefixes = {
      hebrew: {
        'document_management': 'לניהול מסמכים ב-WeSign:',
        'contact_management': 'לניהול אנשי קשר ב-WeSign:',
        'template_management': 'לעבודה עם תבניות ב-WeSign:',
        'signature_workflow': 'לתהליך החתימה ב-WeSign:',
        'navigation': 'לניווט במערכת WeSign:',
        'home_dashboard': 'בדף הבית של WeSign:'
      },
      english: {
        'document_management': 'For document management in WeSign:',
        'contact_management': 'For contact management in WeSign:',
        'template_management': 'For working with templates in WeSign:',
        'signature_workflow': 'For the signature process in WeSign:',
        'navigation': 'For navigating WeSign:',
        'home_dashboard': 'On the WeSign home page:'
      }
    };

    const prefix = contextPrefixes[language]?.[knowledge.category];
    if (prefix && !enhanced.includes(prefix)) {
      enhanced = `${prefix}\n\n${enhanced}`;
    }

    // Add functional requirements as steps if available
    if (knowledge.functionalRequirements && knowledge.functionalRequirements.length > 0) {
      const reqText = language === 'hebrew' ? '\n\nתכונות מערכת רלוונטיות:' : '\n\nRelevant system features:';
      enhanced += reqText;
      knowledge.functionalRequirements.slice(0, 3).forEach(req => {
        enhanced += `\n• ${req}`;
      });
    }

    return enhanced;
  }

  /**
   * Calculate enhanced confidence based on multiple factors
   */
  private calculateEnhancedConfidence(knowledge: ExtractedKnowledge): number {
    let confidence = knowledge.confidence;

    // Boost confidence based on priority
    const priorityBoost = {
      'critical': 0.1,
      'high': 0.05,
      'medium': 0.0,
      'low': -0.05
    };
    confidence += priorityBoost[knowledge.priority] || 0;

    // Boost confidence based on requirement completeness
    if (knowledge.functionalRequirements && knowledge.functionalRequirements.length > 0) {
      confidence += 0.05;
    }

    // Boost confidence based on bilingual completeness
    if (knowledge.responses.hebrew && knowledge.responses.english) {
      confidence += 0.03;
    }

    // Ensure confidence stays within bounds
    return Math.max(0.1, Math.min(0.99, confidence));
  }

  /**
   * Integrate new knowledge with existing knowledge base
   */
  private async integrateKnowledge(newKnowledge: KnowledgeEntry[]): Promise<void> {
    logger.info('Integrating knowledge into Smart Knowledge Base', {
      newEntries: newKnowledge.length
    });

    // For now, we'll need to modify the SmartWeSignKnowledge class to accept dynamic knowledge
    // This would require extending the class to support dynamic knowledge loading

    // Create a backup of current knowledge and add new entries
    const integratedKnowledge = this.mergeKnowledgeBases(newKnowledge);

    // Save the integrated knowledge for manual review and integration
    await this.saveIntegratedKnowledge(integratedKnowledge);

    logger.info('Knowledge integration prepared for manual review');
  }

  /**
   * Merge new knowledge with existing knowledge base
   */
  private mergeKnowledgeBases(newKnowledge: KnowledgeEntry[]): any {
    // Get current knowledge base structure
    const currentStats = this.smartKnowledge.getStats();

    const mergedKnowledge = {
      extractionDate: new Date().toISOString(),
      originalEntries: currentStats.totalEntries,
      newEntries: newKnowledge.length,
      totalEntries: currentStats.totalEntries + newKnowledge.length,
      newKnowledgeEntries: newKnowledge,
      integrationInstructions: {
        note: "This file contains extracted knowledge ready for integration",
        steps: [
          "1. Review the newKnowledgeEntries array",
          "2. Add selected entries to smartWeSignKnowledge.ts initializeKnowledgeBase method",
          "3. Test the updated knowledge base",
          "4. Deploy the enhanced system"
        ]
      }
    };

    return mergedKnowledge;
  }

  /**
   * Save integrated knowledge for manual review
   */
  private async saveIntegratedKnowledge(integratedKnowledge: any): Promise<string> {
    const filePath = `integrated-knowledge-${Date.now()}.json`;
    fs.writeFileSync(filePath, JSON.stringify(integratedKnowledge, null, 2), 'utf-8');

    logger.info('Integrated knowledge saved for review', {
      filePath,
      totalEntries: integratedKnowledge.totalEntries
    });

    return filePath;
  }

  /**
   * Generate integration report
   */
  async generateIntegrationReport(prdFilePath: string): Promise<any> {
    const report = {
      timestamp: new Date().toISOString(),
      sourceFile: prdFilePath,
      extractionStats: this.extractor.getExtractionStats(),
      currentKnowledgeStats: this.smartKnowledge.getStats(),
      recommendations: [
        "Review extracted knowledge entries for accuracy",
        "Test the enhanced knowledge base with real user queries",
        "Monitor AI response quality after integration",
        "Consider adding more specific Hebrew terminology",
        "Expand follow-up questions based on user feedback"
      ]
    };

    return report;
  }
}

export default SmartKnowledgeIntegrator;