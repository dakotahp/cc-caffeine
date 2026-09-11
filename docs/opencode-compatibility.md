# OpenCode Compatibility

> Status: **implemented (D1)**. A thin OpenCode plugin triggers the existing
> `cc-caffeine` CLI, so all session/server/idle-timeout logic stays in one place.
> See "Implementation" below.

## Context

cc-caffeine currently integrates with **Claude Code** via external command hooks
(`hooks/hooks.json`). Each hook spawns `npx cc-caffeine caffeinate|uncaffeinate`,
which writes to `~/.claude/plugins/cc-caffeine/sessions.json` and (on `caffeinate`)
ensures the Electron server is running. The server polls the JSON file and toggles
`powerSaveBlocker`.

OpenCode does **not** have Claude Code's external-command hook model. It has an
**in-process plugin system**. This note maps the two and describes the plugin.

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
| `UserPromptSubmit` | caffeinate | `command.executed` / `session.created` / `message.updated` (user role) |
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

`message.updated` is filtered to `role === 'user'` so assistant streaming does not
churn the session. Tool events are handled by the named `tool.execute.*` hooks,
not the catch-all `event` hook, so nothing fires twice.

## Two integration shapes

### D1 — Thin plugin that calls the existing CLI (implemented)

The plugin is a thin trigger; all logic stays in the project. The core lives in
`src/opencode.js` (CommonJS, shared with the Claude Code path) and is wrapped by
an ESM adapter `opencode/cc-caffeine.mjs` that OpenCode's plugin loader
understands.

```js
// opencode/cc-caffeine.mjs — the ESM adapter OpenCode loads
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createHooks } = require('../src/opencode.js')

export const CcCaffeine = async ctx => createHooks(ctx)
export default CcCaffeine
```

`createHooks(ctx)` returns the hooks object:

```js
// src/opencode.js (abridged)
const ACTIVATE = new Set(['session.created', 'command.executed', 'message.updated'])
const DEACTIVATE = new Set(['session.idle', 'session.deleted'])

const createHooks = ctx => {
  const fallback = ctx.directory ? path.basename(ctx.directory) : 'opencode'
  const handle = async (action, sessionId) => run(action, sessionId || fallback)
  return {
    event: async ({ event }) => {
      const action = actionForEvent(event.type)
      if (!action) return
      if (event.type === 'message.updated' && event.properties?.info?.role !== 'user') return
      await handle(action, extractSessionId(event))
     },
    'tool.execute.before': async input => handle('caffeinate', extractSessionId(null, input)),
    'tool.execute.after': async input => handle('caffeinate', extractSessionId(null, input))
   }
}
```

`run()` spawns the CLI (`node ./caffeine.js` when shipped in the repo, else
`npx cc-caffeine`) and pipes `{ session_id }` on stdin — the same format the
Claude Code hooks use. The spawner is injectable (`setSpawnFn`) for testing.

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

**Decision: D1.** Keep the plugin thin.

## Open items (resolved)

1. **Session id in events.** Confirmed against the `opencode-notifier` and
   `opencode-wakatime` plugins: the id lives in different places per event shape.
   `extractSessionId` in `src/opencode.js` handles all of them:
    - `session.created` / `session.deleted` / `session.updated` → `properties.info.id`
    - `session.idle` / `session.status` / `command.executed` → `properties.sessionID`
    - `message.updated` → `properties.info.sessionID`
    - `tool.execute.before` / `tool.execute.after` → `input.sessionID`
   When an event carries no id, the plugin falls back to the directory basename
   (so a session still exists and the idle timeout still releases it).
2. **Event frequency.** `tool.execute.before`/`after` fire on every tool call.
   Each spawns a short-lived CLI process — the same cost model as Claude Code's
   hooks, so not a regression. The server's idle timeout is the real release path,
   so the per-event spawns only refresh `last_activity`. No debounce needed.
3. **`$` vs `spawn`.** Standardized on `child_process.spawn` (via the injectable
   `setSpawnFn`) rather than Bun's `$`, so the core stays runtime-agnostic and
   testable without a real spawn. The adapter uses `createRequire` to bridge the
   CommonJS core into OpenCode's ESM loader.
4. **Where the plugin ships.** Two paths, both supported:
    - **Project-local:** drop `opencode/cc-caffeine.mjs` into
      `.opencode/plugins/` (or `~/.config/opencode/plugins/`).
    - **npm:** reference the package from `opencode.json`'s `plugin` array. The
      `resolveCli()` helper prefers the sibling `caffeine.js` (repo install) and
      falls back to `npx cc-caffeine` (npm install).
5. **Interaction with the native-caffeinate effort.** D1 is mechanism-agnostic:
   the plugin only talks to the CLI, so the native `caffeinate` backend works
   unchanged. No change needed here.

## Implementation

- `src/opencode.js` — framework-agnostic core: `actionForEvent`, `extractSessionId`,
   `resolveCli`, `run`, `createHooks`, `setSpawnFn`.
- `opencode/cc-caffeine.mjs` — ESM adapter OpenCode loads; bridges the core via
   `createRequire`.
- `test/opencode.test.js` — unit tests for the mapping, id extraction, and the
   spawn/stdin flow (injectable spawner).

### Install (project-local)

Copy the adapter into your project's plugin directory:

```bash
mkdir -p .opencode/plugins
cp opencode/cc-caffeine.mjs .opencode/plugins/cc-caffeine.mjs
```

OpenCode loads it at startup. Activity events refresh the session; the existing
server (auto-started by the first `caffeinate`) keeps the machine awake and
releases it after the idle timeout.

### Install (npm)

Reference the package from `opencode.json`:

```json
{
  "plugin": ["cc-caffeine"]
}
```

## Note on project status

The README currently marks cc-caffeine **DEPRECATED / UNMAINTAINED**, pointing
users to Amphetamine. Adding OpenCode support is a new maintenance commitment;
decide whether that's in scope before investing here.
