# CI Fix Audit

## Failure

GitHub Actions failed on push runs `#1` and `#2` because source directories were accidentally ignored before the initial commit:

- `src/memory/`
- `src/soul/`

The remote typecheck annotations showed missing modules such as `../memory/store.js`, `../memory/user-memory.js`, and `../soul/identity.js`.

## Fix

- Scope runtime data ignores to repository-root directories only: `/memory/`, `/soul/`, `/config/`.
- Commit the previously ignored source files under `src/memory/` and `src/soul/`.
- Upgrade official GitHub Actions from v4 to v6 so they run on the Node 24 action runtime.
- Change the Termux job to copy the checkout into the container instead of changing ownership of the mounted GitHub workspace.

## Verification Evidence

- `git check-ignore -v src\memory\store.ts src\memory\user-memory.ts src\soul\identity.ts` -> PASS by returning no ignored paths.
- `git ls-files src\memory src\soul` -> PASS, seven source/test files are tracked.
- `npm test` -> PASS, 5 test files and 35 tests passed.
- `npm run lint` -> PASS.
- `npm run typecheck` -> PASS.
- `npm run build` -> PASS.
- `node scripts\verify-package.cjs` -> PASS.
- GitHub Actions run `#3` -> PASS after committing the missing sources.
- GitHub Actions run after warning cleanup -> pending.
