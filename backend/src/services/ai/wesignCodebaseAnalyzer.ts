import { logger } from '@/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

export interface WeSignCodeStructure {
  frontend: {
    framework: string;
    version: string;
    components: WeSignComponent[];
    routes: WeSignRoute[];
    services: WeSignService[];
    models: WeSignModel[];
  };
  backend: {
    framework: string;
    version: string;
    controllers: WeSignController[];
    businessLogic: WeSignBusinessLogic[];
    dataAccess: WeSignDataAccess[];
    models: WeSignModel[];
  };
  features: WeSignFeature[];
  workflows: WeSignWorkflow[];
  apiEndpoints: WeSignApiEndpoint[];
}

export interface WeSignComponent {
  name: string;
  path: string;
  type: 'component' | 'page' | 'shared';
  features: string[];
  dependencies: string[];
  hebrewSupport: boolean;
}

export interface WeSignRoute {
  path: string;
  component: string;
  guards: string[];
  children?: WeSignRoute[];
  description: string;
}

export interface WeSignController {
  name: string;
  path: string;
  actions: WeSignControllerAction[];
  routes: string[];
  businessLogic: string[];
}

export interface WeSignControllerAction {
  name: string;
  httpMethod: string;
  route: string;
  parameters: WeSignParameter[];
  returnType: string;
  description: string;
}

export interface WeSignParameter {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface WeSignService {
  name: string;
  path: string;
  methods: string[];
  dependencies: string[];
}

export interface WeSignModel {
  name: string;
  path: string;
  properties: WeSignProperty[];
  relationships: string[];
}

export interface WeSignProperty {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface WeSignBusinessLogic {
  name: string;
  path: string;
  methods: string[];
  workflows: string[];
}

export interface WeSignDataAccess {
  name: string;
  path: string;
  entities: string[];
  operations: string[];
}

export interface WeSignFeature {
  name: string;
  description: string;
  frontendComponents: string[];
  backendControllers: string[];
  workflows: string[];
  hebrewTerms: string[];
  englishTerms: string[];
}

export interface WeSignWorkflow {
  name: string;
  description: string;
  steps: WeSignWorkflowStep[];
  userRoles: string[];
  businessRules: string[];
}

export interface WeSignWorkflowStep {
  order: number;
  name: string;
  description: string;
  component: string;
  apiCall?: string;
  userAction: string;
}

export interface WeSignApiEndpoint {
  controller: string;
  action: string;
  method: string;
  path: string;
  parameters: WeSignParameter[];
  response: string;
  description: string;
  businessLogic: string;
}

/**
 * WeSign Codebase Analyzer
 * Analyzes the actual WeSign source code to extract comprehensive knowledge
 */
export class WeSignCodebaseAnalyzer {
  private frontendPath: string;
  private backendPath: string;
  private codeStructure: WeSignCodeStructure;

  constructor(
    frontendPath: string = 'C:\\Users\\gals\\Desktop\\wesign-client-DEV',
    backendPath: string = 'C:\\Users\\gals\\source\\repos\\user-backend'
  ) {
    this.frontendPath = frontendPath;
    this.backendPath = backendPath;
    this.codeStructure = this.initializeCodeStructure();
  }

  /**
   * Analyze the complete WeSign codebase
   */
  async analyzeFullCodebase(): Promise<WeSignCodeStructure> {
    try {
      logger.info('Starting comprehensive WeSign codebase analysis');

      // Analyze Frontend (Angular)
      await this.analyzeFrontend();

      // Analyze Backend (.NET Core)
      await this.analyzeBackend();

      // Extract Features and Workflows
      await this.extractFeaturesAndWorkflows();

      // Generate API Documentation
      await this.generateApiDocumentation();

      logger.info('WeSign codebase analysis completed successfully', {
        frontendComponents: this.codeStructure.frontend.components.length,
        backendControllers: this.codeStructure.backend.controllers.length,
        features: this.codeStructure.features.length,
        workflows: this.codeStructure.workflows.length,
        apiEndpoints: this.codeStructure.apiEndpoints.length
      });

      return this.codeStructure;

    } catch (error) {
      logger.error('Failed to analyze WeSign codebase:', error);
      throw error;
    }
  }

  /**
   * Analyze Angular Frontend
   */
  private async analyzeFrontend(): Promise<void> {
    logger.info('Analyzing WeSign Angular frontend');

    // Parse package.json for framework info
    const packageJsonPath = path.join(this.frontendPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      this.codeStructure.frontend.framework = 'Angular';
      this.codeStructure.frontend.version = packageJson.dependencies['@angular/core'] || 'Unknown';
    }

    // Analyze Components
    await this.analyzeAngularComponents();

    // Analyze Routes
    await this.analyzeAngularRoutes();

    // Analyze Services
    await this.analyzeAngularServices();
  }

  /**
   * Analyze .NET Core Backend
   */
  private async analyzeBackend(): Promise<void> {
    logger.info('Analyzing WeSign .NET Core backend');

    this.codeStructure.backend.framework = '.NET Core';
    this.codeStructure.backend.version = 'Unknown'; // Would need to parse .csproj

    // Analyze Controllers
    await this.analyzeControllers();

    // Analyze Business Logic
    await this.analyzeBusinessLogic();

    // Analyze Data Access
    await this.analyzeDataAccess();
  }

  /**
   * Analyze Angular Components
   */
  private async analyzeAngularComponents(): Promise<void> {
    const componentsPath = path.join(this.frontendPath, 'src', 'app', 'components');

    if (fs.existsSync(componentsPath)) {
      const componentDirs = this.getDirectories(componentsPath);

      for (const dir of componentDirs) {
        const componentPath = path.join(componentsPath, dir);
        const component = this.analyzeAngularComponent(componentPath, dir);
        this.codeStructure.frontend.components.push(component);
      }
    }
  }

  /**
   * Analyze a single Angular component
   */
  private analyzeAngularComponent(componentPath: string, componentName: string): WeSignComponent {
    const component: WeSignComponent = {
      name: componentName,
      path: componentPath,
      type: this.determineComponentType(componentName),
      features: [],
      dependencies: [],
      hebrewSupport: false
    };

    // Look for TypeScript files
    const tsFiles = this.getFiles(componentPath, '.ts');
    for (const tsFile of tsFiles) {
      const content = fs.readFileSync(path.join(componentPath, tsFile), 'utf-8');

      // Check for Hebrew support
      if (this.containsHebrewContent(content)) {
        component.hebrewSupport = true;
      }

      // Extract dependencies
      component.dependencies.push(...this.extractImports(content));

      // Extract features based on component name and content
      component.features.push(...this.extractFeaturesFromComponent(componentName, content));
    }

    return component;
  }

  /**
   * Analyze Angular Routes
   */
  private async analyzeAngularRoutes(): Promise<void> {
    const routingFiles = [
      path.join(this.frontendPath, 'src', 'app', 'app-routing.module.ts'),
      path.join(this.frontendPath, 'src', 'app', 'components', 'dashboard', 'dashboard-routing.module.ts')
    ];

    for (const routingFile of routingFiles) {
      if (fs.existsSync(routingFile)) {
        const content = fs.readFileSync(routingFile, 'utf-8');
        const routes = this.parseAngularRoutes(content);
        this.codeStructure.frontend.routes.push(...routes);
      }
    }
  }

  /**
   * Analyze Controllers
   */
  private async analyzeControllers(): Promise<void> {
    const controllersPath = path.join(this.backendPath, 'WeSign', 'Areas', 'Api', 'Controllers');

    if (fs.existsSync(controllersPath)) {
      const controllerFiles = this.getFiles(controllersPath, '.cs');

      for (const controllerFile of controllerFiles) {
        const controllerPath = path.join(controllersPath, controllerFile);
        const controller = this.analyzeController(controllerPath, controllerFile);
        this.codeStructure.backend.controllers.push(controller);
      }
    }
  }

  /**
   * Analyze a single Controller
   */
  private analyzeController(controllerPath: string, controllerFile: string): WeSignController {
    const content = fs.readFileSync(controllerPath, 'utf-8');
    const controllerName = controllerFile.replace('.cs', '');

    const controller: WeSignController = {
      name: controllerName,
      path: controllerPath,
      actions: [],
      routes: [],
      businessLogic: []
    };

    // Extract controller actions (methods)
    controller.actions = this.extractControllerActions(content);

    // Extract routes
    controller.routes = this.extractControllerRoutes(content);

    // Extract business logic references
    controller.businessLogic = this.extractBusinessLogicReferences(content);

    return controller;
  }

  /**
   * Extract Features and Workflows
   */
  private async extractFeaturesAndWorkflows(): Promise<void> {
    logger.info('Extracting WeSign features and workflows');

    // Define key WeSign features based on analyzed code
    this.codeStructure.features = [
      {
        name: 'Contact Management',
        description: 'Manage contacts for document signing',
        frontendComponents: ['contacts', 'manage-contacts'],
        backendControllers: ['ContactsController'],
        workflows: ['Add Contact', 'Edit Contact', 'Delete Contact'],
        hebrewTerms: ['איש קשר', 'אנשי קשר', 'הוסף איש קשר', 'ערוך איש קשר'],
        englishTerms: ['contact', 'contacts', 'add contact', 'edit contact', 'manage contacts']
      },
      {
        name: 'Document Management',
        description: 'Upload, manage and organize documents',
        frontendComponents: ['documents', 'doc-view', 'document-sent-successfully'],
        backendControllers: ['DocumentCollectionsController'],
        workflows: ['Upload Document', 'View Document', 'Organize Documents'],
        hebrewTerms: ['מסמך', 'מסמכים', 'העלה מסמך', 'ניהול מסמכים'],
        englishTerms: ['document', 'documents', 'upload document', 'document management']
      },
      {
        name: 'Digital Signature',
        description: 'Self-sign and group signing workflows',
        frontendComponents: ['selfsign', 'groupsign', 'signers'],
        backendControllers: ['SelfSignController', 'SignersController'],
        workflows: ['Self Sign Document', 'Group Sign Document', 'Place Signature Fields'],
        hebrewTerms: ['חתימה דיגיטלית', 'חתום', 'חתימה עצמית', 'חתימה קבוצתית'],
        englishTerms: ['digital signature', 'sign', 'self sign', 'group sign', 'signature']
      },
      {
        name: 'Template Management',
        description: 'Create and manage document templates',
        frontendComponents: ['templates', 'template-edit'],
        backendControllers: ['TemplatesController'],
        workflows: ['Create Template', 'Edit Template', 'Use Template'],
        hebrewTerms: ['תבנית', 'תבניות', 'צור תבנית', 'ערוך תבנית'],
        englishTerms: ['template', 'templates', 'create template', 'edit template']
      },
      {
        name: 'Reports and Analytics',
        description: 'Generate reports and view analytics',
        frontendComponents: ['reports'],
        backendControllers: ['ReportsController'],
        workflows: ['Generate Report', 'View Analytics'],
        hebrewTerms: ['דוח', 'דוחות', 'אנליטיקה', 'סטטיסטיקות'],
        englishTerms: ['report', 'reports', 'analytics', 'statistics']
      },
      {
        name: 'User Management',
        description: 'Manage users and permissions',
        frontendComponents: ['profile', 'managment'],
        backendControllers: ['UsersController', 'AdminsController'],
        workflows: ['User Registration', 'User Profile', 'User Permissions'],
        hebrewTerms: ['משתמש', 'משתמשים', 'פרופיל', 'הרשאות'],
        englishTerms: ['user', 'users', 'profile', 'permissions', 'management']
      }
    ];

    // Generate detailed workflows
    this.generateDetailedWorkflows();
  }

  /**
   * Generate detailed workflows
   */
  private generateDetailedWorkflows(): void {
    this.codeStructure.workflows = [
      {
        name: 'Add New Contact',
        description: 'Complete workflow for adding a new contact to WeSign',
        steps: [
          {
            order: 1,
            name: 'Navigate to Contacts',
            description: 'User clicks on Contacts in the main navigation',
            component: 'ContactsComponent',
            userAction: 'Click navigation menu'
          },
          {
            order: 2,
            name: 'Click Add Contact',
            description: 'User clicks the Add Contact button',
            component: 'ContactsComponent',
            userAction: 'Click Add Contact button'
          },
          {
            order: 3,
            name: 'Fill Contact Form',
            description: 'User fills in contact details (name, email, phone, organization)',
            component: 'ContactFormComponent',
            userAction: 'Fill form fields'
          },
          {
            order: 4,
            name: 'Save Contact',
            description: 'User saves the contact information',
            component: 'ContactFormComponent',
            apiCall: 'POST /api/contacts',
            userAction: 'Click Save button'
          }
        ],
        userRoles: ['User', 'Admin'],
        businessRules: ['Email must be unique', 'Name is required', 'Valid email format required']
      },
      {
        name: 'Send Document for Signature',
        description: 'Complete workflow for sending a document for digital signature',
        steps: [
          {
            order: 1,
            name: 'Upload Document',
            description: 'User uploads a document to be signed',
            component: 'DocumentUploadComponent',
            apiCall: 'POST /api/documents/upload',
            userAction: 'Select and upload file'
          },
          {
            order: 2,
            name: 'Select Signers',
            description: 'User selects who will sign the document',
            component: 'SignersComponent',
            userAction: 'Select contacts from list'
          },
          {
            order: 3,
            name: 'Place Signature Fields',
            description: 'User places signature fields on the document',
            component: 'PlaceFieldsComponent',
            userAction: 'Drag and drop signature fields'
          },
          {
            order: 4,
            name: 'Review and Send',
            description: 'User reviews the configuration and sends for signature',
            component: 'ReviewComponent',
            apiCall: 'POST /api/documents/send',
            userAction: 'Click Send for Signature'
          }
        ],
        userRoles: ['User', 'Admin'],
        businessRules: ['At least one signer required', 'Document must have signature fields', 'Valid email addresses required']
      }
    ];
  }

  /**
   * Generate API Documentation
   */
  private async generateApiDocumentation(): Promise<void> {
    logger.info('Generating WeSign API documentation');

    // Extract API endpoints from controllers
    for (const controller of this.codeStructure.backend.controllers) {
      for (const action of controller.actions) {
        const endpoint: WeSignApiEndpoint = {
          controller: controller.name,
          action: action.name,
          method: action.httpMethod,
          path: action.route,
          parameters: action.parameters,
          response: action.returnType,
          description: action.description,
          businessLogic: controller.businessLogic.join(', ')
        };

        this.codeStructure.apiEndpoints.push(endpoint);
      }
    }
  }

  // Helper methods
  private initializeCodeStructure(): WeSignCodeStructure {
    return {
      frontend: {
        framework: '',
        version: '',
        components: [],
        routes: [],
        services: [],
        models: []
      },
      backend: {
        framework: '',
        version: '',
        controllers: [],
        businessLogic: [],
        dataAccess: [],
        models: []
      },
      features: [],
      workflows: [],
      apiEndpoints: []
    };
  }

  private getDirectories(dirPath: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
  }

  private getFiles(dirPath: string, extension: string): string[] {
    if (!fs.existsSync(dirPath)) return [];
    return fs.readdirSync(dirPath)
      .filter(file => file.endsWith(extension));
  }

  private containsHebrewContent(content: string): boolean {
    return /[\u0590-\u05FF]/.test(content);
  }

  private extractImports(content: string): string[] {
    const importRegex = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private extractFeaturesFromComponent(componentName: string, content: string): string[] {
    const features: string[] = [];

    // Map component names to features
    const featureMap: { [key: string]: string[] } = {
      'contacts': ['Contact Management'],
      'documents': ['Document Management'],
      'signers': ['Digital Signature'],
      'templates': ['Template Management'],
      'reports': ['Reports and Analytics'],
      'profile': ['User Management'],
      'dashboard': ['Dashboard'],
      'login': ['Authentication']
    };

    Object.keys(featureMap).forEach(key => {
      if (componentName.toLowerCase().includes(key)) {
        features.push(...featureMap[key]);
      }
    });

    return features;
  }

  private determineComponentType(componentName: string): 'component' | 'page' | 'shared' {
    if (componentName.includes('shared') || componentName.includes('common')) {
      return 'shared';
    }
    if (['dashboard', 'login', 'main', 'profile'].includes(componentName)) {
      return 'page';
    }
    return 'component';
  }

  private parseAngularRoutes(content: string): WeSignRoute[] {
    // This would need more sophisticated parsing
    // For now, return basic structure
    return [];
  }

  private analyzeAngularServices(): Promise<void> {
    // Implement service analysis
    return Promise.resolve();
  }

  private analyzeBusinessLogic(): Promise<void> {
    // Implement business logic analysis
    return Promise.resolve();
  }

  private analyzeDataAccess(): Promise<void> {
    // Implement data access analysis
    return Promise.resolve();
  }

  private extractControllerActions(content: string): WeSignControllerAction[] {
    // Parse C# controller methods
    const actions: WeSignControllerAction[] = [];

    // Basic regex for public methods (would need more sophisticated parsing)
    const methodRegex = /public\s+(?:async\s+)?\w+\s+(\w+)\s*\(/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      actions.push({
        name: match[1],
        httpMethod: this.inferHttpMethod(match[1], content),
        route: this.inferRoute(match[1]),
        parameters: [],
        returnType: 'ActionResult',
        description: `${match[1]} action in controller`
      });
    }

    return actions;
  }

  private extractControllerRoutes(content: string): string[] {
    const routes: string[] = [];
    const routeRegex = /\[Route\("([^"]+)"\)\]/g;
    let match;

    while ((match = routeRegex.exec(content)) !== null) {
      routes.push(match[1]);
    }

    return routes;
  }

  private extractBusinessLogicReferences(content: string): string[] {
    // Extract references to business logic classes
    return [];
  }

  private inferHttpMethod(methodName: string, content: string): string {
    const lowerMethod = methodName.toLowerCase();
    if (lowerMethod.includes('get') || lowerMethod.includes('list')) return 'GET';
    if (lowerMethod.includes('post') || lowerMethod.includes('create') || lowerMethod.includes('add')) return 'POST';
    if (lowerMethod.includes('put') || lowerMethod.includes('update')) return 'PUT';
    if (lowerMethod.includes('delete') || lowerMethod.includes('remove')) return 'DELETE';
    return 'GET';
  }

  private inferRoute(methodName: string): string {
    return `/api/${methodName.toLowerCase()}`;
  }

  /**
   * Get comprehensive knowledge for AI responses
   */
  getComprehensiveKnowledge(): any {
    return {
      architecture: {
        frontend: 'Angular 15+ with TypeScript',
        backend: '.NET Core with RESTful APIs',
        database: 'SQL Server (inferred)',
        authentication: 'JWT-based authentication'
      },
      features: this.codeStructure.features,
      workflows: this.codeStructure.workflows,
      apiEndpoints: this.codeStructure.apiEndpoints,
      components: this.codeStructure.frontend.components,
      controllers: this.codeStructure.backend.controllers,
      businessDomain: 'Digital document signing and workflow management',
      targetMarket: 'Hebrew/English bilingual users',
      keyCapabilities: [
        'Digital document signing',
        'Contact management',
        'Template management',
        'Group signing workflows',
        'Document tracking and reports',
        'User management and permissions'
      ]
    };
  }
}

export default WeSignCodebaseAnalyzer;