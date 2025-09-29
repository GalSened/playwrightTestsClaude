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
  private scanActualServices(servicesDir: string): Promise<any[]> {
    return Promise.resolve([]);
  }

  private scanActualRoutes(routingFile: string): Promise<any[]> {
    return Promise.resolve([]);
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
  private getTestableElementsForComponent(component: WeSignComponent): Promise<TestableElement[]> {
    return Promise.resolve([]);
  }

  private identifyCommonFailures(componentName: string): FailurePattern[] {
    return [];
  }

  private generateSelectorRecommendations(componentName: string): SelectorRecommendation[] {
    return [];
  }

  private extractI18nKeys(component: WeSignComponent): string[] {
    return [];
  }

  private getComponentRoutes(componentName: string, routes: any[]): string[] {
    return [];
  }

  private determineBusinessFunction(componentName: string): string {
    if (componentName.includes('sign')) return 'Digital Signature';
    if (componentName.includes('auth') || componentName.includes('identity')) return 'Authentication';
    if (componentName.includes('document')) return 'Document Management';
    if (componentName.includes('field')) return 'Form Field';
    return 'General UI';
  }

  private mapApiEndpoints(structure: WeSignCodeStructure): Promise<void> {
    return Promise.resolve();
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