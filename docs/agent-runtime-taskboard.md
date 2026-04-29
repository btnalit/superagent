# Agent Runtime Taskboard

## Goal

Build the smallest Mercury-native runtime layer that captures the five-part AI Agent essence without introducing a full AgentOS.

## Tasks

- [x] Read provided design documents and existing Mercury architecture.
- [x] Write SDD spec and audit.
- [x] Add red tests for goal contract, state machine, authority, evaluation, and capability formula.
- [x] Implement `src/core/agent-runtime.ts`.
- [x] Integrate runtime into `src/core/agent.ts`.
- [x] Run focused tests and full verification gates.
- [x] Backfill audit with actual verification evidence.
- [x] Add red tests for `/runtime` trace formatting.
- [x] Add red tests for structured tool manifest authority.
- [x] Add red tests for contract-aware evaluator rules.
- [x] Add red tests for five plan steps.
- [x] Add red tests for skill reliability metadata.
- [x] Add red tests for data-only evolution proposals.
- [x] Implement the six runtime completion features.
- [x] Integrate trace/proposal commands into Agent.
- [x] Run fresh verification and update audit.

## Next Task

Next suggested phase: add an operator command to clear or archive old persisted evolution proposals.
