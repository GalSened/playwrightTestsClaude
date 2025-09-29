# Code Generation Agent Implementation Plan

## Overview
The Code Generation Agent provides AI-powered test creation capabilities for the QA Intelligence system, specializing in WeSign platform domain knowledge and bilingual test generation (Hebrew/English).

## Architecture

### Core Class Structure
```typescript
export class CodeGenerationAgent extends EventEmitter implements SubAgent {
  public readonly id = 'code-generation-agent';
  public readonly type = 'code-generation' as const;
  public readonly capabilities: AgentCapability[] = [
    'code-generation',
    'test-generation',
    'template-management',
    'code-validation',
    'pattern-extraction',
    'bilingual-generation',
    'wesign-domain-knowledge'
  ];
}
```

### Key Components
1. **CodeGenerationAgent**: Core agent implementation
2. **TemplateManager**: Test template management system
3. **WeSignPatternLibrary**: WeSign-specific test patterns
4. **CodeValidator**: Generated code quality validation
5. **PatternExtractor**: Template creation from existing tests

### Integration Points
1. **AgentOrchestrator**: Capability-based task routing
2. **TestIntelligenceAgent**: Failure analysis for informed generation
3. **AIService**: Enhanced prompt system for code generation
4. **Database Integration**: Template and generated test persistence
5. **Frontend Integration**: Real-time generation UI

## Type System Extensions

### New Agent Types and Capabilities
```typescript
export type AgentType = 
  | 'test-intelligence'
  | 'healing'
  | 'code-generation'  // New agent type
  | 'quality-assurance'
  | 'performance-optimization';

export type AgentCapability = 
  | 'code-generation'       // Core capability
  | 'test-generation'       // Specific capability
  | 'template-management'   // Template operations
  | 'code-validation'       // Quality validation
  | 'pattern-extraction'    // Template creation
  | 'bilingual-generation'  // WeSign-specific
  | 'wesign-domain-knowledge';

export type TaskType =
  | 'generate-tests'        // Core task
  | 'generate-from-template' // Template-based generation
  | 'validate-code'         // Code quality validation
  | 'extract-patterns'      // Template extraction
  | 'maintain-tests';       // Test maintenance
```

### Core Interfaces
```typescript
export interface TestTemplate {
  id: string;
  name: string;
  description: string;
  category: WeSignModule;
  language: 'typescript' | 'python';
  framework: 'playwright' | 'pytest';
  template: string;
  parameters: TemplateParameter[];
  example: string;
  tags: string[];
  usageCount: number;
  successRate: number;
}

export interface CodeGenerationRequest {
  type: 'from-scratch' | 'from-template' | 'pattern-based' | 'maintenance';
  template?: string;
  module: WeSignModule;
  scenario: string;
  language: 'typescript' | 'python';
  framework: 'playwright' | 'pytest';
  bilingual: boolean;
  customization: {
    selectors?: string[];
    testData?: Record<string, any>;
    assertions?: string[];
  };
  qualitySettings: {
    includeErrorHandling: boolean;
    includeRetries: boolean;
    includeScreenshots: boolean;
    codeStyle: 'standard' | 'enterprise' | 'minimal';
  };
}

export interface GeneratedTest {
  id: string;
  name: string;
  code: string;
  filename: string;
  description: string;
  module: WeSignModule;
  framework: string;
  language: string;
  dependencies: string[];
  validationResults: CodeValidationResult;
  metadata: {
    generatedAt: Date;
    tokensUsed: number;
    estimatedExecutionTime: number;
    complexity: 'low' | 'medium' | 'high';
  };
}
```

## WeSign-Specific Pattern Library

### Authentication Patterns
```typescript
const authPatterns = {
  'auth-login': {
    name: 'WeSign Login Flow',
    selectors: {
      emailInput: '[data-testid="email-input"], input[type="email"]',
      passwordInput: '[data-testid="password-input"], input[type="password"]',
      loginButton: '[data-testid="login-button"], button:has-text("כניסה"), button:has-text("Login")',
    },
    bilingualElements: {
      loginButton: { he: 'כניסה', en: 'Login' },
      errorMessage: { he: 'שגיאה בהתחברות', en: 'Login failed' }
    }
  }
};
```

### Document Management Patterns
```typescript
const documentPatterns = {
  'document-upload': {
    name: 'Document Upload Flow',
    selectors: {
      uploadArea: '[data-testid="upload-area"], .upload-zone',
      fileInput: 'input[type="file"]',
      progressBar: '[data-testid="progress"], .progress-bar'
    },
    variations: ['pdf-upload', 'docx-upload', 'invalid-format', 'large-file']
  }
};
```

## AI Integration System

### Enhanced Prompt Templates
```typescript
export class CodeGenerationPrompts {
  static readonly PLAYWRIGHT_GENERATION = `
SYSTEM IDENTITY: You are the WeSign Code Generation Agent - an elite AI architect specializing in production-ready Playwright test automation.

WESIGN CONTEXT:
- Platform: WeSign Electronic Document Signing
- Languages: Hebrew (RTL) + English (LTR)
- Modules: {module}
- Authentication: admin@demo.com / demo123

GENERATION REQUIREMENTS:
✓ Page Object Model architecture
✓ TypeScript interfaces and strict typing
✓ Bilingual selector strategies with fallbacks
✓ Comprehensive error handling and retries
✓ Screenshot capture on failures
✓ Data-driven test parametrization

BILINGUAL SELECTOR STRATEGY:
- Primary: data-testid attributes
- Fallback: text-based selectors with Hebrew/English variants
- RTL-aware positioning validation

REQUEST: {request}
MODULE: {module}
SCENARIO: {scenario}
`;
}
```

## Database Schema Extensions

```sql
-- Test templates table
CREATE TABLE IF NOT EXISTS test_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('auth', 'documents', 'contacts', 'templates', 'dashboard', 'admin', 'integrations')),
  language TEXT NOT NULL CHECK (language IN ('typescript', 'python')),
  framework TEXT NOT NULL CHECK (framework IN ('playwright', 'pytest')),
  template TEXT NOT NULL,
  parameters TEXT NOT NULL, -- JSON array
  example TEXT NOT NULL,
  tags TEXT NOT NULL, -- JSON array
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Generated tests table
CREATE TABLE IF NOT EXISTS generated_tests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  filename TEXT NOT NULL,
  module TEXT NOT NULL,
  framework TEXT NOT NULL,
  language TEXT NOT NULL,
  validation_results TEXT NOT NULL, -- JSON object
  metadata TEXT NOT NULL, -- JSON object
  template_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (template_id) REFERENCES test_templates(id)
);

-- Code generation sessions
CREATE TABLE IF NOT EXISTS code_generation_sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  request_data TEXT NOT NULL, -- JSON object
  status TEXT NOT NULL CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  duration_ms INTEGER,
  tokens_used INTEGER,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)
**Duration**: 40 hours

1. **Type System Extensions** (8 hours)
   - Extend `backend/src/types/agents.ts` with code generation types
   - Add interfaces for templates, requests, and generated tests
   - Define validation result structures

2. **Database Schema** (8 hours)
   - Create schema extensions in `backend/src/database/`
   - Add migration scripts for new tables
   - Create indexes for performance optimization

3. **CodeGenerationAgent Core** (16 hours)
   - Implement `backend/src/services/subAgents/CodeGenerationAgent.ts`
   - Basic agent lifecycle and task execution
   - Integration with AgentOrchestrator

4. **Template Manager** (8 hours)
   - Create `backend/src/services/subAgents/TemplateManager.ts`
   - Template CRUD operations
   - Basic template matching and selection

### Phase 2: AI Integration (Week 3-4)
**Duration**: 35 hours

1. **Enhanced AI Service** (15 hours)
   - Extend existing AIService with code generation prompts
   - Implement specialized WeSign prompt templates
   - Add bilingual generation capabilities

2. **Code Validator** (10 hours)
   - Create `backend/src/services/subAgents/CodeValidator.ts`
   - Code quality analysis and scoring
   - Security and best practices validation

3. **Pattern Library** (10 hours)
   - Implement `backend/src/services/subAgents/WeSignPatternLibrary.ts`
   - Define patterns for all WeSign modules
   - Bilingual selector strategies

### Phase 3: Advanced Features (Week 5-6)
**Duration**: 30 hours

1. **Template System** (15 hours)
   - Advanced template matching algorithms
   - Usage analytics and optimization
   - Template recommendation engine

2. **Pattern Extraction** (10 hours)
   - Automatic template creation from existing tests
   - Pattern recognition and classification
   - Learning from successful test executions

3. **Workflow Integration** (5 hours)
   - Define workflow templates for different scenarios
   - Integration with existing workflow system
   - Multi-step generation pipelines

### Phase 4: API and Frontend (Week 7-8)
**Duration**: 35 hours

1. **REST API Endpoints** (15 hours)
   - Create `backend/src/routes/code-generation.ts`
   - Implement all CRUD operations
   - Workflow execution endpoints

2. **Frontend Components** (20 hours)
   - Code generation panel in SubAgentsPage
   - Real-time generation progress tracking
   - Code editor with syntax highlighting
   - Template browser and selector

### Phase 5: Testing and Optimization (Week 9-10)
**Duration**: 20 hours

1. **Unit Testing** (10 hours)
   - Comprehensive test coverage for all components
   - Mock AI service responses
   - Database integration tests

2. **Performance Optimization** (10 hours)
   - Generation speed optimization
   - Resource usage monitoring
   - Concurrent request handling

## File Structure

```
backend/src/services/subAgents/
├── CodeGenerationAgent.ts           # Core agent implementation
├── TemplateManager.ts               # Template management system
├── WeSignPatternLibrary.ts          # WeSign-specific patterns
├── CodeValidator.ts                 # Code quality validation
├── PatternExtractor.ts              # Template extraction from tests
└── prompts/
    ├── PlaywrightPrompts.ts         # Playwright generation prompts
    └── PytestPrompts.ts             # Pytest generation prompts

backend/src/routes/
└── code-generation.ts               # API endpoints

playwright-smart/src/components/
└── CodeGeneration/
    ├── CodeGenerationPanel.tsx      # Main generation UI
    ├── TemplateSelector.tsx          # Template selection component
    └── CodeEditor.tsx                # Code display and editing
```

## API Endpoints

```typescript
// Core generation endpoints
POST   /api/code-generation/generate              # Generate test code
POST   /api/code-generation/generate/template/:id # Generate from template
POST   /api/code-generation/validate              # Validate generated code
POST   /api/code-generation/workflow/create       # Execute full workflow

// Template management
GET    /api/code-generation/templates             # List templates
POST   /api/code-generation/templates             # Create template
PUT    /api/code-generation/templates/:id         # Update template
DELETE /api/code-generation/templates/:id         # Delete template

// Analytics and monitoring
GET    /api/code-generation/metrics               # Generation metrics
GET    /api/code-generation/sessions              # Generation sessions
```

## Success Metrics

### Performance Indicators
- **Generation Success Rate**: 90%+ successful generations
- **Code Quality Score**: Average 85%+ quality rating
- **Execution Success**: 80%+ generated tests pass on first run
- **Template Usage**: 70%+ template-based generations
- **Generation Speed**: <30 seconds average generation time

### Quality Metrics
- **Code Coverage**: Generated tests achieve 70%+ coverage
- **Maintainability**: 85%+ maintainability score
- **Error Handling**: 100% generated tests include error handling
- **Bilingual Support**: 100% tests support Hebrew/English
- **WeSign Patterns**: 95%+ pattern recognition accuracy

## Integration with Existing Agents

### TestIntelligenceAgent Collaboration
```typescript
// Use failure analysis to inform generation
const analysisResult = await testIntelligenceAgent.analyzeFailures(recentFailures);
const generationContext = {
  commonFailurePatterns: analysisResult.patterns,
  riskAreas: analysisResult.riskAssessment,
  recommendations: analysisResult.recommendations
};
```

### HealingAgent Coordination
```typescript
// Generate self-healing capable tests
const generationRequest = {
  ...baseRequest,
  qualitySettings: {
    ...baseRequest.qualitySettings,
    includeHealingHooks: true,
    selfHealingSelectors: true
  }
};
```

## Estimated Timeline: 160 hours total (10 weeks)
- **Critical Dependencies**: Existing sub-agents infrastructure, AI service integration
- **Parallel Development**: Frontend can be developed parallel to advanced features
- **Testing Integration**: Continuous testing throughout development phases

## Next Steps
1. Begin with type system extensions and database schema
2. Implement core CodeGenerationAgent with basic generation capabilities
3. Add AI integration with WeSign-specific prompt engineering
4. Build template management system with pattern library
5. Create comprehensive frontend interface for generation workflows
6. Implement advanced features like pattern extraction and optimization
7. Comprehensive testing and performance optimization