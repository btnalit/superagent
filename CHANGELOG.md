# Changelog

## 1.1.3 — Fix Ollama Cloud Provider

### What Happened

Ollama Cloud was completely broken — every request returned `404 Not Found`. Two independent bugs prevented `ollamaCloud` from functioning:

### Bug 1: Wrong SDK — Local Ollama API instead of OpenAI-compatible Chat Completions

`ollamaCloud` was routed through `OllamaProvider`, which uses the `ollama-ai-provider` package. This package is designed for **local** Ollama servers and targets `/api/chat` and `/api/tags` endpoints. Ollama Cloud exposes an **OpenAI-compatible** API at `/v1/chat/completions` and `/v1/models` — a completely different wire format.

- **Model listing** called `${baseUrl}/tags` → `https://ollama.com/api/tags` → 404
- **Chat completions** called `${baseUrl}/chat` → `https://ollama.com/api/chat` → 404

**Fix**: `ollamaCloud` is now routed through `OpenAICompatProvider` (using `createOpenAI()` from `@ai-sdk/openai`), matching the pattern used by all other OpenAI-compatible cloud providers (MiMo, Grok).

### Bug 2: Wrong default base URL

The default `OLLAMA_CLOUD_BASE_URL` was set to `https://ollama.com/api` — the local Ollama server path. The correct base URL for Ollama Cloud's OpenAI-compatible API is `https://ollama.com/v1`.

**Fix**: Updated the default and added a config migration (`migrateLegacyOllamaCloudBaseUrl`) that automatically upgrades existing `mercury.yaml` files from `/api` to `/v1` on startup.

### Bug 3: Responses API instead of Chat Completions API

After fixing Bug 1, `OpenAICompatProvider` used `createOpenAI()()` which defaults to OpenAI's **Responses API** (`/responses`). Ollama Cloud only supports the **Chat Completions** API (`/chat/completions`), resulting in `https://ollama.com/api/responses` → 404.

**Fix**: Added `useChatApi` option to `OpenAICompatProvider`. When enabled (as it is for `ollamaCloud`), it calls `client.chat(model)` instead of `client(model)`, targeting `/chat/completions`.

### Bug 4: No baseUrl validation for ollamaCloud

`isProviderConfigured()` and `OllamaProvider.isAvailable()` only checked `apiKey.length > 0` for `ollamaCloud` — a missing or empty `baseUrl` would not be caught, causing a cryptic failure at request time.

**Fix**: Added explicit `ollamaCloud` branch in `isProviderConfigured()` and `isAvailable()` to validate both `apiKey` and `baseUrl`.

### Summary of Changes

| File | Change |
|------|--------|
| `src/providers/registry.ts` | Route `ollamaCloud` → `OpenAICompatProvider` with `useChatApi: true` |
| `src/providers/openai-compat.ts` | Add `useChatApi` option to use Chat Completions API |
| `src/utils/config.ts` | Default base URL `https://ollama.com/api` → `https://ollama.com/v1`; add `ollamaCloud` to `isProviderConfigured()`; add `migrateLegacyOllamaCloudBaseUrl()` |
| `src/utils/provider-models.ts` | New `fetchOllamaCloudModels()` using `/models` (OpenAI-compatible); rename `fetchOllamaModels` → `fetchOllamaLocalModels` (local `/tags` only); route `ollamaCloud` separately |
| `src/providers/ollama.ts` | `isAvailable()` also validates `baseUrl` for non-local providers |
| `.env.example` | `OLLAMA_CLOUD_BASE_URL` default updated to `https://ollama.com/v1` |
| `src/utils/provider-models.test.ts` | Added 2 tests for `ollamaCloud` model catalog |

## 1.1.2 — MiMo Provider & Budget Hardening

## 1.0.0 — Second Brain

This is a **major release** because it introduces the Second Brain — a persistent, structured memory system backed by SQLite with full-text search — alongside fundamental changes to how Mercury stores data and renders output.

### Why 1.0.0?

Mercury has been in rapid development through 0.x releases. The Second Brain feature represents a fundamental capability shift: Mercury now **remembers** across conversations, automatically extracting, consolidating, and recalling facts about you. Combined with the all-in-`~/.mercury/` data architecture and live CLI streaming, this marks a stable, production-ready foundation warranting a major version.

### Second Brain 🧠

- **10 memory types** — identity, preference, goal, project, habit, decision, constraint, relationship, episode, reflection
- **Automatic extraction** — after each conversation, Mercury extracts 0–3 facts with confidence, importance, and durability scores
- **Relevant recall** — before each message, injects top 5 matching memories within a 900-character budget
- **Auto-consolidation** — every 60 minutes, synthesizes a profile summary, active-state summary, and generates reflection memories from detected patterns
- **Conflict resolution** — opposing memories resolved by higher confidence or recency; negation detection handles "likes X" vs "does not like X"
- **Active → Durable promotion** — memories reinforced 3+ times automatically promote from short-lived `active` scope to long-lived `durable` scope
- **Auto-pruning** — active-scope memories stale after 21 days; inferred memories decay; low-confidence durable memories dismissed after 120 days
- **SQLite + FTS5** — full-text search for instant recall, all data stored locally at `~/.mercury/memory/second-brain/second-brain.db`
- **User controls** — `/memory` for overview, search, pause, resume, and clear in both CLI and Telegram

### CLI Streaming Restored

- **Live text streaming** — raw response tokens stream to the terminal as they arrive, then the full response is re-rendered with proper markdown formatting (headings in cyan with `■` markers, code blocks in yellow, lists with dim bullets, blockquotes with dim borders)
- **Cursor save/restore** — uses `\x1b7`/`\x1b8` ANSI sequences instead of fragile line counting, eliminating the duplicate-response bug for single-line answers
- **Tool feedback during streaming** — tool calls appear inline during streaming and are tracked for accurate output replacement

### Data Architecture: All in `~/.mercury/`

- **Before**: Memory (short-term, long-term, episodic) was stored relative to CWD at `./memory/`, creating files in random project directories
- **After**: All state now lives under `~/.mercury/` — config, soul, memory, permissions, skills, schedules, token tracking, daemon state
- **`getMemoryDir()`** helper returns `~/.mercury/memory/` — no more `memory.dir` config field
- **Auto-migration** — on first run, Mercury detects and moves any legacy `./memory/` directory to `~/.mercury/memory/`, then removes the old directory
- **Removed config fields**: `memory.dir`, `memory.secondBrain.dbPath` — these are now computed from `getMercuryHome()`

### Permission Modes

- **Ask Me** — confirm before file writes, shell commands that need approval, and scope changes (default on both CLI and Telegram)
- **Allow All** — auto-approve everything for the session (scopes, commands, loop continuation). Resets on restart.
- CLI: arrow-key menu at session start. Telegram: inline keyboard on first message, `/permissions` to change.

### Step-by-Step Tool Feedback

- **Numbered steps** — each tool call gets a step number (`1. read_file foo.ts`)
- **Spinner** — animated spinner with elapsed time while tools execute
- **Result summaries** — concise result shown after each step (e.g., `42 lines, 3 matches`)

### Other Changes

- **Improved markdown renderer** — cyan headings with `■` markers, yellow inline code, dim strikethrough, blue underlined links with dim URLs, bordered blockquotes, bordered tables
- **HTML entity decoding** — fixes double-encoding from marked's HTML output
- **Telegram organization access** — admins and members with approve/reject/promote/demote flows
- **Model selection during onboarding** — after validating an API key, Mercury fetches available models and lets you choose
- **Telegram editable status messages** — streaming updates use `editMessageText` for live response editing
- **Scheduled task notifications** — Mercury notifies the originating channel when a scheduled task runs
- **Full temporary scope for scheduled tasks** — tasks run in Allow All mode with auto-approved scopes

### Breaking Changes

- Memory data paths changed from `./memory/` to `~/.mercury/memory/` — auto-migration handles this
- Config field `memory.dir` removed — no action needed, value is ignored
- Config field `memory.secondBrain.dbPath` removed — path is now computed automatically

### Full Changelog

**0.5.4** — Fix streaming alignment, remove agent name duplication, cleaner block format
**0.5.3** — Add mercury upgrade command, ENOTEMPTY fix
**0.5.2** — Fix readline prompt handling, streaming re-render, interactive loop detection, HTML entity decoding
**0.5.1** — Bug fixes
**0.5.0** — Telegram organization access, model selection, updated docs
**0.4.0** — Social media skills, GitHub companion
**0.3.0** — Permission system, skill system, scheduler
**0.2.0** — Telegram streaming, file uploads, daemon mode
**0.1.0** — Initial release