# A2A Wire Gates Test Policies
# OPA policies for testing pre-send and post-receive enforcement

package a2a.wire_gates

import future.keywords.if
import future.keywords.in

# Default decision
default allow = false

# Allow all traffic (for permissive testing)
allow_all if {
	input.operation
}

# Tenant-based access control
allow_tenant(allowed_tenant) if {
	input.envelope.meta.tenant == allowed_tenant
}

# Project-based access control
allow_project(allowed_project) if {
	input.envelope.meta.project == allowed_project
}

# Message type allowlist
allow_message_type(allowed_types) if {
	input.envelope.meta.type in allowed_types
}

# Priority-based filtering
allow_priority(min_priority) if {
	priority := object.get(input.envelope.meta, "priority", "normal")
	priority_values := {"low": 0, "normal": 1, "high": 2}
	priority_values[priority] >= priority_values[min_priority]
}

# Tenant + Project combination
allow_tenant_project(tenant, project) if {
	input.envelope.meta.tenant == tenant
	input.envelope.meta.project == project
}

# Pre-send policy (publishing)
allow if {
	input.operation == "publish"
	pre_send_checks
}

pre_send_checks if {
	# Example: Allow only wesign tenant
	input.envelope.meta.tenant == "wesign"

	# Ensure required fields are present
	input.envelope.meta.message_id
	input.envelope.meta.trace_id
	input.envelope.meta.from
	count(input.envelope.meta.to) > 0
}

# Post-receive policy (subscribing)
allow if {
	input.operation == "receive"
	post_receive_checks
}

post_receive_checks if {
	# Example: Allow TaskRequest and TaskResult
	input.envelope.meta.type in ["TaskRequest", "TaskResult", "SpecialistInvocationRequest", "SpecialistInvocationResult"]

	# Verify tenant matches expected
	input.envelope.meta.tenant in ["wesign", "test-tenant"]
}

# Deny with reason
deny[msg] if {
	not input.envelope.meta.tenant
	msg := "Missing required field: tenant"
}

deny[msg] if {
	not input.envelope.meta.project
	msg := "Missing required field: project"
}

deny[msg] if {
	input.envelope.meta.tenant == "blocked-tenant"
	msg := "Tenant 'blocked-tenant' is not allowed"
}

# Composite policy example: Tenant + Type + Priority
allow_composite(tenant, allowed_types, min_priority) if {
	allow_tenant(tenant)
	allow_message_type(allowed_types)
	allow_priority(min_priority)
}

# Violations for detailed reporting
violations[violation] if {
	not input.envelope.meta.tenant
	violation := {
		"field": "tenant",
		"message": "Tenant field is required",
		"severity": "error",
	}
}

violations[violation] if {
	not input.envelope.meta.project
	violation := {
		"field": "project",
		"message": "Project field is required",
		"severity": "error",
	}
}

violations[violation] if {
	count(input.envelope.meta.to) == 0
	violation := {
		"field": "to",
		"message": "At least one recipient is required",
		"severity": "error",
	}
}

violations[violation] if {
	input.envelope.meta.tenant == "blocked-tenant"
	violation := {
		"field": "tenant",
		"message": "Tenant is blocked",
		"severity": "critical",
	}
}

# Rate limiting policy (example)
allow_rate_limit(max_per_second) if {
	# In production, this would check against a state store
	# For tests, we just verify the structure
	max_per_second > 0
	input.envelope.meta.tenant
}

# Capability-based access (JWT scope matching)
allow_with_capability(required_scope) if {
	input.context.jwt_claims
	some scope in input.context.jwt_claims.scopes
	scope_matches(scope, required_scope)
}

scope_matches(scope, required) if {
	scope == "*"
}

scope_matches(scope, required) if {
	scope == required
}

scope_matches(scope, required) if {
	# Wildcard matching: "context.read:*" matches "context.read:test_results"
	parts := split(scope, ":")
	required_parts := split(required, ":")
	parts[0] == required_parts[0]
	parts[1] == "*"
}

# Time-based policy (business hours only)
allow_business_hours if {
	# Parse timestamp from envelope
	ts := input.envelope.meta.ts
	# In production, would check actual time constraints
	# For tests, just verify timestamp exists
	ts != ""
}

# Payload size limit
allow_payload_size(max_bytes) if {
	# Approximate payload size
	payload_str := json.marshal(input.envelope.payload)
	count(payload_str) <= max_bytes
}

# Complete decision with reason
decision = {"allow": allow, "reason": reason, "violations": violations}

reason = "All checks passed" if {
	allow
	count(violations) == 0
}

reason = concat("; ", deny) if {
	not allow
	count(deny) > 0
}

reason = "Policy checks failed" if {
	not allow
	count(deny) == 0
}
