# COM + Agent Orchestrator - Comprehensive Execution Plan

**Document Version:** 1.0
**Date:** October 25, 2025
**Status:** 🎯 **READY FOR IMPLEMENTATION**

---

## Executive Summary

This plan integrates **COM (Context Orchestrator Management)** as an intelligent context service for the **QA Intelligence Agent Orchestrator**, enabling agents to make context-aware decisions using Git-style memory, deterministic retrieval, and agent-to-agent collaboration.

### Key Principles

1. **COM is FOR agents, not users** - Agents call COM to get context packs for their tasks
2. **Orchestrator manages BOTH** - COM (context) + Agents (execution)
3. **Agent-to-agent coordination** - Agents communicate through events + context sharing
4. **Deterministic & auditable** - All context retrieval is reproducible with citations

---

## Table of Contents

1. [Current Architecture Analysis](#1-current-architecture-analysis)
2. [COM Integration Architecture](#2-com-integration-architecture)
3. [Agent-to-Agent Communication](#3-agent-to-agent-communication)
4. [Orchestrator Enhancement](#4-orchestrator-enhancement)
5. [Implementation Phases](#5-implementation-phases)
6. [Technical Specifications](#6-technical-specifications)
7. [Workflows & Use Cases](#7-workflows--use-cases)
8. [Metrics & Success Criteria](#8-metrics--success-criteria)

---

## 1. Current Architecture Analysis

### 1.1 Existing Components

#### **Orchestrators (2 implementations)**

| Component | Location | Status | Purpose |
|-----------|----------|--------|---------|
| **SubAgent Orchestrator** | `services/subAgents/AgentOrchestrator.ts` | ✅ Production | Workflow management, persistence, health monitoring |
| **AI Agent Orchestrator** | `services/ai/agent-orchestrator.ts` | 🔄 Next-Gen | Advanced patterns (concurrent, hierarchical, pipeline) |

#### **Active Agents (3 registered)**

| Agent | Type | Capabilities | Status |
|-------|------|-------------|--------|
| **TestIntelligenceAgent** | `test-intelligence` | test-analysis, failure-prediction, smart-selection, execute-test | ✅ Active |
| **JiraIntegrationAgent** | `jira-integration` | issue-management, test-failure-tracking, quality-reporting, bilingual-support | ✅ Active |
| **FailureAnalysisAgent** | `failure-analysis` | root-cause-analysis, test-failure-investigation, wesign-domain-knowledge | ✅ Active |

#### **Supporting Infrastructure**

| Component | Purpose | Status |
|-----------|---------|--------|
| **ContextManager** | Centralized context sharing (UnifiedContext) | ✅ Active |
| **HealthMonitor** | Agent health checks | ✅ Active |
| **MetricsCollector** | Performance metrics | ✅ Active |
| **EventBus** | Inter-agent communication | ✅ Active |

### 1.2 Current Agent Communication Patterns

```typescript
// Event-driven connections (currently in production)
TestIntelligenceAgent
    ↓ (test failure event)
FailureAnalysisAgent
    ↓ (failure-analysis-complete, confidence > 0.8)
JiraIntegrationAgent
    ↓ (create Jira issue)
```

### 1.3 Identified Gaps (COM Will Fill)

| Gap | Current State | COM Solution |
|-----|---------------|--------------|
| **Historical Context** | Agents have no memory of past decisions | Git-style memory journal with branches/commits/tags |
| **Deterministic Retrieval** | Context is ad-hoc, not reproducible | Policy-driven retrieval with auditable citations |
| **Cross-Agent Learning** | Agents don't learn from each other's experiences | Shared memory journal + roll-ups |
| **Context Budget** | No token budget management | Injector with strict token packing |
| **Policy Management** | Hard-coded decision logic | Versioned policies (A/B testable) |

---

## 2. COM Integration Architecture

### 2.1 System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                     UNIFIED ORCHESTRATOR                              │
│  (Manages BOTH Context [COM] + Agents [Execution])                   │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌────────────────────────────────┐  ┌───────────────────────────┐   │
│  │   COM Service (Port 8083)      │  │  Agent Orchestrator       │   │
│  │   - Event Log (SQLite)         │  │  - Workflow Management    │   │
│  │   - FAISS Vector Index         │  │  - Task Delegation        │   │
│  │   - Memory Journal (Git)       │  │  - Health Monitoring      │   │
│  │   - Policy Engine              │  │  - Inter-Agent Events     │   │
│  │   - Retriever & Injector       │  │                           │   │
│  └────────────┬───────────────────┘  └────────┬──────────────────┘   │
│               │                                 │                      │
│               │◄────Context Request/Response───►│                      │
│               │                                 │                      │
└───────────────┼─────────────────────────────────┼──────────────────────┘
                │                                 │
                │                                 ▼
                │                    ┌──────────────────────────────────┐
                │                    │  Agent Execution Layer           │
                │                    ├──────────────────────────────────┤
                │                    │  • TestIntelligenceAgent         │
                │                    │  • FailureAnalysisAgent          │
                │                    │  • JiraIntegrationAgent          │
                │                    │  • (Future: CodeReviewAgent)     │
                │                    └──────────────────────────────────┘
                │                                 │
                │◄──────Ingest Events─────────────┤
                │                                 │
                ▼                                 ▼
       ┌─────────────────┐            ┌─────────────────────┐
       │  LM Studio      │            │  QA Intelligence    │
       │  (Qwen 2.5 32B) │            │  Backend (8082)     │
       │  Port 1234      │            │                     │
       └─────────────────┘            └─────────────────────┘
```

### 2.2 Data Flow: Agent Request → COM → LLM → Agent Response

```
1. Agent receives task from Orchestrator
2. Agent calls COM.retrieveContext(policy, inputs, budget)
3. COM retrieves ranked items from Event Log + Vector Index
4. COM packs items into token budget with citations
5. Agent receives context pack
6. Agent constructs prompt with context pack
7. Agent calls LM Studio with enriched prompt
8. LLM returns result
9. Agent executes action based on result
10. Agent ingests decision/outcome back to COM
11. COM updates Event Log + triggers roll-ups
```

---

## 3. Agent-to-Agent Communication

### 3.1 Enhanced Communication Flow with COM

```typescript
// BEFORE COM (current state)
TestIntelligenceAgent detects failure
  → emits event
  → FailureAnalysisAgent receives event
  → FailureAnalysisAgent analyzes with limited context
  → emits failure-analysis-complete
  → JiraIntegrationAgent creates issue

// AFTER COM (enhanced with context)
TestIntelligenceAgent detects failure
  → calls COM.retrieveContext(policy='failure-context', testId)
  → receives: similar past failures, fixes, patterns, related tests
  → enriched analysis decision
  → emits event WITH context pack ID
  → FailureAnalysisAgent receives event
  → calls COM.retrieveContext(policy='root-cause', contextPackId)
  → receives: detailed failure history, code changes, logs
  → deep root-cause analysis
  → emits failure-analysis-complete WITH high-confidence diagnosis
  → JiraIntegrationAgent calls COM.retrieveContext(policy='jira-issue')
  → receives: similar past issues, resolution patterns, labels
  → creates well-structured Jira issue with historical context
  → COM ingests all decisions for future reference
```

### 3.2 Context Sharing Protocol

```typescript
// New interface for agent-to-agent context passing
interface AgentMessage {
  id: string;
  from: string;  // source agent ID
  to: string;    // target agent ID
  type: MessageType;
  payload: any;
  timestamp: Date;
  contextPackId?: string;  // NEW: Reference to COM context pack
  requiresResponse: boolean;
  correlationId?: string;
}

interface ContextPack {
  id: string;
  policy: string;
  task: string;
  items: ContextItem[];
  totalTokens: number;
  budget: number;
  efficiency: number;  // totalTokens / budget
  citations: Citation[];
  retrievedAt: Date;
  expiresAt: Date;
}

interface ContextItem {
  id: string;
  type: 'decision' | 'policy' | 'diff' | 'test' | 'bug' | 'spec' | 'flake';
  title: string;
  content: string;
  score: number;
  importance: number;
  recency: number;
  tags: string[];
  source: string;
  timestamp: Date;
}
```

---

## 4. Orchestrator Enhancement

### 4.1 Unified Orchestrator (COM + Agents)

```typescript
// NEW: UnifiedOrchestrator.ts
import { AgentOrchestrator } from './AgentOrchestrator';
import { COMClient } from './COMClient';
import { EventEmitter } from 'events';

export class UnifiedOrchestrator extends EventEmitter {
  private agentOrchestrator: AgentOrchestrator;
  private comClient: COMClient;
  private contextCache: Map<string, ContextPack> = new Map();

  constructor() {
    super();
    this.agentOrchestrator = new AgentOrchestrator();
    this.comClient = new COMClient('http://localhost:8083');
    this.setupIntegration();
  }

  /**
   * Setup bi-directional integration between COM and Agents
   */
  private setupIntegration(): void {
    // When workflow starts, establish context session
    this.agentOrchestrator.on('workflowStarted', async (workflow) => {
      const session = await this.comClient.createContextSession({
        workflowId: workflow.id,
        project: 'WeSign',
        branch: workflow.context.branch || 'main'
      });
      workflow.context.comSessionId = session.id;
    });

    // When agent completes task, ingest decision to COM
    this.agentOrchestrator.on('taskCompleted', async ({ task, result }) => {
      await this.comClient.ingestDecision({
        agentId: result.agentId,
        taskId: task.id,
        decision: result.data,
        reasoning: result.metadata?.reasoning,
        confidence: result.confidence,
        timestamp: new Date()
      });
    });

    // When workflow completes, commit context session
    this.agentOrchestrator.on('workflowCompleted', async (workflow) => {
      if (workflow.context.comSessionId) {
        await this.comClient.commitContextSession(
          workflow.context.comSessionId,
          `Workflow ${workflow.workflowId} completed`
        );
      }
    });
  }

  /**
   * Execute task with automatic context injection
   */
  async executeTaskWithContext(
    task: AgentTask,
    contextPolicy: string
  ): Promise<AgentResult> {
    // 1. Retrieve context pack from COM
    const contextPack = await this.comClient.retrieveContext({
      task: contextPolicy,
      project: 'WeSign',
      branch: task.context.branch || 'main',
      inputs: task.data,
      policy_id: contextPolicy,
      token_budget: 4096
    });

    // 2. Inject context into task
    task.context.comContextPack = contextPack;
    task.context.comContextPackId = contextPack.id;

    // 3. Delegate to agent orchestrator
    const result = await this.agentOrchestrator.delegateTask(task);

    // 4. Cache context pack for reuse
    this.contextCache.set(contextPack.id, contextPack);

    return result;
  }

  /**
   * Execute workflow with context sessions
   */
  async executeWorkflowWithContext(
    workflow: AgentWorkflow
  ): Promise<WorkflowResult> {
    // Create COM session for workflow
    const session = await this.comClient.createContextSession({
      workflowId: workflow.id,
      project: 'WeSign',
      branch: workflow.context.branch || 'main'
    });

    workflow.context.comSessionId = session.id;

    // Execute workflow with context injection
    const result = await this.agentOrchestrator.executeWorkflow(workflow);

    // Commit session on completion
    await this.comClient.commitContextSession(
      session.id,
      `Workflow ${workflow.id} - ${result.status}`
    );

    return result;
  }
}

export const unifiedOrchestrator = new UnifiedOrchestrator();
```

### 4.2 COM Client for Agents

```typescript
// NEW: services/com/COMClient.ts
export class COMClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8083') {
    this.baseUrl = baseUrl;
  }

  /**
   * Retrieve context pack for agent task
   */
  async retrieveContext(request: RetrievalRequest): Promise<ContextPack> {
    const response = await axios.post(`${this.baseUrl}/retrieve`, request);
    return response.data;
  }

  /**
   * Ingest event (diff, decision, test result, etc.)
   */
  async ingestEvent(event: Event): Promise<{ success: boolean; eventId: string }> {
    const response = await axios.post(`${this.baseUrl}/events`, event);
    return response.data;
  }

  /**
   * Ingest agent decision
   */
  async ingestDecision(decision: AgentDecision): Promise<void> {
    const event: Event = {
      id: `dec_${Date.now()}_${decision.agentId}`,
      ts: decision.timestamp,
      project: 'WeSign',
      branch: 'main',
      agent: decision.agentId,
      artifact_type: 'decision',
      title: `Agent decision: ${decision.taskId}`,
      text: JSON.stringify(decision.decision),
      links: { taskId: decision.taskId },
      tags: ['agent-decision', decision.agentId],
      importance: decision.confidence || 0.5,
      pinned: false,
      author: decision.agentId,
      source: 'agent',
      checksum: this.generateChecksum(decision)
    };

    await this.ingestEvent(event);
  }

  /**
   * Create context session for workflow
   */
  async createContextSession(params: {
    workflowId: string;
    project: string;
    branch: string;
  }): Promise<{ id: string }> {
    const response = await axios.post(`${this.baseUrl}/journal/session`, params);
    return response.data;
  }

  /**
   * Commit context session
   */
  async commitContextSession(sessionId: string, message: string): Promise<void> {
    await axios.post(`${this.baseUrl}/journal/commit`, {
      sessionId,
      message
    });
  }

  /**
   * Retrieve flaky registry for triage
   */
  async retrieveFlakyPack(limit: number = 20): Promise<ContextPack> {
    return this.retrieveContext({
      task: 'flaky_triage',
      project: 'WeSign',
      branch: 'main',
      inputs: { limit },
      policy_id: 'qa_flaky_triage',
      token_budget: 4096
    });
  }

  /**
   * Retrieve regression selection pack
   */
  async retrieveRegressionPack(diff: string, coverage: any): Promise<ContextPack> {
    return this.retrieveContext({
      task: 'regression',
      project: 'WeSign',
      branch: 'main',
      inputs: { diff, coverage },
      policy_id: 'qa_regression',
      token_budget: 4096
    });
  }

  private generateChecksum(data: any): string {
    const crypto = require('crypto');
    return `sha256:${crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')}`;
  }
}
```

---

## 5. Implementation Phases

### Phase 1: COM Foundation (Weeks 1-2) ✅ **PRIORITY**

#### **Goals:**
- Standalone COM service operational
- Basic Event Log + FAISS index
- Single policy: `qa_code_review_py`
- CLI tool for manual testing

#### **Deliverables:**

```bash
# COM Service Structure
com/
├── api/
│   ├── events.py          # POST /events, GET /events
│   ├── retrieve.py        # POST /retrieve
│   ├── inject.py          # POST /injector/pack
│   └── policies.py        # GET /policies, PUT /policies/{id}
├── core/
│   ├── event_log.py       # SQLite + Parquet storage
│   ├── vector_index.py    # FAISS with bge-large embeddings
│   ├── graph_index.py     # SQLite for relationships
│   ├── retriever.py       # Policy-driven ranking
│   └── injector.py        # Token budget packer
├── storage/
│   ├── sqlite_adapter.py
│   ├── faiss_index.py
│   └── parquet_writer.py
├── policies/
│   └── qa_code_review_py.yaml
├── main.py                # FastAPI app
├── cli.py                 # CLI tool
└── requirements.txt
```

#### **CLI Commands:**

```bash
# Ingest events
python -m com ingest --from jenkins --file build-123.json

# Retrieve context
python -m com retrieve --task code_review --budget 4096 --output pack.json

# Preview pack
python -m com pack --preview --policy qa_code_review_py

# Health check
python -m com health
```

#### **Acceptance Criteria:**
- ✅ COM service starts on port 8083
- ✅ Events can be ingested via API
- ✅ Context retrieval returns ranked items within budget
- ✅ Policy weights are configurable
- ✅ CLI tool works for manual testing

---

### Phase 2: Agent Integration (Weeks 3-4) ✅ **PRIORITY**

#### **Goals:**
- COMClient integrated into QA Intelligence backend
- TestIntelligenceAgent uses COM for context
- FailureAnalysisAgent uses COM for root-cause context

#### **Deliverables:**

```typescript
// backend/src/services/com/index.ts
export { COMClient } from './COMClient';
export { UnifiedOrchestrator } from './UnifiedOrchestrator';

// backend/src/services/subAgents/TestIntelligenceAgent.ts (enhanced)
import { comClient } from '@/services/com';

export class TestIntelligenceAgent implements SubAgent {
  // ... existing code ...

  async execute(task: AgentTask): Promise<AgentResult> {
    // NEW: Retrieve context from COM
    const contextPack = await comClient.retrieveContext({
      task: 'test_intelligence',
      project: 'WeSign',
      branch: 'main',
      inputs: task.data,
      policy_id: 'qa_test_intelligence',
      token_budget: 4096
    });

    // Enrich prompt with context
    const enrichedPrompt = this.buildPromptWithContext(task, contextPack);

    // Execute with LLM
    const result = await this.llmClient.complete(enrichedPrompt);

    // Ingest decision back to COM
    await comClient.ingestDecision({
      agentId: this.id,
      taskId: task.id,
      decision: result,
      reasoning: result.reasoning,
      confidence: result.confidence,
      timestamp: new Date()
    });

    return this.formatResult(result);
  }

  private buildPromptWithContext(task: AgentTask, contextPack: ContextPack): string {
    return `
You are TestIntelligenceAgent for WeSign QA.

## Context Pack (Retrieved from COM)
${contextPack.items.map(item => `
### ${item.title} (${item.type}, score: ${item.score})
${item.content}
`).join('\n')}

## Citations
${contextPack.citations.map(c => `[${c.id}] ${c.source}`).join('\n')}

## Task
${JSON.stringify(task.data, null, 2)}

Provide analysis with citations from context pack.
`;
  }
}
```

#### **Acceptance Criteria:**
- ✅ TestIntelligenceAgent successfully retrieves context from COM
- ✅ Agent prompts include context pack with citations
- ✅ Agent decisions are ingested back to COM
- ✅ Context packs are cached for workflow duration

---

### Phase 3: Memory Journal & Agent-to-Agent (Weeks 5-6)

#### **Goals:**
- Git-style memory journal operational
- Session branches per workflow
- Agent-to-agent context passing
- Daily/weekly roll-ups

#### **Deliverables:**

```python
# com/core/journal.py
class MemoryJournal:
    def create_session_branch(self, workflow_id: str) -> str:
        """Create ephemeral branch for workflow"""

    def commit_events(self, branch: str, events: list, message: str):
        """Commit events to journal"""

    def merge_to_main(self, session_branch: str):
        """Merge session to main with summarization"""

    def create_tag(self, name: str, message: str):
        """Tag for release or policy version"""
```

```typescript
// Agent-to-agent context passing
interface EnhancedAgentMessage {
  // ... existing fields ...
  contextPackId?: string;  // Reference to shared context
}

// In FailureAnalysisAgent
async execute(task: AgentTask): Promise<AgentResult> {
  // If message has contextPackId, retrieve it
  if (task.context.comContextPackId) {
    const sharedContext = await comClient.getContextPack(
      task.context.comContextPackId
    );
    // Use shared context from previous agent
  }

  // Retrieve additional context specific to failure analysis
  const failureContext = await comClient.retrieveContext({
    task: 'root_cause',
    project: 'WeSign',
    inputs: { ...task.data, sharedContext },
    policy_id: 'qa_root_cause',
    token_budget: 4096
  });

  // Combine contexts for comprehensive analysis
  const result = await this.analyzeWithContext(sharedContext, failureContext);

  return result;
}
```

#### **Acceptance Criteria:**
- ✅ Workflows create session branches
- ✅ Events are committed to session branches
- ✅ Sessions merge to main on completion
- ✅ Agents can share context via contextPackId
- ✅ Daily roll-ups generate policy deltas

---

### Phase 4: Advanced Policies & Flaky Registry (Weeks 7-8)

#### **Goals:**
- Implement all 5 QA policies
- Flaky registry integration
- Regression selection
- Smoke/release builder

#### **Policies:**

```yaml
# qa_test_gen.yaml
policy_id: qa_test_gen
task: test_gen
weights:
  pinned: 3.0
  importance: 2.0
  semantic: 1.8
  recency_lambda: 0.02
always_include:
  - selector_policy
  - api_contracts
  - test_templates
  - flaky_list
budget_tokens: 4096
```

```yaml
# qa_regression.yaml
policy_id: qa_regression
task: regression
weights:
  importance: 2.5  # Higher weight for high-risk tests
  recency_lambda: 0.05  # Recent failures matter
filters:
  artifact_types: [test, diff, coverage]
  time_window_days: 14
budget_tokens: 2048
```

```yaml
# qa_flaky_triage.yaml
policy_id: qa_flaky_triage
task: flaky_triage
weights:
  importance: 3.0  # Flaky tests are critical
  semantic: 2.0
filters:
  artifact_types: [flake, test, runlog]
  tags_any: [flaky, timing, selector-unstable]
budget_tokens: 4096
```

```yaml
# qa_smoke.yaml
policy_id: qa_smoke
task: smoke
weights:
  importance: 3.0
  recency_lambda: 0.01
filters:
  artifact_types: [test, spec]
  tags_any: [critical, smoke, sanity]
always_include:
  - critical_paths
  - auth_flows
budget_tokens: 2048
```

#### **Flaky Registry Integration:**

```typescript
// Flaky detection in TestIntelligenceAgent
async detectFlaky(testResult: TestResult): Promise<void> {
  if (this.isFlakyPattern(testResult)) {
    // Ingest to COM
    await comClient.ingestEvent({
      artifact_type: 'flake',
      title: `Flaky: ${testResult.testId}`,
      text: JSON.stringify(testResult),
      tags: ['flaky', testResult.failureType],
      importance: 0.9
    });

    // Trigger flaky triage workflow
    await unifiedOrchestrator.executeWorkflowWithContext({
      name: 'Flaky Triage',
      steps: [
        {
          id: 'analyze-flake',
          type: 'failure-pattern-recognition',
          data: { testId: testResult.testId }
        },
        {
          id: 'suggest-fix',
          type: 'heal-selectors',
          data: { testId: testResult.testId },
          dependsOn: ['analyze-flake']
        }
      ]
    });
  }
}
```

#### **Acceptance Criteria:**
- ✅ All 5 policies implemented and tested
- ✅ Flaky tests automatically ingested to COM
- ✅ Flaky triage workflow operational
- ✅ Regression selection reduces test suite by 40%+

---

### Phase 5: Production Rollout (Weeks 9-10)

#### **Goals:**
- CI/CD integration
- Performance optimization
- Monitoring & metrics
- Documentation

#### **CI/CD Integration:**

```typescript
// backend/src/routes/ci/gitlab-webhook.ts
router.post('/gitlab/merge-request', async (req, res) => {
  const { object_attributes: pr } = req.body;

  // 1. Ingest diff + tool signals to COM
  const diff = await fetchDiff(pr.iid);
  await comClient.ingestEvent({
    artifact_type: 'diff',
    title: pr.title,
    text: diff,
    links: { gitlab_pr: pr.web_url },
    tags: extractTags(pr.title)
  });

  // 2. Execute code review workflow with context
  const workflow: AgentWorkflow = {
    name: 'QA Code Review',
    steps: [
      {
        id: 'retrieve-context',
        type: 'plan-execution',
        data: { diff, hints: extractHints(pr.title) }
      },
      {
        id: 'analyze-code',
        type: 'assess-quality',
        data: { diff },
        dependsOn: ['retrieve-context']
      },
      {
        id: 'regression-selection',
        type: 'smart-execution',
        data: { diff, coverage },
        dependsOn: ['analyze-code']
      }
    ],
    context: { prId: pr.iid, branch: pr.source_branch }
  };

  const result = await unifiedOrchestrator.executeWorkflowWithContext(workflow);

  // 3. Post PR comments
  await postGitLabComment(pr.iid, formatReviewResult(result));

  res.json({ success: true, workflowId: result.workflowId });
});
```

#### **Metrics Dashboard:**

```typescript
// GET /api/com/metrics
{
  "retrieval": {
    "p50_latency_ms": 650,
    "p95_latency_ms": 1200,
    "hit_rate": 0.87,
    "budget_efficiency": 0.82
  },
  "agents": {
    "test_intelligence": {
      "tasks_completed": 1234,
      "avg_execution_time_ms": 3500,
      "success_rate": 0.94,
      "context_pack_usage": 0.91
    },
    "failure_analysis": {
      "tasks_completed": 456,
      "avg_execution_time_ms": 5200,
      "success_rate": 0.89,
      "context_pack_usage": 0.95
    }
  },
  "memory_journal": {
    "total_events": 12456,
    "branches": 23,
    "commits": 156,
    "tags": 12,
    "storage_mb": 345
  }
}
```

#### **Acceptance Criteria:**
- ✅ CI/CD webhook fully integrated
- ✅ Performance meets targets (p50 ≤ 700ms)
- ✅ Monitoring dashboard operational
- ✅ Documentation complete
- ✅ Runbooks for operations

---

## 6. Technical Specifications

### 6.1 COM Service API

#### **Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/events` | Ingest event (bulk accepted) |
| GET | `/events` | Query events with filters |
| POST | `/retrieve` | Retrieve context pack |
| POST | `/injector/pack` | Pack items into budget |
| GET | `/policies` | List all policies |
| PUT | `/policies/{id}` | Update policy |
| POST | `/journal/session` | Create context session |
| POST | `/journal/commit` | Commit session |
| POST | `/journal/merge` | Merge session to main |
| POST | `/rollups/run` | Trigger roll-ups |
| GET | `/metrics` | COM metrics |
| GET | `/health` | Health check |

#### **Data Models:**

```python
class Event(TypedDict):
    id: str
    ts: datetime
    project: str
    branch: str
    agent: str
    artifact_type: Literal["diff", "decision", "policy", "test",
                           "runlog", "bug", "spec", "flake"]
    title: str
    text: str
    links: dict
    tags: list[str]
    importance: float
    pinned: bool
    checksum: str

class RetrievalRequest(TypedDict):
    task: Literal["code_review", "test_gen", "regression",
                  "flaky_triage", "smoke"]
    project: str
    branch: str
    inputs: dict
    policy_id: str
    token_budget: int

class ContextPack(TypedDict):
    id: str
    policy: str
    items: list[ContextItem]
    totalTokens: int
    budget: int
    efficiency: float
    citations: list[Citation]
    retrievedAt: datetime
```

### 6.2 Agent Enhancement Interface

```typescript
interface COMEnabledAgent extends SubAgent {
  // Original SubAgent interface
  execute(task: AgentTask): Promise<AgentResult>;

  // NEW: COM-aware execution
  executeWithContext(
    task: AgentTask,
    contextPolicy: string,
    budget?: number
  ): Promise<AgentResult>;

  // NEW: Ingest decision to COM
  recordDecision(
    task: AgentTask,
    result: AgentResult,
    reasoning: string
  ): Promise<void>;
}
```

### 6.3 Unified Orchestrator Interface

```typescript
interface UnifiedOrchestratorAPI {
  // Execute task with automatic context injection
  executeTaskWithContext(
    task: AgentTask,
    contextPolicy: string
  ): Promise<AgentResult>;

  // Execute workflow with context sessions
  executeWorkflowWithContext(
    workflow: AgentWorkflow
  ): Promise<WorkflowResult>;

  // Manual context retrieval for custom workflows
  retrieveContext(
    policy: string,
    inputs: any,
    budget?: number
  ): Promise<ContextPack>;

  // Ingest events on behalf of agents
  ingestEvent(event: Event): Promise<void>;
}
```

---

## 7. Workflows & Use Cases

### 7.1 Code Review Workflow (Full Example)

```typescript
// Triggered by GitLab webhook
async function handleMergeRequest(pr: GitLabPR) {
  // Step 1: Ingest diff to COM
  await comClient.ingestEvent({
    id: `diff_pr_${pr.iid}`,
    artifact_type: 'diff',
    title: pr.title,
    text: await fetchDiff(pr.iid),
    tags: ['pr', 'code-review', ...extractTags(pr.title)],
    importance: calculateImportance(pr),
    project: 'WeSign',
    branch: pr.source_branch
  });

  // Step 2: Execute code review workflow
  const workflow: AgentWorkflow = {
    name: 'QA Code Review',
    steps: [
      {
        id: 'code-quality',
        type: 'assess-quality',
        data: { prId: pr.iid, diff: pr.diff }
      },
      {
        id: 'test-gaps',
        type: 'test-analysis',
        data: { prId: pr.iid },
        dependsOn: ['code-quality']
      },
      {
        id: 'security-check',
        type: 'analyze-failures',  // Reusing failure analysis for security patterns
        data: { prId: pr.iid, focus: 'security' },
        dependsOn: ['code-quality']
      }
    ],
    context: { prId: pr.iid, author: pr.author }
  };

  const result = await unifiedOrchestrator.executeWorkflowWithContext(workflow);

  // Step 3: Post PR comment
  const comment = formatCodeReviewComment(result);
  await postGitLabComment(pr.iid, comment);

  return result;
}

function formatCodeReviewComment(result: WorkflowResult): string {
  const findings = result.results.flatMap(r => r.data.findings || []);

  return `
## QA Intelligence Code Review

**Reviewed by:** AI Agents (TestIntelligence + FailureAnalysis)
**Context Retrieved:** ${result.results[0].metadata.contextPackId}

### Findings (${findings.length})

${findings.map(f => `
- **${f.severity}**: ${f.message}
  - File: \`${f.file}:${f.line}\`
  - Recommendation: ${f.recommendation}
  - [Context Citation ${f.citation}]
`).join('\n')}

### Test Coverage Gaps

${result.results[1].data.gaps.map(g => `
- Missing tests for: \`${g.function}\`
  - Similar past issues: ${g.similarIssues.join(', ')}
`).join('\n')}

---
*Powered by COM + QA Intelligence Agents*
  `;
}
```

### 7.2 Flaky Test Triage Workflow

```typescript
// Triggered when test fails intermittently
async function handleFlakyTest(testResult: TestResult) {
  // Step 1: Ingest flaky evidence to COM
  await comClient.ingestEvent({
    artifact_type: 'flake',
    title: `Flaky: ${testResult.testId}`,
    text: JSON.stringify({
      testId: testResult.testId,
      failureType: testResult.failureType,
      environment: testResult.environment,
      logs: testResult.logs
    }),
    tags: ['flaky', testResult.failureType, testResult.environment],
    importance: 0.9,
    project: 'WeSign',
    branch: 'main'
  });

  // Step 2: Retrieve flaky context pack
  const flakyPack = await comClient.retrieveFlakyPack();

  // Step 3: Execute flaky triage workflow
  const workflow: AgentWorkflow = {
    name: 'Flaky Test Triage',
    steps: [
      {
        id: 'pattern-recognition',
        type: 'failure-pattern-recognition',
        data: { testId: testResult.testId, flakyPack }
      },
      {
        id: 'root-cause',
        type: 'root-cause-analysis',
        data: { testId: testResult.testId },
        dependsOn: ['pattern-recognition']
      },
      {
        id: 'healing-suggestion',
        type: 'heal-selectors',
        data: { testId: testResult.testId },
        dependsOn: ['root-cause']
      },
      {
        id: 'create-jira',
        type: 'create-issue',
        data: {
          testId: testResult.testId,
          priority: 'high',
          labels: ['flaky', 'auto-detected']
        },
        dependsOn: ['root-cause'],
        criticalFailure: false  // Optional: continue even if Jira fails
      }
    ]
  };

  const result = await unifiedOrchestrator.executeWorkflowWithContext(workflow);

  // Step 4: Apply healing suggestion automatically if confidence > 0.8
  if (result.results[2].confidence > 0.8) {
    await applyHealingPatch(result.results[2].data.patch);
  }

  return result;
}
```

### 7.3 Regression Selection Workflow

```typescript
// Triggered before test execution
async function selectRegressionTests(
  diff: string,
  coverage: CoverageData
): Promise<string[]> {
  // Step 1: Retrieve regression pack from COM
  const regressionPack = await comClient.retrieveRegressionPack(diff, coverage);

  // Step 2: Execute regression selection
  const task: AgentTask = {
    id: `regression_${Date.now()}`,
    type: 'smart-execution',
    data: {
      diff,
      coverage,
      contextPack: regressionPack,
      budget: 'medium'  // Time budget for test execution
    },
    context: { branch: 'main' }
  };

  const result = await unifiedOrchestrator.executeTaskWithContext(
    task,
    'qa_regression'
  );

  // Step 3: Return prioritized test list
  return result.data.selectedTests.map(t => t.id);
}
```

---

## 8. Metrics & Success Criteria

### 8.1 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context Retrieval (p50) | ≤ 700ms | `/metrics` endpoint |
| Context Retrieval (p95) | ≤ 1200ms | `/metrics` endpoint |
| Agent Task Execution (p50) | ≤ 5s | MetricsCollector |
| Workflow Execution (p50) | ≤ 30s | Workflow history |
| Event Ingest Throughput | ≥ 200 events/sec | Batch ingest test |
| Storage Growth | < 500MB/month | Disk usage monitoring |

### 8.2 Quality Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context Hit-Rate | ≥ 85% | LLM citation analysis |
| Budget Efficiency | ≥ 0.75 | tokens_used / budget |
| Agent Success Rate | ≥ 90% | Task completion status |
| Workflow Success Rate | ≥ 85% | Workflow completion status |
| Policy Compliance | ≥ 95% | Policy validation checks |
| Flaky Reduction | -30% in 3 sprints | Flaky registry trends |

### 8.3 Business Impact Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Pre-merge Defect Catch | +25% | PR comment analysis |
| Test Execution Time | -40% | Regression selection efficiency |
| False Positives | -50% | Flaky test quarantine |
| Agent Context Reuse | ≥ 70% | Context pack cache hits |
| Manual Triage Time | -60% | Time to Jira issue creation |

---

## Next Steps

### Immediate Actions (This Week)

1. **Create COM Repository Structure**
   ```bash
   mkdir -p com/{api,core,storage,policies,tests}
   ```

2. **Implement Event Log + SQLite**
   ```python
   # com/storage/sqlite_adapter.py
   ```

3. **Build FAISS Vector Index**
   ```python
   # com/storage/faiss_index.py
   ```

4. **Create First Policy: qa_code_review_py**
   ```yaml
   # com/policies/qa_code_review_py.yaml
   ```

5. **Setup FastAPI Service**
   ```python
   # com/main.py
   ```

6. **Test CLI Tool**
   ```bash
   python -m com ingest --test
   python -m com retrieve --test
   ```

---

**Document End**

*This execution plan provides a complete roadmap for integrating COM as an agent service within the QA Intelligence platform, enabling context-aware, deterministic, and auditable agent decision-making.*
