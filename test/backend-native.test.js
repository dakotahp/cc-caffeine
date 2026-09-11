const { test } = require('node:test');
const assert = require('node:assert');

const loadBackend = () => {
  delete require.cache[require.resolve('../src/backend')];
  return require('../src/backend');
};

const loadBoth = () => {
  delete require.cache[require.resolve('../src/backend')];
  delete require.cache[require.resolve('../src/native')];
  const backend = require('../src/backend');
  const native = require('../src/native');
  return { backend, native };
};

const makeState = () => ({
  isCaffeinated: false,
  powerSaveBlockerId: null,
  caffeinateProcess: null
});

const mockConfig = sleepBackend => {
  const configPath = require.resolve('../src/config');
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: { getConfig: () => ({ sleep_backend: sleepBackend }) }
  };
};

const mockElectron = () => {
  const calls = { start: [], stop: [] };
  const powerSaveBlocker = {
    start: reason => {
      calls.start.push(reason);
      return 1;
    },
    stop: id => {
      calls.stop.push(id);
      return true;
    }
  };
  const electronPath = require.resolve('../src/electron');
  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: { getElectron: () => ({ powerSaveBlocker }) }
  };
  return calls;
};

test('enableCaffeine dispatches to the native backend when configured', () => {
  mockConfig('native');
  const { backend, native } = loadBoth();
  const child = { killed: false, on: () => undefined, kill: () => undefined };
  native.setSpawnFn(() => child);

  const state = makeState();
  backend.enableCaffeine(state);

  assert.strictEqual(state.isCaffeinated, true);
  assert.strictEqual(state.caffeinateProcess, child);
});

test('disableCaffeine dispatches to the native backend when configured', () => {
  mockConfig('native');
  const { backend, native } = loadBoth();
  const child = {
    killed: false,
    on: () => child,
    kill: () => {
      child.killed = true;
    }
  };
  native.setSpawnFn(() => child);

  const state = makeState();
  backend.enableCaffeine(state);
  backend.disableCaffeine(state);

  assert.strictEqual(child.killed, true);
  assert.strictEqual(state.isCaffeinated, false);
});

test('enableCaffeine uses powerSaveBlocker for the electron backend', () => {
  mockConfig('electron');
  const calls = mockElectron();
  const { enableCaffeine } = loadBackend();

  const state = makeState();
  enableCaffeine(state);

  assert.strictEqual(state.isCaffeinated, true);
  assert.strictEqual(state.powerSaveBlockerId, 1);
  assert.deepStrictEqual(calls.start, ['prevent-app-suspension']);
});

test('disableCaffeine uses powerSaveBlocker for the electron backend', () => {
  mockConfig('electron');
  const calls = mockElectron();
  const { disableCaffeine } = loadBackend();

  const state = makeState();
  state.isCaffeinated = true;
  state.powerSaveBlockerId = 1;

  disableCaffeine(state);

  assert.strictEqual(state.isCaffeinated, false);
  assert.strictEqual(state.powerSaveBlockerId, null);
  assert.deepStrictEqual(calls.stop, [1]);
});
