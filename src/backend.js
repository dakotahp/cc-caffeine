/**
 * Backend module - Handles the sleep-prevention mechanism
 *
 * This is the swappable seam: it dispatches to one of two backends based on
 * the `sleep_backend` config setting:
 *   - 'electron' (default): Electron's powerSaveBlocker
 *   - 'native':     the OS `caffeinate` utility via src/native.js
 *
 * The decision (poller) and UI (system-tray) layers stay backend-agnostic.
 */

const { getElectron } = require('./electron');
const { getConfig } = require('./config');
const native = require('./native');

/**
 * Enable caffeine (prevent sleep)
 * @param {object} state - Tray state object
 */
const enableCaffeine = state => {
  if (getConfig().sleep_backend === 'native') {
    native.enableCaffeine(state);
    return;
  }

  if (!state.isCaffeinated) {
    const { powerSaveBlocker } = getElectron();
    state.isCaffeinated = true;
    state.powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  }
};

/**
 * Disable caffeine (allow sleep)
 * @param {object} state - Tray state object
 */
const disableCaffeine = state => {
  if (getConfig().sleep_backend === 'native') {
    native.disableCaffeine(state);
    return;
  }

  if (state.isCaffeinated) {
    const { powerSaveBlocker } = getElectron();
    state.isCaffeinated = false;
    if (state.powerSaveBlockerId !== null) {
      powerSaveBlocker.stop(state.powerSaveBlockerId);
      state.powerSaveBlockerId = null;
    }
  }
};

module.exports = {
  enableCaffeine,
  disableCaffeine
};
