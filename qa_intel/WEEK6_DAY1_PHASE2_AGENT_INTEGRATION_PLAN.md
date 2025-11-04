# Week 6 Day 1 - Phase 2: Agent Integration with COM - EXECUTION PLAN

**Date**: 2025-10-26
**Phase**: Phase 2 - Agent Integration
**Status**: 🚀 **READY TO START**
**Prerequisites**: Phase 1 Complete ✅

---

## Executive Summary

Phase 2 enables the existing agents (TestIntelligenceAgent, FailureAnalysisAgent, and the new JiraIntegrationAgent) to use COM for historical context retrieval and cross-agent communication. The integration uses a **mixin pattern** where separate `.com.ts` files provide COM-enhanced methods without modifying the core agent logic.

**Key Benefits**:
- Agents make decisions using historical patterns (not just current data)
- Agent-to-agent communication via COM event store
- Graceful degradation if COM service is unavailable
- All agent decisions tracked for future learning

---

## Integration Pattern (Already Implemented in Merge)

### Files Available

1. **backend/src/services/subAgents/TestIntelligenceAgent.com.ts** ✅
   - Enhances failure analysis with historical context
   - Enhances execution planning with test history
   - Enhances selector healing with past fixes
   - Ingests task results and test executions

2. **backend/src/services/ai/failure-analysis-agent.com.ts** ✅
   - Enhances root cause analysis with failure patterns
   - Enhances flaky detection with historical data
   - Gets related failure patterns across tests
   - Shares analysis with TestIntelligenceAgent

3. **backend/src/services/workflows/com-enhanced-agent-workflows.ts** ✅
   - TestFailureAnalysisWorkflow (end-to-end)
   - FlakyTestTriageWorkflow (pattern detection)
   - SmartTestSelectionWorkflow (code change → test selection)
   - COMEnhancedWorkflowManager (coordinator)

4. **backend/tests/com/agent-integration.test.ts** ✅
   - Complete integration test suite
   - Tests all agent→COM interactions
   - Tests agent-to-agent communication
   - Performance and reliability tests

### Key Imports Required

```typescript
import { getCOMClient, EventType, Event } from '../com/COMClient';
import { getTestIntelligenceAgentCOMIntegration } from '@/services/subAgents/TestIntelligenceAgent.com';
import { getFailureAnalysisAgentCOMIntegration } from '@/services/ai/failure-analysis-agent.com';
import { getCOMEnhancedWorkflowManager } from '@/services/workflows/com-enhanced-agent-workflows';
```

---

## Phase 2.1: Basic Agent-COM Integration Testing

### Step 1: Verify COMClient is Accessible ✅
**Status**: Already available from merge
**File**: `backend/src/services/com/COMClient.ts`

**Methods Available**:
- `getCOMClient()` - Singleton client
- `ingestEvent(event: Event)` - Ingest to COM
- `retrieveContext(query: ContextQuery)` - Retrieve context pack
- `checkHealth()` - Health check
- `formatContextForLLM(pack)` - Format for prompts

**Verification**: COM service running on port 8083 ✅

---

### Step 2: Test TestIntelligenceAgent COM Integration

**File to Use**: [backend/src/services/subAgents/TestIntelligenceAgent.com.ts](../backend/src/services/subAgents/TestIntelligenceAgent.com.ts)

**Test Scenario 1: Failure Analysis Enhancement**
```typescript
const testAgentCOM = getTestIntelligenceAgentCOMIntegration();

// Simulate test failure
const task = {
  id: 'test-task-001',
  type: 'analyze-failures',
  data: {
    failures: [
      {
        testId: 'test_login_hebrew',
        errorMessage: 'Element not found: #login-button',
        context: { selector: '#login-button', page: '/login' }
      }
    ]
  },
  context: { branch: 'main' }
};

// Retrieve historical context
const { context, metadata } = await testAgentCOM.enhanceFailureAnalysis(
  task,
  task.data.failures
);

console.log('Context retrieved:', metadata.pack_id);
console.log('Items:', metadata.total_items);
console.log('Tokens:', metadata.total_tokens);
```

**Expected Result**:
- Context pack retrieved (may be empty if no historical data)
- Metadata includes pack_id, total_items, total_tokens
- Graceful degradation if COM unavailable

---

**Test Scenario 2: Ingest Task Result**
```typescript
const result = {
  taskId: 'test-task-001',
  agentId: 'test-intelligence-agent',
  status: 'success',
  success: true,
  data: {
    analysis: {
      rootCauses: ['selector-changed', 'hebrew-rtl-issue'],
      recommendations: ['Use data-testid', 'Test RTL layout']
    }
  },
  confidence: 0.87,
  executionTime: 1500,
  recommendations: ['Fix selector stability']
};

await testAgentCOM.ingestTaskResult(task, result);
```

**Expected Result**:
- Event ingested to COM
- Event type: AGENT_ACTION
- Tags: ['analyze-failures', 'success', 'high-confidence', 'analysis', 'root-cause']
- Importance: calculated based on success + confidence

---

### Step 3: Test FailureAnalysisAgent COM Integration

**File to Use**: [backend/src/services/ai/failure-analysis-agent.com.ts](../backend/src/services/ai/failure-analysis-agent.com.ts)

**Test Scenario 1: Root Cause Analysis Enhancement**
```typescript
const failureAgentCOM = getFailureAnalysisAgentCOMIntegration();

const testId = 'test_payment_flow';
const failures = [
  {
    errorMessage: 'Payment button not clickable',
    selector: '#payment-submit',
    page: '/payment'
  }
];

const { context, metadata } = await failureAgentCOM.enhanceRootCauseAnalysis(
  testId,
  failures,
  {}
);

console.log('Root cause context:', metadata.pack_id);
console.log('Recurring patterns:', metadata.recurring_patterns);
```

**Expected Result**:
- Context pack with historical failure patterns
- Recurring patterns identified from tags
- Graceful degradation if no historical data

---

**Test Scenario 2: Agent-to-Agent Communication**
```typescript
const analysis = {
  failureType: 'selector-not-found',
  rootCause: 'UI refactoring changed element structure',
  recommendations: ['Use data-testid', 'Add explicit waits'],
  confidence: 0.89,
  patterns: ['recurring-failure', 'healable-failure'],
  wesignContext: {
    affectedComponent: 'payment-form',
    relatedWorkflow: 'payment-processing',
    businessImpact: 'high'
  }
};

// Ingest analysis
await failureAgentCOM.ingestAnalysisResult(testId, analysis, 0.89);

// Share with TestIntelligenceAgent
await failureAgentCOM.shareAnalysisWithTestAgent(
  testId,
  analysis,
  'pack-123'
);
```

**Expected Result**:
- Analysis event ingested with importance 4.5 (high confidence + recurring)
- Shared analysis event with tag 'test-intelligence-agent'
- TestIntelligenceAgent can retrieve this in next cycle

---

### Step 4: Test End-to-End Workflow

**File to Use**: [backend/src/services/workflows/com-enhanced-agent-workflows.ts](../backend/src/services/workflows/com-enhanced-agent-workflows.ts)

**Test Scenario: Complete Failure Analysis Workflow**
```typescript
import { TestIntelligenceAgent } from '@/services/subAgents/TestIntelligenceAgent';
import { FailureAnalysisAgent } from '@/services/ai/failure-analysis-agent';
import { getCOMEnhancedWorkflowManager } from '@/services/workflows/com-enhanced-agent-workflows';

const testAgent = new TestIntelligenceAgent();
const failureAgent = new FailureAnalysisAgent();
const workflowManager = getCOMEnhancedWorkflowManager(testAgent, failureAgent);

// Health check
const health = await workflowManager.healthCheck();
console.log('Workflow health:', health);

// Execute flaky test triage workflow
const executionHistory = [
  { status: 'passed', duration: 1000 },
  { status: 'failed', duration: 1200 },
  { status: 'passed', duration: 950 },
  { status: 'failed', duration: 1100 }
];

const triageResult = await workflowManager.triageFlakyTest(
  'test_flaky_example',
  executionHistory
);

console.log('Is flaky:', triageResult.isFlaky);
console.log('Confidence:', triageResult.confidence);
console.log('Recommendations:', triageResult.recommendations);
```

**Expected Result**:
- Workflow health check passes (COM healthy)
- Flaky detection returns analysis with confidence
- Recommendations based on historical patterns
- Pattern ingestion for future detection

---

## Phase 2.2: Integration Test Suite Execution

### Step 5: Run Jest Integration Tests

**File**: [backend/tests/com/agent-integration.test.ts](../backend/tests/com/agent-integration.test.ts)

**Test Groups**:
1. **COMClient Basic Operations** (3 tests)
   - Health check
   - Event ingestion
   - Context retrieval

2. **TestIntelligenceAgent COM Integration** (3 tests)
   - Failure analysis enhancement
   - Task result ingestion
   - Health check

3. **FailureAnalysisAgent COM Integration** (4 tests)
   - Root cause analysis enhancement
   - Flaky detection enhancement
   - Analysis result ingestion
   - Agent-to-agent sharing

4. **Agent-to-Agent Communication** (1 test)
   - Complete end-to-end workflow

5. **Performance and Reliability** (3 tests)
   - Graceful degradation
   - Context retrieval latency
   - Concurrent retrievals

**Run Command**:
```bash
cd backend
npm test -- tests/com/agent-integration.test.ts
```

**Expected Results**:
- All 14 tests should pass
- COM service must be running on port 8083
- Some tests have 15-30 second timeouts (vector search)

---

## Success Criteria (Phase 2.1)

### Must-Have ✓
- [ ] COMClient accessible from TypeScript
- [ ] TestIntelligenceAgent can retrieve historical context
- [ ] TestIntelligenceAgent can ingest task results
- [ ] FailureAnalysisAgent can retrieve failure patterns
- [ ] FailureAnalysisAgent can share analysis via COM
- [ ] Agent-to-agent communication working
- [ ] Graceful degradation when COM unavailable
- [ ] At least 10/14 integration tests passing

### Nice-to-Have ⏳
- [ ] All 14/14 integration tests passing
- [ ] Context retrieval latency <5 seconds
- [ ] Concurrent context retrieval working
- [ ] Pattern detection across multiple tests
- [ ] Workflow health monitoring functional

---

## Timeline

### Week 6 Day 1 (Today) - Phase 2.1
- ✅ Create Phase 2.1 execution plan (this document)
- 🔄 Test TestIntelligenceAgent COM integration (manual)
- 🔄 Test FailureAnalysisAgent COM integration (manual)
- 🔄 Test end-to-end workflow (manual)
- 🔄 Run Jest integration test suite
- 🔄 Create Phase 2.1 completion report

### Week 6 Day 2 - Phase 2.2
- JiraIntegrationAgent COM integration (if exists)
- Production integration into existing agent orchestrator
- Update agent configuration to enable COM by default

### Week 6 Day 3 - Phase 2.3
- Agent orchestrator workflow integration
- Real test execution with COM context
- Performance optimization

---

## Dependencies

### Running Services Required
1. **COM Service**: Port 8083 ✅ (running)
2. **Backend**: Port 8082 (not required for COM tests)
3. **Database**: scheduler.db (not required for COM tests)

### TypeScript Packages Required
All already installed via Phase 1:
- `@types/node`
- `@types/jest` (for tests)
- TypeScript compiler
- ts-node (for running TypeScript directly)

---

## Risk Mitigation

### Risk 1: COMClient Import Path Issues
**Mitigation**: Verify path aliases in tsconfig.json
**Fallback**: Use relative imports

### Risk 2: COM Service Not Running
**Mitigation**: Start COM service before testing
**Verification**: `curl http://localhost:8083/health`

### Risk 3: No Historical Data in COM
**Impact**: Context retrievals return empty packs
**Mitigation**: Ingest test events first, then retrieve
**Expected**: Graceful degradation (empty context, no errors)

### Risk 4: Vector Search Latency
**Impact**: Tests timeout (>5s)
**Mitigation**: Increase Jest timeouts to 15-30s
**Already Applied**: Long timeouts in test file

---

## Testing Checklist

### Manual Testing
- [ ] Import COMClient in TypeScript file - no errors
- [ ] Call `getCOMClient()` - returns client instance
- [ ] Call `checkHealth()` - returns healthy status
- [ ] Ingest test event - success response
- [ ] Retrieve context - returns context pack
- [ ] Test graceful degradation (stop COM, retry) - no crash

### Integration Testing
- [ ] Run Jest test suite - at least 10/14 pass
- [ ] Check test output for warnings/errors
- [ ] Verify context retrieval performance (<5s)
- [ ] Verify event ingestion in COM database
- [ ] Verify agent-to-agent communication

### Workflow Testing
- [ ] Flaky test triage workflow - returns recommendations
- [ ] Smart test selection workflow - selects tests
- [ ] Test failure analysis workflow - completes end-to-end
- [ ] Workflow health check - reports COM status

---

## Deliverables

1. **Manual Test Script** (TypeScript/Node)
   - Path: `backend/scripts/test-com-integration.ts`
   - Runs basic agent→COM operations
   - Outputs results to console

2. **Jest Test Results**
   - Output: `reports/com/agent-integration-results.txt`
   - Coverage: All COM integration points

3. **Phase 2.1 Completion Report**
   - Path: `qa_intel/WEEK6_DAY1_PHASE2_1_COMPLETION_REPORT.md`
   - Documents all test results
   - Lists any issues encountered

---

## Next Phase Preview

### Phase 2.2: Production Integration
- Integrate COM into existing agent orchestrator
- Enable COM context by default for all agent tasks
- Add COM stats to QA Intelligence dashboard
- Monitor agent performance with COM enabled

### Phase 2.3: Advanced Workflows
- Multi-agent collaboration workflows
- Cross-project pattern detection
- Automated Jira ticket creation from patterns
- Self-healing workflow automation

---

**Plan Status**: ✅ **READY TO EXECUTE**
**Next Step**: Begin Step 2 - Test TestIntelligenceAgent COM Integration

---

**End of Plan**
