import { appendFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import type {
  AgentCapabilityScore,
  EvolutionProposal,
  GoalContract,
  RuntimeEvaluation,
  RuntimePlanStep,
  RuntimeToolCall,
} from '../core/agent-runtime.js';

export interface RuntimeRunStartedEvent {
  runId: string;
  timestamp: number;
  goalContract: GoalContract;
}

export interface RuntimePlanStepEvent {
  runId: string;
  timestamp: number;
  step: RuntimePlanStep;
}

export interface RuntimeToolCallEvent {
  runId: string;
  timestamp: number;
  toolCall: RuntimeToolCall;
}

export interface RuntimeEvaluationEvent {
  runId: string;
  timestamp: number;
  evaluation: RuntimeEvaluation;
  capability: AgentCapabilityScore;
}

export interface RuntimeEvolutionProposalEvent {
  runId: string;
  timestamp: number;
  proposal: EvolutionProposal;
}

export type RuntimeTraceEvent =
  | (RuntimeRunStartedEvent & { eventType: 'run_started' })
  | (RuntimePlanStepEvent & { eventType: 'plan_step' })
  | (RuntimeToolCallEvent & { eventType: 'tool_call' })
  | (RuntimeEvaluationEvent & { eventType: 'evaluation' })
  | (RuntimeEvolutionProposalEvent & { eventType: 'evolution_proposal' });

/** Receives Agent Runtime trace lifecycle events without owning execution. */
export interface RuntimeTraceSink {
  readonly name?: string;
  onRunStarted?(event: RuntimeRunStartedEvent): void | Promise<void>;
  onPlanStep?(event: RuntimePlanStepEvent): void | Promise<void>;
  onToolCall?(event: RuntimeToolCallEvent): void | Promise<void>;
  onEvaluation?(event: RuntimeEvaluationEvent): void | Promise<void>;
  onEvolutionProposal?(event: RuntimeEvolutionProposalEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
}

export interface RuntimeTraceSinkEnvOptions {
  env?: Record<string, string | undefined>;
  jsonlPath: string;
}

export interface OtlpRuntimeTraceSinkOptions {
  endpoint?: string;
  headers?: Record<string, string>;
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  fetchImpl?: typeof fetch;
}

export type OtelAttributeValue = string | number | boolean;

export interface RuntimeOtelEvent {
  name: string;
  timeUnixNano: string;
  attributes: Record<string, OtelAttributeValue>;
}

export interface RuntimeOtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'SPAN_KIND_INTERNAL';
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Record<string, OtelAttributeValue>;
  events: RuntimeOtelEvent[];
  status: {
    code: 'STATUS_CODE_UNSET' | 'STATUS_CODE_OK' | 'STATUS_CODE_ERROR';
    message?: string;
  };
}

/** Appends every runtime trace hook as one JSONL record. */
export class JsonlRuntimeTraceSink implements RuntimeTraceSink {
  readonly name = 'jsonl';

  constructor(private readonly filepath: string) {}

  onRunStarted(event: RuntimeRunStartedEvent): void {
    this.write({ eventType: 'run_started', ...event });
  }

  onPlanStep(event: RuntimePlanStepEvent): void {
    this.write({ eventType: 'plan_step', ...event });
  }

  onToolCall(event: RuntimeToolCallEvent): void {
    this.write({ eventType: 'tool_call', ...event });
  }

  onEvaluation(event: RuntimeEvaluationEvent): void {
    this.write({ eventType: 'evaluation', ...event });
  }

  onEvolutionProposal(event: RuntimeEvolutionProposalEvent): void {
    this.write({ eventType: 'evolution_proposal', ...event });
  }

  private write(event: RuntimeTraceEvent): void {
    mkdirSync(dirname(this.filepath), { recursive: true });
    appendFileSync(this.filepath, JSON.stringify(event) + '\n', 'utf-8');
  }
}

/** Converts runtime events into OTLP/HTTP JSON-compatible spans. */
export class OtlpRuntimeTraceSink implements RuntimeTraceSink {
  readonly name = 'otlp';
  private readonly spans: RuntimeOtelSpan[] = [];
  private readonly rootSpanIds = new Map<string, string>();
  private readonly fetchImpl?: typeof fetch;

  constructor(private readonly options: OtlpRuntimeTraceSinkOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  onRunStarted(event: RuntimeRunStartedEvent): void {
    const span = this.createSpan({
      runId: event.runId,
      name: 'superagent.runtime',
      timestamp: event.timestamp,
      attributes: {
        'superagent.run.id': event.runId,
        'superagent.goal.id': event.goalContract.id,
        'superagent.goal.intent': event.goalContract.userIntent,
        'superagent.goal.task_type': event.goalContract.taskType,
        'superagent.goal.deliverable': event.goalContract.deliverable,
        'superagent.goal.risk_tier': event.goalContract.riskTier,
        'superagent.goal.channel_type': event.goalContract.constraints.channelType,
        'superagent.goal.max_tool_calls': event.goalContract.constraints.maxToolCalls,
      },
      spanKey: `${event.runId}:root`,
    });
    this.rootSpanIds.set(event.runId, span.spanId);
    this.spans.push(span);
  }

  onPlanStep(event: RuntimePlanStepEvent): void {
    this.spans.push(this.createSpan({
      runId: event.runId,
      name: `superagent.plan_step.${event.step.id}`,
      timestamp: event.timestamp,
      parentSpanId: this.rootSpanIds.get(event.runId),
      spanKey: `${event.runId}:plan:${event.step.id}:${event.step.status}:${event.timestamp}`,
      attributes: compactAttributes({
        'superagent.run.id': event.runId,
        'superagent.plan_step.id': event.step.id,
        'superagent.plan_step.label': event.step.label,
        'superagent.plan_step.status': event.step.status,
        'superagent.plan_step.evidence': event.step.evidence,
        'superagent.plan_step.failure_reason': event.step.failureReason,
      }),
      error: event.step.status === 'failed' ? event.step.failureReason || 'plan step failed' : undefined,
      startTimestamp: event.step.startedAt,
      endTimestamp: event.step.completedAt,
    }));
  }

  onToolCall(event: RuntimeToolCallEvent): void {
    this.spans.push(this.createSpan({
      runId: event.runId,
      name: `superagent.tool.${event.toolCall.name}`,
      timestamp: event.timestamp,
      parentSpanId: this.rootSpanIds.get(event.runId),
      spanKey: `${event.runId}:tool:${event.toolCall.name}:${event.timestamp}`,
      attributes: {
        'superagent.run.id': event.runId,
        'superagent.tool.name': event.toolCall.name,
        'superagent.tool.input_preview': event.toolCall.inputPreview,
        'superagent.tool.failed': event.toolCall.failed,
      },
      error: event.toolCall.failed ? 'tool call failed' : undefined,
    }));
  }

  onEvaluation(event: RuntimeEvaluationEvent): void {
    this.spans.push(this.createSpan({
      runId: event.runId,
      name: 'superagent.evaluation',
      timestamp: event.timestamp,
      parentSpanId: this.rootSpanIds.get(event.runId),
      spanKey: `${event.runId}:evaluation:${event.timestamp}`,
      attributes: {
        'superagent.run.id': event.runId,
        'superagent.evaluation.verdict': event.evaluation.verdict,
        'superagent.evaluation.issues': event.evaluation.issues.join(','),
        'superagent.evaluation.score.overall': event.evaluation.score.overall,
        'superagent.evaluation.score.goal_completion': event.evaluation.score.goalCompletion,
        'superagent.evaluation.score.evidence': event.evaluation.score.evidence,
        'superagent.capability.score': event.capability.score,
        'superagent.capability.risk_surface': event.capability.factors.riskSurface,
      },
      error: event.evaluation.verdict === 'FAIL' ? event.evaluation.issues.join(',') || 'evaluation failed' : undefined,
    }));
  }

  onEvolutionProposal(event: RuntimeEvolutionProposalEvent): void {
    this.spans.push(this.createSpan({
      runId: event.runId,
      name: 'superagent.evolution_proposal',
      timestamp: event.timestamp,
      parentSpanId: this.rootSpanIds.get(event.runId),
      spanKey: `${event.runId}:proposal:${event.proposal.id}`,
      attributes: {
        'superagent.run.id': event.runId,
        'superagent.proposal.id': event.proposal.id,
        'superagent.proposal.target_type': event.proposal.targetType,
        'superagent.proposal.target_id': event.proposal.targetId || '',
        'superagent.proposal.reason': event.proposal.reason,
        'superagent.proposal.signals': event.proposal.signals.join(','),
        'superagent.proposal.allowed_to_modify_system': event.proposal.allowedToModifySystem,
      },
      events: [{
        name: 'superagent.evolution_proposal.created',
        timeUnixNano: toUnixNano(event.timestamp),
        attributes: {
          'superagent.proposal.reason': event.proposal.reason,
        },
      }],
    }));
  }

  getPendingSpans(): RuntimeOtelSpan[] {
    return this.spans.map((span) => ({
      ...span,
      attributes: { ...span.attributes },
      events: span.events.map((event) => ({ ...event, attributes: { ...event.attributes } })),
      status: { ...span.status },
    }));
  }

  toOtlpJson(): Record<string, unknown> {
    return createOtlpJsonPayload(this.spans, {
      serviceName: this.options.serviceName || 'superagent',
      serviceVersion: this.options.serviceVersion || '0.1.0',
      environment: this.options.environment || process.env.NODE_ENV || 'local',
    });
  }

  async flush(): Promise<void> {
    if (!this.options.endpoint || this.spans.length === 0) return;
    if (!this.fetchImpl) throw new Error('global fetch is not available for OTLP export');

    const response = await this.fetchImpl(this.options.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.options.headers ?? {}),
      },
      body: JSON.stringify(this.toOtlpJson()),
    });

    if (!response.ok) {
      throw new Error(`OTLP export failed with status ${response.status}`);
    }

    this.spans.length = 0;
  }

  private createSpan(input: {
    runId: string;
    name: string;
    timestamp: number;
    spanKey: string;
    attributes: Record<string, OtelAttributeValue>;
    parentSpanId?: string;
    error?: string;
    events?: RuntimeOtelEvent[];
    startTimestamp?: number;
    endTimestamp?: number;
  }): RuntimeOtelSpan {
    const start = input.startTimestamp ?? input.timestamp;
    const end = input.endTimestamp ?? input.timestamp;
    return {
      traceId: hashHex(input.runId, 32),
      spanId: hashHex(input.spanKey, 16),
      parentSpanId: input.parentSpanId,
      name: input.name,
      kind: 'SPAN_KIND_INTERNAL',
      startTimeUnixNano: toUnixNano(start),
      endTimeUnixNano: toUnixNano(end),
      attributes: input.attributes,
      events: input.events ?? [],
      status: input.error
        ? { code: 'STATUS_CODE_ERROR', message: input.error }
        : { code: 'STATUS_CODE_OK' },
    };
  }
}

export class CompositeRuntimeTraceSink implements RuntimeTraceSink {
  readonly name = 'composite';

  constructor(private readonly sinks: RuntimeTraceSink[]) {}

  getSinkNames(): string[] {
    return this.sinks.map((sink) => sink.name || 'anonymous');
  }

  onRunStarted(event: RuntimeRunStartedEvent): void {
    this.emit('onRunStarted', event);
  }

  onPlanStep(event: RuntimePlanStepEvent): void {
    this.emit('onPlanStep', event);
  }

  onToolCall(event: RuntimeToolCallEvent): void {
    this.emit('onToolCall', event);
  }

  onEvaluation(event: RuntimeEvaluationEvent): void {
    this.emit('onEvaluation', event);
  }

  onEvolutionProposal(event: RuntimeEvolutionProposalEvent): void {
    this.emit('onEvolutionProposal', event);
  }

  async flush(): Promise<void> {
    await Promise.all(this.sinks.map(async (sink) => {
      if (!sink.flush) return;
      await sink.flush();
    }));
  }

  private emit(
    method: 'onRunStarted',
    event: RuntimeRunStartedEvent,
  ): void;
  private emit(
    method: 'onPlanStep',
    event: RuntimePlanStepEvent,
  ): void;
  private emit(
    method: 'onToolCall',
    event: RuntimeToolCallEvent,
  ): void;
  private emit(
    method: 'onEvaluation',
    event: RuntimeEvaluationEvent,
  ): void;
  private emit(
    method: 'onEvolutionProposal',
    event: RuntimeEvolutionProposalEvent,
  ): void;
  private emit(
    method: keyof Pick<RuntimeTraceSink, 'onRunStarted' | 'onPlanStep' | 'onToolCall' | 'onEvaluation' | 'onEvolutionProposal'>,
    event: RuntimeRunStartedEvent | RuntimePlanStepEvent | RuntimeToolCallEvent | RuntimeEvaluationEvent | RuntimeEvolutionProposalEvent,
  ): void {
    for (const sink of this.sinks) {
      try {
        const handler = sink[method] as ((value: typeof event) => void | Promise<void>) | undefined;
        const result = handler?.call(sink, event);
        if (result && typeof (result as Promise<void>).catch === 'function') {
          void (result as Promise<void>).catch(() => undefined);
        }
      } catch {
        // Trace sinks are observational and must not interrupt agent execution.
      }
    }
  }
}

/** Builds the default local JSONL sink and optional OTLP exporter from environment. */
export function createRuntimeTraceSinkFromEnv(options: RuntimeTraceSinkEnvOptions): CompositeRuntimeTraceSink {
  const env = options.env ?? process.env;
  const sinks: RuntimeTraceSink[] = [new JsonlRuntimeTraceSink(options.jsonlPath)];
  const endpoint = env.SUPERAGENT_TRACE_OTLP_ENDPOINT || env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;

  if (endpoint) {
    sinks.push(new OtlpRuntimeTraceSink({
      endpoint,
      headers: {
        ...parseHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
        ...parseHeaders(env.SUPERAGENT_TRACE_OTLP_HEADERS),
      },
      serviceName: env.SUPERAGENT_TRACE_SERVICE_NAME || 'superagent',
      serviceVersion: env.SUPERAGENT_TRACE_SERVICE_VERSION || '0.1.0',
      environment: env.SUPERAGENT_TRACE_ENVIRONMENT || env.NODE_ENV || 'local',
    }));
  }

  return new CompositeRuntimeTraceSink(sinks);
}

export function createOtlpJsonPayload(
  spans: RuntimeOtelSpan[],
  resource: { serviceName: string; serviceVersion: string; environment: string },
): Record<string, unknown> {
  return {
    resourceSpans: [{
      resource: {
        attributes: toOtelAttributes({
          'service.name': resource.serviceName,
          'service.version': resource.serviceVersion,
          'deployment.environment': resource.environment,
        }),
      },
      scopeSpans: [{
        scope: {
          name: 'superagent.runtime',
          version: resource.serviceVersion,
        },
        spans: spans.map((span) => ({
          ...span,
          attributes: toOtelAttributes(span.attributes),
          events: span.events.map((event) => ({
            ...event,
            attributes: toOtelAttributes(event.attributes),
          })),
        })),
      }],
    }],
  };
}

function parseHeaders(input?: string): Record<string, string> {
  if (!input) return {};
  const headers: Record<string, string> = {};
  for (const part of input.split(',')) {
    const [key, ...rest] = part.split('=');
    const trimmedKey = key.trim();
    if (!trimmedKey || rest.length === 0) continue;
    headers[trimmedKey] = decodeURIComponent(rest.join('=').trim());
  }
  return headers;
}

function compactAttributes(input: Record<string, string | number | boolean | undefined>): Record<string, OtelAttributeValue> {
  const output: Record<string, OtelAttributeValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) output[key] = value;
  }
  return output;
}

function toOtelAttributes(attributes: Record<string, OtelAttributeValue>): Array<{ key: string; value: Record<string, unknown> }> {
  return Object.entries(attributes).map(([key, value]) => ({
    key,
    value: toOtelAnyValue(value),
  }));
}

function toOtelAnyValue(value: OtelAttributeValue): Record<string, unknown> {
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) return { intValue: value };
  if (typeof value === 'number') return { doubleValue: value };
  return { stringValue: value };
}

function toUnixNano(timestamp: number): string {
  return (BigInt(timestamp) * 1_000_000n).toString();
}

function hashHex(value: string, length: 16 | 32): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}
