# COM (Context Orchestrator Management) - How It Works

**Version**: 1.0
**Last Updated**: 2025-10-26
**Status**: Operational (Running on port 8083)

---

## 🎯 What is COM?

**COM** (Context Orchestrator Management) is a **Python FastAPI service** that provides intelligent context management, event storage, and semantic search capabilities for your QA Intelligence platform.

Think of it as the **"memory and intelligence layer"** that sits between your test execution engine and your AI agents, storing events, analyzing patterns, and providing contextual insights.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     QA Intelligence Platform                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Backend    │◄───────►│     COM      │                 │
│  │  (Node.js)   │  Events │   (Python)   │                 │
│  │  Port 8082   │         │  Port 8083   │                 │
│  └──────┬───────┘         └──────┬───────┘                 │
│         │                        │                          │
│         │                        ├─► Event Store (SQLite)   │
│         │                        ├─► Vector Index (FAISS)   │
│         │                        ├─► Policy Engine (Rego)   │
│         │                        └─► LLM Service            │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   3 Agents   │                                           │
│  │ - Test Intel │                                           │
│  │ - Jira       │                                           │
│  │ - Failure    │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Components

Based on the startup logs, COM initializes **9 major components**:

### 1. **Event Store** (SQLite Database)
**Purpose**: Persistent storage for all test events
**Location**: `./data/events.db`
**Function**: Records every test execution, failure, success, and system event

```python
# Example event structure:
{
  "event_id": "uuid",
  "event_type": "test_execution_completed",
  "timestamp": "2025-10-26T...",
  "project": "WeSign",
  "data": {
    "test_id": "test_login_basic.py::test_login_with_valid_credentials",
    "status": "passed",
    "duration_ms": 1234,
    "artifacts": [...]
  },
  "tags": ["auth", "critical"]
}
```

**Current Status**: ✅ **0 events** (ready for ingestion)

---

### 2. **Vector Index** (FAISS - Facebook AI Similarity Search)
**Purpose**: Semantic search and similarity matching
**Model**: `BAAI/bge-large-en-v1.5` (1024-dimensional embeddings)
**Location**: `./data/vector_index.faiss`

**How it works**:
1. Events are converted to text (description + metadata)
2. Text is embedded into 1024-dimensional vectors using BGE model
3. Vectors stored in FAISS index for fast similarity search
4. When querying, finds semantically similar events (not just keyword matching)

**Example Use Case**:
```
Query: "login fails with invalid credentials"
→ Finds similar past failures even if worded differently:
  - "authentication error with wrong password"
  - "signin rejected due to bad creds"
  - "user login denied - invalid username"
```

**Current Status**: ✅ **0 vectors** (ready for embedding)

---

### 3. **Hybrid Retriever**
**Purpose**: Combines keyword search + semantic search for best results
**Function**:
- Keyword search (fast, exact matches)
- Semantic search (slow, meaning-based)
- Hybrid = combines both with scoring

**When to use**:
- Keyword only: "Find all tests tagged 'login'"
- Semantic only: "Find tests that check user authentication"
- Hybrid: Best of both worlds

**Current Status**: ✅ **Ready**

---

### 4. **Policy Engine** (Open Policy Agent style)
**Purpose**: Automated decision-making based on rules
**Location**: `./policies/`
**Policies Loaded**: 5 policies

#### Policy 1: `qa_code_review_py`
**Purpose**: Automated code review for test files
**What it does**: Checks Python test code for best practices, common issues

#### Policy 2: `qa_flaky_triage`
**Purpose**: Automatically detects and categorizes flaky tests
**What it does**:
- Identifies tests that pass/fail inconsistently
- Categorizes flakiness (environment, timing, data)
- Suggests remediation

#### Policy 3: `qa_healing`
**Purpose**: Self-healing test automation
**What it does**:
- Detects when tests fail due to UI changes
- Suggests selector updates
- Can auto-fix common issues

#### Policy 4: `qa_regression_select`
**Purpose**: Smart test selection for regression testing
**What it does**:
- Analyzes code changes
- Selects only relevant tests to run
- Saves time by avoiding full regression

#### Policy 5: `qa_root_cause`
**Purpose**: Automated root cause analysis
**What it does**:
- Analyzes test failures
- Identifies patterns
- Suggests likely root causes

**Current Status**: ✅ **5 policies loaded**

---

### 5. **Memory Journal** (Git-style Version Control)
**Purpose**: Track changes to context/decisions over time
**Function**:
- Records decisions made by agents
- Branches for different analysis paths
- Commits represent state snapshots
- Can "rewind" to see past reasoning

**Use Case**:
```
Branch: main
  Commit 1: Initial failure analysis for test_login
  Commit 2: Root cause identified: selector changed
  Commit 3: Self-healing applied: updated selector
  Commit 4: Test re-run successful
```

**Current Status**: ✅ **1 branch, 0 commits** (ready)

---

### 6. **LLM Service** (Large Language Model Integration)
**Purpose**: AI-powered analysis and summaries
**Backend**: LM Studio (local) or OpenAI (cloud)
**Function**:
- Generates natural language summaries
- Analyzes failure patterns
- Suggests fixes in plain English

**Current Status**: ⚠️ **LLM not available** (will use fallback summaries)
- LM Studio not running
- Will work but with simpler summaries

---

### 7. **Roll-up Summary Service**
**Purpose**: Periodic aggregation and summarization
**Function**:
- Aggregates events hourly/daily/weekly
- Creates executive summaries
- Identifies trends

**Example Output**:
```
Daily Summary (2025-10-26):
- Total Tests: 533
- Executions: 12
- Pass Rate: 85%
- New Failures: 3 (auth module)
- Flaky Tests Detected: 2
- Trend: Pass rate down 5% from yesterday
```

**Current Status**: ✅ **Ready** (LLM enabled: True)

---

### 8. **Flaky Test Registry**
**Purpose**: Tracks tests that exhibit flaky behavior
**Function**:
- Records pass/fail history per test
- Calculates flakiness score
- Marks tests as "flaky" when threshold exceeded

**Flakiness Score**:
```
Score = (failures / total_runs) * inconsistency_factor
If score > 0.3 → Test marked as flaky
```

**Current Status**: ✅ **Ready**

---

### 9. **Smart Regression Selector**
**Purpose**: Intelligently select which tests to run
**Function**:
- Analyzes code changes (git diff)
- Maps code to tests
- Selects minimum test set for full coverage

**Example**:
```
Code changed: src/auth/login.py
→ Selects tests:
  - test_login_basic.py (direct)
  - test_user_dashboard.py (login required)
  - test_permissions.py (auth-related)
→ Skips tests:
  - test_document_upload.py (unrelated)
  - test_reports.py (unrelated)
```

**Current Status**: ✅ **Ready**

---

## 🔄 How COM Works (End-to-End Flow)

### Scenario: Test Execution with COM

```
1. TEST RUNS (Backend)
   └─► UnifiedTestEngine executes test
       test_login_basic.py::test_login_with_valid_credentials

2. EVENT CREATION (Backend)
   └─► EventBus publishes event: TEST_EXECUTION_COMPLETED
       {
         type: "test_execution_completed",
         test_id: "test_login_basic.py::...",
         status: "passed",
         duration_ms: 1234
       }

3. EVENT INGESTION (COM)
   └─► POST /ingest
       ├─► Store in Event Store (SQLite)
       ├─► Generate embedding (BGE model)
       ├─► Store vector in FAISS index
       └─► Apply policies (qa_root_cause, qa_flaky_triage, etc.)

4. CONTEXT RETRIEVAL (Agents)
   └─► Agents query COM: "Similar login test failures?"
       POST /retrieve
       ├─► Hybrid search (keyword + semantic)
       ├─► Find top 5 similar events
       └─► Return with relevance scores

5. ANALYSIS (Agents)
   └─► TestIntelligence Agent analyzes context
       ├─► Compares with past failures
       ├─► Identifies patterns
       └─► Generates insights

6. DECISION (Policy Engine)
   └─► qa_flaky_triage policy evaluates test
       ├─► Pass rate: 8/10 = 80%
       ├─► Flakiness score: 0.15 (OK)
       └─► Decision: Not flaky

7. MEMORY COMMIT (Memory Journal)
   └─► Records decision in git-style journal
       Commit: "Test test_login_basic analyzed - not flaky"
```

---

## 📡 COM API Endpoints

Based on the logs, COM exposed these endpoints:

### Core Endpoints

1. **GET /health**
   - Check if COM is alive
   - Returns: `{ "status": "healthy", "components": {...} }`

2. **POST /ingest**
   - Ingest new events
   - Body: `{ "event_type": "...", "data": {...}, "tags": [...] }`
   - Returns: `201 Created`

3. **POST /retrieve**
   - Search for similar events
   - Body: `{ "query": "login failures", "limit": 10 }`
   - Returns: Array of matching events with scores

4. **GET /events/recent**
   - Get recent events
   - Query: `?project=WeSign&limit=10`
   - Returns: Array of recent events

5. **GET /docs**
   - Interactive API documentation (Swagger UI)
   - Visit: http://localhost:8083/docs

6. **GET /openapi.json**
   - OpenAPI specification

---

## 📊 COM Activity (From Logs)

Looking at the request logs, COM has been actively used:

```
✅ Health checks: Multiple (system monitoring)
✅ Event ingestion: ~13 events ingested (201 Created responses)
✅ Event retrieval: ~8 retrievals (200 OK responses)
✅ Recent events queries: ~5 queries
```

**Activity Pattern**:
- Backend health-checks COM regularly
- Events are being ingested successfully
- Agents are retrieving context for analysis
- System is operational and integrated

---

## 🔧 COM Configuration

**Port**: 8083 (not 8000 as mentioned earlier)
**Host**: 0.0.0.0 (accessible from network)
**Data Directory**: `./data/`
**Policies Directory**: `./policies/`
**Embedding Model**: BAAI/bge-large-en-v1.5 (1024-dim)

---

## 💡 How Agents Use COM

### TestIntelligence Agent
```python
# When analyzing test results
events = com.retrieve(
    query="Similar authentication test failures",
    project="WeSign",
    limit=10
)
# Returns past auth failures for comparison
```

### JiraIntegration Agent
```python
# When creating tickets
related = com.retrieve(
    query="Login test failure with selector issue",
    limit=5
)
# Finds related Jira tickets to avoid duplicates
```

### FailureAnalysis Agent
```python
# When diagnosing failures
context = com.retrieve(
    query=f"Test {test_id} failure patterns",
    limit=20
)
# Gets historical failure data for root cause analysis
```

---

## 🎯 Key Benefits of COM

1. **Semantic Search**: Find similar issues even with different wording
2. **Pattern Detection**: Automatically identify recurring failures
3. **Context Preservation**: Never lose historical insights
4. **Policy Automation**: Automated decisions (flaky detection, root cause, etc.)
5. **Agent Collaboration**: Shared memory across all agents
6. **Trend Analysis**: Roll-up summaries show long-term patterns
7. **Git-style Memory**: Audit trail of all decisions

---

## 🔍 Current COM Status

**From Logs Analysis**:
- ✅ **Running**: Port 8083
- ✅ **Initialized**: All 9 components ready
- ✅ **Active**: Processing events and queries
- ⚠️ **LLM Offline**: Using fallback (simpler summaries)
- ✅ **Event Store**: 0 events (empty but ready)
- ✅ **Vector Index**: 0 vectors (ready for embeddings)
- ✅ **Policies**: 5 loaded and active

---

## 📈 Integration with QA Intelligence

```
Backend (Node.js) ──► COM (Python) ──► Agents
     │                    │              │
     │                    │              └─► TestIntelligence
     │                    │              └─► JiraIntegration
     │                    │              └─► FailureAnalysis
     │                    │
     │                    ├─► Event Store (persist)
     │                    ├─► Vector Index (search)
     │                    └─► Policy Engine (decide)
     │
     └─► UnifiedTestEngine (execute tests)
```

---

## 🚀 Next Steps with COM

1. **Start ingesting events** from test executions
2. **Build up vector index** for better semantic search
3. **Enable LLM** (start LM Studio) for smarter summaries
4. **Configure policies** for your specific use cases
5. **Monitor trends** via roll-up summaries

---

**COM Status**: ✅ **FULLY OPERATIONAL**
**Integration**: ✅ **CONNECTED TO BACKEND**
**Ready for**: Event ingestion, context retrieval, agent collaboration

---

**Last Updated**: 2025-10-26 12:00 UTC
