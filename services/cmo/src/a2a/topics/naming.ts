/**
 * Topic Naming Conventions
 * Enforces topic naming patterns for A2A messaging
 *
 * Convention: qa.<tenant>.<project>.<domain>.<entity>.<verb>
 *
 * Examples:
 * - qa.wesign.frontend.specialists.playwright_healer.invoke
 * - qa.wesign.shared.cmo.decisions
 * - qa.wesign.shared.registry.heartbeats
 */

/**
 * Topic components
 */
export interface TopicComponents {
  /**
   * Tenant identifier (lowercase alphanumeric, hyphens, underscores)
   */
  tenant: string;

  /**
   * Project identifier
   */
  project: string;

  /**
   * Domain (e.g., 'specialists', 'cmo', 'registry', 'ci', 'dashboard')
   */
  domain: string;

  /**
   * Entity (optional, e.g., 'playwright_healer', 'decisions', 'heartbeats')
   */
  entity?: string;

  /**
   * Verb (optional, e.g., 'invoke', 'result', 'update')
   */
  verb?: string;
}

/**
 * Topic builder result
 */
export interface TopicBuildResult {
  /**
   * Full topic name
   */
  topic: string;

  /**
   * Components used to build topic
   */
  components: TopicComponents;

  /**
   * Partition key for ordered delivery
   */
  partitionKey: string;
}

/**
 * Topic parse result
 */
export interface TopicParseResult {
  /**
   * Whether parsing succeeded
   */
  valid: boolean;

  /**
   * Parsed components (if valid)
   */
  components?: TopicComponents;

  /**
   * Error message (if invalid)
   */
  error?: string;
}

/**
 * Topic naming patterns
 */
export const TOPIC_PATTERNS = {
  /**
   * Base prefix (all topics start with this)
   */
  PREFIX: 'qa',

  /**
   * Component separator
   */
  SEPARATOR: '.',

  /**
   * Wildcard for subscriptions
   */
  WILDCARD: '*',

  /**
   * Valid component pattern (lowercase alphanumeric, hyphens, underscores, periods)
   */
  COMPONENT_PATTERN: /^[a-z0-9_.-]+$/,

  /**
   * Tenant/project pattern (stricter: no periods)
   */
  ID_PATTERN: /^[a-z0-9_-]+$/,
};

/**
 * Well-known domains
 */
export enum TopicDomain {
  SPECIALISTS = 'specialists',
  CMO = 'cmo',
  REGISTRY = 'registry',
  CI = 'ci',
  DASHBOARD = 'dashboard',
  MEMORY = 'memory',
  CONTEXT = 'context',
  SYSTEM = 'system',
}

/**
 * Well-known verbs
 */
export enum TopicVerb {
  INVOKE = 'invoke',
  RESULT = 'result',
  REQUEST = 'request',
  RESPONSE = 'response',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  HEARTBEAT = 'heartbeat',
  EVENT = 'event',
}

/**
 * Build topic name from components
 *
 * @param components - Topic components
 * @returns Topic build result
 */
export function buildTopic(components: TopicComponents): TopicBuildResult {
  // Validate components
  validateComponents(components);

  // Build topic parts
  const parts = [
    TOPIC_PATTERNS.PREFIX,
    components.tenant,
    components.project,
    components.domain,
  ];

  if (components.entity) {
    parts.push(components.entity);
  }

  if (components.verb) {
    parts.push(components.verb);
  }

  const topic = parts.join(TOPIC_PATTERNS.SEPARATOR);

  // Generate partition key (for ordered delivery within tenant:project:trace)
  const partitionKey = generatePartitionKey(components.tenant, components.project);

  return {
    topic,
    components,
    partitionKey,
  };
}

/**
 * Parse topic name into components
 *
 * @param topic - Topic name to parse
 * @returns Parse result
 */
export function parseTopic(topic: string): TopicParseResult {
  const parts = topic.split(TOPIC_PATTERNS.SEPARATOR);

  // Minimum parts: qa.<tenant>.<project>.<domain> = 4
  if (parts.length < 4) {
    return {
      valid: false,
      error: `Topic must have at least 4 components (qa.tenant.project.domain), got ${parts.length}`,
    };
  }

  // Check prefix
  if (parts[0] !== TOPIC_PATTERNS.PREFIX) {
    return {
      valid: false,
      error: `Topic must start with '${TOPIC_PATTERNS.PREFIX}', got '${parts[0]}'`,
    };
  }

  const tenant = parts[1]!;
  const project = parts[2]!;
  const domain = parts[3]!;
  const entity = parts[4]; // optional
  const verb = parts[5]; // optional

  // Validate tenant and project
  if (!TOPIC_PATTERNS.ID_PATTERN.test(tenant)) {
    return {
      valid: false,
      error: `Tenant '${tenant}' must match pattern ${TOPIC_PATTERNS.ID_PATTERN}`,
    };
  }

  if (!TOPIC_PATTERNS.ID_PATTERN.test(project)) {
    return {
      valid: false,
      error: `Project '${project}' must match pattern ${TOPIC_PATTERNS.ID_PATTERN}`,
    };
  }

  // Validate domain
  if (!TOPIC_PATTERNS.COMPONENT_PATTERN.test(domain)) {
    return {
      valid: false,
      error: `Domain '${domain}' must match pattern ${TOPIC_PATTERNS.COMPONENT_PATTERN}`,
    };
  }

  // Validate entity (if present)
  if (entity && !TOPIC_PATTERNS.COMPONENT_PATTERN.test(entity)) {
    return {
      valid: false,
      error: `Entity '${entity}' must match pattern ${TOPIC_PATTERNS.COMPONENT_PATTERN}`,
    };
  }

  // Validate verb (if present)
  if (verb && !TOPIC_PATTERNS.COMPONENT_PATTERN.test(verb)) {
    return {
      valid: false,
      error: `Verb '${verb}' must match pattern ${TOPIC_PATTERNS.COMPONENT_PATTERN}`,
    };
  }

  return {
    valid: true,
    components: {
      tenant,
      project,
      domain,
      entity,
      verb,
    },
  };
}

/**
 * Validate topic components
 *
 * @param components - Components to validate
 * @throws Error if components are invalid
 */
export function validateComponents(components: TopicComponents): void {
  // Validate tenant
  if (!TOPIC_PATTERNS.ID_PATTERN.test(components.tenant)) {
    throw new Error(
      `Tenant '${components.tenant}' must match pattern ${TOPIC_PATTERNS.ID_PATTERN}`
    );
  }

  // Validate project
  if (!TOPIC_PATTERNS.ID_PATTERN.test(components.project)) {
    throw new Error(
      `Project '${components.project}' must match pattern ${TOPIC_PATTERNS.ID_PATTERN}`
    );
  }

  // Validate domain
  if (!TOPIC_PATTERNS.COMPONENT_PATTERN.test(components.domain)) {
    throw new Error(
      `Domain '${components.domain}' must match pattern ${TOPIC_PATTERNS.COMPONENT_PATTERN}`
    );
  }

  // Validate entity (if present)
  if (components.entity && !TOPIC_PATTERNS.COMPONENT_PATTERN.test(components.entity)) {
    throw new Error(
      `Entity '${components.entity}' must match pattern ${TOPIC_PATTERNS.COMPONENT_PATTERN}`
    );
  }

  // Validate verb (if present)
  if (components.verb && !TOPIC_PATTERNS.COMPONENT_PATTERN.test(components.verb)) {
    throw new Error(
      `Verb '${components.verb}' must match pattern ${TOPIC_PATTERNS.COMPONENT_PATTERN}`
    );
  }
}

/**
 * Generate partition key for ordered delivery
 *
 * Partition key: hash(tenant:project:trace_id)
 * This ensures all messages for a trace go to the same partition
 *
 * @param tenant - Tenant identifier
 * @param project - Project identifier
 * @param traceId - Trace ID (optional)
 * @returns Partition key
 */
export function generatePartitionKey(tenant: string, project: string, traceId?: string): string {
  if (traceId) {
    return `${tenant}:${project}:${traceId}`;
  }

  return `${tenant}:${project}`;
}

/**
 * Check if topic matches pattern (supports wildcards)
 *
 * Examples:
 * - matchesTopic('qa.wesign.frontend.specialists.healer.invoke', 'qa.wesign.frontend.*') → true
 * - matchesTopic('qa.wesign.frontend.specialists.healer.invoke', 'qa.wesign.*.specialists.*.*') → true
 *
 * @param topic - Topic to check
 * @param pattern - Pattern to match (supports * wildcard)
 * @returns True if topic matches pattern
 */
export function matchesTopic(topic: string, pattern: string): boolean {
  // Exact match
  if (topic === pattern) {
    return true;
  }

  // Convert pattern to regex
  // Replace '.' with '\.' and '*' with '.*'
  const regexPattern = pattern
    .split(TOPIC_PATTERNS.SEPARATOR)
    .map((part) => (part === TOPIC_PATTERNS.WILDCARD ? '.*' : part.replace(/\./g, '\\.')))
    .join('\\.');

  const regex = new RegExp(`^${regexPattern}$`);

  return regex.test(topic);
}

/**
 * Common topic builders for convenience
 */
export const TopicBuilders = {
  /**
   * Specialist invocation topic
   */
  specialistInvoke(tenant: string, project: string, specialistId: string): string {
    return buildTopic({
      tenant,
      project,
      domain: TopicDomain.SPECIALISTS,
      entity: specialistId,
      verb: TopicVerb.INVOKE,
    }).topic;
  },

  /**
   * Specialist result topic
   */
  specialistResult(tenant: string, project: string, specialistId: string): string {
    return buildTopic({
      tenant,
      project,
      domain: TopicDomain.SPECIALISTS,
      entity: specialistId,
      verb: TopicVerb.RESULT,
    }).topic;
  },

  /**
   * CMO decisions topic
   */
  cmoDecisions(tenant: string, project: string): string {
    return buildTopic({
      tenant,
      project,
      domain: TopicDomain.CMO,
      entity: 'decisions',
    }).topic;
  },

  /**
   * Registry heartbeats topic
   */
  registryHeartbeats(tenant: string, project: string): string {
    return buildTopic({
      tenant,
      project,
      domain: TopicDomain.REGISTRY,
      entity: 'heartbeats',
    }).topic;
  },

  /**
   * Memory events topic
   */
  memoryEvents(tenant: string, project: string): string {
    return buildTopic({
      tenant,
      project,
      domain: TopicDomain.MEMORY,
      entity: 'events',
    }).topic;
  },

  /**
   * Context requests topic
   */
  contextRequests(tenant: string, project: string): string {
    return buildTopic({
      tenant,
      project,
      domain: TopicDomain.CONTEXT,
      entity: 'requests',
    }).topic;
  },

  /**
   * Context results topic
   */
  contextResults(tenant: string, project: string): string {
    return buildTopic({
      tenant,
      project,
      domain: TopicDomain.CONTEXT,
      entity: 'results',
    }).topic;
  },
};
