# Default OPA Policy for CMO/ELG
# Enforces basic security and operational constraints

package cmo.elg

# Main decision point
default allow = true

# Deny if graph execution is explicitly blocked
deny[msg] {
  input.graph.id == "blocked-graph"
  msg := "Graph is blocked by policy"
}

# Deny if step exceeds maximum allowed index
deny[msg] {
  input.execution.stepIndex > 1000
  msg := "Step index exceeds maximum (1000)"
}

# Deny if trace ID is missing or invalid
deny[msg] {
  not input.execution.traceId
  msg := "Trace ID is required"
}

deny[msg] {
  count(input.execution.traceId) < 10
  msg := "Trace ID must be at least 10 characters"
}

# Pre-execution phase: validate input
deny[msg] {
  input.phase == "pre"
  input.data == null
  msg := "Input data cannot be null in pre-execution"
}

# Post-execution phase: validate result
deny[msg] {
  input.phase == "post"
  input.data.error != null
  input.data.error.code == "CRITICAL"
  msg := "Critical error detected in execution result"
}

# Rate limiting: deny if too many steps in short time
# (This would need actual time-based data from input)
deny[msg] {
  input.execution.stepIndex > 100
  input.graph.version == "dev"
  msg := "Dev version graphs limited to 100 steps"
}

# Allow by default if no deny rules match
allow {
  count(deny) == 0
}

# Return structured decision
decision = {
  "allowed": allow,
  "reason": concat(", ", deny),
  "metadata": {
    "policy_version": "1.0.0",
    "evaluated_at": time.now_ns(),
  }
}
