# Trace Sink Audit

## Assumptions

- VoltOps is useful as an observability target, but Superagent must not depend on VoltAgent runtime classes.
- Current VoltAgent SDK observability helper is not a stable integration point, so the first exporter should target OTLP/HTTP JSON.
- A local JSONL trace sink is the durable fallback for no-network operation.

## Verification Plan

- `npm test -- src/observability/trace-sink.test.ts`
- `npm test -- src/core/agent-runtime.test.ts src/observability/trace-sink.test.ts`
- `npm test`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `node scripts\verify-package.cjs`

## Evidence

- `npm test -- src/observability/trace-sink.test.ts` -> RED first because `./trace-sink.js` did not exist.
- `npm test -- src/observability/trace-sink.test.ts` -> PASS after implementation, 4 tests passed.
- `npm test -- src/core/agent-runtime.test.ts src/observability/trace-sink.test.ts` -> PASS, 13 tests passed.
- `npm run typecheck` -> FAIL first because test sink lambdas returned `Array.push()` numbers and OTLP payload needed type narrowing.
- `npm run typecheck` -> PASS after fixing tests.
- `npm test` -> PASS, 6 test files and 39 tests passed.
- `npm run lint` -> PASS.
- `npm run build` -> PASS, `dist/index.js` built successfully.
- `node scripts\verify-package.cjs` -> PASS, package smoke test succeeded.
- `Get-ChildItem -Path scripts -Recurse -File | Select-String -Pattern 'a34','a35','a36','global_process','process_hard'` -> no matching guard scripts found.
