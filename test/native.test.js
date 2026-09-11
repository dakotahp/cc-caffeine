const { test } = require('node:test');
const assert = require('node:assert');

const loadNative = () => {
  delete require.cache[require.resolve('../src/native')];
  return require('../src/native');
};

const makeState = () => ({
  isCaffeinated: false,
  caffeinateProcess: null
});

const makeFakeChild = () => {
  const handlers = {};
  const child = {
    killed: false,
    on: (event, cb) => {
      handlers[event] = cb;
      return child;
    },
    kill: () => {
      child.killed = true;
      if (handlers.exit) {
        handlers.exit();
      }
    }
  };
  return { child, handlers };
};

test('enableCaffeine spawns caffeinate -i and stores the child', () => {
  const { enableCaffeine, setSpawnFn } = loadNative();
  const { child } = makeFakeChild();
  const calls = [];
  setSpawnFn((cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return child;
  });

  const state = makeState();
  enableCaffeine(state);

  assert.strictEqual(state.isCaffeinated, true);
  assert.strictEqual(state.caffeinateProcess, child);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].cmd, 'caffeinate');
  assert.deepStrictEqual(calls[0].args, ['-i']);
});

test('enableCaffeine is a no-op when already caffeinated', () => {
  const { enableCaffeine, setSpawnFn } = loadNative();
  let spawnCount = 0;
  setSpawnFn(() => {
    spawnCount++;
    return makeFakeChild().child;
  });

  const state = makeState();
  state.isCaffeinated = true;
  state.caffeinateProcess = makeFakeChild().child;

  enableCaffeine(state);

  assert.strictEqual(spawnCount, 0);
});

test('disableCaffeine kills the child and clears state', () => {
  const { enableCaffeine, disableCaffeine, setSpawnFn } = loadNative();
  const { child } = makeFakeChild();
  setSpawnFn(() => child);

  const state = makeState();
  enableCaffeine(state);
  disableCaffeine(state);

  assert.strictEqual(child.killed, true);
  assert.strictEqual(state.isCaffeinated, false);
  assert.strictEqual(state.caffeinateProcess, null);
});

test('disableCaffeine is a no-op when not caffeinated', () => {
  const { disableCaffeine } = loadNative();
  const state = makeState();

  disableCaffeine(state);

  assert.strictEqual(state.isCaffeinated, false);
  assert.strictEqual(state.caffeinateProcess, null);
});

test('child exit clears state when the process dies on its own', () => {
  const { enableCaffeine, setSpawnFn } = loadNative();
  const { child, handlers } = makeFakeChild();
  setSpawnFn(() => child);

  const state = makeState();
  enableCaffeine(state);

  handlers.exit();

  assert.strictEqual(state.isCaffeinated, false);
  assert.strictEqual(state.caffeinateProcess, null);
});
