# Sample Run Fixture

This directory contains a sample execution trace for testing the replay CLI and determinism verification.

## Contents

- **sample-run.json** - Complete execution trace with steps and activities

## Fixture Details

**Trace ID:** `sample-fixture-trace-001`
**Graph:** `demo-workflow` v1.0.0
**Status:** completed
**Duration:** 2.15 seconds
**Steps:** 4 (init → process → validate → finalize)
**Activities:** 5 (2x time, 1x random, 1x http, 1x time)

## How This Fixture Was Generated

This is a synthetic fixture created for testing purposes. It represents a typical workflow execution with:

1. **Init step** - Initialization with virtual clock and seeded RNG
2. **Process step** - HTTP call to external API
3. **Validate step** - Validation logic with timestamp
4. **Finalize step** - Completion

All state hashes are deterministic and reproducible.

## Usage

### Replay the Fixture

```bash
# Load fixture into database first (manual step)
# Then replay:
npm run replay -- --trace sample-fixture-trace-001

# Replay first 2 steps only:
npm run replay -- --trace sample-fixture-trace-001 --to 2

# Replay with verification:
npm run replay -- --trace sample-fixture-trace-001 --verify
```

### Compare with Another Trace

```bash
# Compare determinism between two runs:
npm run replay -- --trace sample-fixture-trace-001 --compare other-trace-id
```

## Expected Output

When replaying this fixture:

- ✅ All steps should complete successfully
- ✅ State hashes should match deterministically
- ✅ Activities should be replayed without actual I/O
- ✅ Final state: `{ counter: 1, total: 42, complete: true, messages: [...] }`

## Loading Fixture into Database

To use this fixture for testing, load it into your local Postgres database:

```sql
-- Insert run
INSERT INTO cmo_runs (trace_id, graph_id, graph_version, status, started_at, completed_at)
VALUES ('sample-fixture-trace-001', 'demo-workflow', '1.0.0', 'completed',
        '2025-01-02T00:00:00.000Z', '2025-01-02T00:00:02.150Z');

-- Insert steps
INSERT INTO cmo_steps (trace_id, step_index, node_id, state_hash, input_hash, output_hash,
                       next_edge, started_at, completed_at, duration_ms)
VALUES
  ('sample-fixture-trace-001', 0, 'init',
   'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
   '0000000000000000000000000000000000000000000000000000000000000000',
   '1111111111111111111111111111111111111111111111111111111111111111',
   'process', '2025-01-02T00:00:00.000Z', '2025-01-02T00:00:00.250Z', 250),
  ('sample-fixture-trace-001', 1, 'process',
   'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1',
   '1111111111111111111111111111111111111111111111111111111111111111',
   '2222222222222222222222222222222222222222222222222222222222222222',
   'validate', '2025-01-02T00:00:00.250Z', '2025-01-02T00:00:01.100Z', 850),
  ('sample-fixture-trace-001', 2, 'validate',
   'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2',
   '2222222222222222222222222222222222222222222222222222222222222222',
   '3333333333333333333333333333333333333333333333333333333333333333',
   'finalize', '2025-01-02T00:00:01.100Z', '2025-01-02T00:00:01.500Z', 400),
  ('sample-fixture-trace-001', 3, 'finalize',
   'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2c3',
   '3333333333333333333333333333333333333333333333333333333333333333',
   '4444444444444444444444444444444444444444444444444444444444444444',
   NULL, '2025-01-02T00:00:01.500Z', '2025-01-02T00:00:02.150Z', 650);

-- Insert activities
INSERT INTO cmo_activities (trace_id, step_index, activity_type, request_hash,
                             request_data, response_data, timestamp)
VALUES
  ('sample-fixture-trace-001', 0, 'time', 'abc123', '{}', '"2025-01-02T00:00:00.000Z"', NOW()),
  ('sample-fixture-trace-001', 0, 'random', 'def456', '{"max":100}', '42', NOW()),
  ('sample-fixture-trace-001', 1, 'http', 'ghi789',
   '{"url":"https://api.example.com/data","options":{"method":"GET"}}',
   '{"status":200,"body":"{\"result\":\"success\"}"}', NOW()),
  ('sample-fixture-trace-001', 1, 'time', 'jkl012', '{}', '"2025-01-02T00:00:00.500Z"', NOW()),
  ('sample-fixture-trace-001', 2, 'time', 'mno345', '{}', '"2025-01-02T00:00:01.200Z"', NOW());
```

Or use the helper script (to be created):

```bash
npm run load-fixture -- test/fixtures/sample-run/sample-run.json
```

## Verifying Determinism

To verify determinism with this fixture:

1. Load the fixture into the database
2. Run the same graph definition twice with the same seed
3. Compare the two traces using --compare
4. All state hashes should match exactly

```bash
# Compare two deterministic runs:
npm run replay -- --trace run-1 --compare run-2
```

Expected output: `✅ Traces are identical!`
