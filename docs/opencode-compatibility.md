# OpenCode Compatibility

> Status: **exploratory / not implemented**. This is a design note, separate from the
> native-`caffeinate` work. Revisit when deciding whether to add OpenCode support.

## Context

cc-caffeine currently integrates with **Claude Code** via external command hooks
(`hooks/hooks.json`). Each hook spawns `npx cc-caffeine caffeinate|uncaffeinate`,
which writes to `~/.claude/plugins/cc-caffeine/sessions.json` and (on `caffeinate`)
ensures the Electron server is running. The server polls the JSON file and toggles
`powerSaveBlocker`.

OpenCode does **not** have Claude Code's external-command hook model. It has an
**in-process plugin system**. This note maps the two and sketches a plugin.

## OpenCode plugin system (summary)

- Plugins are JS/TS modules loaded at startup from:
  - `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global), or
  - npm packages listed under `plugin` in `opencode.json`.
- A plugin is a module exporting a function that receives a context and returns a
  hooks object:

  ```js
  export const MyPlugin = async ({ project, client, $, directory, worktree }) => {
    return {
      // hook implementations
    }
  }
  ```

  Context provides:
  - `project` — current project info
  - `directory` — current working directory
  - `worktree` — git worktree path
  - `client` — opencode SDK client
  - `$` — Bun's shell API for running commands

- Local plugins can use external npm packages by adding a `package.json` to the
  config directory (opencode runs `bun install` at startup).

### Events available (relevant subset)

- Session: `session.created`, `session.deleted`, `session.idle`, `session.updated`,
  `session.status`, `session.compacted`, `session.error`, `session.diff`
- Tool: `tool.execute.before`, `tool.execute.after`
- Command: `command.executed`
- Message: `message.updated`, `message.part.updated`, ...
- A generic `event` hook receives `{ event }` where `event` has `.type` and
  `.properties` (same shape as `client.event.subscribe()` stream items).

## Claude Code → OpenCode event mapping

| Claude Code hook (`hooks/hooks.json`) | Action | OpenCode event(s) |
|---|---|---|
| `UserPromptSubmit` | caffeinate | `command.executed` / `session.created` |
| `PreToolUse` (matcher `*`) | caffeinate | `tool.execute.before` |
| `PostToolUse` (matcher `*`) | caffeinate | `tool.execute.after` |
| `Notification` | uncaffeinate | `session.idle` |
| `Stop` | uncaffeinate | `session.idle` |
| `SessionEnd` | uncaffeinate | `session.deleted` |

The semantic is: **activity events → caffeinate** (touch the session, refresh
`last_activity`), **idle/end events → uncaffeinate** (drop the session). The
existing idle-timeout logic in the server then releases sleep after N minutes of
no activity, so the "uncaffeinate" events are belt-and-suspenders, not the only
release path.

## Two integration shapes

### D1 — Thin plugin that calls the existing CLI (recommended)

The plugin is a thin trigger; all logic stays in the project.

```js
// .opencode/plugins/cc-caffeine.js
const { spawn } = require('node:child_process')

const run = (action, sessionId) =>
  new Promise(resolve => {
    const p = spawn('npx', ['cc-caffeine', action], { stdio: ['pipe', 'ignore', 'ignore'] })
    p.stdin.write(JSON.stringify({ session_id: sessionId }))
    p.stdin.end()
    p.on('close', resolve)
  })

export const CcCaffeine = async ({ client }) => {
  const sessionId = () => /* see "Open items" — derive from event.properties */
  return {
    'tool.execute.before': async () => run('caffeinate', sessionId()),
    'tool.execute.after': async () => run('caffeinate', sessionId()),
    'command.executed': async () => run('caffeinate', sessionId()),
    'session.created': async () => run('caffeinate', sessionId()),
    'session.idle': async () => run('uncaffeinate', sessionId()),
    'session.deleted': async () => run('uncaffeinate', sessionId()),
  }
}
```

- **Pros**: reuses `sessions.json` + server + idle-timeout unchanged; one code
  path shared with Claude Code; trivial to maintain.
- **Cons**: depends on the CLI + server being installed; spawns a process per
  event (same as Claude Code's model, so not a regression).

### D2 — Plugin manages sleep directly

The plugin spawns the sleep-prevention mechanism itself (native `caffeinate` or
its own logic), bypassing the CLI/server.

- **Pros**: no CLI/server dependency for the OpenCode path.
- **Cons**: duplicates the idle-timeout + session logic; diverges from the Claude
  Code path; two implementations to keep in sync.

**Recommendation: D1.** Keep the plugin thin.

## Open items to verify before implementing

1. **Session id in events.** The `event` hook gives `event.properties`; the exact
   field carrying the session id (e.g. `sessionID` vs `id`) must be confirmed
   against the SDK types
   (`packages/sdk/js/src/gen/types.gen.ts`) or by logging a real event. The
   `session.created`/`session.deleted`/`session.idle` payloads are the ones that
   matter.
2. **Event frequency.** `tool.execute.before`/`after` fire on every tool call —
   potentially very frequently. Confirm the per-event `npx` spawn cost is
   acceptable, or debounce (e.g. only caffeinate on `session.created` + a
   heartbeat, and rely on the server's idle timeout for release).
3. **`$` vs `spawn`.** The plugin context provides Bun's `$` shell API; using it
   avoids a `child_process` import. Decide which to standardize on.
4. **Where the plugin ships.** Project-local (`.opencode/plugins/`) vs a published
   npm package referenced from `opencode.json`. A published package is the
   distribution story that mirrors the Claude Code plugin marketplace.
5. **Interaction with the native-caffeinate effort.** If the sleep mechanism
   becomes native `caffeinate` on macOS, D1 still works unchanged (the plugin only
   talks to the CLI). D2 would need to know the mechanism. Another reason to
   prefer D1.

## Note on project status

The README currently marks cc-caffeine **DEPRECATED / UNMAINTAINED**, pointing
users to Amphetamine. Adding OpenCode support is a new maintenance commitment;
decide whether that's in scope before investing here.
