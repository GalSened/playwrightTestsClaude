# Context System - H4R + SCS + Context Pack

Human-like memory retrieval for the Central Memory Orchestrator (CMO).

## Overview

The Context System provides multi-signal, policy-aware context retrieval for AI specialists. It consists of three integrated modules:

1. **H4R** (Human-like Retrieval with 4R Framework) - Multi-signal ranking
2. **SCS** (Specialist Context Slicer) - Policy-aware slicing with budget enforcement
3. **Context Pack** - Structured delivery with TL;DR, affordances, and explainability

## Architecture

```
┌─────────────────┐
│ ContextRequest  │ (A2A Envelope)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Context Handler │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│            Context Pack Builder                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │   H4R    │→ │   SCS    │→ │  Summarizer +    │ │
│  │ Retrieval│  │  Slicer  │  │  Affordances     │ │
│  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ ContextResult   │ (A2A Envelope with explainability)
└─────────────────┘
```

## H4R: Multi-Signal Retrieval

### Signal Functions

H4R ranks candidates using 8 weighted signals:

| Signal | Weight | Formula | Purpose |
|--------|--------|---------|---------|
| **Recency** | 0.25 | `exp(-λ * age_days)` | Newer items score higher |
| **Frequency** | 0.15 | `log(access_count + 1)` | Frequently accessed items |
| **Importance** | 0.20 | user/system tags (0-1) | Explicitly tagged priority |
| **Causality** | 0.15 | `1 / (1 + distance)` | Closer in causal graph |
| **Novelty⁻** | 0.10 | `1 - novelty` | Favor established patterns |
| **Trust** | 0.10 | source confidence (0-1) | Reliable sources |
| **Sensitivity⁻** | 0.05 | `1 - sensitivity` | Penalize sensitive data |

**Final Score** = Σ (signal × weight)

### Candidate Generators

- **Postgres FTS** (always enabled): Full-text search using `tsvector` and `ts_rank`
- **Qdrant** (optional): Vector similarity search (requires `QDRANT_URL`)
- **Neo4j** (optional): Graph traversal for causal chains (requires `NEO4J_URL`)

### Example Usage

```typescript
import { H4RRetriever } from './context/h4r';

const retriever = new H4RRetriever({
  weights: {
    recency: 0.3,
    importance: 0.25,
    // ... other weights
  },
  minScore: 0.5,
  limit: 10,
});

const response = await retriever.retrieve({
  text: 'login test failures',
  type: 'hybrid',
  filters: { test_type: 'e2e' },
});

// response.results: ranked H4RResult[]
// response.metrics: { candidateMs, rankingMs, totalMs }
```

### Explainability

Every result includes:

```typescript
{
  id: string;
  score: number;
  signals: {
    recency: 0.85,
    frequency: 0.42,
    importance: 0.70,
    // ... all 8 signals
  },
  reason: 'kept' | 'dropped',
  explanation: 'Score 0.743 (top signals: recency=0.85, importance=0.70, ...)'
}
```

## SCS: Policy-Aware Slicing

### Budget Enforcement

Default limits (configurable via environment):

- **Max Bytes**: 120KB (122,880 bytes)
- **Max Tokens**: 30,000 (estimated)
- **Max Items**: 100

Slicing stops when **any** limit is reached.

### OPA Integration

SCS queries OPA for policy decisions:

```
POST http://localhost:8181/v1/data/cmo/context
{
  "input": {
    "specialist": {
      "type": "specialist",
      "id": "playwright_healer",
      "securityLevel": "internal"
    },
    "item": {
      "id": "mem-001",
      "content": {...},
      "metadata": {...}
    }
  }
}

Response:
{
  "result": {
    "allow": true,
    "redact": true,
    "redactedFields": ["$.content.personalData"]
  }
}
```

### Fallback Rules

When OPA is unavailable (`SCS_OPA_FALLBACK_LOCAL=true`):

1. **Sensitivity threshold**: Items with `sensitivity > 0.7` blocked for `public`/`internal` specialists
2. **PII detection**: Redact fields marked with `containsPII=true`
3. **Credentials**: Block items with `hasCredentials=true`
4. **Trust threshold**: Block items with `trust < 0.3`
5. **Group-based access**: Check `restrictedToGroups` against specialist's `authorizedGroups`

### Example Usage

```typescript
import { ContextSlicer } from './context/scs';

const slicer = new ContextSlicer({
  budget: {
    maxBytes: 100000,
    maxTokens: 25000,
  },
  opaUrl: 'http://localhost:8181',
  fallbackToLocal: true,
});

const slice = await slicer.slice(specialist, h4rResults);

// slice.items: SlicedItem[] (policy-approved)
// slice.totalRedacted: number of items blocked/redacted
// slice.budgetUsed: { bytes, estimatedTokens, items }
```

## Context Pack: Structured Delivery

### Components

1. **TL;DR Summary**: Extractive summarization (top 5 sentences by relevance)
2. **Evidence**: Full H4R results (pre-sliced by SCS)
3. **Causal Graph** (optional): Nodes + edges showing relationships
4. **Affordances**: Action hints based on evidence patterns
5. **Agent Slice**: Specialist-specific, policy-aware minimal context

### Affordances

Rule-based action suggestions:

| Pattern | Affordance | Confidence |
|---------|------------|------------|
| Multiple test failures | `retry_with_healing` | 0.5 + 0.1 × failures |
| Selector issues | `suggest_fix` | 0.85 |
| Flaky behavior | `rerun_tests` | 0.75 |
| Low relevance | `request_more_context` | 0.6 |
| Critical keywords | `escalate_to_human` | 0.95 |

### Example Usage

```typescript
import { ContextPackBuilder } from './context/pack';

const builder = new ContextPackBuilder({
  h4rOptions: { limit: 20 },
  scsOptions: { budget: { maxBytes: 120000 } },
  packOptions: { tldrSentences: 5 },
});

const pack = await builder.build(query, specialist);

console.log(pack.tldr.summary);
// "Test login-spec-001 failed due to selector issue. Element #login-button not found. Suggested fix: update to #loginBtn. High confidence based on DOM snapshot."

console.log(pack.affordances[0]);
// {
//   type: 'suggest_fix',
//   description: 'Selector-related issues detected...',
//   confidence: 0.85,
//   parameters: { affectedTests: 1, suggestedStrategy: 'data-testid' }
// }
```

## A2A Integration

### ContextRequest Handler

Automatically registered in the A2A inbound handler:

```typescript
import { createContextHandler } from './a2a/handlers';

const contextHandler = createContextHandler({
  h4rOptions: { minScore: 0.5 },
  scsOptions: { budget: { maxBytes: 120000 } },
});

inboundHandler.register('ContextRequest', async (envelope) => {
  return await contextHandler.handle(envelope);
});
```

### Request Format

```json
{
  "meta": {
    "type": "ContextRequest",
    "from": {
      "type": "specialist",
      "id": "playwright_healer",
      "securityLevel": "internal"
    }
  },
  "payload": {
    "query": {
      "type": "semantic",
      "text": "login test failures with selector issues",
      "filters": { "test_type": "e2e", "status": "failed" }
    },
    "limit": 10,
    "include_scores": true
  }
}
```

### Response Format

```json
{
  "meta": {
    "type": "ContextResult",
    "reply_to": "original_message_id"
  },
  "payload": {
    "results": [
      {
        "id": "mem-001",
        "content": {...},
        "score": 0.85,
        "metadata": {
          "source": "postgres",
          "redacted": false,
          "byteSize": 1024
        }
      }
    ],
    "total_count": 42,
    "query_duration_ms": 185,
    "sources": ["postgres"],
    "explainability": {
      "tldr": {
        "summary": "...",
        "citations": ["mem-001", "mem-005"]
      },
      "affordances": [...],
      "causalGraph": null,
      "slicing": {
        "totalRedacted": 5,
        "totalDroppedBudget": 2,
        "budgetUsed": { "bytes": 98000, "estimatedTokens": 24500, "items": 10 }
      },
      "timings": {
        "retrievalMs": 150,
        "slicingMs": 20,
        "summarizationMs": 15,
        "totalMs": 185
      },
      "warnings": []
    }
  }
}
```

## Configuration

### Environment Variables

See `.env.example` for complete configuration. Key variables:

```bash
# H4R
H4R_WEIGHT_RECENCY=0.25
H4R_RECENCY_DECAY_LAMBDA=0.1
QDRANT_URL=  # Optional

# SCS
SCS_MAX_BYTES_DEFAULT=122880
SCS_OPA_URL=http://localhost:8181
SCS_OPA_FALLBACK_LOCAL=true

# Context Pack
CONTEXT_PACK_TLDR_SENTENCES=5
CONTEXT_PACK_INCLUDE_GRAPH=false
```

## Performance Targets

| Component | P95 Latency | Notes |
|-----------|-------------|-------|
| **H4R** | < 200ms | 1000-doc corpus, Postgres FTS |
| **SCS** | < 50ms | 100-item slicing with OPA cache |
| **Context Pack** | < 100ms | Total assembly time |

## Testing

```bash
# Unit tests
npm run test -w services/cmo -- --filter=context

# Integration tests
npm run test -w services/cmo -- --filter=integration.contextpack

# Benchmarks
npm run bench -w services/cmo
```

## Monitoring

Key metrics to track:

- `h4r.retrieval.duration_ms` (P50, P95, P99)
- `h4r.candidates.count` (total, per source)
- `scs.slicing.duration_ms`
- `scs.opa.cache.hit_rate`
- `scs.budget.utilization_pct` (bytes, tokens, items)
- `context_pack.assembly.duration_ms`
- `context_pack.affordances.generated`

## Troubleshooting

### H4R returns no results

- **Check**: Postgres FTS index exists (`CREATE INDEX ON memory USING gin(fts_vector)`)
- **Check**: Signal weights sum to 1.0
- **Check**: `minScore` threshold not too high
- **Debug**: Enable logging and inspect candidate counts

### SCS drops all items

- **Check**: OPA policy too restrictive
- **Check**: Budget limits too low
- **Check**: Specialist security level matches data sensitivity
- **Debug**: Review `agentSlice.warnings`

### Context Pack slow

- **Check**: H4R candidate limit not too high (default: 50)
- **Check**: Database indexes optimized
- **Check**: OPA caching enabled (`SCS_OPA_CACHE_TTL_MS > 0`)
- **Profile**: Inspect `metadata.timings` breakdown

## Future Enhancements

1. **LLM-based summarization**: Replace extractive with abstractive
2. **Dynamic signal weights**: A/B test and optimize per specialist
3. **Causal graph ML**: Use models to infer relationships
4. **Budget auto-tuning**: Adjust limits based on specialist feedback
5. **Distributed caching**: Redis cache for H4R results

## References

- [H4R Paper (internal)](#)
- [OPA Documentation](https://www.openpolicyagent.org/)
- [Qdrant Vector DB](https://qdrant.tech/)
- [Neo4j Graph Database](https://neo4j.com/)
