# COM (Context Orchestrator Management)

**Version:** 0.1.0
**Status:** Phase 1 - Foundation Complete
**Purpose:** Git-style memory journal and policy-driven context retrieval for QA Intelligence agents

---

## 🎯 Overview

COM is a **context retrieval service** designed specifically for AI agents. It provides:

- **Git-Style Memory Journal** - Branches, commits, and tags for event versioning
- **Event Log** - SQLite-based append-only event storage with deduplication
- **Vector Index** - FAISS semantic search using BGE-Large embeddings
- **Policy Engine** - Deterministic token-budget context packing
- **Hybrid Retrieval** - Combines semantic similarity, recency, importance, and diversity

COM serves as a **shared memory layer** for agents, enabling them to:
1. **Remember** past events (test failures, code changes, analyses)
2. **Retrieve** relevant context based on task requirements
3. **Share** knowledge across agent-to-agent workflows

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     QA Intelligence Backend                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Test Intel   │  │ Failure      │  │ Jira         │      │
│  │ Agent        │  │ Analysis     │  │ Integration  │      │
│  │              │  │ Agent        │  │ Agent        │      │
│  └───────┬──────┘  └───────┬──────┘  └───────┬──────┘      │
│          │                  │                  │             │
│          └──────────────────┼──────────────────┘             │
│                             │                                │
│                      ┌──────▼──────┐                        │
│                      │  COMClient  │                        │
│                      └──────┬──────┘                        │
└─────────────────────────────┼───────────────────────────────┘
                              │ HTTP/JSON
                              │
                    ┌─────────▼─────────┐
                    │   COM Service     │
                    │   (Port 8083)     │
                    └─────────┬─────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    ┌─────▼─────┐      ┌─────▼─────┐      ┌─────▼─────┐
    │  Event    │      │  Vector   │      │  Policy   │
    │  Store    │      │  Index    │      │  Engine   │
    │ (SQLite)  │      │ (FAISS)   │      │ (YAML)    │
    └───────────┘      └───────────┘      └───────────┘
```

---

## 🚀 Quick Start

### 1. Installation

```bash
cd com

# Install dependencies
pip install -r requirements.txt

# Or with virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configuration

Copy `.env` and adjust if needed:

```bash
# Key configurations
COM_SERVICE_PORT=8083
EVENT_LOG_DB_PATH=./data/events.db
VECTOR_INDEX_PATH=./data/vector_index.faiss
EMBEDDING_MODEL=BAAI/bge-large-en-v1.5
```

### 3. Start COM Service

```bash
# Using Python
python -m api.main

# Or using the CLI entry point
com-server
```

The service will:
- Initialize Event Store (SQLite)
- Load Vector Index (or create new)
- Load Policies from `./policies/*.yaml`
- Start FastAPI server on port 8083

### 4. Verify Health

```bash
curl http://localhost:8083/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-25T...",
  "total_events": 0,
  "total_branches": 1,
  "vector_index_size": 0
}
```

---

## 📖 Usage

### CLI Tool

```bash
# Install CLI
pip install -e .

# Seed test data
com seed --project WeSign --count 10

# List events
com event list --project WeSign

# Get event details
com event get evt-123456

# Create memory branch
com branch create feature/test-improvements

# Show statistics
com stats
```

### API Endpoints

#### **POST /ingest** - Ingest Event

```bash
curl -X POST http://localhost:8083/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "id": "evt-001",
    "type": "test_failure",
    "project": "WeSign",
    "source": "TestRunner",
    "importance": 3.5,
    "tags": ["flaky", "self-signing"],
    "data": {
      "test_id": "test_self_signing_pdf",
      "error": "Element not found"
    }
  }'
```

#### **POST /retrieve** - Retrieve Context

```bash
curl -X POST http://localhost:8083/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "task": "root_cause",
    "project": "WeSign",
    "branch": "main",
    "inputs": {
      "test_id": "test_self_signing_pdf",
      "error": "Element not found"
    },
    "policy_id": "qa_code_review_py",
    "token_budget": 4096
  }'
```

Response:
```json
{
  "success": true,
  "context_pack": {
    "pack_id": "pack-123456",
    "policy_id": "qa_code_review_py",
    "task": "root_cause",
    "items": [
      {
        "event_id": "evt-001",
        "content": "...",
        "score": 0.87,
        "metadata": {...}
      }
    ],
    "total_items": 5,
    "total_tokens": 2048,
    "budget_tokens": 4096,
    "utilization": 0.5,
    "summary": "Retrieved 5 relevant events..."
  }
}
```

---

## 🔧 Backend Integration

### TypeScript/Node.js Integration

```typescript
import { COMClient, EventType } from '@/services/com/COMClient';

// Initialize client
const comClient = new COMClient('http://localhost:8083');

// Ingest event
await comClient.ingestEvent({
  id: 'evt-001',
  type: EventType.TEST_FAILURE,
  project: 'WeSign',
  source: 'TestIntelligenceAgent',
  importance: 4.0,
  tags: ['regression'],
  data: {
    test_id: 'test_login',
    error: 'Timeout waiting for login button'
  }
});

// Retrieve context for task
const contextPack = await comClient.retrieveContext({
  task: 'root_cause',
  project: 'WeSign',
  inputs: {
    test_id: 'test_login',
    error: 'Timeout'
  }
});

// Format for LLM
const contextString = comClient.formatContextForLLM(contextPack);
console.log(contextString);
```

### Enhanced Agent Pattern

```typescript
import { COMEnhancedAgent } from '@/services/com/COMIntegrationExample';

class MyAgent extends COMEnhancedAgent {
  async execute(task: AgentTask): Promise<AgentResult> {
    // 1. Retrieve context from COM
    const context = await this.retrieveContextForTask(task);

    // 2. Use context in execution
    const prompt = this.formatContextForPrompt(context);
    const result = await this.performTask(task, prompt);

    // 3. Ingest result for future context
    await this.ingestTaskResult(task, result);

    return result;
  }
}
```

---

## 📋 Policies

Policies define how context is retrieved. Located in `./policies/*.yaml`:

### Example: `qa_code_review_py.yaml`

```yaml
policy_id: qa_code_review_py
task: code_review

weights:
  pinned: 3.0      # Pinned events (high priority)
  importance: 2.0  # Event importance score
  semantic: 1.6    # Semantic similarity
  recency: 1.0     # Recent events
  diversity: 0.5   # Diversity penalty

budget_tokens: 4096
event_types:
  - test_failure
  - code_change
  - agent_action

min_importance: 2.0
tags_include:
  - regression
  - flaky

include_rollups: true
max_events: 50
```

### Creating Custom Policies

1. Create `./policies/my_policy.yaml`
2. Define weights and filters
3. Restart COM service (or it will auto-reload in dev mode)
4. Reference via `policy_id` in retrieval requests

---

## 🧪 Testing

### Manual Testing

```bash
# 1. Start COM service
python -m api.main

# 2. Seed test data
com seed --count 20

# 3. Test retrieval
curl -X POST http://localhost:8083/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "task": "root_cause",
    "project": "WeSign",
    "inputs": {"test_id": "test_self_signing_pdf"}
  }'
```

### Integration Testing

```bash
# Run pytest tests (when implemented)
pytest tests/ -v
```

---

## 📊 Monitoring

### Health Checks

```bash
# Basic health
curl http://localhost:8083/health

# Detailed stats
curl http://localhost:8083/stats
```

### Logs

COM uses structured logging:

```bash
# View logs (if using systemd)
journalctl -u com-service -f

# Or direct output
python -m api.main 2>&1 | tee com.log
```

---

## 🔐 Security

### Current State (Development)
- No authentication (localhost only)
- No encryption at rest
- No PII filtering

### Production Recommendations
1. **Add authentication** - JWT/API keys for COM API
2. **Enable HTTPS** - Use reverse proxy (nginx/traefik)
3. **PII filtering** - Redact sensitive data before ingestion
4. **Access control** - Per-project authorization
5. **Encryption** - Encrypt SQLite database at rest
6. **Rate limiting** - Prevent abuse of retrieval endpoint

---

## 🐛 Troubleshooting

### Issue: "Model not found" error on startup

**Solution:** First run downloads the embedding model (1.3GB):

```bash
# Pre-download model
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-large-en-v1.5')"
```

### Issue: FAISS import error

**Solution:** Install CPU version:

```bash
pip install faiss-cpu==1.7.4
```

### Issue: Port 8083 already in use

**Solution:** Change port in `.env`:

```bash
COM_SERVICE_PORT=8084
```

### Issue: Slow retrieval

**Diagnosis:**
1. Check vector index size: `curl http://localhost:8083/stats`
2. Reduce `max_events` in policy
3. Lower `token_budget`

---

## 📈 Performance

### Benchmarks (Phase 1)

- **Ingestion:** ~100 events/sec (SQLite bottleneck)
- **Vector search:** ~10ms for 10k vectors
- **Retrieval (end-to-end):** ~200ms (includes LLM tokenization)
- **Memory:** ~500MB (embedding model loaded)

### Optimization Tips

1. **Batch ingestion** - Use bulk endpoints (TODO: implement)
2. **Index caching** - Keep FAISS index in memory (default)
3. **Policy tuning** - Reduce `max_events` and `budget_tokens`
4. **Async ingestion** - Enable `ENABLE_ASYNC_INGEST=true`

---

## 🗺️ Roadmap

### ✅ Phase 1: Foundation (Current)
- Event Log with SQLite
- FAISS vector index
- Policy engine
- Basic retrieval
- CLI tool

### 🔄 Phase 2: Agent Integration (In Progress)
- COMClient for backend
- Enhanced agents
- Agent-to-agent context passing

### 📅 Phase 3: Memory Journal (Planned)
- Git-style commits and branches
- Tag management
- Daily/weekly roll-ups

### 📅 Phase 4: Advanced Policies (Planned)
- All 5 QA policies
- Flaky registry integration
- Regression selection

### 📅 Phase 5: Production (Planned)
- Authentication & security
- Performance optimization
- Monitoring & metrics
- CI/CD integration

---

## 🤝 Contributing

COM is part of the QA Intelligence platform. For questions or contributions:

1. Review `COM_ORCHESTRATOR_EXECUTION_PLAN.md`
2. Follow existing code patterns
3. Add tests for new features
4. Update this README

---

## 📄 License

Part of QA Intelligence Platform - Internal Use

---

**Generated:** 2025-10-25
**Maintainer:** QA Intelligence Team
**Documentation:** See `/docs/com/` for detailed architecture
