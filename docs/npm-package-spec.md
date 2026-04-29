# npm Package Publication Spec

## Goal

Publish the runtime as a public npm package named `@btnalit/ycsuperagent` so Linux servers can install and run it with `npm install -g`.

## Constraints

- The existing `superagent` npm package name is already occupied.
- New npm package names must be lowercase.
- Runtime behavior must not change.
- Existing CLI names must remain compatible.

## Success Criteria

- `package.json` uses `@btnalit/ycsuperagent`.
- The package is publishable as a public scoped package.
- Global installs expose `ycsuperagent`, while preserving `mercury` and `superagent`.
- `npm pack --dry-run` shows the expected package name and contents.
- Typecheck, tests, build, and package verification pass.

## Verification

Run:

```bash
npm install --package-lock-only
npm test
npm run typecheck
npm run build
npm pack --dry-run
node scripts/verify-package.cjs
```
