import {
  trace,
  Tracer,
  SpanStatusCode,
  context,
  SpanKind,
} from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { settings } from '../config/settings';

let _tracer: Tracer | null = null;

export function configureTracing(serviceName = 'enterprise-agent'): void {
  const resource = new Resource({ [SEMRESATTRS_SERVICE_NAME]: serviceName });
  const provider = new NodeTracerProvider({ resource });

  // Try OTLP; fall back to console in dev / CI
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
    const exporter = new OTLPTraceExporter({ url: settings.otlpEndpoint });
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
  } catch {
    provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  provider.register();
  _tracer = trace.getTracer(serviceName);
}

export function getTracer(): Tracer {
  if (!_tracer) {
    configureTracing();
  }
  return _tracer!;
}

export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
  kind?: SpanKind;
}

/**
 * Run `fn` inside a new OTel span, recording errors automatically.
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  opts: SpanOptions = {},
): Promise<T> {
  const span = getTracer().startSpan(name, {
    kind: opts.kind ?? SpanKind.INTERNAL,
    attributes: opts.attributes,
  });
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
