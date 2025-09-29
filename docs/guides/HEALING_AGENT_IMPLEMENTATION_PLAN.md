# Healing Agent Implementation Plan

## Overview
The Healing Agent provides autonomous test repair capabilities for the QA Intelligence system, focusing on self-healing selectors, code mutation, and pattern-based repair recommendations.

## Architecture

### Core Class Structure
```typescript
export class HealingAgent extends EventEmitter implements SubAgent {
  public readonly id = 'healing-agent';
  public readonly type = 'healing' as const;
  public readonly capabilities: AgentCapability[] = [
    'selector-healing',
    'test-repair',
    'pattern-learning',
    'code-mutation',
    'performance-optimization'
  ];
}
```

### Integration Points
1. **AgentOrchestrator**: Capability-based task routing
2. **TestIntelligenceAgent**: Failure analysis collaboration
3. **ContextManager**: Real-time failure history updates
4. **Database Schema**: Extensions for healing patterns and attempts
5. **Playwright Integration**: Non-intrusive test execution hooks

### Key Capabilities

#### 1. Autonomous Test Repair
- Self-healing selectors with AI-powered analysis
- Multiple fallback strategies (data-testid, semantic, XPath)
- WeSign-specific patterns for bilingual content

#### 2. Pattern Learning
- Machine learning from healing attempts
- Success rate improvement over time
- Failure pattern recognition and classification

#### 3. Multi-Strategy Healing
- **Primary**: Data-testid fallback strategies
- **Secondary**: Semantic selector generation
- **Tertiary**: XPath alternatives with stability scoring
- **WeSign-Specific**: Document signing workflows, authentication patterns

#### 4. Real-time Integration
- Playwright test execution with healing hooks
- Non-blocking healing attempts
- Immediate fallback on healing failure

## Implementation Steps

### Phase 1: Core Infrastructure (20 hours)
1. **Type Definitions** (4 hours)
   - Extend `backend/src/types/agents.ts` with healing-specific types
   - Add `HealingStrategy`, `HealingAttempt`, `PatternMatch` interfaces
   - Define healing task types and result structures

2. **Database Schema Extensions** (6 hours)
   - Extend `backend/src/database/agents-schema.sql`
   - Add `healing_attempts`, `healing_patterns`, `selector_analysis` tables
   - Create indexes for performance optimization

3. **HealingAgent Core Class** (10 hours)
   - Create `backend/src/services/subAgents/HealingAgent.ts`
   - Implement basic agent interface and lifecycle
   - Add health check and status reporting capabilities

### Phase 2: Healing Strategies (25 hours)
1. **Selector Analysis Engine** (8 hours)
   - Implement selector stability scoring
   - Create fallback selector generation
   - Add WeSign-specific selector patterns

2. **Multi-Strategy Healing** (10 hours)
   - Data-testid fallback implementation
   - Semantic selector generation
   - XPath alternative generation with stability scoring

3. **Pattern Learning System** (7 hours)
   - Machine learning from healing attempts
   - Pattern classification and storage
   - Success rate tracking and optimization

### Phase 3: Playwright Integration (15 hours)
1. **Test Hooks System** (8 hours)
   - Non-intrusive Playwright integration
   - Real-time healing during test execution
   - Healing attempt logging and metrics

2. **WeSign-Specific Intelligence** (7 hours)
   - Bilingual content handling (Hebrew/English)
   - Document signing workflow patterns
   - Authentication flow healing strategies

### Phase 4: AI Integration (15 hours)
1. **AI-Powered Analysis** (8 hours)
   - Integration with existing AIService
   - Intelligent healing strategy selection
   - Context-aware repair recommendations

2. **Failure Analysis Collaboration** (7 hours)
   - Integration with TestIntelligenceAgent
   - Shared failure pattern recognition
   - Collaborative healing recommendations

### Phase 5: Frontend Integration (10 hours)
1. **Healing Dashboard** (6 hours)
   - Extend SubAgentsPage with healing metrics
   - Real-time healing attempt monitoring
   - Pattern analysis visualization

2. **Configuration Interface** (4 hours)
   - Healing strategy configuration
   - Pattern threshold adjustments
   - Success rate analytics

## Database Schema Extensions

```sql
-- Healing attempts tracking
CREATE TABLE healing_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  original_selector TEXT NOT NULL,
  healed_selector TEXT,
  strategy_used TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  error_message TEXT,
  context_data TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pattern learning storage
CREATE TABLE healing_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern_type TEXT NOT NULL,
  selector_pattern TEXT NOT NULL,
  success_rate REAL NOT NULL,
  usage_count INTEGER DEFAULT 1,
  last_success DATETIME,
  last_failure DATETIME,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Selector analysis cache
CREATE TABLE selector_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  selector TEXT UNIQUE NOT NULL,
  stability_score REAL NOT NULL,
  fallback_selectors TEXT NOT NULL,
  analysis_metadata TEXT,
  analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
```

## File Structure

```
backend/src/services/subAgents/
├── HealingAgent.ts                 # Core healing agent implementation
├── healingStrategies/
│   ├── SelectorHealing.ts          # Selector healing strategies
│   ├── PatternLearning.ts          # Pattern learning system
│   └── WeSignSpecific.ts           # WeSign-specific healing patterns
└── integration/
    └── PlaywrightIntegration.ts    # Playwright test hooks
```

## Success Metrics
- **80%+ healing success rate**
- **<5 second average healing time**
- **95%+ pattern learning accuracy**
- **Zero regression introduction**
- **Real-time healing capability**

## Estimated Timeline: 85 hours total
- **Critical Path**: Types → HealingAgent → Database Schema → Playwright Integration
- **Parallel Work**: AI Integration can run parallel with Playwright Integration
- **Dependencies**: Requires existing sub-agents infrastructure completion

## Next Steps
1. Begin with type definitions and database schema extensions
2. Implement core HealingAgent class with basic capabilities
3. Add healing strategies one by one with comprehensive testing
4. Integrate with Playwright and existing test infrastructure
5. Add frontend monitoring and configuration capabilities