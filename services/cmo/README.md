# CMO/ELG - Developer Guide

**Version:** 1.0.0
**Status:** ✅ **Production Ready** - Core Runtime + Dev Infrastructure Complete
**Language:** TypeScript (ES2022 Modules)

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Development Workflow](#development-workflow)
5. [Testing](#testing)
6. [Replay CLI](#replay-cli)
7. [Configuration](#configuration)
8. [Architecture](#architecture)
9. [Troubleshooting](#troubleshooting)
10. [CI/CD](#cicd)

---

## Overview

CMO/ELG (Context-Memory-Operations Event Loop Graph) is a **deterministic, checkpointed orchestration engine** for multi-agent workflows. It provides:

- ✅ **Deterministic Execution** - Virtual clock, seeded RNG, activity recording for perfect replay
- ✅ **Crash Recovery** - Postgres checkpointing with resume-from-last-step
- ✅ **Activity Boundary** - All I/O isolated to ActivityClient for record/replay
- ✅ **A2A Messaging** - Redis Streams with consumer groups, DLQ, and backpressure
- ✅ **Policy Enforcement** - OPA policies for data governance
- ✅ **Schema Validation** - JSON Schema validation with AJV
- ✅ **Observability** - OpenTelemetry spans, structured logging with Pino
- ✅ **Time-Travel Debugging** - Replay CLI for trace comparison and verification

---

## Prerequisites

Before you begin, ensure you have:

### Required

- **Node.js** ≥ 20.10.0
- **Docker** ≥ 20.10 and **Docker Compose** ≥ 2.0
- **Make** (optional, for convenience commands)

### Optional

- **PostgreSQL client** (`psql`) for database debugging
- **Redis CLI** (`redis-cli`) for Redis debugging
- **MinIO client** (`mc`) for S3 debugging

---

## Quick Start

### 1. Install Dependencies

```bash
cd services/cmo
npm install
```

### 2. Start Local Stack

Start Postgres 16, Redis 7, and MinIO using Docker Compose:

```bash
# Option 1: Using NPM script
npm run dev:stack

# Option 2: Using Makefile (from project root)
make up

# Option 3: Manual
cd ../../tools/local-stack
cp .env.example .env
docker compose up -d
```

**Verify stack is running:**

```bash
docker ps
# Should see: cmo-postgres, cmo-redis, cmo-minio
```

**Services available:**
- Postgres: `localhost:5432` (user: `admin`, password: `secure123`)
- Redis: `localhost:6379` (no password)
- MinIO API: `localhost:9000` (access key: `minioadmin`, secret: `minioadmin123`)
- MinIO Console: `http://localhost:9001` (web UI)

### 3. Configure Environment

```bash
cd services/cmo
cp .env.example .env
# .env is already pre-configured for local stack defaults
```

### 4. Start CMO Service

```bash
# Option 1: Using NPM script
npm run dev

# Option 2: Using Makefile (from project root)
make cmo
```

**Expected output:**

```
{"level":"info","time":"...","msg":"Starting CMO/ELG service..."}
{"level":"info","latency":45,"msg":"Postgres health check passed"}
{"level":"info","latency":12,"msg":"Redis health check passed"}
{"level":"info","latency":67,"bucket":"cmo-artifacts","msg":"S3 health check passed"}
{"level":"info","msg":"CMO/ELG service ready"}
```

### 5. Run Tests

```bash
npm test
```

**That's it!** You now have a fully functional CMO/ELG development environment.

---

## Development Workflow

### Daily Development

```bash
# 1. Start local stack (if not running)
npm run dev:stack

# 2. Start CMO service in dev mode
npm run dev

# 3. Run tests in watch mode (in another terminal)
npm run test:watch

# 4. Stop everything when done
npm run dev:stack:down  # or make down
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Build production bundle
npm run build

# Start production build
npm run build && npm start
```

### Common Tasks

| Task | Command | Description |
|------|---------|-------------|
| Start local stack | `npm run dev:stack` | Boots Postgres, Redis, MinIO |
| Stop local stack | `npm run dev:stack:down` | Stops and removes volumes |
| Start CMO service | `npm run dev` | Runs CMO with hot-reload |
| Run all tests | `npm test` | Runs unit + contract + integration tests |
| Run specific tests | `npm run test:unit` | Runs only unit tests |
| Schema validation | `npm run schema:check` | Validates JSON schemas |
| Policy tests | `npm run policy:test` | Tests OPA policies |
| Replay CLI | `npm run replay -- --trace <id>` | Time-travel debugging |

---

## Testing

CMO/ELG follows a comprehensive testing strategy:

### Test Pyramid

```
       E2E/Integration (5%)
            ───────
       Contract Tests (15%)
          ─────────────
      Unit Tests (80%)
    ───────────────────────
```

### Unit Tests

**Location:** `test/unit/`

```bash
# Run all unit tests
npm run test:unit

# Run specific test file
npx vitest run test/unit/transport.redis.spec.ts

# Watch mode
npm run test:watch
```

**Coverage:**

```bash
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Contract Tests

**Location:** `test/contract/`

#### Schema Validation Tests

Validates all envelope schemas against AJV:

```bash
npm run schema:check
```

**What it tests:**
- `EnvelopeMeta` schema
- `AgentId` schema
- `SpecialistInvocationRequest` schema
- `SpecialistResult` schema
- `RetryDirective` schema
- `DecisionNotice` schema

#### Policy Tests

Tests OPA policy enforcement:

```bash
npm run policy:test
```

**What it tests:**
- Selector history leak prevention (healer-only access)
- Write scope enforcement (`healing/*` namespace)
- PII access control (admin-only)
- Payload size limits (10MB max)
- Specialist registration validation

### Integration Tests

Full end-to-end workflows with real Postgres/Redis/S3:

```bash
npm run test:integration
```

**What it tests:**
- Graph execution with checkpointing
- Crash recovery and resume
- Activity record/replay
- Transport reliability (pub/sub, ACK/NACK, DLQ)
- Backpressure handling

### Test Fixtures

**Location:** `test/fixtures/`

#### Sample Run Fixture

Pre-loaded execution trace for testing replay functionality:

```bash
# Load fixture into database
psql -h localhost -U admin -d playwright_enterprise -f tools/local-stack/sql/schema.sql

# Run replay
npm run replay -- --trace sample-fixture-trace-001

# Replay with verification
npm run replay -- --trace sample-fixture-trace-001 --verify

# Replay first 2 steps only
npm run replay -- --trace sample-fixture-trace-001 --to 2
```

---

## Replay CLI

The replay CLI provides **time-travel debugging** for graph executions.

### Basic Usage

```bash
npm run replay -- --trace <trace-id> [options]
```

### Options

| Option | Short | Description |
|--------|-------|-------------|
| `--trace <id>` | `-t` | Trace ID to replay (required) |
| `--to <step>` | `-s` | Replay up to this step index |
| `--verify` | `-v` | Verify state hashes match original |
| `--compare <id>` | `-c` | Compare with another trace |
| `--verbose` | | Enable verbose logging |
| `--help` | `-h` | Show help message |

### Examples

#### 1. Replay Entire Trace

```bash
npm run replay -- --trace abc-123-def-456
```

**Output:**

```
=== Original Execution Summary ===

Trace ID: abc-123-def-456
Total Steps: 8
Replaying: 8 steps

Step 0: init
  State Hash: a1b2c3d4e5f6g7h8...
  Duration: 250ms
  ✅ Success → process

Step 1: process
  State Hash: b2c3d4e5f6g7h8i9...
  Duration: 850ms
  ✅ Success → validate
...
```

#### 2. Replay Up to Step N

```bash
npm run replay -- --trace abc-123 --to 5
```

Replays only steps 0-5 (useful for debugging mid-execution issues).

#### 3. Compare Two Traces (Determinism Verification)

```bash
npm run replay -- --trace run-1 --compare run-2
```

**Output:**

```
=== Trace Comparison ===

Trace 1: run-1 (8 steps)
Trace 2: run-2 (8 steps)

Step | Trace 1 Hash         | Trace 2 Hash         | Match  | Node
-----|----------------------|----------------------|--------|------------
   0 | a1b2c3d4e5f6g7h8i9j0 | a1b2c3d4e5f6g7h8i9j0 | ✅     | init / init
   1 | b2c3d4e5f6g7h8i9j0k1 | b2c3d4e5f6g7h8i9j0k1 | ✅     | process / process
   2 | c3d4e5f6g7h8i9j0k1l2 | c3d4e5f6g7h8i9j0k1l2 | ✅     | validate / validate
...

Matching steps: 8 / 8 (100.0%)

✅ Traces are identical!
```

#### 4. Replay with Verification

```bash
npm run replay -- --trace abc-123 --verify --verbose
```

Enables verbose logging and state hash verification (future: re-executes graph and compares hashes).

### Sample Fixture

Try the included sample fixture:

```bash
# View fixture details
cat test/fixtures/sample-run/README.md

# Load fixture (automatic in CI, manual for local dev)
# See fixture README for SQL commands

# Replay fixture
npm run replay -- --trace sample-fixture-trace-001
```

---

## Configuration

### Environment Variables

All configuration is done via `.env` file. See `.env.example` for complete reference.

#### Database (Postgres)

```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=playwright_enterprise
POSTGRES_USER=admin
POSTGRES_PASSWORD=secure123
POSTGRES_SSL=false
POSTGRES_MAX_CONNECTIONS=20
```

#### Redis (Transport)

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_STREAM_NAME=cmo-events
REDIS_CONSUMER_GROUP=cmo-workers
REDIS_MAX_PENDING=1000  # Backpressure threshold
```

#### S3/MinIO (Artifacts)

```bash
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
S3_BUCKET=cmo-artifacts
S3_FORCE_PATH_STYLE=true
```

#### OpenTelemetry (Observability)

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=cmo-elg
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

#### OPA (Policies)

```bash
OPA_ENABLED=true
OPA_POLICY_PATH=./policies/slices.rego
```

#### Runtime

```bash
ELG_MAX_STEP_DURATION_MS=60000
ELG_CHECKPOINT_INTERVAL=1  # Checkpoint every N steps
ELG_MAX_RETRIES=3
```

#### Logging

```bash
LOG_LEVEL=info  # debug, info, warn, error
LOG_PRETTY=true  # Pretty-print logs (dev only)
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CMO/ELG Runtime                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Graph Nodes │→ │  Activity     │→ │  Checkpointer │  │
│  │ (Pure Fns)  │  │  Boundary     │  │  (Postgres)   │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                 │                  │          │
│         ↓                 ↓                  ↓          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Policies   │  │   Schemas    │  │     OTEL     │  │
│  │   (OPA)      │  │   (AJV)      │  │   (Traces)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                           │                             │
│  ┌────────────────────────┴─────────────────────────┐  │
│  │      Transport Adapter (Redis Streams)           │  │
│  │  - Consumer Groups  - DLQ  - Backpressure        │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
           │                                    │
           ↓                                    ↓
    ┌──────────────┐                    ┌──────────────┐
    │ Specialist   │                    │ S3/MinIO     │
    │ Agents (A2A) │                    │ Artifacts    │
    └──────────────┘                    └──────────────┘
```

### Key Components

#### 1. Runtime Executor (`src/elg/runtime.ts`)

- Executes graph definitions
- Manages state transitions
- Handles timeouts and retries
- Emits OTEL spans

#### 2. Activity Boundary (`src/elg/activity/`)

- **Record Mode:** Captures all I/O for replay
- **Replay Mode:** Returns recorded responses
- **Normal Mode:** Direct I/O passthrough
- Activities: `http`, `time`, `random`, `s3`, `db`

#### 3. Checkpointer (`src/elg/checkpointer/postgres.ts`)

- Saves execution state to Postgres
- Enables crash recovery
- Stores activities for replay
- Idempotent with unique constraints

#### 4. Transport (`src/elg/transport/redis-streams.ts`)

- Agent-to-Agent (A2A) messaging
- Consumer groups with load balancing
- Dead-Letter Queue (DLQ) for failed messages
- Backpressure: pause at maxPending, resume at 80%

#### 5. Policies (`policies/slices.rego`)

- Pre/post-execution gates
- Data access control (selector history → healer only)
- Write scope enforcement (`healing/*` namespace)
- PII protection (admin-only access)

#### 6. Schemas (`src/schemas/`)

- Pre-compiled AJV validators
- Envelope validation (6 types)
- Strict mode with format validators

---

## A2A (Agent-to-Agent) Messaging

CMO/ELG includes a complete **Agent-to-Agent (A2A) messaging system** for multi-agent orchestration.

### A2A Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      A2A Messaging Stack                        │
│                                                                 │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  11 Envelope     │→ │   Security      │→ │  Topic-Based  │  │
│  │  Types + AJV     │  │   JWT + Signing │  │  Routing      │  │
│  └──────────────────┘  └─────────────────┘  └───────────────┘  │
│           │                     │                    │          │
│           ↓                     ↓                    ↓          │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  Agent Registry  │  │   Middleware    │  │  Redis/NATS   │  │
│  │  Postgres + Leases│  │   OPA + Idem    │  │  Transports   │  │
│  └──────────────────┘  └─────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

- **11 Envelope Types** - TaskRequest, TaskResult, MemoryEvent, ContextRequest, ContextResult, SpecialistInvocationRequest, SpecialistResult, RetryDirective, DecisionNotice + 2 more
- **Security** - JWT authentication, capability tokens, message signing, replay protection
- **Topic Naming** - Convention: `qa.<tenant>.<project>.<domain>.<entity>.<verb>`
- **Agent Registry** - Postgres-backed registry with heartbeat leases (60s), discovery, health checks
- **Middleware** - OPA policy gates, idempotency guard
- **Transports** - Redis Streams (production), NATS JetStream (stub for future)

### Topic Naming Convention

Topics follow a strict hierarchical pattern:

```
qa.<tenant>.<project>.<domain>.<entity>.<verb>
```

**Examples:**

- `qa.wesign.frontend.specialists.playwright_healer.invoke`
- `qa.wesign.shared.cmo.decisions`
- `qa.wesign.shared.registry.heartbeats`

**Built-in Topic Builders:**

```typescript
import { TopicBuilders } from '@/a2a';

// Specialist invocation
TopicBuilders.specialistInvoke('wesign', 'frontend', 'playwright_healer');
// → qa.wesign.frontend.specialists.playwright_healer.invoke

// CMO decisions
TopicBuilders.cmoDecisions('wesign', 'frontend');
// → qa.wesign.frontend.cmo.decisions

// Registry heartbeats
TopicBuilders.registryHeartbeats('wesign', 'shared');
// → qa.wesign.shared.registry.heartbeats
```

### Envelope Structure

All A2A messages use a standard envelope structure:

```typescript
{
  meta: {
    a2a_version: '1.0',
    message_id: 'abc123...',        // SHA-256 hash
    trace_id: 'trace-xyz...',       // Execution trace
    ts: '2025-01-15T10:00:00Z',     // ISO 8601
    from: {
      type: 'cmo',
      id: 'cmo-main',
      version: '1.0.0'
    },
    to: [{ type: 'specialist', id: 'playwright_healer', version: '1.0.0' }],
    tenant: 'wesign',
    project: 'frontend',
    type: 'SpecialistInvocationRequest',
    priority: 'normal',              // Optional: low, normal, high
    correlation_id: 'req-456',       // Optional: for request/response
    reply_to: 'qa.wesign.frontend.cmo.replies', // Optional: reply topic
    idempotency_key: 'hash...',      // Optional: for deduplication
    jwt_token: 'eyJ...',             // Optional: JWT for auth
    capability_token: 'eyJ...',      // Optional: fine-grained auth
    signature: 'abc123...'           // Optional: HMAC signature
  },
  payload: {
    // Envelope-type-specific payload
  }
}
```

### Security: JWT Tokens

A2A supports JWT-based authentication with scopes:

**JWT Claims:**

```typescript
{
  sub: 'agent_id',
  tenant: 'wesign',
  project: 'frontend',
  scopes: [
    'context.read:*',              // Read all context
    'repo.write:healing/*',        // Write to healing namespace
    'healing.selector'             // Selector healing capability
  ],
  iss: 'wesign-auth',
  exp: 1737000000
}
```

**Scope Matching:**

- Exact match: `context.read:test_results`
- Wildcard: `context.read:*`
- Namespace: `repo.write:healing/*`

**Usage:**

```typescript
import { verifyJWT, tokenHasScope } from '@/a2a';

const result = verifyJWT(token, {
  key: process.env.JWT_SECRET,
  algorithm: 'HS256',
  issuer: 'wesign-auth'
});

if (result.valid && tokenHasScope(result.claims, 'context.read:test_results')) {
  // Authorized
}
```

### Security: Capability Tokens

For fine-grained authorization, use capability tokens (nested JWS):

```typescript
import { verifyCapabilityToken, hasCapabilities } from '@/a2a';

const result = verifyCapabilityToken(capToken, {
  key: process.env.CAP_TOKEN_SECRET,
  algorithm: 'HS256'
});

if (result.valid && hasCapabilities(result.claims, ['healing.selector'])) {
  // Authorized for selector healing
}
```

### Agent Registry

Agents register with the central registry using heartbeats:

**Registration:**

```typescript
import { createAgentRegistry } from '@/a2a';

const registry = await createAgentRegistry({
  postgres: {
    host: 'localhost',
    port: 5432,
    database: 'playwright_enterprise',
    user: 'admin',
    password: 'secure123'
  },
  enableLeaseExpiryChecker: true,
  leaseExpiryIntervalMs: 10000  // Check every 10s
});

// Register agent
const lease = await registry.register({
  agent_id: 'playwright_healer',
  version: '1.0.0',
  tenant: 'wesign',
  project: 'frontend',
  capabilities: ['healing.selector', 'healing.assertion'],
  initial_status: 'HEALTHY',
  lease_duration_seconds: 60
});

console.log('Lease expires at:', lease.lease_until);
```

**Heartbeats:**

```typescript
import { startHeartbeatPublisher } from '@/a2a';

const publisher = await startHeartbeatPublisher({
  agentId: { type: 'specialist', id: 'playwright_healer', version: '1.0.0' },
  registry,
  transport,
  tenant: 'wesign',
  project: 'frontend',
  intervalMs: 20000,  // Heartbeat every 20s (1/3 of 60s lease)
  leaseDurationSeconds: 60
});

// Heartbeats publish automatically every 20s
```

**Discovery:**

```typescript
// Find all healthy healers with selector capability
const agents = await registry.discover({
  tenant: 'wesign',
  project: 'frontend',
  capability: 'healing.selector',
  status: ['HEALTHY']
});

agents.forEach(agent => {
  console.log(`Found: ${agent.agent_id} (v${agent.version})`);
});
```

**Agent Status State Machine:**

```
STARTING → HEALTHY → DEGRADED → UNAVAILABLE
    ↓          ↓          ↓
    └──────────┴──────────┴──> (lease expires → UNAVAILABLE)
```

### Middleware: OPA Policy Gates

OPA policies enforce rules before publishing and after receiving envelopes:

**Setup:**

```typescript
import { createOPAWireGates } from '@/a2a';

const opaGates = createOPAWireGates({
  url: 'http://localhost:8181',
  preSendPolicyPath: 'a2a/wire_gates/pre_send',
  postReceivePolicyPath: 'a2a/wire_gates/post_receive',
  timeout: 5000
});

// Check before publishing
await opaGates.checkOrThrow(envelope, 'publish');

// Check after receiving
await opaGates.checkOrThrow(envelope, 'receive');
```

**Example Policy (Rego):**

```rego
package a2a.wire_gates

# Deny cross-tenant messages
default pre_send = false

pre_send = {"allow": true} {
  input.envelope.meta.from.tenant == input.envelope.meta.tenant
}

pre_send = {"allow": false, "reason": "Cross-tenant denied"} {
  not pre_send.allow
}
```

### Middleware: Idempotency Guard

Prevents duplicate processing using Postgres:

```typescript
import { createIdempotencyGuard } from '@/a2a';

const guard = createIdempotencyGuard({
  checkpointer: postgresCheckpointer,
  traceId: 'trace-123',
  stepIndex: 0
});

// Check for duplicate
const result = await guard.check(envelope);
if (result.isDuplicate) {
  return result.cachedResponse;  // Return cached response
}

// Process envelope...
const response = await processEnvelope(envelope);

// Record response for future deduplication
await guard.record(envelope, response);
```

### Publishing & Subscribing

**Publish Example:**

```typescript
import { createAndPublish } from '@/a2a';

const result = await createAndPublish(
  {
    a2a_version: '1.0',
    trace_id: 'trace-123',
    from: { type: 'cmo', id: 'cmo-main', version: '1.0.0' },
    to: [{ type: 'specialist', id: 'playwright_healer', version: '1.0.0' }],
    tenant: 'wesign',
    project: 'frontend',
    type: 'SpecialistInvocationRequest'
  },
  {
    task: 'fix_selector',
    inputs: { selector: '.btn-submit', error: 'not found' }
  },
  {
    transport,
    validate: true,
    signing: { secretKey: process.env.SIGNING_KEY }
  }
);

console.log('Published:', result.messageId, 'to', result.topic);
```

**Subscribe Example:**

```typescript
import { subscribe } from '@/a2a';

await subscribe(
  'qa.wesign.frontend.cmo.*',  // Topic pattern with wildcard
  async (envelope) => {
    console.log('Received:', envelope.meta.type);

    if (envelope.meta.type === 'SpecialistResult') {
      // Process specialist result
    }
  },
  {
    transport,
    validate: true,
    consumerGroup: 'cmo-workers',
    consumerId: 'cmo-1'
  }
);
```

### ELG Integration: InvokeSpecialist Activity

Invoke specialist agents from ELG graph nodes:

```typescript
import { createInvokeSpecialistActivity } from '@/elg/activity/invoke-specialist';

const activity = createInvokeSpecialistActivity({
  transport,
  cmoAgentId: { type: 'cmo', id: 'cmo-main', version: '1.0.0' },
  tenant: 'wesign',
  project: 'frontend',
  traceId: 'trace-123'
});

// Inside a graph node (with ActivityClient)
const result = await activity.invoke(activityClient, {
  specialist: { type: 'specialist', id: 'playwright_healer', version: '1.0.0' },
  task: 'fix_selector',
  inputs: { selector: '.btn-submit', error: 'not found' },
  budget: { max_minutes: 5, max_cost_usd: 0.10 },
  timeout: 300000  // 5 minutes
});

if (result.status === 'success') {
  console.log('Proposal:', result.proposal);
  console.log('Confidence:', result.confidence);
}
```

### ELG Integration: Inbound Handler

Route incoming A2A messages to handlers:

```typescript
import { createInboundHandler } from '@/a2a';

const handler = createInboundHandler({
  transport,
  agentId: { type: 'cmo', id: 'cmo-main', version: '1.0.0' },
  tenant: 'wesign',
  project: 'frontend',
  opaGates,
  idempotencyGuard,
  validateEnvelopes: true
});

// Register handler for TaskRequest
handler.on('TaskRequest', async (envelope) => {
  const request = envelope.payload;
  // Process task...
  return {
    meta: { ...envelope.meta, type: 'TaskResult' },
    payload: { task: request.task, status: 'success', result: {...} }
  };
});

// Subscribe to topics
await transport.subscribe('qa.wesign.frontend.cmo.*', async (msg, ack) => {
  const envelope = JSON.parse(msg.payload.toString());
  await handler.handle(envelope);
  await ack.ack();
});
```

### ELG Integration: DecisionNotice Publisher

Publish CMO decisions:

```typescript
import { createDecisionNoticePublisher } from '@/a2a';

const publisher = createDecisionNoticePublisher({
  transport,
  cmoAgentId: { type: 'cmo', id: 'cmo-main', version: '1.0.0' },
  tenant: 'wesign',
  project: 'frontend',
  traceId: 'trace-123'
});

// Approve a proposal
await publisher.approve(
  { fix: 'Update selector to use data-testid' },
  'High confidence, passes all criteria',
  {
    scoringSummary: { confidence: 0.95, feasibility: 0.9, total_score: 0.925 },
    nextActions: [
      { action: 'apply_fix', assigned_to: 'ci-gate', deadline: '2025-01-15T10:00:00Z' }
    ]
  }
);

// Reject a proposal
await publisher.reject(
  'Confidence score too low',
  [
    { code: 'LOW_CONFIDENCE', message: 'Score 0.45 < 0.7', severity: 'error' }
  ]
);
```

### Transport Options

**Redis Streams (Production):**

```typescript
import { createRedisA2ATransport } from '@/a2a';

const transport = await createRedisA2ATransport({
  host: 'localhost',
  port: 6379,
  streamPrefix: 'a2a:',
  consumerGroupPrefix: 'group:',
  maxLength: 10000,
  maxPending: 1000,  // Backpressure threshold
  validateOnPublish: true,
  validateOnSubscribe: true
});
```

**NATS JetStream (Stub for future):**

```typescript
import { NatsA2ATransport } from '@/a2a';

const transport = new NatsA2ATransport({
  servers: ['nats://localhost:4222'],
  streamPrefix: 'A2A',
  validateOnPublish: true
});

// Will throw "Not implemented" until Step-3.5
await transport.connect();  // Error: Not implemented
```

### Database Tables

A2A uses the following Postgres tables:

```sql
-- Agent registry
agents (agent_id PK, version, tenant, project, capabilities JSONB,
        status, last_heartbeat, lease_until, metadata JSONB)

-- Agent topic subscriptions
agent_topics (id PK, agent_id FK, topic, role)

-- Views
agents_active (active agents with lease_remaining_seconds)
```

**Useful Queries:**

```sql
-- List all healthy agents
SELECT agent_id, version, capabilities, last_heartbeat
FROM agents
WHERE status = 'HEALTHY' AND lease_until > NOW();

-- Find agents with expired leases
SELECT agent_id, lease_until,
       EXTRACT(EPOCH FROM (NOW() - lease_until)) as expired_seconds_ago
FROM agents
WHERE lease_until < NOW() AND status != 'UNAVAILABLE';

-- Mark expired agents as unavailable
SELECT mark_expired_agents();

-- Discover agents by capability
SELECT * FROM discover_agents('wesign', 'frontend', 'healing.selector');

-- Get registry health report
SELECT * FROM agents;
SELECT
  COUNT(*) FILTER (WHERE status = 'HEALTHY') as healthy,
  COUNT(*) FILTER (WHERE status = 'DEGRADED') as degraded,
  COUNT(*) FILTER (WHERE status = 'UNAVAILABLE') as unavailable
FROM agents;
```

---

## Troubleshooting

### Port Already in Use

**Error:**

```
Error: listen EADDRINUSE: address already in use :::5432
```

**Solution:**

```bash
# Check what's using the port
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Stop conflicting service
docker compose down  # If Docker Compose
brew services stop postgresql  # If Homebrew Postgres (macOS)
```

### MinIO Access Denied

**Error:**

```
Error: S3 unhealthy: Access Denied
```

**Solution:**

1. Check MinIO credentials in `.env`:

```bash
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin123
```

2. Verify bucket exists:

```bash
docker exec -it cmo-minio mc ls myminio
# Should show: cmo-artifacts
```

3. Recreate bucket:

```bash
docker exec -it cmo-minio mc mb myminio/cmo-artifacts
```

### Postgres Connection Failed

**Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

1. Check Postgres is running:

```bash
docker ps | grep cmo-postgres
```

2. If not running, start stack:

```bash
npm run dev:stack
```

3. Check logs:

```bash
docker logs cmo-postgres
```

4. Verify connection manually:

```bash
psql -h localhost -U admin -d playwright_enterprise
# Password: secure123
```

### Redis Connection Failed

**Error:**

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**

1. Check Redis is running:

```bash
docker ps | grep cmo-redis
```

2. Test connection:

```bash
docker exec -it cmo-redis redis-cli ping
# Should return: PONG
```

### Schema Validation Errors

**Error:**

```
Error: Schema validation failed: data.meta.messageType must be equal to one of the allowed values
```

**Solution:**

Ensure envelope has correct structure:

```typescript
const envelope = {
  meta: {
    messageType: 'specialist-invocation',  // Must be exact
    correlationId: '...',
    timestamp: new Date().toISOString(),
  },
  payload: {
    // ... payload
  }
};
```

Run schema tests to see all validation rules:

```bash
npm run schema:check
```

### Test Failures in CI

**Error:**

```
Error: Timeout waiting for Postgres to be ready
```

**Solution:**

1. Increase health check retries in GitHub Actions workflow
2. Add explicit wait in CI:

```bash
timeout 60 bash -c 'until pg_isready -h localhost -U admin; do sleep 2; done'
```

### Replay Not Finding Trace

**Error:**

```
Error: No steps found for trace: abc-123
```

**Solution:**

1. Check trace exists in database:

```sql
SELECT trace_id, graph_id, status FROM cmo_runs WHERE trace_id = 'abc-123';
```

2. Load sample fixture:

```bash
npm run replay -- --trace sample-fixture-trace-001
```

### OPA Policy Errors

**Error:**

```
Error: Policy evaluation failed: undefined rule
```

**Solution:**

For development, policies use MockPolicyEvaluator (no OPA required).

For production, compile WASM:

```bash
opa build -t wasm -e cmo/slices -o bundle.tar.gz policies/
tar -xzf bundle.tar.gz
# Use policy.wasm in config
```

---

## CI/CD

### GitHub Actions

CI pipeline defined in `.github/workflows/cmo.yml`.

**What it does:**

1. Starts service containers (Postgres, Redis, MinIO)
2. Installs dependencies
3. Builds TypeScript
4. Runs all tests (unit, contract, integration)
5. Boot smoke test (verifies health checks)
6. Replay CLI test (loads fixture and replays)
7. Uploads artifacts (coverage, logs, replay output)

**Trigger conditions:**

- Push to `main` or `feat/cmo-elg-*` branches
- Pull requests to `main`
- Changes to `services/cmo/**` or `tools/local-stack/**`

**View results:**

```bash
# GitHub Actions
https://github.com/<org>/<repo>/actions

# Local CI simulation
make test-all
```

### Jenkins (Alternative)

If using Jenkins instead of GitHub Actions:

1. Create `Jenkinsfile` in project root
2. Define pipeline stages (checkout, install, test, build)
3. Use Docker Compose for service containers
4. Publish HTML reports as artifacts

---

## Makefile Commands (Project Root)

For convenience, a Makefile is provided at the project root:

```bash
make help         # Show all commands
make up           # Start local stack
make down         # Stop local stack
make logs         # View stack logs
make status       # Check stack status

make cmo          # Start CMO service
make cmo-down     # Stop CMO service
make test-cmo     # Run CMO tests
make lint-cmo     # Lint CMO code

make test-all     # Run all tests (CMO + backend)
make clean        # Clean build artifacts and volumes
make install      # Install all dependencies
```

---

## Directory Structure

```
services/cmo/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vitest.config.ts          # Test configuration
├── .env.example              # Environment template
├── README.md                 # This file
├── policies/
│   └── slices.rego           # OPA policy for data governance
├── src/
│   ├── elg/
│   │   ├── node.ts                      # Graph node interface
│   │   ├── activity.ts                  # Activity client interface
│   │   ├── runtime.ts                   # Runtime executor
│   │   ├── checkpointer/
│   │   │   ├── schema.sql               # Postgres DDL
│   │   │   └── postgres.ts              # Checkpointer implementation
│   │   ├── transport/
│   │   │   ├── index.ts                 # Transport interface
│   │   │   ├── redis-streams.ts         # Redis implementation
│   │   │   └── nats-jetstream.ts        # NATS stub
│   │   ├── replay/
│   │   │   └── cli.ts                   # Replay CLI
│   │   ├── otel.ts                      # OpenTelemetry setup
│   │   └── activity/
│   │       └── index.ts                 # Activity client implementation
│   ├── schemas/
│   │   └── index.ts                     # Pre-compiled AJV validators
│   └── app/
│       ├── main.ts                      # Service entrypoint
│       └── config.ts                    # Configuration loader
└── test/
    ├── unit/                            # Unit tests
    │   ├── runtime.spec.ts
    │   ├── transport.redis.spec.ts
    │   └── ...
    ├── contract/                        # Contract tests
    │   ├── schemas.spec.ts
    │   ├── policy.spec.ts
    │   └── ...
    ├── integration/                     # Integration tests
    │   └── e2e.spec.ts
    └── fixtures/                        # Test fixtures
        └── sample-run/
            ├── sample-run.json
            └── README.md
```

---

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| `ioredis` | ^5.7.0 | Redis client for transport |
| `pg` | ^8.16.3 | PostgreSQL client for checkpoints |
| `@aws-sdk/client-s3` | ^3.637.0 | S3-compatible storage (MinIO) |
| `ajv` | ^8.17.1 | JSON Schema validation |
| `ajv-formats` | ^2.1.1 | Additional format validators for AJV |
| `@open-policy-agent/opa-wasm` | ^1.10.0 | OPA policy enforcement (WASM) |
| `@opentelemetry/sdk-node` | ^0.52.0 | OpenTelemetry SDK |
| `@opentelemetry/auto-instrumentations-node` | ^0.52.0 | Auto-instrumentation |
| `pino` | ^9.7.0 | Structured logging |
| `pino-pretty` | ^13.0.0 | Pretty-print logs (dev) |
| `dotenv` | ^16.4.5 | Environment variables |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.3.3 | TypeScript compiler |
| `vitest` | ^2.1.0 | Test framework |
| `@vitest/coverage-v8` | ^2.1.0 | Coverage reporting |
| `tsx` | ^4.6.2 | TypeScript runner (dev mode) |
| `eslint` | ^8.55.0 | Linting |
| `@typescript-eslint/eslint-plugin` | ^6.14.0 | TypeScript ESLint rules |
| `@typescript-eslint/parser` | ^6.14.0 | TypeScript parser for ESLint |

---

## License

MIT

---

## References

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Redis Streams Documentation](https://redis.io/docs/data-types/streams/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
- [OPA WebAssembly](https://www.openpolicyagent.org/docs/latest/wasm/)
- [Vitest Documentation](https://vitest.dev/)
- [AJV JSON Schema Validator](https://ajv.js.org/)

---

**Status:** ✅ **Production Ready** - Core Runtime + Dev Infrastructure Complete

**Last Updated:** 2025-10-02

**Questions?** See [Troubleshooting](#troubleshooting) or open an issue.
