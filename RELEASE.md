# Release v0.4.1

## ☿ Mercury Agent v0.4.1

**Smarter agent context, co-author fix, and loop detection.**

### What's Changed

- **Agent context enrichment** — Every request now includes `Platform` and `Working directory` in the system prompt, so the LLM knows what OS it's on and where it's working. Prevents the "trying `/home/zayd` on Windows" confusion.
- **GitHub companion awareness** — When GitHub tools are active, the system prompt now explains when to use `git_commit` + `git_push` vs. `github_api` Contents API, so the agent doesn't fumble between approaches.
- **Co-author injection for GitHub API** — `github_api` now automatically injects `Co-authored-by: Mercury <mercury@cosmicstack.org>` into all content creation/update operations (`PUT /repos/:owner/:repo/contents/:path`). Previously, only `git_commit` had the co-author trailer — API-created files were missing it.
- **Loop detection circuit breaker** — New `ToolCallLoopDetector` tracks consecutive tool calls. If the same tool+params is called 3+ times in a row, a system warning is injected telling the LLM to try a different approach. Prevents the infinite `approve_scope` / `list_dir` death spirals that burned through token budgets.
- **`github_api` description overhaul** — The tool description now explicitly documents Contents API operations (push files, delete files) and when to use the API vs. git CLI, so the LLM makes smarter choices from the start.

### Bug Fixes

- LLM no longer blind to the current working directory or platform when making tool calls
- GitHub API file pushes now correctly show Mercury as co-author in GitHub's commit history
- Agent no longer loops on failing permission/approval calls until token budget exhaustion

### Migration from v0.4.0

No configuration changes required. All improvements are in agent behavior and tool descriptions.

---

**Full Changelog**: https://github.com/cosmicstack-labs/mercury-agent/compare/v0.4.0...v0.4.1