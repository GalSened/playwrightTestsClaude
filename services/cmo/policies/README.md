# OPA Policies for CMO/ELG

This directory contains Open Policy Agent (OPA) policies for enforcing security and operational constraints in the CMO/ELG runtime.

## Policy Files

- **default.rego** - Default policy with basic security constraints
- **default.wasm** - Compiled WASM policy (generated from default.rego)

## Compiling Policies

### Prerequisites

Install the OPA CLI:

```bash
# macOS
brew install opa

# Linux
curl -L -o opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64
chmod +x opa
sudo mv opa /usr/local/bin/

# Windows
# Download from: https://github.com/open-policy-agent/opa/releases
```

### Compile Rego to WASM

```bash
# From the services/cmo directory
opa build -t wasm -e cmo/elg/decision policies/default.rego -o policies/bundle.tar.gz

# Extract the WASM file
tar -xzf policies/bundle.tar.gz -C policies/
mv policies/policy.wasm policies/default.wasm

# Clean up
rm policies/bundle.tar.gz policies/data.json
```

### Test Policy Locally

```bash
# Test the policy with sample input
opa eval -d policies/default.rego -i test_input.json "data.cmo.elg.decision"
```

**Example test_input.json:**

```json
{
  "phase": "pre",
  "graph": {
    "id": "test-graph",
    "version": "1.0.0"
  },
  "execution": {
    "traceId": "test-trace-12345",
    "stepIndex": 0,
    "nodeId": "entry"
  },
  "data": {
    "request": "analyze"
  }
}
```

## Policy Rules

### Default Policy (`default.rego`)

The default policy enforces:

1. **Trace ID Validation**
   - Must be present
   - Must be at least 10 characters

2. **Step Limits**
   - Maximum 1000 steps per execution
   - Dev version graphs limited to 100 steps

3. **Input Validation**
   - Pre-execution: input data cannot be null
   - Post-execution: critical errors are blocked

4. **Graph Blocking**
   - Can explicitly block specific graph IDs

### Policy Decision Structure

The policy returns a structured decision:

```json
{
  "allowed": true,
  "reason": "",
  "metadata": {
    "policy_version": "1.0.0",
    "evaluated_at": 1704067200000000000
  }
}
```

## Custom Policies

### Creating a Custom Policy

1. Write your policy in Rego:

```rego
package cmo.elg

# Your custom rules here
deny[msg] {
  input.graph.id == "sensitive-graph"
  not input.user.role == "admin"
  msg := "Only admins can run sensitive graphs"
}

allow {
  count(deny) == 0
}

decision = {
  "allowed": allow,
  "reason": concat(", ", deny)
}
```

2. Compile to WASM:

```bash
opa build -t wasm -e cmo/elg/decision policies/custom.rego -o policies/custom-bundle.tar.gz
tar -xzf policies/custom-bundle.tar.gz
mv policy.wasm policies/custom.wasm
```

3. Configure CMO to use your policy:

```bash
export OPA_ENABLED=true
export OPA_POLICY_PATH=./policies/custom.wasm
```

## Integration with CMO Runtime

The runtime loads and enforces policies at two points:

1. **Pre-execution Gate**: Before executing each node
   ```typescript
   await policyEvaluator.checkPreExecution(
     graphId,
     graphVersion,
     traceId,
     stepIndex,
     nodeId,
     input
   );
   ```

2. **Post-execution Gate**: After executing each node
   ```typescript
   await policyEvaluator.checkPostExecution(
     graphId,
     graphVersion,
     traceId,
     stepIndex,
     nodeId,
     result
   );
   ```

If a policy denies execution, the runtime throws an error and marks the run as failed.

## Disabling Policies

Policies can be disabled via configuration:

```bash
export OPA_ENABLED=false
```

When disabled, all policy checks return `{ allowed: true }`.

## Testing Policies

Write unit tests for your policies:

```bash
# Create test file: policies/default_test.rego
package cmo.elg

test_allow_valid_input {
  decision.allowed with input as {
    "phase": "pre",
    "graph": {"id": "test", "version": "1.0.0"},
    "execution": {"traceId": "trace-12345", "stepIndex": 0, "nodeId": "n1"},
    "data": {"request": "test"}
  }
}

test_deny_blocked_graph {
  not decision.allowed with input as {
    "phase": "pre",
    "graph": {"id": "blocked-graph", "version": "1.0.0"},
    "execution": {"traceId": "trace-12345", "stepIndex": 0, "nodeId": "n1"},
    "data": {}
  }
}
```

Run tests:

```bash
opa test policies/
```

## Resources

- [OPA Documentation](https://www.openpolicyagent.org/docs/latest/)
- [Rego Language Reference](https://www.openpolicyagent.org/docs/latest/policy-language/)
- [WASM Compilation Guide](https://www.openpolicyagent.org/docs/latest/wasm/)
