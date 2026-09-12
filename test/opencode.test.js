const { test } = require('node:test');
const assert = require('node:assert');

// The plugin is an ESM module (OpenCode's loader requires it), so load it via
// dynamic import. A unique query string per call gives a fresh module instance,
// the ESM equivalent of the old `delete require.cache`, so `setSpawnFn` stays
// isolated between tests.
const loadOpencode = async () => {
  const mod = await import(`../opencode/cc-caffeine.mjs?bust=${Date.now()}-${Math.random()}`);
  return mod;
};

const makeFakeChild = () => {
  const handlers = {};
  let stdin = '';
  const child = {
    stdin: {
      write: chunk => {
        stdin += chunk;
        return true;
      },
      end: () => {}
    },
    on: (event, cb) => {
      handlers[event] = cb;
      return child;
    }
  };
  // Fire close on the next tick so the run() promise resolves without the test
  // having to drive it manually (stdin is written synchronously before close).
  process.nextTick(() => handlers.close && handlers.close());
  return {
    child,
    handlers,
    getStdin: () => stdin
  };
};

test('actionForEvent maps activity events to caffeinate', async () => {
  const { actionForEvent } = await loadOpencode();

  assert.strictEqual(actionForEvent('session.created'), 'caffeinate');
  assert.strictEqual(actionForEvent('command.executed'), 'caffeinate');
  assert.strictEqual(actionForEvent('message.updated'), 'caffeinate');
});

test('actionForEvent maps idle/end events to uncaffeinate', async () => {
  const { actionForEvent } = await loadOpencode();

  assert.strictEqual(actionForEvent('session.idle'), 'uncaffeinate');
  assert.strictEqual(actionForEvent('session.deleted'), 'uncaffeinate');
});

test('actionForEvent returns null for irrelevant events', async () => {
  const { actionForEvent } = await loadOpencode();

  assert.strictEqual(actionForEvent('tool.execute.before'), null);
  assert.strictEqual(actionForEvent('tool.execute.after'), null);
  assert.strictEqual(actionForEvent('session.status'), null);
  assert.strictEqual(actionForEvent('unknown.event'), null);
});

test('extractSessionId reads properties.info.id for lifecycle events', async () => {
  const { extractSessionId } = await loadOpencode();

  const event = { type: 'session.created', properties: { info: { id: 'sess-1' } } };
  assert.strictEqual(extractSessionId(event), 'sess-1');
});

test('extractSessionId reads properties.sessionID for idle events', async () => {
  const { extractSessionId } = await loadOpencode();

  const event = { type: 'session.idle', properties: { sessionID: 'sess-2' } };
  assert.strictEqual(extractSessionId(event), 'sess-2');
});

test('extractSessionId reads properties.info.sessionID for message events', async () => {
  const { extractSessionId } = await loadOpencode();

  const event = {
    type: 'message.updated',
    properties: { info: { role: 'user', sessionID: 'sess-3' } }
  };
  assert.strictEqual(extractSessionId(event), 'sess-3');
});

test('extractSessionId reads input.sessionID for tool events', async () => {
  const { extractSessionId } = await loadOpencode();

  assert.strictEqual(extractSessionId(null, { sessionID: 'sess-4' }), 'sess-4');
});

test('extractSessionId returns null when no id is present', async () => {
  const { extractSessionId } = await loadOpencode();

  assert.strictEqual(extractSessionId({ type: 'session.idle', properties: {} }), null);
  assert.strictEqual(extractSessionId(null, {}), null);
});

test('createHooks returns the expected hook keys', async () => {
  const { createHooks } = await loadOpencode();

  const hooks = createHooks({ directory: '/tmp/proj' });

  assert.ok(typeof hooks.event === 'function');
  assert.ok(typeof hooks['tool.execute.before'] === 'function');
  assert.ok(typeof hooks['tool.execute.after'] === 'function');
});

test('event hook caffeinates on session.created with the session id', async () => {
  const { createHooks, setSpawnFn } = await loadOpencode();
  const fake = makeFakeChild();
  setSpawnFn(() => fake.child);

  const hooks = createHooks({ directory: '/tmp/proj' });
  await hooks.event({ event: { type: 'session.created', properties: { info: { id: 'sess-1' } } } });

  assert.deepStrictEqual(JSON.parse(fake.getStdin()), { session_id: 'sess-1' });
});

test('event hook uncaffeinates on session.idle with the session id', async () => {
  const { createHooks, setSpawnFn } = await loadOpencode();
  const fake = makeFakeChild();
  setSpawnFn(() => fake.child);

  const hooks = createHooks({ directory: '/tmp/proj' });
  await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'sess-2' } } });

  assert.deepStrictEqual(JSON.parse(fake.getStdin()), { session_id: 'sess-2' });
});

test('event hook ignores irrelevant events without spawning', async () => {
  const { createHooks, setSpawnFn } = await loadOpencode();
  let spawnCount = 0;
  setSpawnFn(() => {
    spawnCount++;
    return makeFakeChild().child;
  });

  const hooks = createHooks({ directory: '/tmp/proj' });
  await hooks.event({ event: { type: 'session.status', properties: {} } });

  assert.strictEqual(spawnCount, 0);
});

test('event hook ignores assistant message.updated (only user activity caffeinates)', async () => {
  const { createHooks, setSpawnFn } = await loadOpencode();
  let spawnCount = 0;
  setSpawnFn(() => {
    spawnCount++;
    return makeFakeChild().child;
  });

  const hooks = createHooks({ directory: '/tmp/proj' });
  await hooks.event({
    event: { type: 'message.updated', properties: { info: { role: 'assistant', sessionID: 's' } } }
  });

  assert.strictEqual(spawnCount, 0);
});

test('tool.execute.before caffeinates using the input session id', async () => {
  const { createHooks, setSpawnFn } = await loadOpencode();
  const fake = makeFakeChild();
  setSpawnFn(() => fake.child);

  const hooks = createHooks({ directory: '/tmp/proj' });
  await hooks['tool.execute.before']({ sessionID: 'sess-4' });

  assert.deepStrictEqual(JSON.parse(fake.getStdin()), { session_id: 'sess-4' });
});

test('event hook falls back to the directory basename when no id is present', async () => {
  const { createHooks, setSpawnFn } = await loadOpencode();
  const fake = makeFakeChild();
  setSpawnFn(() => fake.child);

  const hooks = createHooks({ directory: '/tmp/my-project' });
  await hooks.event({ event: { type: 'session.idle', properties: {} } });

  assert.deepStrictEqual(JSON.parse(fake.getStdin()), { session_id: 'my-project' });
});

test('run resolves on spawn error without throwing', async () => {
  const { run, setSpawnFn } = await loadOpencode();
  setSpawnFn(() => {
    throw new Error('spawn failed');
  });

  await assert.doesNotReject(run('caffeinate', 'sess-1'));
});
