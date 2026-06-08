# AI Agents

See [CLAUDE.md](CLAUDE.md) for AI agent instructions.

## Adding AI Backends

For adding a new backend such as Claude, Codex, OpenCode, Cursor, Pi, or future CLIs/APIs, follow the checklist in `CLAUDE.md` under **Adding a New AI Backend**.

## Keyboard Affordances

For keyboard shortcut hints (`Kbd`) and keyboard-only default actions, follow `CLAUDE.md` → **Keyboard Affordances in Web/Mobile**.

## PI CLI JSON Output Format

See `CLAUDE.md` → **PI CLI JSON Output Format** before changing PI chat parsing. Jean must persist its own session/run JSONL; use PI's documented format only to parse PI CLI output correctly before writing Jean history. Streaming assistant text arrives under `message_update.assistantMessageEvent.delta`; final assistant text, thinking, tool calls, tool results, and usage are nested under `type: "message"` / message lifecycle entries per https://pi.dev/docs/latest/session-format.
