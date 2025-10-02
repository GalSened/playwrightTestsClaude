# Slices Policy for CMO/ELG
# Enforces data boundary and scope constraints for specialist interactions

package cmo.slices

# Import common helpers
import future.keywords

# Main decision point
default allow = false

# Allow by default if no deny rules match
allow {
  count(deny) == 0
}

# =============================================================================
# Deny Rules - Data Boundary Enforcement
# =============================================================================

# Rule: Deny sending selector history outside the healer specialist
deny[msg] {
  input.phase == "pre"
  input.data.payload.sliceFields
  "selectorHistory" in input.data.payload.sliceFields
  input.data.meta.targetSpecialist != "healer"
  msg := sprintf(
    "selector_history_leak: Selector history can only be sent to healer specialist, not %s",
    [input.data.meta.targetSpecialist]
  )
}

# Rule: Deny write scopes outside healing/* namespace
deny[msg] {
  input.phase == "pre"
  input.data.payload.writeScope
  not startswith(input.data.payload.writeScope, "healing/")
  msg := sprintf(
    "invalid_write_scope: Write scope '%s' must start with 'healing/'",
    [input.data.payload.writeScope]
  )
}

# Rule: Deny if trying to access PII fields without proper role
deny[msg] {
  input.phase == "pre"
  input.data.payload.sliceFields
  pii_field := input.data.payload.sliceFields[_]
  pii_field in {"email", "phone", "ssn", "creditCard"}
  not input.execution.role == "admin"
  msg := sprintf(
    "pii_access_denied: Field '%s' requires admin role, current role: %s",
    [pii_field, input.execution.role]
  )
}

# Rule: Deny if payload size exceeds limit
deny[msg] {
  input.phase == "pre"
  input.data.payload.size
  input.data.payload.size > 10485760  # 10MB
  msg := sprintf(
    "payload_too_large: Payload size %d bytes exceeds 10MB limit",
    [input.data.payload.size]
  )
}

# Rule: Deny if target specialist is not registered
deny[msg] {
  input.phase == "pre"
  input.data.meta.targetSpecialist
  not specialist_is_registered(input.data.meta.targetSpecialist)
  msg := sprintf(
    "unregistered_specialist: Specialist '%s' is not registered",
    [input.data.meta.targetSpecialist]
  )
}

# =============================================================================
# Post-Execution Validation
# =============================================================================

# Rule: Deny if result contains error but status is success
deny[msg] {
  input.phase == "post"
  input.data.result.status == "success"
  input.data.result.error
  msg := "inconsistent_result: Result marked as success but contains error"
}

# Rule: Deny if execution exceeded time budget
deny[msg] {
  input.phase == "post"
  input.data.result.durationMs
  input.data.result.durationMs > 30000  # 30 seconds
  msg := sprintf(
    "execution_timeout: Execution took %dms, exceeds 30s limit",
    [input.data.result.durationMs]
  )
}

# =============================================================================
# Helper Functions
# =============================================================================

# Check if specialist is in the registered list
specialist_is_registered(name) {
  registered := {"healer", "analyzer", "optimizer", "validator", "executor"}
  name in registered
}

# =============================================================================
# Structured Decision Output
# =============================================================================

decision = {
  "allowed": allow,
  "reason": reason_message,
  "denials": deny,
  "metadata": {
    "policy": "slices",
    "version": "1.0.0",
    "evaluated_at": time.now_ns(),
    "phase": input.phase,
    "specialist": object.get(object.get(input.data, "meta", {}), "targetSpecialist", "unknown"),
  }
}

reason_message = concat("; ", deny) {
  count(deny) > 0
} else = "allowed" {
  true
}
