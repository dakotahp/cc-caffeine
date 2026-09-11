/**
 * OpenCode plugin core - translates OpenCode events into cc-caffeine CLI calls.
 *
 * OpenCode has no external-command hook model like Claude Code; it exposes an
 * in-process plugin system. This module is the framework-agnostic core: it maps
 * OpenCode events to the same `caffeinate`/`uncaffeinate` actions the Claude Code
 * hooks use, then shells out to the existing CLI so all session/server/idle-timeout
 * logic stays in one place (design D1 in docs/opencode-compatibility.md).
 *
 * The spawner is injectable (`setSpawnFn`) so the core can be tested without
 * spawning real processes, mirroring src/native.js.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let spawnFn = spawn;

const setSpawnFn = fn => {
  spawnFn = fn;
};

// Activity events refresh last_activity (caffeinate); idle/end events drop the
// session (uncaffeinate). The server's idle timeout is the real release path;
// the uncaffeinate events are belt-and-suspenders.
const ACTIVATE = new Set([
  'session.created',
  'command.executed',
  'message.updated'
]);

const DEACTIVATE = new Set(['session.idle', 'session.deleted']);

/**
 * Map an OpenCode event type to a CLI action, or null when the event is
 * irrelevant to sleep prevention.
 */
const actionForEvent = type => {
  if (DEACTIVATE.has(type)) {
    return 'uncaffeinate';
  }
  if (ACTIVATE.has(type)) {
    return 'caffeinate';
  }
  return null;
};

/**
 * Extract the session id from an OpenCode event or a tool-execution context.
 *
 * The field carrying the id differs by event shape (confirmed against the
 * opencode-notifier / opencode-wakatime plugins):
 *   - session.created / session.deleted / session.updated: properties.info.id
 *   - session.idle / session.status / command.executed:    properties.sessionID
 *   - message.updated:                                     properties.info.sessionID
 *   - tool.execute.before / tool.execute.after:            input.sessionID
 */
const extractSessionId = (event, input) => {
  if (input && typeof input.sessionID === 'string') {
    return input.sessionID;
  }
  if (event && typeof event.sessionID === 'string') {
    return event.sessionID;
  }

  const props = event && event.properties;
  if (!props) {
    return null;
  }
  if (typeof props.sessionID === 'string') {
    return props.sessionID;
  }

  const info = props.info;
  if (info && typeof info.id === 'string') {
    return info.id;
  }
  if (info && typeof info.sessionID === 'string') {
    return info.sessionID;
  }
  return null;
};

/**
 * Resolve the CLI to invoke. When the plugin ships inside the repo, the sibling
 * caffeine.js is used; when installed from npm, the `cc-caffeine` bin.
 */
const resolveCli = () => {
  const local = path.join(__dirname, '..', 'caffeine.js');
  if (fs.existsSync(local)) {
    return { cmd: 'node', args: [local] };
  }
  return { cmd: 'npx', args: ['cc-caffeine'] };
};

/**
 * Run a CLI action, piping `{ session_id }` on stdin (the Claude Code hook
 * format). Resolves on close or error so a failed spawn never rejects a hook.
 */
const run = (action, sessionId, cli) =>
  new Promise(resolve => {
    let child;
    try {
      const resolved = cli || resolveCli();
      child = spawnFn(resolved.cmd, [...resolved.args, action], {
        stdio: ['pipe', 'ignore', 'ignore']
      });
    } catch {
      // A failed spawn must never reject a hook.
      resolve();
      return;
    }

    if (sessionId) {
      child.stdin.write(JSON.stringify({ session_id: sessionId }));
    }
    child.stdin.end();

    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });

/**
 * Build the OpenCode hooks object. `ctx` is the plugin context
 * ({ client, directory, worktree, $ }); only `directory` is used, as a fallback
 * session id when an event carries none.
 */
const createHooks = ctx => {
  const directory = ctx && ctx.directory;
  const fallback = directory ? path.basename(directory) : 'opencode';

  const handle = async (action, sessionId) => {
    const id = sessionId || fallback;
    await run(action, id);
  };

  return {
    // Catch-all for session / command / message events. Tool events are ignored
    // here (actionForEvent returns null for them) and handled by the named
    // tool hooks below, so nothing fires twice.
    event: async ({ event }) => {
      const action = actionForEvent(event.type);
      if (!action) {
        return;
      }

      if (event.type === 'message.updated') {
        const info = event.properties && event.properties.info;
        if (!info || info.role !== 'user') {
          return;
        }
      }

      await handle(action, extractSessionId(event));
    },

    // Tool activity is the highest-frequency signal; each call refreshes
    // last_activity so the idle timeout keeps the machine awake during a turn.
    'tool.execute.before': async input => {
      await handle('caffeinate', extractSessionId(null, input));
    },
    'tool.execute.after': async input => {
      await handle('caffeinate', extractSessionId(null, input));
    }
  };
};

module.exports = {
  createHooks,
  actionForEvent,
  extractSessionId,
  resolveCli,
  run,
  setSpawnFn
};
