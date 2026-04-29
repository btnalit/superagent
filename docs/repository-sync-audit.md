# Repository Sync Audit

## Goal

Sync the local Superagent project to `https://github.com/btnalit/superagent` and make the repository safe to bootstrap from a fresh clone.

## Scope

- Project identity: package metadata, README clone/link commands, repository URLs.
- CI: keep install, lint, typecheck, test, build, and package verification gates.
- Release safety: remove the inherited npm publish job until this fork has an explicit release policy.
- Git hygiene: normalize text files to LF and keep image assets binary.
- Pages safety: remove the inherited `mercury.cosmicstack.org` CNAME from the static docs directory.
- Runtime references: include the three local design documents under `docs/reference/` for traceability.

## Acceptance Evidence

- `npm test` -> PASS, 5 test files and 35 tests passed.
- `npm run lint` -> PASS.
- `npm run typecheck` -> PASS.
- `npm run build` -> PASS, `dist/index.js` built successfully.
- `node scripts\verify-package.cjs` -> PASS, tarball install smoke test succeeded.
- `Get-ChildItem -Path scripts -Recurse -File | Select-String -Pattern 'a34','a35','a36','global_process','process_hard'` -> no matching global gate scripts found.
- `git push -u origin main` -> PASS, `main` now tracks `origin/main`.

## Notes

- The remote repository was checked with `git ls-remote` and appeared empty before initialization.
- Package verification now reads the package name dynamically so the smoke test follows the renamed package.
- Repository sync completed in commit `1c427df` and pushed to `origin/main`.
