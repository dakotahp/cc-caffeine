/**
 * Native backend - Prevents sleep by spawning the OS `caffeinate` utility.
 *
 * This is the alternative to the Electron powerSaveBlocker backend. It runs
 * without Electron, so the server can be a plain Node process. The child
 * process is stored on the state object and killed on disable/shutdown.
 *
 * The spawner is injectable (`setSpawnFn`) so the backend can be tested
 * without spawning real processes.
 */

const { spawn } = require('child_process');

let spawnFn = spawn;

const setSpawnFn = fn => {
  spawnFn = fn;
};

/**
 * Enable caffeine (prevent sleep) by spawning `caffeinate -i`.
 * @param {object} state - Tray state object with isCaffeinated / caffeinateProcess
 */
const enableCaffeine = state => {
  if (state.isCaffeinated) {
    return;
  }

  const child = spawnFn('caffeinate', ['-i'], { stdio: 'ignore' });

  child.on('exit', () => {
    if (state.caffeinateProcess === child) {
      state.caffeinateProcess = null;
      state.isCaffeinated = false;
    }
  });

  state.caffeinateProcess = child;
  state.isCaffeinated = true;
};

/**
 * Disable caffeine (allow sleep) by killing the `caffeinate` child.
 * @param {object} state - Tray state object with isCaffeinated / caffeinateProcess
 */
const disableCaffeine = state => {
  if (!state.isCaffeinated || !state.caffeinateProcess) {
    return;
  }

  const child = state.caffeinateProcess;
  child.kill();
  state.caffeinateProcess = null;
  state.isCaffeinated = false;
};

module.exports = {
  enableCaffeine,
  disableCaffeine,
  setSpawnFn
};
