/**
 * Fallback Redaction Rules
 *
 * Local policy enforcement when OPA unavailable
 */

import type { OPADecision, SpecialistMetadata } from '../types.js';
import type { H4RResult } from '../../h4r/types.js';

/**
 * Apply fallback redaction rules
 */
export function applyFallbackRules(
  specialist: SpecialistMetadata,
  item: H4RResult
): OPADecision {
  const { metadata } = item;

  // Rule 1: Sensitivity threshold
  const sensitivity = metadata.sensitivity ?? 0;
  if (sensitivity > 0.7) {
    const specialistLevel = specialist.securityLevel || 'public';

    if (
      specialistLevel === 'public' ||
      specialistLevel === 'internal'
    ) {
      return {
        allow: false,
        reason: 'Sensitivity too high for specialist security level',
      };
    }
  }

  // Rule 2: Redact sensitive fields
  const sensitiveFields: string[] = [];

  // Check for PII patterns in metadata
  if (metadata.containsPII || metadata.hasPersonalData) {
    sensitiveFields.push('$.content.personalData');
  }

  // Check for credentials
  if (metadata.hasCredentials || metadata.containsSecrets) {
    return {
      allow: false,
      reason: 'Contains credentials or secrets',
    };
  }

  // Rule 3: Trust threshold
  const trust = metadata.trust ?? 0.7;
  if (trust < 0.3) {
    return {
      allow: false,
      reason: 'Source trust below threshold',
    };
  }

  // Rule 4: Group-based access
  if (metadata.restrictedToGroups && Array.isArray(metadata.restrictedToGroups)) {
    const authorizedGroups = specialist.authorizedGroups || [];
    const hasAccess = (metadata.restrictedToGroups as string[]).some((g) =>
      authorizedGroups.includes(g)
    );

    if (!hasAccess) {
      return {
        allow: false,
        reason: 'Not authorized for restricted groups',
      };
    }
  }

  // Allow with optional redaction
  return {
    allow: true,
    redact: sensitiveFields.length > 0,
    redactedFields: sensitiveFields,
    reason: 'Fallback rules: allowed',
  };
}

/**
 * Redact content based on JSONPath expressions
 */
export function redactContent(
  content: unknown,
  redactedFields: string[]
): unknown {
  if (redactedFields.length === 0) {
    return content;
  }

  // Simple redaction: deep clone and replace sensitive paths with [REDACTED]
  // Real implementation would use JSONPath library

  const redacted = JSON.parse(JSON.stringify(content));

  // Placeholder: mark as redacted
  if (typeof redacted === 'object' && redacted !== null) {
    (redacted as Record<string, unknown>)._redacted = true;
    (redacted as Record<string, unknown>)._redactedFields = redactedFields;
  }

  return redacted;
}
