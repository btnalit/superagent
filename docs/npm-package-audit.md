# npm Package Audit

## Change Scope

This audit covers npm package metadata and deployment documentation for `@btnalit/ycsuperagent`.

## Decisions

- Use `@btnalit/ycsuperagent` instead of `superagent` because `superagent` is already occupied on npm.
- Keep `mercury` and `superagent` command aliases for compatibility.
- Add `ycsuperagent` as the primary public-package CLI command.
- Use `publishConfig.access = public` for scoped public npm publication.

## Risk Review

- Package rename affects npm publication identity only.
- CLI runtime behavior is unchanged.
- Public publishing itself is an external irreversible registry action and must use npm authentication.

## Evidence

- `npm view @btnalit/ycsuperagent name version description` returned npm 404, confirming no existing package in the public registry.
- `npm install --package-lock-only` completed successfully.
- `npm test` passed: 6 files, 39 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm pack --dry-run` produced `@btnalit/ycsuperagent@0.1.0` with `dist/index.js`, `dist/index.js.map`, README files, LICENSE, and `package.json`.
- `node scripts/verify-package.cjs` passed all package integrity checks.
- `npm whoami` failed with `ENEEDAUTH`, so public npm publication is pending npm authentication.
