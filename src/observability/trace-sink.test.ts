import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PermissionsManifest } from '../capabilities/permissions.js';
import { createAgentRuntimeRun } from '../core/agent-runtime.js';
import {
  JsonlRuntimeTraceSink,
  OtlpRuntimeTraceSink,
  createRuntimeTraceSinkFromEnv,
  type RuntimeTraceSink,
} from './trace-sink.js';

const permissions: PermissionsManifest = {
  capabilities: {
    filesystem: {
      enabled: true,
      scopes: [{ path: '.', read: true, write: true }],
    },
    shell: {
      enabled: true,
      blocked: ['rm -rf /'],
      autoApproved: ['npm test *'],
      needsApproval: ['git push *'],
      cwdOnly: true,
    },
    git: {
      enabled: true,
      autoApproveRead: true,
      approveWrite: true,
    },
  },
};

const tempDirs: string[] = [];

describe('runtime trace sinks', () => {
  it('emits run, plan step, tool call, evaluation, and evolution proposal hooks', () => {
    const events: string[] = [];
    const sink: RuntimeTraceSink = {
      onRunStarted: (event) => { events.push(`run_started:${event.runId}:${event.goalContract.taskType}`); },
      onPlanStep: (event) => { events.push(`plan_step:${event.step.id}:${event.step.status}`); },
      onToolCall: (event) => { events.push(`tool_call:${event.toolCall.name}:${event.toolCall.failed}`); },
      onEvaluation: (event) => { events.push(`evaluation:${event.evaluation.verdict}:${event.capability.score}`); },
      onEvolutionProposal: (event) => { events.push(`proposal:${event.proposal.targetType}:${event.proposal.targetId}`); },
    };

    const run = createAgentRuntimeRun('请修改源码并跑测试', {
      runId: 'run_sink',
      channelType: 'cli',
      maxToolCalls: 10,
      permissions,
      toolNames: ['read_file', 'run_command'],
      traceSink: sink,
    });

    run.transition('CONTRACTING');
    run.transition('EXECUTING');
    run.recordToolCall('run_command', { command: 'npm test' }, true);
    run.transition('VERIFYING');
    const evaluation = run.evaluate('修改已完成，但测试失败：1 个断言未通过。');
    run.transition('LEARNING');
    run.createEvolutionFeedback(evaluation);
    run.transition('ARCHIVED');

    expect(events[0]).toBe('run_started:run_sink:code');
    expect(events).toContain('plan_step:contract:in_progress');
    expect(events).toContain('plan_step:execute:in_progress');
    expect(events).toContain('tool_call:run_command:true');
    expect(events).toContain(`evaluation:FAIL:${run.getCapabilityScore(evaluation).score}`);
    expect(events).toContain('proposal:tool:run_command');
  });

  it('persists trace events through the JSONL sink', () => {
    const dir = mkdtempSync(join(tmpdir(), 'superagent-trace-sink-'));
    tempDirs.push(dir);
    const sink = new JsonlRuntimeTraceSink(join(dir, 'runtime-traces.jsonl'));
    const run = createAgentRuntimeRun('请创建文件 docs/demo.md', {
      runId: 'run_jsonl',
      channelType: 'cli',
      maxToolCalls: 10,
      permissions,
      toolNames: ['create_file', 'run_command'],
      traceSink: sink,
    });

    run.transition('CONTRACTING');
    run.transition('EXECUTING');
    run.recordToolCall('create_file', { path: 'docs/demo.md' }, false);
    run.transition('VERIFYING');
    const evaluation = run.evaluate('已创建 docs/demo.md。验证：npm test 通过。');
    run.transition('LEARNING');
    run.createEvolutionFeedback(evaluation);
    run.transition('ARCHIVED');

    const events = readFileSync(join(dir, 'runtime-traces.jsonl'), 'utf-8')
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));

    expect(events.map((event) => event.eventType)).toContain('run_started');
    expect(events.map((event) => event.eventType)).toContain('plan_step');
    expect(events.map((event) => event.eventType)).toContain('tool_call');
    expect(events.map((event) => event.eventType)).toContain('evaluation');
    expect(events.find((event) => event.eventType === 'tool_call')).toMatchObject({
      runId: 'run_jsonl',
      toolCall: {
        name: 'create_file',
        failed: false,
      },
    });
  });

  it('maps runtime events to OpenTelemetry-compatible spans', () => {
    const sink = new OtlpRuntimeTraceSink({ serviceName: 'superagent-test' });
    const run = createAgentRuntimeRun('请调研 AI Agent 市场', {
      runId: 'run_otlp',
      channelType: 'cli',
      maxToolCalls: 10,
      permissions,
      toolNames: ['fetch_url'],
      traceSink: sink,
    });

    run.transition('CONTRACTING');
    run.transition('EXECUTING');
    run.recordToolCall('fetch_url', { url: 'https://example.com' }, false);
    run.transition('VERIFYING');
    const evaluation = run.evaluate('AI Agent 市场正在增长。');
    run.transition('LEARNING');
    run.createEvolutionFeedback(evaluation);

    const spans = sink.getPendingSpans();
    const root = spans.find((span) => span.name === 'superagent.runtime');
    const tool = spans.find((span) => span.name === 'superagent.tool.fetch_url');
    const evaluator = spans.find((span) => span.name === 'superagent.evaluation');
    const proposal = spans.find((span) => span.name === 'superagent.evolution_proposal');

    expect(root).toMatchObject({
      attributes: {
        'superagent.run.id': 'run_otlp',
        'superagent.goal.task_type': 'research',
      },
    });
    expect(tool?.parentSpanId).toBe(root?.spanId);
    expect(tool?.attributes).toMatchObject({
      'superagent.tool.name': 'fetch_url',
      'superagent.tool.failed': false,
    });
    expect(evaluator?.attributes).toMatchObject({
      'superagent.evaluation.verdict': 'FAIL',
      'superagent.capability.score': run.getCapabilityScore(evaluation).score,
    });
    expect(proposal?.attributes).toMatchObject({
      'superagent.proposal.target_type': 'evaluator',
      'superagent.proposal.target_id': 'research',
    });

    const payload = sink.toOtlpJson() as {
      resourceSpans: Array<{
        scopeSpans: Array<{
          spans: unknown[];
        }>;
      }>;
    };
    expect(payload.resourceSpans[0].scopeSpans[0].spans.length).toBe(spans.length);
  });

  it('creates local JSONL tracing by default and enables OTLP only with an endpoint', () => {
    const dir = mkdtempSync(join(tmpdir(), 'superagent-trace-env-'));
    tempDirs.push(dir);

    const localOnly = createRuntimeTraceSinkFromEnv({
      env: {},
      jsonlPath: join(dir, 'local.jsonl'),
    });
    const withOtlp = createRuntimeTraceSinkFromEnv({
      env: {
        SUPERAGENT_TRACE_OTLP_ENDPOINT: 'http://127.0.0.1:4318/v1/traces',
        SUPERAGENT_TRACE_OTLP_HEADERS: 'Authorization=Bearer test',
      },
      jsonlPath: join(dir, 'otlp.jsonl'),
    });

    expect(localOnly.getSinkNames()).toEqual(['jsonl']);
    expect(withOtlp.getSinkNames()).toEqual(['jsonl', 'otlp']);
  });
});

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});
