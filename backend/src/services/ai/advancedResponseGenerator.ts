import { logger } from '@/utils/logger';
import { ChatOpenAI } from '@langchain/openai';

export interface UserContext {
  userId: string;
  role: 'admin' | 'user' | 'power_user' | 'developer';
  experience: 'beginner' | 'intermediate' | 'expert';
  language: 'hebrew' | 'english' | 'mixed';
  previousQueries: string[];
  currentWorkflow?: string;
  preferences: {
    responseStyle: 'concise' | 'detailed' | 'step_by_step';
    includeScreenshots: boolean;
    includeCode: boolean;
    includeAdvancedTips: boolean;
  };
}

export interface ContextualResponse {
  answer: string;
  confidence: number;
  personalization: {
    roleSpecific: boolean;
    experienceAdjusted: boolean;
    languageOptimized: boolean;
    workflowAware: boolean;
  };
  enhancements: {
    visualGuides: Array<{
      type: 'screenshot' | 'diagram' | 'flowchart';
      description: string;
      url?: string;
    }>;
    codeExamples: Array<{
      language: 'javascript' | 'python' | 'curl';
      title: string;
      code: string;
    }>;
    relatedWorkflows: string[];
    advancedTips: string[];
  };
  followUp: {
    suggestedQuestions: string[];
    nextSteps: string[];
    relatedFeatures: string[];
  };
  metadata: {
    generatedAt: string;
    processingTime: number;
    tokensUsed: number;
    sources: number;
  };
}

/**
 * Advanced Response Generator with Contextual AI
 * Provides personalized, role-based, experience-adjusted responses
 */
export class AdvancedResponseGenerator {
  private llm: ChatOpenAI;
  private userContexts = new Map<string, UserContext>();
  private responseTemplates = new Map<string, any>();

  constructor() {
    this.llm = new ChatOpenAI({
      model: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 30000
    });

    this.initializeTemplates();
  }

  /**
   * Generate contextual response based on user profile and query
   */
  async generateResponse(
    query: string,
    knowledgeSources: any[],
    userContext: Partial<UserContext>
  ): Promise<ContextualResponse> {
    const startTime = Date.now();

    try {
      // Build or update user context
      const fullContext = this.buildUserContext(userContext);

      // Determine response strategy
      const strategy = this.determineResponseStrategy(query, fullContext, knowledgeSources);

      // Generate core response
      const coreResponse = await this.generateCoreResponse(query, knowledgeSources, fullContext, strategy);

      // Add contextual enhancements
      const enhancements = await this.generateEnhancements(query, fullContext, strategy);

      // Generate follow-up suggestions
      const followUp = this.generateFollowUp(query, fullContext, knowledgeSources);

      const processingTime = Date.now() - startTime;

      const response: ContextualResponse = {
        answer: coreResponse.answer,
        confidence: coreResponse.confidence,
        personalization: {
          roleSpecific: strategy.roleSpecific,
          experienceAdjusted: strategy.experienceAdjusted,
          languageOptimized: strategy.languageOptimized,
          workflowAware: strategy.workflowAware
        },
        enhancements,
        followUp,
        metadata: {
          generatedAt: new Date().toISOString(),
          processingTime,
          tokensUsed: coreResponse.tokensUsed || 0,
          sources: knowledgeSources.length
        }
      };

      // Update user context with this interaction
      this.updateUserContext(fullContext.userId, query, response);

      return response;

    } catch (error) {
      logger.error('Advanced response generation failed:', error);
      throw error;
    }
  }

  /**
   * Build comprehensive user context
   */
  private buildUserContext(partial: Partial<UserContext>): UserContext {
    const userId = partial.userId || 'anonymous';
    const existing = this.userContexts.get(userId);

    const context: UserContext = {
      userId,
      role: partial.role || existing?.role || 'user',
      experience: partial.experience || existing?.experience || 'intermediate',
      language: partial.language || existing?.language || 'english',
      previousQueries: existing?.previousQueries || [],
      currentWorkflow: partial.currentWorkflow || existing?.currentWorkflow,
      preferences: {
        responseStyle: partial.preferences?.responseStyle || existing?.preferences?.responseStyle || 'detailed',
        includeScreenshots: partial.preferences?.includeScreenshots ?? existing?.preferences?.includeScreenshots ?? true,
        includeCode: partial.preferences?.includeCode ?? existing?.preferences?.includeCode ?? false,
        includeAdvancedTips: partial.preferences?.includeAdvancedTips ?? existing?.preferences?.includeAdvancedTips ?? false,
        ...partial.preferences
      }
    };

    this.userContexts.set(userId, context);
    return context;
  }

  /**
   * Determine optimal response strategy
   */
  private determineResponseStrategy(
    query: string,
    context: UserContext,
    sources: any[]
  ): {
    roleSpecific: boolean;
    experienceAdjusted: boolean;
    languageOptimized: boolean;
    workflowAware: boolean;
    responseType: 'tutorial' | 'reference' | 'troubleshooting' | 'overview';
    complexity: 'simple' | 'moderate' | 'advanced';
  } {
    const queryLower = query.toLowerCase();

    // Determine response type
    let responseType: 'tutorial' | 'reference' | 'troubleshooting' | 'overview' = 'overview';
    if (queryLower.includes('how') || queryLower.includes('איך')) {
      responseType = 'tutorial';
    } else if (queryLower.includes('error') || queryLower.includes('problem') || queryLower.includes('בעיה')) {
      responseType = 'troubleshooting';
    } else if (queryLower.includes('what is') || queryLower.includes('מה זה')) {
      responseType = 'reference';
    }

    // Determine complexity based on user experience
    let complexity: 'simple' | 'moderate' | 'advanced' = 'moderate';
    if (context.experience === 'beginner') {
      complexity = 'simple';
    } else if (context.experience === 'expert' || context.role === 'developer') {
      complexity = 'advanced';
    }

    return {
      roleSpecific: context.role !== 'user',
      experienceAdjusted: true,
      languageOptimized: context.language !== 'english',
      workflowAware: !!context.currentWorkflow,
      responseType,
      complexity
    };
  }

  /**
   * Generate core response with AI
   */
  private async generateCoreResponse(
    query: string,
    sources: any[],
    context: UserContext,
    strategy: any
  ): Promise<{ answer: string; confidence: number; tokensUsed: number }> {
    const isHebrew = context.language === 'hebrew';

    // Build context-aware system prompt
    const systemPrompt = this.buildSystemPrompt(context, strategy);

    // Build knowledge context
    const knowledgeContext = sources.map(source =>
      `[${source.type || 'unknown'}] ${source.content?.substring(0, 500) || ''}`
    ).join('\n\n');

    // Build user prompt
    const userPrompt = isHebrew ? `
שאלת המשתמש: ${query}

מידע רלוונטי:
${knowledgeContext}

אנא תן תשובה ${this.getResponseStyleInHebrew(context.preferences.responseStyle)} שמתאימה לרמת הניסיון של המשתמש (${this.getExperienceInHebrew(context.experience)}) ולתפקיד שלו (${this.getRoleInHebrew(context.role)}).
` : `
User question: ${query}

Relevant information:
${knowledgeContext}

Please provide a ${context.preferences.responseStyle} response appropriate for a ${context.experience} ${context.role}.
`;

    try {
      const response = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      const answer = response.content as string;
      const confidence = this.calculateConfidence(sources.length, strategy.complexity);

      return {
        answer,
        confidence,
        tokensUsed: answer.length / 4 // Rough estimate
      };

    } catch (error) {
      logger.error('Core response generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate contextual enhancements
   */
  private async generateEnhancements(
    query: string,
    context: UserContext,
    strategy: any
  ): Promise<ContextualResponse['enhancements']> {
    const enhancements: ContextualResponse['enhancements'] = {
      visualGuides: [],
      codeExamples: [],
      relatedWorkflows: [],
      advancedTips: []
    };

    // Add visual guides if requested
    if (context.preferences.includeScreenshots) {
      enhancements.visualGuides = this.generateVisualGuides(query, context);
    }

    // Add code examples if requested or for developers
    if (context.preferences.includeCode || context.role === 'developer') {
      enhancements.codeExamples = this.generateCodeExamples(query, context);
    }

    // Add advanced tips for experienced users
    if (context.preferences.includeAdvancedTips || context.experience === 'expert') {
      enhancements.advancedTips = this.generateAdvancedTips(query, context);
    }

    // Add related workflows
    enhancements.relatedWorkflows = this.generateRelatedWorkflows(query, context);

    return enhancements;
  }

  /**
   * Generate follow-up suggestions
   */
  private generateFollowUp(
    query: string,
    context: UserContext,
    sources: any[]
  ): ContextualResponse['followUp'] {
    const isHebrew = context.language === 'hebrew';

    // Context-aware follow-up questions
    const suggestedQuestions = this.generateSuggestedQuestions(query, context, isHebrew);
    const nextSteps = this.generateNextSteps(query, context, isHebrew);
    const relatedFeatures = this.generateRelatedFeatures(query, context);

    return {
      suggestedQuestions,
      nextSteps,
      relatedFeatures
    };
  }

  /**
   * Build context-aware system prompt
   */
  private buildSystemPrompt(context: UserContext, strategy: any): string {
    const isHebrew = context.language === 'hebrew';

    const basePrompt = isHebrew ? `
אתה מומחה WeSign מתקדם המתמחה בפלטפורמת החתימות הדיגיטליות.
המשתמש הוא ${this.getRoleInHebrew(context.role)} ברמת ניסיון ${this.getExperienceInHebrew(context.experience)}.

עקרונות מנחים:
- התאם את התשובה לרמת הניסיון של המשתמש
- השתמש בטרמינולוגיה מתאימה לתפקיד שלו
- תן תשובות ב${this.getResponseStyleInHebrew(context.preferences.responseStyle)}
- כלול המלצות מעשיות ורלוונטיות
- שמור על טון מקצועי וידידותי
` : `
You are an advanced WeSign expert specializing in the digital signature platform.
The user is a ${context.role} with ${context.experience} experience level.

Guiding principles:
- Adapt response to user's experience level
- Use terminology appropriate for their role
- Provide ${context.preferences.responseStyle} responses
- Include practical and relevant recommendations
- Maintain a professional and friendly tone
`;

    // Add role-specific guidance
    if (strategy.roleSpecific) {
      const roleGuidance = this.getRoleSpecificGuidance(context.role, isHebrew);
      return basePrompt + '\n\n' + roleGuidance;
    }

    return basePrompt;
  }

  /**
   * Helper methods for context building
   */
  private getResponseStyleInHebrew(style: string): string {
    const styles = {
      'concise': 'תמציתי',
      'detailed': 'מפורט',
      'step_by_step': 'שלב אחר שלב'
    };
    return styles[style] || 'מפורט';
  }

  private getExperienceInHebrew(experience: string): string {
    const experiences = {
      'beginner': 'מתחיל',
      'intermediate': 'בינוני',
      'expert': 'מומחה'
    };
    return experiences[experience] || 'בינוני';
  }

  private getRoleInHebrew(role: string): string {
    const roles = {
      'admin': 'מנהל מערכת',
      'user': 'משתמש',
      'power_user': 'משתמש מתקדם',
      'developer': 'מפתח'
    };
    return roles[role] || 'משתמש';
  }

  private getRoleSpecificGuidance(role: string, isHebrew: boolean): string {
    const guidance = {
      admin: {
        hebrew: 'התמקד בניהול משתמשים, הגדרות מערכת, ודוחות ניהוליים.',
        english: 'Focus on user management, system settings, and administrative reports.'
      },
      developer: {
        hebrew: 'כלול פרטים טכניים, API calls, ודוגמאות קוד כשרלוונטי.',
        english: 'Include technical details, API calls, and code examples when relevant.'
      },
      power_user: {
        hebrew: 'כלול טיפים מתקדמים, קיצורי דרך, ואוטומציה.',
        english: 'Include advanced tips, shortcuts, and automation features.'
      }
    };

    return guidance[role]?.[isHebrew ? 'hebrew' : 'english'] || '';
  }

  private generateVisualGuides(query: string, context: UserContext): any[] {
    // Generate context-aware visual guide suggestions
    const guides = [];

    if (query.toLowerCase().includes('contact') || query.includes('קשר')) {
      guides.push({
        type: 'screenshot',
        description: context.language === 'hebrew'
          ? 'צילום מסך של דף ניהול אנשי קשר'
          : 'Screenshot of contacts management page'
      });
    }

    return guides;
  }

  private generateCodeExamples(query: string, context: UserContext): any[] {
    const examples = [];

    if (context.role === 'developer' && query.toLowerCase().includes('api')) {
      examples.push({
        language: 'curl',
        title: 'Add Contact API Call',
        code: `curl -X POST https://api.wesign.com/contacts \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John Doe", "email": "john@example.com"}'`
      });
    }

    return examples;
  }

  private generateAdvancedTips(query: string, context: UserContext): string[] {
    const tips = [];

    if (context.experience === 'expert') {
      if (context.language === 'hebrew') {
        tips.push('השתמש בטמפלטים כדי לזרז את התהליך');
        tips.push('הגדר אוטומציה לתהליכים חוזרים');
      } else {
        tips.push('Use templates to accelerate the process');
        tips.push('Set up automation for recurring workflows');
      }
    }

    return tips;
  }

  private generateRelatedWorkflows(query: string, context: UserContext): string[] {
    // Generate context-aware workflow suggestions
    const workflows = [];

    if (query.toLowerCase().includes('contact')) {
      workflows.push('Document Sending', 'Template Management');
    }

    return workflows;
  }

  private generateSuggestedQuestions(query: string, context: UserContext, isHebrew: boolean): string[] {
    // Generate context-aware follow-up questions
    const questions = [];

    if (query.toLowerCase().includes('contact') || query.includes('קשר')) {
      if (isHebrew) {
        questions.push('איך אני יכול לערוך איש קשר קיים?');
        questions.push('איך אני מייבא אנשי קשר מקובץ?');
      } else {
        questions.push('How can I edit an existing contact?');
        questions.push('How do I import contacts from a file?');
      }
    }

    return questions;
  }

  private generateNextSteps(query: string, context: UserContext, isHebrew: boolean): string[] {
    const steps = [];

    if (isHebrew) {
      steps.push('נסה את הפעולה במערכת');
      steps.push('בדוק את התוצאות');
    } else {
      steps.push('Try the action in the system');
      steps.push('Verify the results');
    }

    return steps;
  }

  private generateRelatedFeatures(query: string, context: UserContext): string[] {
    return ['Bulk Operations', 'Advanced Search', 'Reporting'];
  }

  private calculateConfidence(sourceCount: number, complexity: string): number {
    let base = Math.min(0.9, 0.5 + (sourceCount * 0.05));

    if (complexity === 'simple') base += 0.05;
    if (complexity === 'advanced') base -= 0.05;

    return Math.max(0.1, Math.min(0.95, base));
  }

  private updateUserContext(userId: string, query: string, response: ContextualResponse): void {
    const context = this.userContexts.get(userId);
    if (context) {
      context.previousQueries.push(query);

      // Keep only last 10 queries
      if (context.previousQueries.length > 10) {
        context.previousQueries = context.previousQueries.slice(-10);
      }

      this.userContexts.set(userId, context);
    }
  }

  /**
   * Initialize response templates
   */
  private initializeTemplates(): void {
    // Initialize with common response patterns
    this.responseTemplates.set('tutorial', {
      structure: ['introduction', 'prerequisites', 'steps', 'verification', 'troubleshooting'],
      tone: 'instructional'
    });

    this.responseTemplates.set('reference', {
      structure: ['definition', 'purpose', 'usage', 'examples', 'related'],
      tone: 'informational'
    });
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      activeUsers: this.userContexts.size,
      responseTemplates: this.responseTemplates.size,
      lastGenerated: new Date().toISOString()
    };
  }
}

export default AdvancedResponseGenerator;