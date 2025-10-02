/**
 * WeSign Knowledge Base Integrator
 * Integrates WeSign codebase analysis directly into the knowledge base
 * for enhanced AI understanding and context-aware responses
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '@/utils/logger';
import { KnowledgeIngestionService } from './knowledgeIngestionService';
import WeSignCodebaseAnalyzer, { WeSignCodeStructure, WeSignComponent, WeSignWorkflow } from './wesignCodebaseAnalyzer';

export interface WeSignKnowledgeBase {
  codebaseAnalysis: WeSignCodeStructure;
  componentMap: Map<string, ComponentKnowledge>;
  workflowMap: Map<string, WorkflowKnowledge>;
  selectorMap: Map<string, SelectorKnowledge>;
  apiEndpointMap: Map<string, ApiKnowledge>;
  lastUpdated: Date;
}

export interface ComponentKnowledge {
  name: string;
  businessFunction: string;
  testableElements: TestableElement[];
  commonFailures: FailurePattern[];
  selectorRecommendations: SelectorRecommendation[];
  i18nKeys: string[];
  dependencies: string[];
  routes: string[];
}

export interface TestableElement {
  type: 'button' | 'input' | 'select' | 'form' | 'modal' | 'dropdown';
  selector: string;
  dataTestId?: string;
  stableSelector?: string;
  description: string;
  i18nKey?: string;
  stability: 'high' | 'medium' | 'low';
  commonIssues: string[];
}

export interface FailurePattern {
  type: string;
  description: string;
  commonSelectors: string[];
  rootCauses: string[];
  healingStrategies: string[];
}

export interface SelectorRecommendation {
  element: string;
  primary: string;
  fallbacks: string[];
  stability: number;
  notes: string[];
}

export interface WorkflowKnowledge {
  name: string;
  steps: WorkflowStep[];
  criticalPath: boolean;
  components: string[];
  apis: string[];
  commonFailurePoints: FailurePoint[];
  testStrategies: TestStrategy[];
}

export interface WorkflowStep {
  order: number;
  name: string;
  component: string;
  selectors: string[];
  expectedState: string;
  validations: string[];
  nextSteps: string[];
}

export interface FailurePoint {
  step: string;
  component: string;
  commonError: string;
  healingStrategy: string;
}

export interface TestStrategy {
  name: string;
  description: string;
  approach: string;
  selectors: string[];
  assertions: string[];
}

export interface SelectorKnowledge {
  element: string;
  component: string;
  primary: string;
  alternatives: string[];
  stability: number;
  lastTested: Date;
  successRate: number;
}

export interface ApiKnowledge {
  endpoint: string;
  method: string;
  description: string;
  parameters: any[];
  responses: any[];
  dependencies: string[];
  testData: any;
}

export class WeSignKnowledgeIntegrator {
  private knowledgeIngestion: KnowledgeIngestionService;
  private dashboardAnalyzer: WeSignCodebaseAnalyzer;
  private signerAnalyzer: WeSignCodebaseAnalyzer;
  private wesignDashboardPath: string;
  private wesignSignerPath: string;
  private knowledgeBase: WeSignKnowledgeBase;

  constructor() {
    this.knowledgeIngestion = new KnowledgeIngestionService();
    this.wesignDashboardPath = 'C:\\Users\\gals\\Desktop\\wesign-client-DEV';
    this.wesignSignerPath = 'C:\\Users\\gals\\Desktop\\wesignsigner-client-app-DEV';
    this.dashboardAnalyzer = new WeSignCodebaseAnalyzer(this.wesignDashboardPath);
    this.signerAnalyzer = new WeSignCodebaseAnalyzer(this.wesignSignerPath);
    this.knowledgeBase = this.initializeKnowledgeBase();
  }

  /**
   * Initialize and populate the WeSign knowledge base
   */
  async initializeWeSignKnowledge(): Promise<WeSignKnowledgeBase> {
    logger.info('Initializing comprehensive WeSign knowledge base');

    try {
      // Step 1: Analyze the WeSign client codebase
      const codeStructure = await this.analyzeWeSignClientApp();

      // Step 2: Extract detailed component knowledge
      await this.extractComponentKnowledge(codeStructure);

      // Step 3: Map workflows to components and selectors
      await this.mapWorkflowsToImplementation(codeStructure);

      // Step 4: Analyze testable elements and generate selectors
      await this.generateSelectorKnowledge(codeStructure);

      // Step 5: Create API endpoint mappings
      await this.mapApiEndpoints(codeStructure);

      // Step 6: Ingest all knowledge into database
      await this.ingestAllKnowledge();

      this.knowledgeBase.lastUpdated = new Date();

      logger.info('WeSign knowledge base initialization completed', {
        components: this.knowledgeBase.componentMap.size,
        workflows: this.knowledgeBase.workflowMap.size,
        selectors: this.knowledgeBase.selectorMap.size,
        apis: this.knowledgeBase.apiEndpointMap.size
      });

      return this.knowledgeBase;

    } catch (error) {
      logger.error('Failed to initialize WeSign knowledge base:', error);
      throw error;
    }
  }

  /**
   * Analyze BOTH WeSign client applications in detail
   */
  private async analyzeWeSignClientApp(): Promise<WeSignCodeStructure> {
    logger.info('Analyzing BOTH WeSign client applications (Dashboard + Signer)');

    // Analyze Dashboard Client (main app with contacts, documents, etc.)
    logger.info('Analyzing WeSign Dashboard Client');
    const dashboardStructure = await this.analyzeActualClientApp(this.wesignDashboardPath, 'dashboard');

    // Analyze Signer Client (signing-focused app)
    logger.info('Analyzing WeSign Signer Client');
    const signerStructure = await this.analyzeActualClientApp(this.wesignSignerPath, 'signer');

    // Merge both client structures for comprehensive knowledge
    return this.mergeBothClientStructures(dashboardStructure, signerStructure);
  }

  /**
   * Analyze the actual WeSign client app at the specified path
   */
  private async analyzeActualClientApp(clientPath: string, clientType: 'dashboard' | 'signer'): Promise<WeSignCodeStructure> {
    const structure: WeSignCodeStructure = {
      frontend: {
        framework: 'Angular',
        version: '15.2.10',
        components: [],
        routes: [],
        services: [],
        models: []
      },
      backend: {
        framework: 'REST API',
        version: 'Unknown',
        controllers: [],
        businessLogic: [],
        dataAccess: [],
        models: []
      },
      features: [],
      workflows: [],
      apiEndpoints: []
    };

    // Analyze actual components from the filesystem
    const componentsDir = path.join(clientPath, 'src', 'app', 'components');
    if (fs.existsSync(componentsDir)) {
      structure.frontend.components = await this.scanActualComponents(componentsDir, clientType);
    }

    // Analyze actual services
    const servicesDir = path.join(clientPath, 'src', 'app', 'services');
    if (fs.existsSync(servicesDir)) {
      structure.frontend.services = await this.scanActualServices(servicesDir);
    }

    // Analyze actual routes
    const routingFile = path.join(clientPath, 'src', 'app', 'app-routing.module.ts');
    if (fs.existsSync(routingFile)) {
      structure.frontend.routes = await this.scanActualRoutes(routingFile);
    }

    // Define enhanced workflows based on actual app structure and client type
    structure.workflows = this.defineEnhancedWorkflows(structure.frontend.components, clientType);

    return structure;
  }

  /**
   * Merge both client structures for comprehensive knowledge
   */
  private mergeBothClientStructures(dashboardStructure: WeSignCodeStructure, signerStructure: WeSignCodeStructure): WeSignCodeStructure {
    logger.info('Merging Dashboard and Signer client structures');

    // Combine components from both clients
    const allComponents = [
      ...dashboardStructure.frontend.components.map(comp => ({ ...comp, clientType: 'dashboard' })),
      ...signerStructure.frontend.components.map(comp => ({ ...comp, clientType: 'signer' }))
    ];

    // Combine services
    const allServices = [
      ...dashboardStructure.frontend.services,
      ...signerStructure.frontend.services
    ];

    // Combine routes
    const allRoutes = [
      ...dashboardStructure.frontend.routes,
      ...signerStructure.frontend.routes
    ];

    // Combine workflows
    const allWorkflows = [
      ...dashboardStructure.workflows,
      ...signerStructure.workflows
    ];

    return {
      frontend: {
        framework: 'Angular',
        version: '15.2.10',
        components: allComponents,
        routes: allRoutes,
        services: allServices,
        models: [...dashboardStructure.frontend.models, ...signerStructure.frontend.models]
      },
      backend: dashboardStructure.backend, // Assume same backend
      features: this.mergeFeatures(dashboardStructure, signerStructure),
      workflows: allWorkflows,
      apiEndpoints: [...dashboardStructure.apiEndpoints, ...signerStructure.apiEndpoints]
    };
  }

  /**
   * Merge features from both clients
   */
  private mergeFeatures(dashboardStructure: WeSignCodeStructure, signerStructure: WeSignCodeStructure): any[] {
    const dashboardFeatures = [
      'Document Management Dashboard',
      'Contact Management',
      'Group Signing Orchestration',
      'Template Management',
      'Reporting & Analytics',
      'User Administration'
    ];

    const signerFeatures = [
      'Individual Document Signing',
      'Digital Signature Creation',
      'Authentication Flows',
      'Smart Card Integration',
      'OTP Verification',
      'Document Field Completion'
    ];

    return [
      ...dashboardFeatures.map(feature => ({ name: feature, clientType: 'dashboard' })),
      ...signerFeatures.map(feature => ({ name: feature, clientType: 'signer' }))
    ];
  }

  /**
   * Scan actual components from filesystem
   */
  private async scanActualComponents(componentsDir: string, clientType: 'dashboard' | 'signer'): Promise<WeSignComponent[]> {
    const components: WeSignComponent[] = [];

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (item.endsWith('.component.ts')) {
            const component = await this.analyzeActualComponent(fullPath);
            if (component) {
              components.push(component);
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan directory: ${dir}`, error);
      }
    };

    await scanDirectory(componentsDir);
    return components;
  }

  /**
   * Analyze an actual component file
   */
  private async analyzeActualComponent(componentPath: string): Promise<WeSignComponent | null> {
    try {
      const content = fs.readFileSync(componentPath, 'utf-8');
      const componentName = path.basename(path.dirname(componentPath));

      // Extract template path
      const templateMatch = content.match(/templateUrl:\s*['"]([^'"]+)['"]/);
      const templatePath = templateMatch ?
        path.join(path.dirname(componentPath), templateMatch[1]) : null;

      // Analyze template for testable elements
      const testableElements = templatePath && fs.existsSync(templatePath) ?
        await this.extractTestableElements(templatePath) : [];

      return {
        name: componentName,
        path: componentPath,
        type: this.determineComponentType(componentName, content),
        features: this.extractComponentFeatures(componentName, content),
        dependencies: this.extractComponentDependencies(content),
        hebrewSupport: this.detectHebrewSupport(content, templatePath)
      };

    } catch (error) {
      logger.warn(`Failed to analyze component: ${componentPath}`, error);
      return null;
    }
  }

  /**
   * Extract testable elements from template
   */
  private async extractTestableElements(templatePath: string): Promise<TestableElement[]> {
    try {
      const template = fs.readFileSync(templatePath, 'utf-8');
      const elements: TestableElement[] = [];

      // Extract buttons
      const buttonRegex = /<button[^>]*([^>]*)>(.*?)<\/button>/gs;
      let match;
      while ((match = buttonRegex.exec(template)) !== null) {
        const attributes = match[1];
        const content = match[2];

        elements.push({
          type: 'button',
          selector: this.generateButtonSelector(attributes, content),
          dataTestId: this.extractDataTestId(attributes),
          stableSelector: this.generateStableSelector('button', attributes),
          description: `Button: ${this.extractButtonText(content)}`,
          stability: this.assessStability(attributes),
          commonIssues: this.identifyCommonButtonIssues(attributes, content)
        });
      }

      // Extract inputs
      const inputRegex = /<input[^>]*([^>]*)\/?>/gs;
      while ((match = inputRegex.exec(template)) !== null) {
        const attributes = match[1];

        elements.push({
          type: 'input',
          selector: this.generateInputSelector(attributes),
          dataTestId: this.extractDataTestId(attributes),
          stableSelector: this.generateStableSelector('input', attributes),
          description: `Input: ${this.extractInputType(attributes)}`,
          stability: this.assessStability(attributes),
          commonIssues: this.identifyCommonInputIssues(attributes)
        });
      }

      // Extract select elements
      const selectRegex = /<select[^>]*([^>]*)>.*?<\/select>/gs;
      while ((match = selectRegex.exec(template)) !== null) {
        const attributes = match[1];

        elements.push({
          type: 'select',
          selector: this.generateSelectSelector(attributes),
          dataTestId: this.extractDataTestId(attributes),
          stableSelector: this.generateStableSelector('select', attributes),
          description: `Select: ${this.extractSelectName(attributes)}`,
          stability: this.assessStability(attributes),
          commonIssues: this.identifyCommonSelectIssues(attributes)
        });
      }

      return elements;

    } catch (error) {
      logger.warn(`Failed to extract testable elements from: ${templatePath}`, error);
      return [];
    }
  }

  /**
   * Extract detailed component knowledge
   */
  private async extractComponentKnowledge(structure: WeSignCodeStructure): Promise<void> {
    logger.info('Extracting detailed component knowledge');

    for (const component of structure.frontend.components) {
      const knowledge: ComponentKnowledge = {
        name: component.name,
        businessFunction: this.determineBusinessFunction(component.name),
        testableElements: await this.getTestableElementsForComponent(component),
        commonFailures: this.identifyCommonFailures(component.name),
        selectorRecommendations: this.generateSelectorRecommendations(component.name),
        i18nKeys: this.extractI18nKeys(component),
        dependencies: component.dependencies,
        routes: this.getComponentRoutes(component.name, structure.frontend.routes)
      };

      this.knowledgeBase.componentMap.set(component.name, knowledge);
    }
  }

  /**
   * Map workflows to actual implementation
   */
  private async mapWorkflowsToImplementation(structure: WeSignCodeStructure): Promise<void> {
    logger.info('Mapping workflows to implementation');

    // Define actual workflows based on analyzed components
    const workflows = [
      {
        name: 'Document Signing Workflow',
        steps: [
          {
            order: 1,
            name: 'Access Document',
            component: 'main-signer',
            selectors: ['[data-testid="document-container"]', '.document-viewer'],
            expectedState: 'Document loaded and displayed',
            validations: ['Document content visible', 'Signature fields identified'],
            nextSteps: ['Complete required fields', 'Navigate to signature pad']
          },
          {
            order: 2,
            name: 'Complete Form Fields',
            component: 'text-field',
            selectors: ['input[data-field-type="text"]', '.form-field input'],
            expectedState: 'All required fields completed',
            validations: ['Field validation passed', 'Required fields filled'],
            nextSteps: ['Proceed to signature']
          },
          {
            order: 3,
            name: 'Create Digital Signature',
            component: 'sign-pad',
            selectors: ['[data-testid="signature-pad"]', 'canvas.signature-pad'],
            expectedState: 'Signature created and accepted',
            validations: ['Signature not empty', 'Signature quality acceptable'],
            nextSteps: ['Submit document']
          },
          {
            order: 4,
            name: 'Submit Signed Document',
            component: 'success-page',
            selectors: ['[data-testid="submit-button"]', 'button.submit'],
            expectedState: 'Document submitted successfully',
            validations: ['Success confirmation displayed'],
            nextSteps: []
          }
        ],
        criticalPath: true,
        components: ['main-signer', 'text-field', 'sign-pad', 'success-page'],
        apis: ['/api/documents/get', '/api/documents/submit', '/api/signature/create'],
        commonFailurePoints: [
          {
            step: 'Create Digital Signature',
            component: 'sign-pad',
            commonError: 'Signature pad not responsive',
            healingStrategy: 'Wait for canvas element to be fully loaded and interactive'
          }
        ],
        testStrategies: [
          {
            name: 'End-to-End Signature Flow',
            description: 'Complete document signing from start to finish',
            approach: 'Sequential step validation',
            selectors: ['[data-testid="document-container"]', '[data-testid="signature-pad"]', '[data-testid="submit-button"]'],
            assertions: ['Document loaded', 'Signature created', 'Submission successful']
          }
        ]
      },
      {
        name: 'Authentication Workflow',
        steps: [
          {
            order: 1,
            name: 'Select Authentication Method',
            component: 'oauth-comsign-idp',
            selectors: ['[data-testid="auth-method-selector"]', '.auth-options'],
            expectedState: 'Authentication method selected',
            validations: ['Method selection visible', 'Selected method highlighted'],
            nextSteps: ['Proceed with selected method']
          },
          {
            order: 2,
            name: 'Smart Card Authentication',
            component: 'smart-card-alert',
            selectors: ['[data-testid="smart-card-reader"]', '.smart-card-prompt'],
            expectedState: 'Smart card detected and read',
            validations: ['Card reader connected', 'Certificate valid'],
            nextSteps: ['Complete identity verification']
          }
        ],
        criticalPath: true,
        components: ['oauth-comsign-idp', 'smart-card-alert', 'identity-success'],
        apis: ['/api/auth/methods', '/api/auth/smartcard', '/api/auth/verify'],
        commonFailurePoints: [
          {
            step: 'Smart Card Authentication',
            component: 'smart-card-alert',
            commonError: 'Smart card reader not detected',
            healingStrategy: 'Check for alternative authentication method or retry with timeout'
          }
        ],
        testStrategies: [
          {
            name: 'OAuth Flow Test',
            description: 'Test OAuth authentication flow',
            approach: 'Mock OAuth responses',
            selectors: ['[data-testid="oauth-button"]', '[data-testid="auth-callback"]'],
            assertions: ['OAuth redirect successful', 'Token received']
          }
        ]
      }
    ];

    // Convert to WorkflowKnowledge and store
    for (const workflow of workflows) {
      const knowledge: WorkflowKnowledge = {
        name: workflow.name,
        steps: workflow.steps,
        criticalPath: workflow.criticalPath,
        components: workflow.components,
        apis: workflow.apis,
        commonFailurePoints: workflow.commonFailurePoints,
        testStrategies: workflow.testStrategies
      };

      this.knowledgeBase.workflowMap.set(workflow.name, knowledge);
    }
  }

  /**
   * Generate comprehensive selector knowledge
   */
  private async generateSelectorKnowledge(structure: WeSignCodeStructure): Promise<void> {
    logger.info('Generating selector knowledge base');

    for (const component of structure.frontend.components) {
      const templatePath = this.getTemplatePath(component.path);
      if (templatePath && fs.existsSync(templatePath)) {
        const elements = await this.extractTestableElements(templatePath);

        for (const element of elements) {
          const selectorKnowledge: SelectorKnowledge = {
            element: `${component.name}-${element.type}`,
            component: component.name,
            primary: element.stableSelector || element.selector,
            alternatives: this.generateAlternativeSelectors(element),
            stability: element.stability === 'high' ? 0.95 : element.stability === 'medium' ? 0.75 : 0.5,
            lastTested: new Date(),
            successRate: 0.85 // Initial estimate
          };

          this.knowledgeBase.selectorMap.set(selectorKnowledge.element, selectorKnowledge);
        }
      }
    }
  }

  /**
   * Ingest all knowledge into the database with vectorization
   */
  private async ingestAllKnowledge(): Promise<void> {
    logger.info('Ingesting WeSign knowledge into database with vectorization');

    try {
      // Create comprehensive documentation files
      const docs = [
        {
          filename: 'wesign-components-knowledge.md',
          content: this.generateComponentsDocumentation(),
          category: 'wesign-components'
        },
        {
          filename: 'wesign-workflows-knowledge.md',
          content: this.generateWorkflowsDocumentation(),
          category: 'wesign-workflows'
        },
        {
          filename: 'wesign-selectors-knowledge.md',
          content: this.generateSelectorsDocumentation(),
          category: 'wesign-selectors'
        },
        {
          filename: 'wesign-i18n-knowledge.md',
          content: await this.generateI18nDocumentation(),
          category: 'wesign-i18n'
        },
        {
          filename: 'wesign-failure-patterns.md',
          content: this.generateFailurePatternsDocumentation(),
          category: 'wesign-failures'
        }
      ];

      // Ingest each documentation file
      for (const doc of docs) {
        const tempFile = this.createTempFile(doc.content, doc.filename);
        await this.knowledgeIngestion.ingestFile(tempFile, doc.category);

        // Cleanup temp file
        fs.unlinkSync(tempFile);
      }

      // NEW: Create structured vector embeddings for enhanced search
      await this.createWeSignVectorEmbeddings();

      logger.info('All WeSign knowledge successfully ingested into database with vectorization');

    } catch (error) {
      logger.error('Failed to ingest WeSign knowledge:', error);
    }
  }

  /**
   * Create structured vector embeddings for WeSign components, workflows, and selectors
   */
  private async createWeSignVectorEmbeddings(): Promise<void> {
    logger.info('Creating WeSign vector embeddings for enhanced semantic search');

    try {
      const vectorDocuments = [];

      // Create vector documents for each component
      for (const [componentName, component] of this.knowledgeBase.componentMap) {
        const componentVector = {
          content: this.createComponentVectorContent(component),
          metadata: {
            type: 'wesign-component',
            componentName: componentName,
            businessFunction: component.businessFunction,
            category: 'wesign-components',
            source: 'wesign-codebase-analysis'
          }
        };
        vectorDocuments.push(componentVector);
      }

      // Create vector documents for each workflow
      for (const [workflowName, workflow] of this.knowledgeBase.workflowMap) {
        const workflowVector = {
          content: this.createWorkflowVectorContent(workflow),
          metadata: {
            type: 'wesign-workflow',
            workflowName: workflowName,
            criticalPath: workflow.criticalPath,
            category: 'wesign-workflows',
            source: 'wesign-codebase-analysis'
          }
        };
        vectorDocuments.push(workflowVector);
      }

      // Create vector documents for selector knowledge
      for (const [elementKey, selector] of this.knowledgeBase.selectorMap) {
        const selectorVector = {
          content: this.createSelectorVectorContent(selector),
          metadata: {
            type: 'wesign-selector',
            element: elementKey,
            component: selector.component,
            stability: selector.stability,
            category: 'wesign-selectors',
            source: 'wesign-codebase-analysis'
          }
        };
        vectorDocuments.push(selectorVector);
      }

      // Create comprehensive WeSign knowledge vector
      const comprehensiveVector = {
        content: this.createComprehensiveWeSignVector(),
        metadata: {
          type: 'wesign-comprehensive',
          category: 'wesign-knowledge-base',
          source: 'wesign-codebase-analysis',
          components: this.knowledgeBase.componentMap.size,
          workflows: this.knowledgeBase.workflowMap.size,
          selectors: this.knowledgeBase.selectorMap.size
        }
      };
      vectorDocuments.push(comprehensiveVector);

      // Ingest all vector documents
      for (let i = 0; i < vectorDocuments.length; i++) {
        const doc = vectorDocuments[i];
        const tempFile = this.createTempFile(doc.content, `wesign-vector-${i}.md`);

        await this.knowledgeIngestion.ingestFile(tempFile, doc.metadata.category);

        // Cleanup
        fs.unlinkSync(tempFile);
      }

      logger.info('WeSign vector embeddings created successfully', {
        vectorDocuments: vectorDocuments.length,
        components: this.knowledgeBase.componentMap.size,
        workflows: this.knowledgeBase.workflowMap.size,
        selectors: this.knowledgeBase.selectorMap.size
      });

    } catch (error) {
      logger.error('Failed to create WeSign vector embeddings:', error);
    }
  }

  /**
   * Create vector-optimized content for component
   */
  private createComponentVectorContent(component: ComponentKnowledge): string {
    return `
WeSign Component: ${component.name}

Business Function: ${component.businessFunction}

Testable Elements:
${component.testableElements.map(el =>
  `- ${el.type}: ${el.description} (selector: ${el.selector}, stability: ${el.stability})`
).join('\n')}

Common Failures:
${component.commonFailures.map(failure =>
  `- ${failure.type}: ${failure.description}`
).join('\n')}

Selector Recommendations:
${component.selectorRecommendations.map(rec =>
  `- ${rec.element}: ${rec.primary} (stability: ${rec.stability})`
).join('\n')}

Dependencies: ${component.dependencies.join(', ')}
Routes: ${component.routes.join(', ')}
I18n Keys: ${component.i18nKeys.join(', ')}

This component is part of the ${component.businessFunction} functionality in the WeSign digital signature platform.
    `.trim();
  }

  /**
   * Create vector-optimized content for workflow
   */
  private createWorkflowVectorContent(workflow: WorkflowKnowledge): string {
    return `
WeSign Workflow: ${workflow.name}

Critical Path: ${workflow.criticalPath ? 'Yes' : 'No'}

Components Involved: ${workflow.components.join(', ')}
APIs Used: ${workflow.apis.join(', ')}

Workflow Steps:
${workflow.steps.map(step =>
  `${step.order}. ${step.name} (${step.component})
     - Selectors: ${step.selectors.join(', ')}
     - Expected State: ${step.expectedState}
     - Validations: ${step.validations.join(', ')}`
).join('\n')}

Common Failure Points:
${workflow.commonFailurePoints.map(fp =>
  `- ${fp.step}: ${fp.commonError} (healing: ${fp.healingStrategy})`
).join('\n')}

Test Strategies:
${workflow.testStrategies.map(ts =>
  `- ${ts.name}: ${ts.description} (approach: ${ts.approach})`
).join('\n')}

This workflow is ${workflow.criticalPath ? 'critical' : 'standard'} to WeSign business operations.
    `.trim();
  }

  /**
   * Create vector-optimized content for selector
   */
  private createSelectorVectorContent(selector: SelectorKnowledge): string {
    return `
WeSign Selector: ${selector.element}

Component: ${selector.component}
Primary Selector: ${selector.primary}
Alternative Selectors: ${selector.alternatives.join(', ')}
Stability Score: ${Math.round(selector.stability * 100)}%
Success Rate: ${Math.round(selector.successRate * 100)}%
Last Tested: ${selector.lastTested.toISOString()}

This selector is used for testing the ${selector.element} element in the ${selector.component} component of the WeSign platform.
Recommended for use in automated testing scenarios requiring ${selector.stability > 0.8 ? 'high' : selector.stability > 0.6 ? 'medium' : 'low'} stability.
    `.trim();
  }

  /**
   * Create comprehensive WeSign knowledge vector
   */
  private createComprehensiveWeSignVector(): string {
    return `
WeSign Digital Signature Platform - Comprehensive Knowledge Base

PLATFORM OVERVIEW:
WeSign is a comprehensive digital signature platform consisting of two main client applications:
1. Dashboard Client (wesign-client-DEV): Document management, contact management, group signing orchestration
2. Signer Client (wesignsigner-client-app-DEV): Individual document signing, authentication, signature creation

ARCHITECTURE:
- Frontend: Angular 15 with TypeScript
- Multi-language: Hebrew (RTL) and English (LTR) support
- Authentication: OAuth, Smart Card, OTP verification
- Real-time: SignalR integration for live updates

BUSINESS FUNCTIONS:
- Document Management: Upload, organize, distribute documents
- Contact Management: Maintain signer contacts and groups
- Digital Signature: Individual and group signing workflows
- Authentication: Multiple authentication methods for security
- Template Management: Reusable document templates
- Reporting: Analytics and audit trails

CRITICAL WORKFLOWS:
${Array.from(this.knowledgeBase.workflowMap.values())
  .filter(w => w.criticalPath)
  .map(w => `- ${w.name}: ${w.steps.length} steps`)
  .join('\n')}

COMPONENT COVERAGE:
Total Components: ${this.knowledgeBase.componentMap.size}
Dashboard Components: Document management, contacts, group signing, templates
Signer Components: Individual signing, authentication, signature pad, form fields

SELECTOR STABILITY:
High Stability (>80%): ${Array.from(this.knowledgeBase.selectorMap.values()).filter(s => s.stability > 0.8).length} selectors
Medium Stability (60-80%): ${Array.from(this.knowledgeBase.selectorMap.values()).filter(s => s.stability > 0.6 && s.stability <= 0.8).length} selectors
Low Stability (<60%): ${Array.from(this.knowledgeBase.selectorMap.values()).filter(s => s.stability <= 0.6).length} selectors

TESTING CONSIDERATIONS:
- Hebrew UI requires RTL layout testing
- Multiple authentication flows need separate test scenarios
- Document upload/download workflows require file handling
- Signature creation needs canvas interaction testing
- Real-time features require SignalR connection testing

This knowledge base provides comprehensive understanding of the WeSign platform for intelligent test automation, failure analysis, and quality assurance.
    `.trim();
  }

  // Documentation generation methods
  private generateComponentsDocumentation(): string {
    let doc = '# WeSign Components Knowledge Base\n\n';

    for (const [name, knowledge] of this.knowledgeBase.componentMap) {
      doc += `## Component: ${name}\n\n`;
      doc += `**Business Function**: ${knowledge.businessFunction}\n\n`;

      if (knowledge.testableElements.length > 0) {
        doc += `### Testable Elements\n`;
        for (const element of knowledge.testableElements) {
          doc += `- **${element.type}**: ${element.selector} (${element.stability} stability)\n`;
          doc += `  - Description: ${element.description}\n`;
          if (element.commonIssues.length > 0) {
            doc += `  - Common Issues: ${element.commonIssues.join(', ')}\n`;
          }
        }
        doc += '\n';
      }

      if (knowledge.commonFailures.length > 0) {
        doc += `### Common Failure Patterns\n`;
        for (const failure of knowledge.commonFailures) {
          doc += `- **${failure.type}**: ${failure.description}\n`;
          doc += `  - Root Causes: ${failure.rootCauses.join(', ')}\n`;
          doc += `  - Healing Strategies: ${failure.healingStrategies.join(', ')}\n`;
        }
        doc += '\n';
      }
    }

    return doc;
  }

  private generateWorkflowsDocumentation(): string {
    let doc = '# WeSign Workflows Knowledge Base\n\n';

    for (const [name, workflow] of this.knowledgeBase.workflowMap) {
      doc += `## Workflow: ${name}\n\n`;
      doc += `**Critical Path**: ${workflow.criticalPath ? 'Yes' : 'No'}\n\n`;

      doc += `### Steps\n`;
      for (const step of workflow.steps) {
        doc += `${step.order}. **${step.name}** (${step.component})\n`;
        doc += `   - Selectors: ${step.selectors.join(', ')}\n`;
        doc += `   - Expected State: ${step.expectedState}\n`;
        doc += `   - Validations: ${step.validations.join(', ')}\n\n`;
      }

      if (workflow.commonFailurePoints.length > 0) {
        doc += `### Common Failure Points\n`;
        for (const failure of workflow.commonFailurePoints) {
          doc += `- **${failure.step}**: ${failure.commonError}\n`;
          doc += `  - Healing Strategy: ${failure.healingStrategy}\n`;
        }
        doc += '\n';
      }
    }

    return doc;
  }

  private generateSelectorsDocumentation(): string {
    let doc = '# WeSign Selectors Knowledge Base\n\n';

    for (const [element, selector] of this.knowledgeBase.selectorMap) {
      doc += `## Element: ${element}\n`;
      doc += `- **Component**: ${selector.component}\n`;
      doc += `- **Primary Selector**: ${selector.primary}\n`;
      doc += `- **Alternatives**: ${selector.alternatives.join(', ')}\n`;
      doc += `- **Stability**: ${Math.round(selector.stability * 100)}%\n`;
      doc += `- **Success Rate**: ${Math.round(selector.successRate * 100)}%\n\n`;
    }

    return doc;
  }

  private generateFailurePatternsDocumentation(): string {
    let doc = '# WeSign Failure Patterns Knowledge Base\n\n';

    const allFailures = Array.from(this.knowledgeBase.componentMap.values())
      .flatMap(comp => comp.commonFailures);

    const groupedFailures = allFailures.reduce((groups, failure) => {
      if (!groups[failure.type]) groups[failure.type] = [];
      groups[failure.type].push(failure);
      return groups;
    }, {} as Record<string, FailurePattern[]>);

    for (const [type, failures] of Object.entries(groupedFailures)) {
      doc += `## Failure Type: ${type}\n\n`;

      for (const failure of failures) {
        doc += `### ${failure.description}\n`;
        doc += `- **Common Selectors**: ${failure.commonSelectors.join(', ')}\n`;
        doc += `- **Root Causes**: ${failure.rootCauses.join(', ')}\n`;
        doc += `- **Healing Strategies**: ${failure.healingStrategies.join(', ')}\n\n`;
      }
    }

    return doc;
  }

  /**
   * Generate Hebrew/English i18n documentation from translation files
   */
  private async generateI18nDocumentation(): Promise<string> {
    logger.info('Generating Hebrew/English i18n documentation');

    let doc = '# WeSign Internationalization (i18n) Knowledge Base\n\n';
    doc += 'This document contains Hebrew and English translations for WeSign UI elements.\n\n';

    try {
      // Search for i18n files in both clients
      const i18nData = await this.extractI18nFromBothClients();

      if (i18nData.hebrew.size > 0) {
        doc += '## Hebrew Translations (עברית)\n\n';
        for (const [key, value] of i18nData.hebrew) {
          doc += `### ${key}\n`;
          doc += `**Hebrew**: ${value.hebrew}\n`;
          doc += `**English**: ${value.english}\n`;
          doc += `**Context**: ${value.context}\n\n`;
        }
      }

      if (i18nData.uiElements.size > 0) {
        doc += '## UI Elements (Bilingual)\n\n';
        for (const [element, translations] of i18nData.uiElements) {
          doc += `### ${element}\n`;
          doc += `**Hebrew**: ${translations.hebrew}\n`;
          doc += `**English**: ${translations.english}\n`;
          doc += `**Selector**: ${translations.selector}\n\n`;
        }
      }

      // Add common WeSign terminology
      doc += '## Common WeSign Terms\n\n';
      const commonTerms = this.getCommonWeSignTerms();
      for (const [english, hebrew] of commonTerms) {
        doc += `- **${english}** → **${hebrew}**\n`;
      }

    } catch (error) {
      logger.warn('Failed to extract i18n data:', error);
      doc += '## No i18n files found\n\nUsing common WeSign terminology only.\n\n';
    }

    return doc;
  }

  /**
   * Extract i18n data from both WeSign clients
   */
  private async extractI18nFromBothClients(): Promise<{
    hebrew: Map<string, { hebrew: string; english: string; context: string }>;
    uiElements: Map<string, { hebrew: string; english: string; selector: string }>;
  }> {
    const result = {
      hebrew: new Map(),
      uiElements: new Map()
    };

    // Check both client directories for i18n files
    const clients = [
      { name: 'Dashboard', path: this.wesignDashboardPath },
      { name: 'Signer', path: this.wesignSignerPath }
    ];

    for (const client of clients) {
      await this.extractI18nFromClient(client.path, client.name, result);
    }

    return result;
  }

  /**
   * Extract i18n data from a specific client
   */
  private async extractI18nFromClient(clientPath: string, clientName: string, result: any): Promise<void> {
    try {
      // Common i18n file locations
      const i18nPaths = [
        path.join(clientPath, 'src', 'assets', 'i18n'),
        path.join(clientPath, 'src', 'locale'),
        path.join(clientPath, 'assets', 'i18n'),
        path.join(clientPath, 'locale')
      ];

      for (const i18nPath of i18nPaths) {
        if (fs.existsSync(i18nPath)) {
          await this.processI18nDirectory(i18nPath, clientName, result);
        }
      }

      // Also scan component templates for translate pipe usage
      const componentsPath = path.join(clientPath, 'src', 'app');
      if (fs.existsSync(componentsPath)) {
        await this.extractTranslateKeysFromComponents(componentsPath, clientName, result);
      }
    } catch (error) {
      logger.warn(`Failed to extract i18n from ${clientName}:`, error);
    }
  }

  /**
   * Process i18n directory for translation files
   */
  private async processI18nDirectory(i18nPath: string, clientName: string, result: any): Promise<void> {
    const files = fs.readdirSync(i18nPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(i18nPath, file);
        const language = file.replace('.json', '');

        try {
          const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.processTranslationFile(content, language, clientName, result);
        } catch (error) {
          logger.warn(`Failed to parse i18n file ${filePath}:`, error);
        }
      }
    }
  }

  /**
   * Process translation file content
   */
  private processTranslationFile(content: any, language: string, clientName: string, result: any): void {
    const flattenedContent = this.flattenTranslationObject(content);

    for (const [key, value] of Object.entries(flattenedContent)) {
      if (typeof value === 'string') {
        const existing = result.hebrew.get(key) || { hebrew: '', english: '', context: clientName };

        if (language === 'he' || language === 'hebrew') {
          existing.hebrew = value;
        } else if (language === 'en' || language === 'english') {
          existing.english = value;
        }

        result.hebrew.set(key, existing);
      }
    }
  }

  /**
   * Extract translate keys from component templates
   */
  private async extractTranslateKeysFromComponents(componentsPath: string, clientName: string, result: any): Promise<void> {
    // Recursively find .html files and extract | translate usage
    const htmlFiles = this.findFilesRecursively(componentsPath, '.html');

    for (const htmlFile of htmlFiles) {
      try {
        const content = fs.readFileSync(htmlFile, 'utf-8');
        const translateMatches = content.match(/['"]([A-Z_][A-Z0-9_]*\.[A-Z0-9_]*)['"]\s*\|\s*translate/g);

        if (translateMatches) {
          for (const match of translateMatches) {
            const key = match.match(/['"]([^'"]*)['"]/)?.[1];
            if (key) {
              result.uiElements.set(key, {
                hebrew: `[${key}]`, // Placeholder
                english: key.split('.').pop()?.toLowerCase().replace('_', ' ') || key,
                selector: `[data-i18n="${key}"]`
              });
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to process HTML file ${htmlFile}:`, error);
      }
    }
  }

  /**
   * Get common WeSign terms for both languages
   */
  private getCommonWeSignTerms(): Map<string, string> {
    const terms = new Map();

    // Core WeSign functionality
    terms.set('Sign Document', 'חתימת מסמך');
    terms.set('Login', 'התחברות');
    terms.set('Logout', 'יציאה');
    terms.set('Dashboard', 'לוח בקרה');
    terms.set('Contacts', 'אנשי קשר');
    terms.set('Documents', 'מסמכים');
    terms.set('Templates', 'תבניות');
    terms.set('Reports', 'דוחות');
    terms.set('Settings', 'הגדרות');
    terms.set('Profile', 'פרופיל');

    // Actions
    terms.set('Add', 'הוסף');
    terms.set('Edit', 'ערוך');
    terms.set('Delete', 'מחק');
    terms.set('Save', 'שמור');
    terms.set('Cancel', 'בטל');
    terms.set('Submit', 'שלח');
    terms.set('Upload', 'העלה');
    terms.set('Download', 'הורד');
    terms.set('Send', 'שלח');
    terms.set('Sign', 'חתום');

    // Form elements
    terms.set('Email', 'דוא״ל');
    terms.set('Password', 'סיסמה');
    terms.set('Name', 'שם');
    terms.set('Phone', 'טלפון');
    terms.set('Address', 'כתובת');
    terms.set('Date', 'תאריך');
    terms.set('Status', 'סטטוס');

    return terms;
  }

  /**
   * Flatten nested translation object
   */
  private flattenTranslationObject(obj: any, prefix: string = ''): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        Object.assign(flattened, this.flattenTranslationObject(value, newKey));
      } else if (typeof value === 'string') {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Find files recursively by extension
   */
  private findFilesRecursively(dir: string, extension: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) {
      return files;
    }

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          files.push(...this.findFilesRecursively(itemPath, extension));
        } else if (stats.isFile() && item.endsWith(extension)) {
          files.push(itemPath);
        }
      }
    } catch (error) {
      logger.warn(`Failed to read directory ${dir}:`, error);
    }

    return files;
  }

  // Helper methods
  private initializeKnowledgeBase(): WeSignKnowledgeBase {
    return {
      codebaseAnalysis: {} as WeSignCodeStructure,
      componentMap: new Map(),
      workflowMap: new Map(),
      selectorMap: new Map(),
      apiEndpointMap: new Map(),
      lastUpdated: new Date()
    };
  }

  private createTempFile(content: string, filename: string): string {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(tempDir, filename);
    fs.writeFileSync(tempFile, content, 'utf-8');
    return tempFile;
  }

  // Enhanced implementations for both clients
  /**
   * Extract service exports from TypeScript service file
   */
  private extractServiceExports(content: string): string[] {
    const exports = [];
    
    // Extract method names from service class
    const methodMatches = content.match(/^\s+(?:public\s+)?([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*{/gm);
    if (methodMatches) {
      for (const match of methodMatches) {
        const methodName = match.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/)?.[1];
        if (methodName && !['constructor', 'ngOnInit', 'ngOnDestroy'].includes(methodName)) {
          exports.push(methodName);
        }
      }
    }

    return exports;
  }

  /**
   * Extract service dependencies from constructor injection
   */
  private extractServiceDependencies(content: string): string[] {
    const dependencies = [];
    
    // Extract constructor parameters
    const constructorMatch = content.match(/constructor\s*\(\s*([\s\S]*?)\s*\)/);
    if (constructorMatch) {
      const params = constructorMatch[1];
      const paramMatches = params.match(/(?:private|public|protected)?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*([a-zA-Z_$][a-zA-Z0-9_$.<>]+)/g);
      
      if (paramMatches) {
        for (const param of paramMatches) {
          const typeMatch = param.match(/:\s*([a-zA-Z_$][a-zA-Z0-9_$.<>]+)/);
          if (typeMatch) {
            dependencies.push(typeMatch[1]);
          }
        }
      }
    }

    return dependencies;
  }

  private async scanActualServices(servicesDir: string): Promise<any[]> {
  const services: any[] = [];

  if (!fs.existsSync(servicesDir)) {
    return services;
  }

  try {
    const files = fs.readdirSync(servicesDir);

    for (const file of files) {
      if (file.endsWith('.service.ts')) {
        const servicePath = path.join(servicesDir, file);
        const content = fs.readFileSync(servicePath, 'utf-8');
        
        const serviceName = file.replace('.service.ts', '');
        services.push({
          name: serviceName,
          path: servicePath,
          exports: this.extractServiceExports(content),
          dependencies: this.extractServiceDependencies(content)
        });
      }
    }

    // Also scan subdirectories
    const subdirs = files.filter(file => {
      const fullPath = path.join(servicesDir, file);
      return fs.statSync(fullPath).isDirectory();
    });

    for (const subdir of subdirs) {
      const subdirPath = path.join(servicesDir, subdir);
      const subdirServices = await this.scanActualServices(subdirPath);
      services.push(...subdirServices);
    }

  } catch (error) {
    logger.warn(`Failed to scan services directory ${servicesDir}:`, error);
  }

  return services;
}

  private async scanActualRoutes(routingFile: string): Promise<any[]> {
  const routes: any[] = [];

  if (!fs.existsSync(routingFile)) {
    return routes;
  }

  try {
    const content = fs.readFileSync(routingFile, 'utf-8');
    
    // Extract routes from Angular routing module
    const routesMatch = content.match(/const\s+routes:\s*Routes\s*=\s*\[([\s\S]*?)\];/);
    if (routesMatch) {
      const routesContent = routesMatch[1];
      
      // Parse individual route objects
      const routeMatches = routesContent.match(/\{[^}]*\}/g);
      if (routeMatches) {
        for (const routeMatch of routeMatches) {
          try {
            // Extract path and component
            const pathMatch = routeMatch.match(/path:\s*['\"]([^'\"]*)['\"]/)?.at(1);
            const componentMatch = routeMatch.match(/component:\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/)?.at(1);
            
            if (pathMatch) {
              routes.push({
                path: pathMatch,
                component: componentMatch,
                fullRoute: routeMatch.replace(/\s+/g, ' ').trim()
              });
            }
          } catch (error) {
            logger.warn(`Failed to parse route: ${routeMatch}`, error);
          }
        }
      }
    }

    logger.info(`Extracted ${routes.length} routes from ${routingFile}`);
    
  } catch (error) {
    logger.warn(`Failed to scan routes file ${routingFile}:`, error);
  }

  return routes;
}

  private defineEnhancedWorkflows(components: WeSignComponent[], clientType: 'dashboard' | 'signer'): WeSignWorkflow[] {
    const workflows = [];

    if (clientType === 'dashboard') {
      workflows.push(
        {
          name: 'Document Upload and Management',
          description: 'Upload documents and organize them for signing',
          steps: [
            { order: 1, name: 'Navigate to Documents', component: 'documents', userAction: 'Click documents menu' },
            { order: 2, name: 'Upload Document', component: 'upload-file-button', userAction: 'Select and upload file' },
            { order: 3, name: 'Organize Document', component: 'document', userAction: 'Set document properties' }
          ],
          userRoles: ['User', 'Admin'],
          businessRules: ['File size limits', 'Supported formats', 'Document validation']
        },
        {
          name: 'Contact Management Workflow',
          description: 'Manage contacts for document signing',
          steps: [
            { order: 1, name: 'Access Contacts', component: 'contacts', userAction: 'Navigate to contacts' },
            { order: 2, name: 'Add Contact', component: 'select-contact', userAction: 'Add new contact details' },
            { order: 3, name: 'Organize Groups', component: 'select-contacts-group', userAction: 'Create contact groups' }
          ],
          userRoles: ['User', 'Admin'],
          businessRules: ['Unique email addresses', 'Contact validation', 'Group permissions']
        },
        {
          name: 'Group Signing Orchestration',
          description: 'Set up and manage group signing workflows',
          steps: [
            { order: 1, name: 'Initiate Group Sign', component: 'groupsign', userAction: 'Start group signing process' },
            { order: 2, name: 'Select Recipients', component: 'select-multi-contacts', userAction: 'Choose signing participants' },
            { order: 3, name: 'Configure Fields', component: 'duplicate-field-to-pages', userAction: 'Set up signature fields' }
          ],
          userRoles: ['User', 'Admin'],
          businessRules: ['Minimum signers required', 'Signing order', 'Field validation']
        }
      );
    } else if (clientType === 'signer') {
      workflows.push(
        {
          name: 'Individual Document Signing',
          description: 'Complete signing process for individual documents',
          steps: [
            { order: 1, name: 'Access Document', component: 'main-signer', userAction: 'Open signing link' },
            { order: 2, name: 'Authenticate', component: 'oauth-comsign-idp', userAction: 'Complete authentication' },
            { order: 3, name: 'Complete Fields', component: 'text-field', userAction: 'Fill required fields' },
            { order: 4, name: 'Create Signature', component: 'sign-pad', userAction: 'Draw or upload signature' },
            { order: 5, name: 'Submit', component: 'success-page', userAction: 'Finalize signing' }
          ],
          userRoles: ['Signer'],
          businessRules: ['Authentication required', 'All required fields must be completed', 'Valid signature required']
        },
        {
          name: 'Smart Card Authentication',
          description: 'Authenticate using smart card for enhanced security',
          steps: [
            { order: 1, name: 'Detect Smart Card', component: 'smart-card-alert', userAction: 'Insert smart card' },
            { order: 2, name: 'Verify Identity', component: 'identity-success', userAction: 'Complete verification' }
          ],
          userRoles: ['Signer'],
          businessRules: ['Valid certificate required', 'Card reader connectivity', 'Certificate not expired']
        }
      );
    }

    return workflows;
  }

  private determineComponentType(name: string, content: string): 'component' | 'page' | 'shared' {
    if (name.includes('page') || ['main-signer', 'success-page', 'decline-page'].includes(name)) {
      return 'page';
    }
    if (name.includes('shared') || name.includes('common')) {
      return 'shared';
    }
    return 'component';
  }

  private extractComponentFeatures(name: string, content: string): string[] {
    const features = [];
    if (name.includes('sign')) features.push('Digital Signing');
    if (name.includes('auth') || name.includes('identity')) features.push('Authentication');
    if (name.includes('document')) features.push('Document Management');
    if (name.includes('field')) features.push('Form Fields');
    return features;
  }

  private extractComponentDependencies(content: string): string[] {
    const imports = content.match(/import.*from\s+['"]([^'"]+)['"]/g) || [];
    return imports.map(imp => imp.match(/from\s+['"]([^'"]+)['"]/)?.[1] || '').filter(Boolean);
  }

  private detectHebrewSupport(content: string, templatePath?: string): boolean {
    if (/[\u0590-\u05FF]/.test(content)) return true;
    if (templatePath && fs.existsSync(templatePath)) {
      const template = fs.readFileSync(templatePath, 'utf-8');
      return /[\u0590-\u05FF]/.test(template);
    }
    return false;
  }

  private generateButtonSelector(attributes: string, content: string): string {
    const testId = this.extractDataTestId(attributes);
    if (testId) return `[data-testid="${testId}"]`;

    const id = this.extractAttribute(attributes, 'id');
    if (id) return `#${id}`;

    const className = this.extractAttribute(attributes, 'class');
    if (className) return `button.${className.split(' ')[0]}`;

    const text = this.extractButtonText(content);
    return text ? `button:contains("${text}")` : 'button';
  }

  private generateInputSelector(attributes: string): string {
    const testId = this.extractDataTestId(attributes);
    if (testId) return `[data-testid="${testId}"]`;

    const name = this.extractAttribute(attributes, 'name');
    if (name) return `input[name="${name}"]`;

    const id = this.extractAttribute(attributes, 'id');
    if (id) return `#${id}`;

    return 'input';
  }

  private generateSelectSelector(attributes: string): string {
    const testId = this.extractDataTestId(attributes);
    if (testId) return `[data-testid="${testId}"]`;

    const name = this.extractAttribute(attributes, 'name');
    if (name) return `select[name="${name}"]`;

    const id = this.extractAttribute(attributes, 'id');
    if (id) return `#${id}`;

    return 'select';
  }

  private extractDataTestId(attributes: string): string | undefined {
    return this.extractAttribute(attributes, 'data-testid');
  }

  private extractAttribute(attributes: string, name: string): string | undefined {
    const match = attributes.match(new RegExp(`${name}\\s*=\\s*["']([^"']*?)["']`));
    return match?.[1];
  }

  private generateStableSelector(type: string, attributes: string): string {
    const testId = this.extractDataTestId(attributes);
    if (testId) return `[data-testid="${testId}"]`;

    const name = this.extractAttribute(attributes, 'name');
    if (name) return `${type}[name="${name}"]`;

    const id = this.extractAttribute(attributes, 'id');
    if (id) return `#${id}`;

    return `${type}`;
  }

  private extractButtonText(content: string): string {
    return content.replace(/<[^>]*>/g, '').trim();
  }

  private extractInputType(attributes: string): string {
    return this.extractAttribute(attributes, 'type') || 'text';
  }

  private extractSelectName(attributes: string): string {
    return this.extractAttribute(attributes, 'name') || 'select';
  }

  private assessStability(attributes: string): 'high' | 'medium' | 'low' {
    if (this.extractDataTestId(attributes)) return 'high';
    if (this.extractAttribute(attributes, 'id') || this.extractAttribute(attributes, 'name')) return 'medium';
    return 'low';
  }

  private identifyCommonButtonIssues(attributes: string, content: string): string[] {
    const issues = [];
    if (!this.extractDataTestId(attributes)) issues.push('No data-testid for stable selection');
    if (content.includes('{{') && content.includes('translate')) issues.push('Text content depends on i18n translation');
    if (attributes.includes('*ngIf')) issues.push('Conditional rendering may affect visibility');
    return issues;
  }

  private identifyCommonInputIssues(attributes: string): string[] {
    const issues = [];
    if (!this.extractAttribute(attributes, 'name')) issues.push('No name attribute for form binding');
    if (attributes.includes('required')) issues.push('Required field validation may cause test failures');
    if (attributes.includes('*ngIf')) issues.push('Conditional rendering may affect visibility');
    return issues;
  }

  private identifyCommonSelectIssues(attributes: string): string[] {
    const issues = [];
    if (!this.extractAttribute(attributes, 'name')) issues.push('No name attribute for form binding');
    if (attributes.includes('*ngFor')) issues.push('Dynamic options may affect selection');
    return issues;
  }

  private getTemplatePath(componentPath: string): string | null {
    const dir = path.dirname(componentPath);
    const baseName = path.basename(componentPath, '.component.ts');
    const templatePath = path.join(dir, `${baseName}.component.html`);
    return fs.existsSync(templatePath) ? templatePath : null;
  }

  private generateAlternativeSelectors(element: TestableElement): string[] {
    const alternatives = [];

    if (element.dataTestId) {
      alternatives.push(`[data-testid="${element.dataTestId}"]`);
    }

    alternatives.push(element.selector);

    // Add CSS class-based selectors if available
    if (element.selector.includes('.')) {
      alternatives.push(element.selector);
    }

    return [...new Set(alternatives)];
  }

  // More placeholder implementations
  /**
   * Infer testable elements from component name and features when template is not available
   */
  private inferTestableElementsFromComponent(component: WeSignComponent): TestableElement[] {
    const elements: TestableElement[] = [];
    const componentName = component.name.toLowerCase();

    // Infer common elements based on component name patterns
    if (componentName.includes('button') || componentName.includes('btn')) {
      elements.push({
        type: 'button',
        selector: `[data-testid="${component.name}-button"]`,
        dataTestId: `${component.name}-button`,
        stableSelector: `button[data-component="${component.name}"]`,
        description: `Primary action button for ${component.name}`,
        stability: 'medium',
        commonIssues: ['Button may be conditionally rendered', 'Text content may be dynamic']
      });
    }

    if (componentName.includes('form') || componentName.includes('input') || componentName.includes('field')) {
      elements.push(
        {
          type: 'input',
          selector: `[data-testid="${component.name}-input"]`,
          dataTestId: `${component.name}-input`,
          stableSelector: `input[data-component="${component.name}"]`,
          description: `Input field for ${component.name}`,
          stability: 'high',
          commonIssues: ['May have validation requirements', 'Could be required field']
        },
        {
          type: 'button',
          selector: `[data-testid="${component.name}-submit"]`,
          dataTestId: `${component.name}-submit`,
          stableSelector: `button[type="submit"][data-component="${component.name}"]`,
          description: `Submit button for ${component.name}`,
          stability: 'high',
          commonIssues: ['Disabled until form is valid', 'May trigger validation']
        }
      );
    }

    if (componentName.includes('select') || componentName.includes('dropdown')) {
      elements.push({
        type: 'select',
        selector: `[data-testid="${component.name}-select"]`,
        dataTestId: `${component.name}-select`,
        stableSelector: `select[data-component="${component.name}"]`,
        description: `Dropdown selector for ${component.name}`,
        stability: 'medium',
        commonIssues: ['Options may be loaded dynamically', 'Default selection behavior']
      });
    }

    if (componentName.includes('sign') || componentName.includes('pad')) {
      elements.push({
        type: 'canvas',
        selector: `[data-testid="${component.name}-canvas"]`,
        dataTestId: `${component.name}-canvas`,
        stableSelector: `canvas[data-component="${component.name}"]`,
        description: `Signature canvas for ${component.name}`,
        stability: 'low',
        commonIssues: ['Canvas interaction requires special handling', 'Touch/mouse event simulation needed']
      });
    }

    if (componentName.includes('document') || componentName.includes('viewer')) {
      elements.push({
        type: 'div',
        selector: `[data-testid="${component.name}-viewer"]`,
        dataTestId: `${component.name}-viewer`,
        stableSelector: `div[data-component="${component.name}"]`,
        description: `Document viewer container for ${component.name}`,
        stability: 'medium',
        commonIssues: ['Document loading state', 'Scroll position handling']
      });
    }

    if (componentName.includes('auth') || componentName.includes('login')) {
      elements.push(
        {
          type: 'input',
          selector: `[data-testid="${component.name}-email"]`,
          dataTestId: `${component.name}-email`,
          stableSelector: `input[type="email"][data-component="${component.name}"]`,
          description: `Email input for ${component.name}`,
          stability: 'high',
          commonIssues: ['Email validation required', 'May be pre-filled']
        },
        {
          type: 'input',
          selector: `[data-testid="${component.name}-password"]`,
          dataTestId: `${component.name}-password`,
          stableSelector: `input[type="password"][data-component="${component.name}"]`,
          description: `Password input for ${component.name}`,
          stability: 'high',
          commonIssues: ['Password visibility toggle', 'Strength validation']
        }
      );
    }

    // Add generic container element if no specific elements were inferred
    if (elements.length === 0) {
      elements.push({
        type: 'div',
        selector: `[data-testid="${component.name}"]`,
        dataTestId: component.name,
        stableSelector: `[data-component="${component.name}"]`,
        description: `Main container for ${component.name} component`,
        stability: 'medium',
        commonIssues: ['Component may be conditionally rendered']
      });
    }

    return elements;
  }

  private async getTestableElementsForComponent(component: WeSignComponent): Promise<TestableElement[]> {
  const elements: TestableElement[] = [];
  
  try {
    const templatePath = this.getTemplatePath(component.path);
    if (templatePath && fs.existsSync(templatePath)) {
      return await this.extractTestableElements(templatePath);
    }

    // If no template, infer testable elements from component name and features
    const inferredElements = this.inferTestableElementsFromComponent(component);
    elements.push(...inferredElements);

  } catch (error) {
    logger.warn(`Failed to get testable elements for ${component.name}:`, error);
  }

  return elements;
}

  private identifyCommonFailures(componentName: string): FailurePattern[] {
  const failures: FailurePattern[] = [];
  const name = componentName.toLowerCase();

  // Signature pad related failures
  if (name.includes('sign') || name.includes('pad')) {
    failures.push({
      type: 'interaction_failure',
      description: 'Signature pad not responsive to touch/mouse events',
      commonSelectors: ['canvas.signature-pad', '[data-testid="signature-pad"]'],
      rootCauses: ['Canvas not fully loaded', 'Event listeners not attached', 'Touch events not properly handled'],
      healingStrategies: ['Wait for canvas element to be interactive', 'Retry with different event types', 'Check canvas dimensions']
    });
  }

  // Authentication related failures  
  if (name.includes('auth') || name.includes('login') || name.includes('oauth')) {
    failures.push({
      type: 'authentication_failure',
      description: 'Authentication flow interruption',
      commonSelectors: ['[data-testid="login-form"]', '.auth-container', 'input[type="password"]'],
      rootCauses: ['Network timeout', 'Invalid credentials', 'Session expired', 'OAuth redirect issues'],
      healingStrategies: ['Retry authentication', 'Clear session and restart', 'Verify credentials', 'Handle OAuth popups']
    });
  }

  // Document viewer failures
  if (name.includes('document') || name.includes('viewer') || name.includes('main-signer')) {
    failures.push({
      type: 'loading_failure',
      description: 'Document fails to load or display',
      commonSelectors: ['.document-viewer', '[data-testid="document-container"]', '.pdf-container'],
      rootCauses: ['Document not found', 'Network issues', 'Large file size', 'Browser compatibility'],
      healingStrategies: ['Wait for document load event', 'Check network connectivity', 'Retry with timeout', 'Verify file format support']
    });
  }

  // Form related failures
  if (name.includes('form') || name.includes('field') || name.includes('input')) {
    failures.push({
      type: 'validation_failure',
      description: 'Form validation errors or field interaction issues',
      commonSelectors: ['input.error', '.form-field.invalid', '[data-testid*="error"]'],
      rootCauses: ['Required field empty', 'Invalid format', 'Field disabled', 'Validation rules changed'],
      healingStrategies: ['Clear field and retry input', 'Wait for validation completion', 'Check field enabled state', 'Verify input format']
    });
  }

  // Smart card related failures
  if (name.includes('smart') && name.includes('card')) {
    failures.push({
      type: 'hardware_failure',
      description: 'Smart card reader not detected or card not readable',
      commonSelectors: ['[data-testid="smart-card-reader"]', '.card-reader-status'],
      rootCauses: ['Card reader not connected', 'Card not inserted', 'Driver issues', 'Card expired/invalid'],
      healingStrategies: ['Check card reader connection', 'Prompt user to insert card', 'Retry card reading', 'Fallback to alternative auth']
    });
  }

  // Contact/selection related failures
  if (name.includes('contact') || name.includes('select')) {
    failures.push({
      type: 'selection_failure',
      description: 'Contact selection or list loading issues',
      commonSelectors: ['.contact-list', '[data-testid*="contact"]', 'select[multiple]'],
      rootCauses: ['Contacts not loaded', 'Search filter too restrictive', 'Permissions issue', 'Large dataset timeout'],
      healingStrategies: ['Wait for contacts to load', 'Clear search filters', 'Verify permissions', 'Use pagination if available']
    });
  }

  // Upload related failures
  if (name.includes('upload') || name.includes('file')) {
    failures.push({
      type: 'upload_failure',
      description: 'File upload or processing failures',
      commonSelectors: ['input[type="file"]', '.upload-area', '[data-testid*="upload"]'],
      rootCauses: ['File too large', 'Invalid file type', 'Network interruption', 'Server processing error'],
      healingStrategies: ['Check file size limits', 'Verify file type', 'Retry upload', 'Wait for server processing']
    });
  }

  // Navigation/routing failures
  if (name.includes('page') || name.includes('header') || name.includes('menu')) {
    failures.push({
      type: 'navigation_failure',
      description: 'Page navigation or routing issues',
      commonSelectors: ['[routerLink]', '.nav-item', '[data-testid*="nav"]'],
      rootCauses: ['Route not found', 'Permission denied', 'State not preserved', 'Lazy loading delay'],
      healingStrategies: ['Verify route exists', 'Check user permissions', 'Wait for lazy loading', 'Retry navigation']
    });
  }

  // Hebrew/RTL related failures
  if (name.includes('lang') || name.includes('i18n')) {
    failures.push({
      type: 'localization_failure',
      description: 'Hebrew/RTL layout or text rendering issues',
      commonSelectors: ['[dir="rtl"]', '.hebrew-text', '[lang="he"]'],
      rootCauses: ['Font not loaded', 'RTL CSS conflicts', 'Text direction incorrect', 'Translation missing'],
      healingStrategies: ['Wait for fonts to load', 'Check text direction', 'Verify translation files', 'Test with fallback language']
    });
  }

  // Default generic failures if none specific identified
  if (failures.length === 0) {
    failures.push({
      type: 'generic_failure',
      description: 'Component not found or not interactive',
      commonSelectors: [`[data-testid="${componentName}"]`, `[data-component="${componentName}"]`],
      rootCauses: ['Element not rendered', 'CSS loading incomplete', 'JavaScript not executed', 'Timing issues'],
      healingStrategies: ['Wait for element to be visible', 'Check element enabled state', 'Retry with longer timeout', 'Verify page fully loaded']
    });
  }

  return failures;
}

  private generateSelectorRecommendations(componentName: string): SelectorRecommendation[] {
  const recommendations: SelectorRecommendation[] = [];
  const name = componentName.toLowerCase();

  // Primary data-testid based selectors (highest stability)
  recommendations.push({
    element: `${componentName} container`,
    primary: `[data-testid="${componentName}"]`,
    alternatives: [`[data-component="${componentName}"]`, `.${componentName}-container`],
    stability: 0.95,
    reasoning: 'Data-testid attributes are specifically for testing and most stable'
  });

  // Component-specific selector recommendations
  if (name.includes('sign') || name.includes('pad')) {
    recommendations.push({
      element: 'signature canvas',
      primary: `[data-testid="signature-pad"]`,
      alternatives: [`canvas.signature-pad`, `#${componentName}-canvas`],
      stability: 0.85,
      reasoning: 'Canvas elements for signature should have data-testid for touch interaction testing'
    });
  }

  if (name.includes('button') || name.includes('btn')) {
    recommendations.push({
      element: 'primary action button',
      primary: `[data-testid="${componentName}-submit"]`,
      alternatives: [`button[data-component="${componentName}"]`, `button.${componentName}-btn`],
      stability: 0.90,
      reasoning: 'Action buttons should have data-testid for click event testing'
    });
  }

  if (name.includes('form') || name.includes('input') || name.includes('field')) {
    recommendations.push(
      {
        element: 'form input field',
        primary: `[data-testid="${componentName}-input"]`,
        alternatives: [`input[name="${componentName}"]`, `input[data-component="${componentName}"]`],
        stability: 0.88,
        reasoning: 'Form inputs should have data-testid and name attributes for reliable form testing'
      },
      {
        element: 'form validation message',
        primary: `[data-testid="${componentName}-error"]`,
        alternatives: [`.${componentName}-error`, `[data-component="${componentName}"] .error-message`],
        stability: 0.75,
        reasoning: 'Error messages should be identifiable for validation testing'
      }
    );
  }

  if (name.includes('select') || name.includes('dropdown')) {
    recommendations.push({
      element: 'dropdown selector',
      primary: `[data-testid="${componentName}-select"]`,
      alternatives: [`select[data-component="${componentName}"]`, `.${componentName}-dropdown`],
      stability: 0.87,
      reasoning: 'Dropdown selectors need stable identifiers for option selection testing'
    });
  }

  if (name.includes('document') || name.includes('viewer')) {
    recommendations.push({
      element: 'document viewer container',
      primary: `[data-testid="document-viewer"]`,
      alternatives: [`.document-container`, `#${componentName}-viewer`],
      stability: 0.82,
      reasoning: 'Document viewers need stable selectors for content verification'
    });
  }

  if (name.includes('auth') || name.includes('login')) {
    recommendations.push(
      {
        element: 'login email input',
        primary: `[data-testid="auth-email"]`,
        alternatives: [`input[type="email"]`, `input[name="email"]`],
        stability: 0.92,
        reasoning: 'Authentication fields require highest stability for login testing'
      },
      {
        element: 'login password input',
        primary: `[data-testid="auth-password"]`,
        alternatives: [`input[type="password"]`, `input[name="password"]`],
        stability: 0.92,
        reasoning: 'Password fields need stable selectors for secure authentication testing'
      }
    );
  }

  if (name.includes('contact')) {
    recommendations.push({
      element: 'contact list item',
      primary: `[data-testid="contact-item"]`,
      alternatives: [`.contact-list-item`, `[data-contact-id]`],
      stability: 0.80,
      reasoning: 'Contact items should be identifiable for selection and management testing'
    });
  }

  if (name.includes('template')) {
    recommendations.push({
      element: 'template selector',
      primary: `[data-testid="template-item"]`,
      alternatives: [`.template-card`, `[data-template-id]`],
      stability: 0.83,
      reasoning: 'Template items need stable selectors for template management testing'
    });
  }

  // Hebrew/RTL specific recommendations
  if (name.includes('hebrew') || name.includes('rtl')) {
    recommendations.push({
      element: 'RTL text container',
      primary: `[dir="rtl"][data-testid="${componentName}"]`,
      alternatives: [`.hebrew-text`, `[lang="he"]`],
      stability: 0.70,
      reasoning: 'Hebrew/RTL elements need direction-specific selectors for layout testing'
    });
  }

  // Generic fallback recommendations
  if (recommendations.length === 1) {
    recommendations.push({
      element: 'interactive element',
      primary: `[data-testid="${componentName}-action"]`,
      alternatives: [`[data-component="${componentName}"] button`, `.${componentName}-action`],
      stability: 0.75,
      reasoning: 'Interactive elements should have action-specific identifiers'
    });
  }

  return recommendations;
}

  private extractI18nKeys(component: WeSignComponent): string[] {
    const i18nKeys: string[] = [];

    try {
      const templatePath = this.getTemplatePath(component.path);
      if (templatePath && fs.existsSync(templatePath)) {
        const templateContent = fs.readFileSync(templatePath, 'utf-8');

        // Extract translate pipe usage: {{ 'KEY' | translate }}
        const translatePipeMatches = templateContent.match(/['"`]([A-Z_][A-Z0-9_]*(?:\.[A-Z0-9_]*)*)['"]\s*\|\s*translate/g);
        if (translatePipeMatches) {
          for (const match of translatePipeMatches) {
            const keyMatch = match.match(/['"`]([A-Z_][A-Z0-9_]*(?:\.[A-Z0-9_]*)*)['"]/);
            if (keyMatch) {
              i18nKeys.push(keyMatch[1]);
            }
          }
        }

        // Extract Angular i18n directive: i18n="@@key"
        const i18nDirectiveMatches = templateContent.match(/i18n="@@([^"]+)"/g);
        if (i18nDirectiveMatches) {
          for (const match of i18nDirectiveMatches) {
            const keyMatch = match.match(/i18n="@@([^"]+)"/);
            if (keyMatch) {
              i18nKeys.push(keyMatch[1]);
            }
          }
        }
      }

      // Check component TypeScript file for translate service usage
      if (fs.existsSync(component.path)) {
        const componentContent = fs.readFileSync(component.path, 'utf-8');

        // Extract translate.get() calls: this.translate.get('KEY')
        const translateGetMatches = componentContent.match(/translate\.get\(['"`]([A-Z_][A-Z0-9_]*(?:\.[A-Z0-9_]*)*)['"]\)/g);
        if (translateGetMatches) {
          for (const match of translateGetMatches) {
            const keyMatch = match.match(/translate\.get\(['"`]([A-Z_][A-Z0-9_]*(?:\.[A-Z0-9_]*)*)['"]\)/);
            if (keyMatch) {
              i18nKeys.push(keyMatch[1]);
            }
          }
        }

        // Extract translate.instant() calls: this.translate.instant('KEY')
        const translateInstantMatches = componentContent.match(/translate\.instant\(['"`]([A-Z_][A-Z0-9_]*(?:\.[A-Z0-9_]*)*)['"]\)/g);
        if (translateInstantMatches) {
          for (const match of translateInstantMatches) {
            const keyMatch = match.match(/translate\.instant\(['"`]([A-Z_][A-Z0-9_]*(?:\.[A-Z0-9_]*)*)['"]\)/);
            if (keyMatch) {
              i18nKeys.push(keyMatch[1]);
            }
          }
        }
      }

      // Add common WeSign i18n keys based on component name
      const componentName = component.name.toLowerCase();
      if (componentName.includes('sign')) {
        i18nKeys.push('COMMON.SIGN', 'COMMON.SIGNATURE', 'SIGN.TITLE', 'SIGN.SUBMIT');
      }
      if (componentName.includes('auth') || componentName.includes('login')) {
        i18nKeys.push('AUTH.LOGIN', 'AUTH.EMAIL', 'AUTH.PASSWORD', 'COMMON.SUBMIT');
      }
      if (componentName.includes('document')) {
        i18nKeys.push('DOCUMENTS.TITLE', 'DOCUMENTS.UPLOAD', 'COMMON.DOWNLOAD', 'COMMON.VIEW');
      }
      if (componentName.includes('contact')) {
        i18nKeys.push('CONTACTS.TITLE', 'CONTACTS.ADD', 'CONTACTS.EDIT', 'COMMON.DELETE');
      }
      if (componentName.includes('form') || componentName.includes('field')) {
        i18nKeys.push('FORM.REQUIRED', 'FORM.INVALID', 'COMMON.SAVE', 'COMMON.CANCEL');
      }

    } catch (error) {
      logger.warn(`Failed to extract i18n keys for ${component.name}:`, error);
    }

    // Remove duplicates and return
    return [...new Set(i18nKeys)];
  }

  private getComponentRoutes(componentName: string, routes: any[]): string[] {
    const componentRoutes: string[] = [];

    try {
      // Direct component name matches
      for (const route of routes) {
        if (route.component && route.component.toLowerCase().includes(componentName.toLowerCase())) {
          componentRoutes.push(route.path);
        }
      }

      // Infer routes based on component name patterns
      const componentLower = componentName.toLowerCase();

      // Authentication routes
      if (componentLower.includes('auth') || componentLower.includes('login')) {
        const authRoutes = routes.filter(r => r.path.includes('auth') || r.path.includes('login'));
        componentRoutes.push(...authRoutes.map(r => r.path));
      }

      // Document routes
      if (componentLower.includes('document')) {
        const docRoutes = routes.filter(r =>
          r.path.includes('document') || r.path.includes('upload') || r.path.includes('viewer')
        );
        componentRoutes.push(...docRoutes.map(r => r.path));
      }

      // Contact routes
      if (componentLower.includes('contact')) {
        const contactRoutes = routes.filter(r => r.path.includes('contact'));
        componentRoutes.push(...contactRoutes.map(r => r.path));
      }

      // Signing routes
      if (componentLower.includes('sign')) {
        const signRoutes = routes.filter(r =>
          r.path.includes('sign') || r.path.includes('signature')
        );
        componentRoutes.push(...signRoutes.map(r => r.path));
      }

      // Template routes
      if (componentLower.includes('template')) {
        const templateRoutes = routes.filter(r => r.path.includes('template'));
        componentRoutes.push(...templateRoutes.map(r => r.path));
      }

      // Report routes
      if (componentLower.includes('report')) {
        const reportRoutes = routes.filter(r => r.path.includes('report'));
        componentRoutes.push(...reportRoutes.map(r => r.path));
      }

      // Main pages
      if (componentLower.includes('main') || componentLower.includes('dashboard')) {
        componentRoutes.push('/', '/dashboard', '/home');
      }

      // Signer specific routes
      if (componentLower.includes('signer')) {
        const signerRoutes = routes.filter(r =>
          r.path.includes('signer') || r.path.includes('signing')
        );
        componentRoutes.push(...signerRoutes.map(r => r.path));
      }

      // Admin routes
      if (componentLower.includes('admin')) {
        const adminRoutes = routes.filter(r => r.path.includes('admin'));
        componentRoutes.push(...adminRoutes.map(r => r.path));
      }

      // Settings routes
      if (componentLower.includes('setting')) {
        const settingsRoutes = routes.filter(r => r.path.includes('setting'));
        componentRoutes.push(...settingsRoutes.map(r => r.path));
      }

      // Profile routes
      if (componentLower.includes('profile')) {
        const profileRoutes = routes.filter(r => r.path.includes('profile'));
        componentRoutes.push(...profileRoutes.map(r => r.path));
      }

      // If still no routes found, try to infer from component name
      if (componentRoutes.length === 0) {
        // Try to match route path that contains part of component name
        const nameWords = componentName.toLowerCase().split(/[_-]/);
        for (const word of nameWords) {
          if (word.length > 3) { // Only meaningful words
            const matchingRoutes = routes.filter(r =>
              r.path.toLowerCase().includes(word) ||
              (r.component && r.component.toLowerCase().includes(word))
            );
            componentRoutes.push(...matchingRoutes.map(r => r.path));
          }
        }
      }

    } catch (error) {
      logger.warn(`Failed to get routes for component ${componentName}:`, error);
    }

    // Remove duplicates and return
    return [...new Set(componentRoutes)];
  }

  private determineBusinessFunction(componentName: string): string {
    if (componentName.includes('sign')) return 'Digital Signature';
    if (componentName.includes('auth') || componentName.includes('identity')) return 'Authentication';
    if (componentName.includes('document')) return 'Document Management';
    if (componentName.includes('field')) return 'Form Field';
    return 'General UI';
  }

  private async mapApiEndpoints(structure: WeSignCodeStructure): Promise<void> {
    logger.info('Mapping API endpoints to components and workflows');

    try {
      // Analyze Angular services for HTTP client usage
      for (const service of structure.frontend.services) {
        await this.analyzeServiceForApiEndpoints(service);
      }

      // Define common WeSign API endpoints based on components
      const commonEndpoints = this.defineCommonWeSignEndpoints(structure);
      for (const endpoint of commonEndpoints) {
        this.knowledgeBase.apiEndpointMap.set(endpoint.endpoint, endpoint);
      }

      // Map component-specific endpoints
      for (const component of structure.frontend.components) {
        const componentEndpoints = this.inferApiEndpointsForComponent(component);
        for (const endpoint of componentEndpoints) {
          this.knowledgeBase.apiEndpointMap.set(endpoint.endpoint, endpoint);
        }
      }

      logger.info(`Mapped ${this.knowledgeBase.apiEndpointMap.size} API endpoints`);

    } catch (error) {
      logger.error('Failed to map API endpoints:', error);
    }
  }

  /**
   * Analyze a service file for HTTP client usage and API endpoints
   */
  private async analyzeServiceForApiEndpoints(service: any): Promise<void> {
    try {
      if (!fs.existsSync(service.path)) {
        return;
      }

      const content = fs.readFileSync(service.path, 'utf-8');

      // Extract HTTP method calls with fixed regex patterns
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
      for (const method of httpMethods) {
        // Fixed regex pattern - properly escaped and grouped
        const methodPattern = new RegExp(`this\\.http\\.${method}\\s*\\(['"]([^'"]+)['"]`, 'g');
        let match;
        while ((match = methodPattern.exec(content)) !== null) {
          const endpoint = match[1];
          if (endpoint && endpoint.startsWith('/api')) {
            const apiEndpoint: ApiKnowledge = {
              endpoint: endpoint,
              method: method.toUpperCase(),
              description: `${method.toUpperCase()} endpoint from ${service.name} service`,
              parameters: this.extractEndpointParameters(endpoint, content),
              responses: this.inferResponseTypes(endpoint, method),
              dependencies: service.dependencies || [],
              testData: this.generateTestDataForEndpoint(endpoint, method)
            };
            this.knowledgeBase.apiEndpointMap.set(endpoint, apiEndpoint);
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to analyze service ${service.name} for API endpoints:`, error);
    }
  }

  /**
   * Define common WeSign API endpoints based on application structure
   */
  private defineCommonWeSignEndpoints(structure: WeSignCodeStructure): ApiKnowledge[] {
    const endpoints: ApiKnowledge[] = [];

    // Authentication endpoints
    endpoints.push(
      {
        endpoint: '/api/auth/login',
        method: 'POST',
        description: 'User authentication with credentials',
        parameters: [{ name: 'email', type: 'string', required: true }, { name: 'password', type: 'string', required: true }],
        responses: [{ status: 200, description: 'Login successful', schema: { token: 'string', user: 'object' } }],
        dependencies: ['AuthService'],
        testData: { email: 'test@wesign.com', password: 'testpass123' }
      },
      {
        endpoint: '/api/auth/logout',
        method: 'POST',
        description: 'User logout and token invalidation',
        parameters: [],
        responses: [{ status: 200, description: 'Logout successful' }],
        dependencies: ['AuthService'],
        testData: {}
      }
    );

    // Document endpoints
    endpoints.push(
      {
        endpoint: '/api/documents',
        method: 'GET',
        description: 'Retrieve user documents',
        parameters: [{ name: 'page', type: 'number', required: false }, { name: 'limit', type: 'number', required: false }],
        responses: [{ status: 200, description: 'Documents retrieved', schema: { documents: 'array', total: 'number' } }],
        dependencies: ['DocumentService'],
        testData: { page: 1, limit: 10 }
      },
      {
        endpoint: '/api/documents/upload',
        method: 'POST',
        description: 'Upload a new document',
        parameters: [{ name: 'file', type: 'file', required: true }, { name: 'title', type: 'string', required: false }],
        responses: [{ status: 201, description: 'Document uploaded', schema: { documentId: 'string', url: 'string' } }],
        dependencies: ['DocumentService'],
        testData: { title: 'Test Document' }
      }
    );

    // Signing endpoints
    endpoints.push(
      {
        endpoint: '/api/signing/create',
        method: 'POST',
        description: 'Create a new signing request',
        parameters: [{ name: 'documentId', type: 'string', required: true }, { name: 'signers', type: 'array', required: true }],
        responses: [{ status: 201, description: 'Signing request created', schema: { requestId: 'string' } }],
        dependencies: ['SigningService'],
        testData: { documentId: 'doc123', signers: [{ email: 'signer@test.com', name: 'Test Signer' }] }
      },
      {
        endpoint: '/api/signing/submit',
        method: 'POST',
        description: 'Submit a completed signature',
        parameters: [{ name: 'requestId', type: 'string', required: true }, { name: 'signature', type: 'string', required: true }],
        responses: [{ status: 200, description: 'Signature submitted successfully' }],
        dependencies: ['SigningService'],
        testData: { requestId: 'req123', signature: 'base64_signature_data' }
      }
    );

    // Contact endpoints
    endpoints.push(
      {
        endpoint: '/api/contacts',
        method: 'GET',
        description: 'Retrieve user contacts',
        parameters: [{ name: 'search', type: 'string', required: false }],
        responses: [{ status: 200, description: 'Contacts retrieved', schema: { contacts: 'array' } }],
        dependencies: ['ContactService'],
        testData: { search: 'test' }
      },
      {
        endpoint: '/api/contacts',
        method: 'POST',
        description: 'Create a new contact',
        parameters: [{ name: 'name', type: 'string', required: true }, { name: 'email', type: 'string', required: true }],
        responses: [{ status: 201, description: 'Contact created', schema: { contactId: 'string' } }],
        dependencies: ['ContactService'],
        testData: { name: 'Test Contact', email: 'contact@test.com' }
      }
    );

    // Template endpoints
    endpoints.push(
      {
        endpoint: '/api/templates',
        method: 'GET',
        description: 'Retrieve document templates',
        parameters: [],
        responses: [{ status: 200, description: 'Templates retrieved', schema: { templates: 'array' } }],
        dependencies: ['TemplateService'],
        testData: {}
      }
    );

    return endpoints;
  }

  /**
   * Infer API endpoints for a specific component
   */
  private inferApiEndpointsForComponent(component: WeSignComponent): ApiKnowledge[] {
    const endpoints: ApiKnowledge[] = [];
    const componentName = component.name.toLowerCase();

    // Component-specific endpoint inference
    if (componentName.includes('document')) {
      endpoints.push({
        endpoint: `/api/documents/${componentName}`,
        method: 'GET',
        description: `Endpoint for ${component.name} component`,
        parameters: [{ name: 'id', type: 'string', required: true }],
        responses: [{ status: 200, description: 'Success' }],
        dependencies: [component.name],
        testData: { id: 'test-id' }
      });
    }

    if (componentName.includes('sign')) {
      endpoints.push({
        endpoint: `/api/signing/${componentName}`,
        method: 'POST',
        description: `Signing endpoint for ${component.name} component`,
        parameters: [{ name: 'data', type: 'object', required: true }],
        responses: [{ status: 200, description: 'Signing successful' }],
        dependencies: [component.name],
        testData: { data: { signature: 'test-signature' } }
      });
    }

    if (componentName.includes('auth')) {
      endpoints.push({
        endpoint: `/api/auth/${componentName}`,
        method: 'POST',
        description: `Authentication endpoint for ${component.name} component`,
        parameters: [{ name: 'credentials', type: 'object', required: true }],
        responses: [{ status: 200, description: 'Authentication successful' }],
        dependencies: [component.name],
        testData: { credentials: { token: 'test-token' } }
      });
    }

    return endpoints;
  }

  /**
   * Extract parameters from endpoint URL and service content
   */
  private extractEndpointParameters(endpoint: string, serviceContent: string): any[] {
    const parameters: any[] = [];

    // Extract path parameters from URL
    const pathParams = endpoint.match(/:([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
    if (pathParams) {
      for (const param of pathParams) {
        parameters.push({
          name: param.substring(1), // Remove the ':'
          type: 'string',
          required: true,
          location: 'path'
        });
      }
    }

    // Try to extract query parameters from service method calls
    const queryParamMatches = serviceContent.match(/params:\s*{([^}]+)}/g);
    if (queryParamMatches) {
      for (const match of queryParamMatches) {
        const paramContent = match.match(/params:\s*{([^}]+)}/)?.[1];
        if (paramContent) {
          const paramNames = paramContent.match(/([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
          if (paramNames) {
            for (const paramName of paramNames) {
              parameters.push({
                name: paramName,
                type: 'unknown',
                required: false,
                location: 'query'
              });
            }
          }
        }
      }
    }

    return parameters;
  }

  /**
   * Infer response types based on endpoint pattern
   */
  private inferResponseTypes(endpoint: string, method: string): any[] {
    const responses = [];

    // Success responses
    if (method.toLowerCase() === 'post' && endpoint.includes('create')) {
      responses.push({ status: 201, description: 'Created successfully' });
    } else if (method.toLowerCase() === 'delete') {
      responses.push({ status: 204, description: 'Deleted successfully' });
    } else {
      responses.push({ status: 200, description: 'Success' });
    }

    // Common error responses
    responses.push({ status: 400, description: 'Bad Request' });
    responses.push({ status: 401, description: 'Unauthorized' });
    responses.push({ status: 500, description: 'Internal Server Error' });

    return responses;
  }

  /**
   * Generate test data for endpoint based on its pattern
   */
  private generateTestDataForEndpoint(endpoint: string, method: string): any {
    const testData: any = {};

    if (endpoint.includes('auth')) {
      testData.email = 'test@wesign.com';
      testData.password = 'testpass123';
    }

    if (endpoint.includes('document')) {
      testData.documentId = 'test-doc-123';
      testData.title = 'Test Document';
    }

    if (endpoint.includes('sign')) {
      testData.signature = 'base64_test_signature';
      testData.requestId = 'test-request-123';
    }

    if (endpoint.includes('contact')) {
      testData.name = 'Test Contact';
      testData.email = 'contact@test.com';
    }

    return testData;
  }

  /**
   * Get knowledge for specific query
   */
  async getKnowledgeForQuery(query: string): Promise<any> {
    // Search the knowledge base for relevant information
    const results = await this.knowledgeIngestion.searchKnowledge(query, 10);

    return {
      query,
      results,
      components: Array.from(this.knowledgeBase.componentMap.values()),
      workflows: Array.from(this.knowledgeBase.workflowMap.values()),
      selectors: Array.from(this.knowledgeBase.selectorMap.values()),
      lastUpdated: this.knowledgeBase.lastUpdated
    };
  }

  /**
   * Update knowledge base with new information
   */
  async updateKnowledge(category: string, content: string): Promise<void> {
    const tempFile = this.createTempFile(content, `update-${Date.now()}.md`);
    await this.knowledgeIngestion.ingestFile(tempFile, category);
    fs.unlinkSync(tempFile);

    logger.info(`Updated knowledge base category: ${category}`);
  }
}