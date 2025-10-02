/**
 * A2A Routing Layer
 * Publish/subscribe helpers with topic validation, security, and transport integration
 */

import type { TransportAdapter, MessageHandler } from '../../elg/transport/index.js';
import type { A2AEnvelope, EnvelopeMeta } from '../envelopes/index.js';
import { validateEnvelopeOrThrow } from '../envelopes/index.js';
import { buildTopic, parseTopic, generatePartitionKey } from './naming.js';
import type { SigningConfig } from '../security/signer.js';
import { createSignedEnvelope, generateMessageId } from '../security/signer.js';

/**
 * Publishing options
 */
export interface PublishOptions {
  /**
   * Transport adapter to publish through
   */
  transport: TransportAdapter;

  /**
   * Signing configuration (optional)
   */
  signing?: SigningConfig;

  /**
   * Whether to validate envelope before publishing (default: true)
   */
  validate?: boolean;

  /**
   * Custom partition key (optional, overrides default tenant:project:trace)
   */
  partitionKey?: string;
}

/**
 * Subscription options
 */
export interface SubscribeOptions {
  /**
   * Transport adapter to subscribe through
   */
  transport: TransportAdapter;

  /**
   * Whether to validate envelopes on receive (default: true)
   */
  validate?: boolean;

  /**
   * Consumer group name (optional, for load balancing)
   */
  consumerGroup?: string;

  /**
   * Consumer ID (optional, for consumer identification)
   */
  consumerId?: string;
}

/**
 * Publish result
 */
export interface PublishResult {
  /**
   * Message ID
   */
  messageId: string;

  /**
   * Topic published to
   */
  topic: string;

  /**
   * Timestamp when published
   */
  timestamp: string;
}

/**
 * A2A message handler (receives validated envelopes)
 */
export type A2AMessageHandler = (envelope: A2AEnvelope) => Promise<void>;

/**
 * Publish an A2A envelope to the appropriate topic
 *
 * Topic is derived from envelope meta (tenant/project/type)
 * No free-form topics allowed - enforced by envelope structure
 *
 * @param envelope - Envelope to publish
 * @param options - Publishing options
 * @returns Publish result
 */
export async function publish(
  envelope: A2AEnvelope,
  options: PublishOptions
): Promise<PublishResult> {
  // Validate envelope structure (if enabled)
  if (options.validate !== false) {
    validateEnvelopeOrThrow(envelope);
  }

  // Derive topic from envelope recipients
  const topic = deriveTopicFromEnvelope(envelope);

  // Generate partition key for ordered delivery
  const partitionKey =
    options.partitionKey ||
    generatePartitionKey(envelope.meta.tenant, envelope.meta.project, envelope.meta.trace_id);

  // Serialize envelope to bytes
  const message = Buffer.from(JSON.stringify(envelope), 'utf-8');

  // Publish through transport
  await options.transport.publish(topic, message, { partitionKey });

  return {
    messageId: envelope.meta.message_id,
    topic,
    timestamp: envelope.meta.ts,
  };
}

/**
 * Subscribe to A2A messages on a topic pattern
 *
 * @param topicPattern - Topic pattern to subscribe to (supports wildcards)
 * @param handler - Message handler
 * @param options - Subscription options
 */
export async function subscribe(
  topicPattern: string,
  handler: A2AMessageHandler,
  options: SubscribeOptions
): Promise<void> {
  // Validate topic pattern
  const parseResult = parseTopic(topicPattern.replace(/\*/g, 'wildcard'));
  if (!parseResult.valid && !topicPattern.includes('*')) {
    throw new Error(`Invalid topic pattern: ${parseResult.error}`);
  }

  // Create transport message handler that wraps A2A handler
  const transportHandler: MessageHandler = async (message, ack) => {
    try {
      // Deserialize envelope
      const json = message.payload.toString('utf-8');
      const envelope = JSON.parse(json) as A2AEnvelope;

      // Validate envelope (if enabled)
      if (options.validate !== false) {
        validateEnvelopeOrThrow(envelope);
      }

      // Call A2A handler
      await handler(envelope);

      // Acknowledge successful processing
      await ack.ack();
    } catch (error) {
      // Negative acknowledgment on error
      await ack.nack({
        reason: (error as Error).message,
        requeue: false, // Don't requeue on validation errors
      });
    }
  };

  // Subscribe through transport
  await options.transport.subscribe(topicPattern, transportHandler, {
    group: options.consumerGroup,
    consumer: options.consumerId,
  });
}

/**
 * Create and publish an A2A envelope
 *
 * Convenience method for creating and publishing in one step
 *
 * @param meta - Envelope metadata (without message_id, ts, signature, idempotency_key)
 * @param payload - Envelope payload
 * @param options - Publishing options
 * @returns Publish result
 */
export async function createAndPublish<T>(
  meta: Omit<EnvelopeMeta, 'message_id' | 'ts' | 'signature' | 'idempotency_key'>,
  payload: T,
  options: PublishOptions
): Promise<PublishResult> {
  // Generate message_id and timestamp
  const message_id = generateMessageId();
  const ts = new Date().toISOString();

  const fullMeta: EnvelopeMeta = {
    ...meta,
    message_id,
    ts,
  } as EnvelopeMeta;

  // Create envelope (with signing if configured)
  let envelope: A2AEnvelope;

  if (options.signing) {
    envelope = createSignedEnvelope(fullMeta, payload, options.signing);
  } else {
    envelope = {
      meta: fullMeta,
      payload,
    };
  }

  // Publish
  return publish(envelope, options);
}

/**
 * Derive topic from envelope recipients
 *
 * If envelope has a single topic recipient, use that topic.
 * If envelope has agent recipients, build topic from agent type/id.
 * If envelope has multiple recipients, throw error (not supported for topic-based routing).
 *
 * @param envelope - Envelope to derive topic from
 * @returns Topic name
 */
function deriveTopicFromEnvelope(envelope: A2AEnvelope): string {
  const recipients = envelope.meta.to;

  if (recipients.length === 0) {
    throw new Error('Envelope must have at least one recipient');
  }

  if (recipients.length > 1) {
    throw new Error('Topic-based routing only supports single recipient');
  }

  const recipient = recipients[0]!;

  // Check if recipient is a topic
  if ('type' in recipient && recipient.type === 'topic') {
    return recipient.name;
  }

  // Check if recipient is an agent
  if ('id' in recipient && 'type' in recipient) {
    // Build topic from agent info and envelope type
    const domain = mapAgentTypeToTopicDomain(recipient.type);
    const entity = recipient.id;
    const verb = mapEnvelopeTypeToVerb(envelope.meta.type);

    const topicResult = buildTopic({
      tenant: envelope.meta.tenant,
      project: envelope.meta.project,
      domain,
      entity,
      verb,
    });

    return topicResult.topic;
  }

  throw new Error('Recipient must be either a topic or an agent');
}

/**
 * Map agent type to topic domain
 */
function mapAgentTypeToTopicDomain(agentType: string): string {
  switch (agentType) {
    case 'specialist':
      return 'specialists';
    case 'cmo':
      return 'cmo';
    case 'ci-gate':
      return 'ci';
    case 'dashboard':
      return 'dashboard';
    case 'mcp-server':
      return 'mcp';
    case 'system':
      return 'system';
    default:
      return 'agents'; // fallback
  }
}

/**
 * Map envelope type to topic verb
 */
function mapEnvelopeTypeToVerb(envelopeType: string): string {
  switch (envelopeType) {
    case 'TaskRequest':
    case 'SpecialistInvocationRequest':
    case 'ContextRequest':
      return 'invoke';

    case 'TaskResult':
    case 'SpecialistResult':
    case 'ContextResult':
      return 'result';

    case 'RetryDirective':
      return 'retry';

    case 'DecisionNotice':
      return 'decision';

    case 'MemoryEvent':
      return 'event';

    default:
      return 'message'; // fallback
  }
}

/**
 * Topic-based request/response pattern
 */
export class RequestResponseHandler {
  private pendingRequests = new Map<
    string,
    {
      resolve: (response: A2AEnvelope) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  >();

  constructor(
    private transport: TransportAdapter,
    private agentId: string,
    private tenant: string,
    private project: string
  ) {}

  /**
   * Send request and wait for response
   *
   * @param request - Request envelope
   * @param options - Publishing options
   * @param timeoutMs - Timeout in milliseconds (default: 30000)
   * @returns Response envelope
   */
  async sendRequest(
    request: A2AEnvelope,
    options: PublishOptions,
    timeoutMs: number = 30000
  ): Promise<A2AEnvelope> {
    // Ensure request has correlation_id
    if (!request.meta.correlation_id) {
      request.meta.correlation_id = request.meta.message_id;
    }

    // Ensure request has reply_to topic
    if (!request.meta.reply_to) {
      const replyTopic = buildTopic({
        tenant: this.tenant,
        project: this.project,
        domain: 'agents',
        entity: this.agentId,
        verb: 'reply',
      }).topic;

      request.meta.reply_to = replyTopic;
    }

    // Create promise for response
    const responsePromise = new Promise<A2AEnvelope>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.meta.correlation_id!);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(request.meta.correlation_id!, { resolve, reject, timeout });
    });

    // Publish request
    await publish(request, options);

    // Wait for response
    return responsePromise;
  }

  /**
   * Handle incoming response
   *
   * Call this from your reply topic subscription handler
   *
   * @param response - Response envelope
   */
  handleResponse(response: A2AEnvelope): void {
    const correlationId = response.meta.correlation_id;

    if (!correlationId) {
      // No correlation ID, can't match to request
      return;
    }

    const pending = this.pendingRequests.get(correlationId);

    if (!pending) {
      // No pending request for this correlation ID
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);

    // Remove from pending
    this.pendingRequests.delete(correlationId);

    // Resolve promise
    pending.resolve(response);
  }

  /**
   * Cancel all pending requests
   */
  cancelAll(): void {
    for (const [correlationId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Request cancelled'));
    }

    this.pendingRequests.clear();
  }
}
