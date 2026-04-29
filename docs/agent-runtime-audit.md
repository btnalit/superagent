# Agent Runtime Audit

## Source Documents Read

- `D:\superagent\aiagent.md`
- `D:\superagent\ai-agent-architecture.html`
- `D:\superagent\complete-ai-agent-design.html`

## Extracted Essence

- Goal contract: user intent must become an inspectable completion contract.
- State machine execution: LLM can propose, but runtime state transitions must be deterministic.
- Skill assets: existing `SkillLoader` and `use_skill` are the asset base; this change only measures availability/reliability defaults.
- Tool authority: existing `PermissionManager` is the authority boundary; runtime summarizes enabled capabilities and risk.
- Evaluation evolution: each run produces deterministic scores and feedback signals, not self-modifying code.

## Existing Mercury Fit

- `src/core/agent.ts` owns per-message execution and AI SDK calls.
- `src/capabilities/permissions.ts` already gates filesystem, shell, and git operations.
- `src/skills/loader.ts` already implements progressive skill disclosure.
- `src/memory/store.ts` already has episodic event metadata suitable for compact runtime evidence.

## Risk Notes

- The existing agent loop has duplicated `onStepFinish` logic for streaming and non-streaming paths. This implementation records runtime tool calls in both branches without a broad refactor.
- Existing auto-approval for internal/scheduled messages remains unchanged.
- The new deterministic R4 rejection only handles clearly forbidden destructive/exfiltration requests. It does not replace permission checks.

## Verification Plan

- Red tests before production runtime code.
- Run focused test: `npm test -- src/core/agent-runtime.test.ts`
- Run full test: `npm test`
- Run type/build gates: `npm run typecheck`, `npm run build`

## Completion Evidence

Implemented files:

- `src/core/agent-runtime.ts`
- `src/core/agent-runtime.test.ts`
- `src/capabilities/tool-manifest.ts`
- `src/core/agent.ts`
- `src/capabilities/registry.ts`
- `src/skills/types.ts`
- `src/skills/loader.ts`
- `src/skills/loader.test.ts`
- `src/utils/manual.ts`
- `README.md`
- `README.zh-CN.md`
- `docs/agent-runtime-spec.md`
- `docs/agent-runtime-taskboard.md`

Feature completion:

- Runtime trace: `/runtime` and `/trace` render the latest goal contract, plan steps, tool calls, evaluation, capability score, and proposals.
- Tool manifest: built-in tools now expose `riskTier`, `reversible`, `requiresApproval`, `capability`, and `sideEffect`.
- Contract-aware evaluator: code, research, and file-write tasks have specific evidence checks.
- Plan steps: each run tracks `contract -> plan -> execute -> verify -> learn` with status and evidence.
- Skill reliability: skill discovery now reads `version`, `status`, `risk-tier`, `eval-cases`, and `success-metrics`, with stable skills sorted first.
- Evolution proposals: runtime creates data-only proposals, persists them to `~/.mercury/evolution-proposals.jsonl`, and exposes recent entries through `/proposals`.

Verification commands:

- `npm test -- src/core/agent-runtime.test.ts` - passed, 9 tests.
- `npm test -- src/core/agent-runtime.test.ts src/skills/loader.test.ts` - passed, 10 tests.
- `npm run typecheck` - passed.
- `npm test` - passed, 5 files / 35 tests.
- `npm run build` - passed.
- `npm run lint` - passed.
- `node scripts\verify-package.cjs` - passed.

Governance note:

- No `a34`, `a35`, or `a36` process gate script exists in `scripts/`; available scripts are `check-native-deps`, `publish`, and `verify-package`.
- Search for `a34`, `a35`, `a36`, `global_process`, and `process_hard` under `scripts/` returned no matches.
- The workspace is not a Git repository, so no commit could be created.
