/**
 * OpenTelemetry Setup
 * Provides tracing, metrics, and logging for ELG Runtime
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import * as api from '@opentelemetry/api';

/**
 * OTEL Configuration
 */
export interface OTELConfig {
  /**
   * Service name
   */
  serviceName: string;

  /**
   * Service version
   */
  serviceVersion: string;

  /**
   * Enable OpenTelemetry
   */
  enabled: boolean;

  /**
   * OTLP endpoint
   */
  otlpEndpoint?: string;

  /**
   * Trace sample rate (0.0 - 1.0)
   */
  sampleRate?: number;

  /**
   * Additional resource attributes
   */
  resourceAttributes?: Record<string, string>;
}

/**
 * OpenTelemetry SDK instance
 */
let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry
 */
export function initializeOTEL(config: OTELConfig): NodeSDK | null {
  if (!config.enabled) {
    console.log('OpenTelemetry disabled');
    return null;
  }

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
    ...config.resourceAttributes,
  });

  const traceExporter = new OTLPTraceExporter({
    url: config.otlpEndpoint || 'http://localhost:4318/v1/traces',
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false, // Disable FS instrumentation (too noisy)
        },
      }),
    ],
  });

  sdk.start();
  console.log('OpenTelemetry initialized:', {
    serviceName: config.serviceName,
    otlpEndpoint: config.otlpEndpoint || 'http://localhost:4318/v1/traces',
  });

  return sdk;
}

/**
 * Shutdown OpenTelemetry
 */
export async function shutdownOTEL(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    console.log('OpenTelemetry shutdown');
  }
}

/**
 * Get tracer
 */
export function getTracer(name: string = 'elg-runtime'): api.Tracer {
  return api.trace.getTracer(name);
}

/**
 * Create span for node execution
 */
export function createNodeSpan(
  traceId: string,
  stepIndex: number,
  nodeId: string,
  tracer?: api.Tracer
): api.Span {
  const t = tracer || getTracer();

  const span = t.startSpan(`node.${nodeId}`, {
    attributes: {
      'elg.trace_id': traceId,
      'elg.step_index': stepIndex,
      'elg.node_id': nodeId,
    },
  });

  return span;
}

/**
 * Create span for activity
 */
export function createActivitySpan(
  traceId: string,
  stepIndex: number,
  activityType: string,
  tracer?: api.Tracer
): api.Span {
  const t = tracer || getTracer();

  const span = t.startSpan(`activity.${activityType}`, {
    attributes: {
      'elg.trace_id': traceId,
      'elg.step_index': stepIndex,
      'elg.activity_type': activityType,
    },
  });

  return span;
}

/**
 * Add error to span
 */
export function recordSpanError(span: api.Span, error: Error): void {
  span.recordException(error);
  span.setStatus({ code: api.SpanStatusCode.ERROR, message: error.message });
}

/**
 * Add event to span
 */
export function addSpanEvent(
  span: api.Span,
  name: string,
  attributes?: api.Attributes
): void {
  span.addEvent(name, attributes);
}
