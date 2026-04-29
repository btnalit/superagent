# Trace Sink Spec

## Goal

Make Agent Runtime trace emission pluggable so Superagent can keep local `/trace` and JSONL evidence while also exporting the same runtime facts as OpenTelemetry-compatible spans for VoltOps or any OTLP collector.

## Constraints

- Do not let VoltAgent own or replace Superagent runtime execution.
- Do not add network side effects unless an exporter endpoint is explicitly configured.
- Keep `/runtime` and `/trace` working without external services.
- Keep sink failures non-fatal: trace export must not block the user task.
- Avoid depending on deprecated VoltAgent observability SDK APIs.

## Runtime Events

The runtime emits these sink hooks:

- `onRunStarted`: root metadata for the goal contract.
- `onPlanStep`: status/evidence/failure for `contract`, `plan`, `execute`, `verify`, and `learn`.
- `onToolCall`: tool name, input preview, failure flag, and timestamp.
- `onEvaluation`: evaluator verdict, scores, issues, and capability score.
- `onEvolutionProposal`: data-only proposal events.

## Export Mapping

- Goal Contract -> root span metadata.
- Plan Step -> child span named `superagent.plan_step.<id>`.
- Tool Call -> child span named `superagent.tool.<name>`.
- Evaluator -> child span named `superagent.evaluation`.
- Capability Score -> evaluation span attributes.
- Evolution Proposal -> child event span named `superagent.evolution_proposal`.

## Acceptance Criteria

- A test sink can observe all five event types in deterministic order.
- JSONL sink writes runtime trace events without changing episodic memory behavior.
- OTLP exporter maps runtime events into OpenTelemetry-style spans with stable trace IDs and parent-child links.
- OTLP exporter is disabled unless `SUPERAGENT_TRACE_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set.
- Local verification passes: targeted tests, full tests, typecheck, build, and package verification.
