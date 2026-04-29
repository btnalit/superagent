# Agent Runtime Essence Spec

## Goal

Extend Mercury with the essence of the provided AI Agent design:

`AI Agent = Goal Contract + State Machine Execution + Skill Assets + Tool Authority + Evaluation Evolution`

`Agent Capability = Goal Contract x Context Quality x Skill Reliability x Tool Authority x Evaluation Feedback / Risk Surface`

This is intentionally smaller than a full AgentOS. Mercury already has tools, permissions, skills, memory, channels, and AI SDK execution. The change adds a deterministic runtime layer around the existing agent loop.

## Assumptions

- Mercury remains a TypeScript CLI/daemon agent and keeps Vercel AI SDK as the LLM/tool execution runtime.
- Runtime data continues to use existing memory/episodic storage; no new database is introduced.
- Existing permission checks remain the hard execution boundary. The new runtime layer records and scores authority, but does not bypass `PermissionManager`.
- User-facing conversation remains Chinese only when the system/user prompt asks for it; this implementation adds runtime guidance but does not force all users globally into Chinese.
- The first implementation handles per-message runs, not long-lived multi-run workflows.

## Scope

In scope:

- Create a goal contract from each non-command user message.
- Classify risk from the requested intent.
- Track a small state machine for each run.
- Track a five-step plan view: contract, plan, execute, verify, learn.
- Summarize skill availability and tool authority from existing registries, tool manifests, and permission manifest.
- Evaluate final output with deterministic, contract-aware checks and produce evolution feedback.
- Inject a concise runtime contract into the system prompt.
- Persist runtime evidence into the existing episodic event metadata.
- Provide `/runtime` and `/trace` to inspect the most recent runtime evidence.
- Provide a lightweight evolution proposal queue. Proposals are data only and cannot modify runtime behavior.
- Extend skill discovery metadata with `version`, `status`, `risk-tier`, `eval-cases`, and `success-metrics`.

Out of scope:

- Separate ops-gate service.
- Human approval UI redesign.
- Vector memory, dashboards, A/B infrastructure, canary rollout, sub-agent orchestration.
- Replacing the AI SDK loop with LangGraph or another runtime.

## Success Criteria

- `src/core/agent-runtime.ts` exposes typed, testable runtime primitives.
- `src/capabilities/tool-manifest.ts` exposes structured metadata for every built-in tool.
- Agent messages include a runtime contract prompt before model execution.
- Final responses record evaluation and capability factors in episodic metadata.
- R4 requests can be deterministically rejected before LLM execution.
- `/runtime` and `/trace` show the latest goal contract, plan steps, tool calls, evaluation, capability score, and proposals.
- Unit tests cover goal contract creation, risk classification, state transitions, plan steps, tool authority metadata, contract-aware evaluation, evolution feedback, skill reliability, trace formatting, and capability formula behavior.
- Fresh verification runs: `npm test`, `npm run typecheck`, and `npm run build`.

## Architecture

`Agent.handleMessage()` creates an `AgentRuntimeRun` after command and budget gates pass. The run builds a `GoalContract`, moves through deterministic states, records plan steps and tool calls from `onStepFinish`, evaluates the final response, queues data-only evolution proposals, and writes a compact evidence summary to episodic memory.

The runtime layer is pure TypeScript except for consuming the permission manifest shape. It does not call models, tools, files, or network.

## Data Flow

User message -> `createAgentRuntimeRun()` -> prompt context -> AI SDK execution -> tool call records -> deterministic evaluation -> episodic metadata -> trace command / proposal queue.

## Validation Mapping

- Contract and risk: `src/core/agent-runtime.test.ts`
- State machine: `src/core/agent-runtime.test.ts`
- Capability formula: `src/core/agent-runtime.test.ts`
- Integration type safety: `npm run typecheck`
- Runtime packaging: `npm run build`
