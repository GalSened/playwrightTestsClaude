/**
 * Template Engine - Generates WeSign-specific Jira issue templates
 * Supports bilingual templates and contextual issue creation
 */

import { logger } from '@/utils/logger';
import type { TestFailureIssueData } from '@/types/agents';

export interface IssueTemplate {
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  labels: string[];
  customFields?: Record<string, any>;
}

interface TemplateContext {
  testName: string;
  wesignModule: string;
  language: string;
  environment: string;
  browserType: string;
  errorMessage: string;
  selector?: string;
  url: string;
  stackTrace?: string;
  testRunId: string;
  failureHash: string;
  screenshots: string[];
}

export class TemplateEngine {
  private templates: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Generate issue template based on failure data
   */
  async generateIssueTemplate(failureData: TestFailureIssueData): Promise<IssueTemplate> {
    try {
      const context = this.buildTemplateContext(failureData);
      const templateKey = this.selectTemplate(failureData);
      const template = this.templates.get(templateKey);

      if (!template) {
        logger.warn(`Template not found: ${templateKey}, using default`);
        return this.generateDefaultTemplate(context);
      }

      return {
        summary: this.renderTemplate(template.summary, context),
        description: this.renderTemplate(template.description, context),
        issueType: template.issueType || 'Bug',
        priority: failureData.priority || 'Medium',
        labels: this.generateLabels(context),
        customFields: this.generateCustomFields(context, template.customFields)
      };
    } catch (error) {
      logger.error('Failed to generate issue template:', error);
      return this.generateFallbackTemplate(failureData);
    }
  }

  private buildTemplateContext(failureData: TestFailureIssueData): TemplateContext {
    return {
      testName: failureData.testName,
      wesignModule: failureData.wesignModule,
      language: failureData.language,
      environment: failureData.environment,
      browserType: failureData.browserType,
      errorMessage: failureData.errorMessage,
      selector: failureData.selector,
      url: failureData.url,
      stackTrace: failureData.stackTrace,
      testRunId: failureData.testRunId,
      failureHash: failureData.failureHash,
      screenshots: failureData.screenshots
    };
  }

  private selectTemplate(failureData: TestFailureIssueData): string {
    const failureCategory = this.categorizeFailure(failureData.errorMessage);
    
    // Build template key based on context
    const templateKeys = [
      `wesign-${failureCategory}-${failureData.wesignModule}-${failureData.language}`,
      `wesign-${failureCategory}-${failureData.language}`,
      `wesign-${failureCategory}`,
      `wesign-default-${failureData.language}`,
      'wesign-default'
    ];

    for (const key of templateKeys) {
      if (this.templates.has(key)) {
        return key;
      }
    }

    return 'wesign-default';
  }

  private categorizeFailure(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('selector') || message.includes('element')) return 'ui';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('api') || message.includes('http')) return 'api';
    if (message.includes('auth') || message.includes('login')) return 'auth';
    if (message.includes('data') || message.includes('validation')) return 'data';
    if (message.includes('performance') || message.includes('slow')) return 'performance';
    if (message.includes('network') || message.includes('connection')) return 'network';
    
    return 'general';
  }

  private renderTemplate(template: string, context: TemplateContext): string {
    let result = template;
    
    // Replace all template variables
    Object.entries(context).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const stringValue = Array.isArray(value) ? value.join(', ') : String(value || '');
      result = result.replace(regex, stringValue);
    });

    // Handle conditional blocks
    result = this.processConditionalBlocks(result, context);
    
    // Handle screenshot attachments
    result = this.processScreenshotBlocks(result, context.screenshots);
    
    return result;
  }

  private processConditionalBlocks(template: string, context: TemplateContext): string {
    // Handle {{#if condition}} blocks
    const ifRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    return template.replace(ifRegex, (match, condition, content) => {
      const value = context[condition as keyof TemplateContext];
      return value ? content : '';
    });
  }

  private processScreenshotBlocks(template: string, screenshots: string[]): string {
    // Handle {{#screenshots}} blocks
    const screenshotRegex = /{{#screenshots}}([\s\S]*?){{\/screenshots}}/g;
    return template.replace(screenshotRegex, (match, content) => {
      if (screenshots.length === 0) return '';
      
      return screenshots.map(screenshot => {
        const filename = screenshot.split('/').pop() || 'screenshot.png';
        return content.replace(/{{\.}}/g, filename);
      }).join('\n');
    });
  }

  private generateLabels(context: TemplateContext): string[] {
    const labels = [
      'wesign',
      'automated-test',
      context.wesignModule,
      context.language,
      context.environment,
      this.categorizeFailure(context.errorMessage)
    ];

    // Add browser-specific label
    if (context.browserType) {
      labels.push(context.browserType.toLowerCase());
    }

    return labels.filter(Boolean);
  }

  private generateCustomFields(context: TemplateContext, templateCustomFields?: Record<string, string>): Record<string, any> {
    const customFields: Record<string, any> = {};

    // Apply template custom fields
    if (templateCustomFields) {
      Object.entries(templateCustomFields).forEach(([fieldId, template]) => {
        customFields[fieldId] = this.renderTemplate(template, context);
      });
    }

    return customFields;
  }

  private generateDefaultTemplate(context: TemplateContext): IssueTemplate {
    const languageTitle = context.language === 'hebrew' ? 'עברית' : 
                         context.language === 'english' ? 'English' : 'Bilingual';
    
    return {
      summary: `Test Failure: ${context.testName} (${context.wesignModule})`,
      description: this.generateDefaultDescription(context),
      issueType: 'Bug',
      priority: 'Medium',
      labels: this.generateLabels(context)
    };
  }

  private generateDefaultDescription(context: TemplateContext): string {
    const languageTitle = context.language === 'hebrew' ? 'עברית' : 
                         context.language === 'english' ? 'English' : 'Bilingual';

    return `
h2. Test Failure Summary
*Test:* ${context.testName}
*Module:* ${context.wesignModule}
*Environment:* ${context.environment}
*Browser:* ${context.browserType}
*Language:* ${languageTitle}

h2. Error Details
*Error Message:* ${context.errorMessage}
${context.selector ? `*Selector:* ${context.selector}` : ''}
*URL:* ${context.url}

${context.stackTrace ? `h2. Technical Details
*Stack Trace:*
{code}
${context.stackTrace}
{code}` : ''}

h2. Test Information
*Test Run ID:* ${context.testRunId}
*Failure Hash:* ${context.failureHash}

${context.screenshots.length > 0 ? `h2. Screenshots
${context.screenshots.map(s => `!${s.split('/').pop()}!`).join('\n')}` : ''}
    `.trim();
  }

  private generateFallbackTemplate(failureData: TestFailureIssueData): IssueTemplate {
    return {
      summary: `Automated Test Failure: ${failureData.testName}`,
      description: `Error: ${failureData.errorMessage}\nURL: ${failureData.url}`,
      issueType: 'Bug',
      priority: failureData.priority || 'Medium',
      labels: ['wesign', 'automated-test', 'fallback']
    };
  }

  private initializeDefaultTemplates(): void {
    // WeSign UI Test Failure (Hebrew)
    this.templates.set('wesign-ui-hebrew', {
      summary: 'בדיקת UI נכשלה: {{testName}} - {{wesignModule}}',
      description: `
h2. סיכום כשל בדיקה
*בדיקה:* {{testName}}
*מודול:* {{wesignModule}}
*סביבה:* {{environment}}
*דפדפן:* {{browserType}}
*שפה:* עברית

h2. פרטי שגיאה
*הודעת שגיאה:* {{errorMessage}}
{{#if selector}}*Selector:* {{selector}}{{/if}}
*URL:* {{url}}

{{#if stackTrace}}
h2. פרטים טכניים
*Stack Trace:*
{code}
{{stackTrace}}
{code}
{{/if}}

h2. צילומי מסך
{{#screenshots}}
!{{.}}!
{{/screenshots}}

h2. מידע על הבדיקה
*Test Run ID:* {{testRunId}}
*Failure Hash:* {{failureHash}}
      `.trim(),
      issueType: 'Bug',
      customFields: {
        'customfield_10001': '{{environment}}',
        'customfield_10002': '{{wesignModule}}'
      }
    });

    // WeSign UI Test Failure (English)
    this.templates.set('wesign-ui-english', {
      summary: 'UI Test Failure: {{testName}} - {{wesignModule}}',
      description: `
h2. Test Failure Summary
*Test:* {{testName}}
*Module:* {{wesignModule}}
*Environment:* {{environment}}
*Browser:* {{browserType}}
*Language:* English

h2. Error Details
*Error Message:* {{errorMessage}}
{{#if selector}}*Selector:* {{selector}}{{/if}}
*URL:* {{url}}

{{#if stackTrace}}
h2. Technical Details
*Stack Trace:*
{code}
{{stackTrace}}
{code}
{{/if}}

h2. Screenshots
{{#screenshots}}
!{{.}}!
{{/screenshots}}

h2. Test Information
*Test Run ID:* {{testRunId}}
*Failure Hash:* {{failureHash}}
      `.trim(),
      issueType: 'Bug',
      customFields: {
        'customfield_10001': '{{environment}}',
        'customfield_10002': '{{wesignModule}}'
      }
    });

    // WeSign API Test Failure
    this.templates.set('wesign-api', {
      summary: 'API Test Failure: {{testName}} - {{wesignModule}}',
      description: `
h2. API Test Failure Summary
*Test:* {{testName}}
*Module:* {{wesignModule}}
*Environment:* {{environment}}
*Language:* {{language}}

h2. API Error Details
*Error Message:* {{errorMessage}}
*URL:* {{url}}

h2. Request Details
{{#if stackTrace}}
*Response/Stack Trace:*
{code:json}
{{stackTrace}}
{code}
{{/if}}

h2. Test Information
*Test Run ID:* {{testRunId}}
*Failure Hash:* {{failureHash}}
      `.trim(),
      issueType: 'Bug'
    });

    // WeSign Performance Issue
    this.templates.set('wesign-performance', {
      summary: 'Performance Issue: {{testName}} - {{wesignModule}}',
      description: `
h2. Performance Issue Summary
*Test:* {{testName}}
*Module:* {{wesignModule}}
*Environment:* {{environment}}
*Browser:* {{browserType}}

h2. Performance Details
*Issue:* {{errorMessage}}
*URL:* {{url}}

h2. Impact Analysis
*Business Process:* {{wesignModule}}
*Language Support:* {{language}}

h2. Technical Information
*Test Run ID:* {{testRunId}}
*Environment:* {{environment}}
      `.trim(),
      issueType: 'Task',
      customFields: {
        'customfield_10003': '{{environment}}',
        'customfield_10004': '{{wesignModule}}'
      }
    });

    // WeSign Authentication Issue
    this.templates.set('wesign-auth', {
      summary: 'Authentication Issue: {{testName}}',
      description: `
h2. Authentication Failure Summary
*Test:* {{testName}}
*Module:* {{wesignModule}}
*Environment:* {{environment}}
*Language:* {{language}}

h2. Authentication Error
*Error Message:* {{errorMessage}}
*URL:* {{url}}

{{#if selector}}
*Failed Element:* {{selector}}
{{/if}}

h2. Security Impact
*Module Affected:* {{wesignModule}}
*Environment:* {{environment}}

h2. Test Information
*Test Run ID:* {{testRunId}}
*Failure Hash:* {{failureHash}}
      `.trim(),
      issueType: 'Bug'
    });

    // Default template
    this.templates.set('wesign-default', {
      summary: 'Test Failure: {{testName}} - {{wesignModule}}',
      description: `
h2. Test Failure Summary
*Test:* {{testName}}
*Module:* {{wesignModule}}
*Environment:* {{environment}}
*Browser:* {{browserType}}
*Language:* {{language}}

h2. Error Details
*Error Message:* {{errorMessage}}
{{#if selector}}*Selector:* {{selector}}{{/if}}
*URL:* {{url}}

{{#if stackTrace}}
h2. Technical Details
*Stack Trace:*
{code}
{{stackTrace}}
{code}
{{/if}}

h2. Screenshots
{{#screenshots}}
!{{.}}!
{{/screenshots}}

h2. Test Information
*Test Run ID:* {{testRunId}}
*Failure Hash:* {{failureHash}}
      `.trim(),
      issueType: 'Bug'
    });

    logger.info('Jira issue templates initialized successfully');
  }

  /**
   * Add or update a template
   */
  addTemplate(key: string, template: any): void {
    this.templates.set(key, template);
    logger.info(`Template added/updated: ${key}`);
  }

  /**
   * Get all template keys
   */
  getTemplateKeys(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Check if template exists
   */
  hasTemplate(key: string): boolean {
    return this.templates.has(key);
  }
}