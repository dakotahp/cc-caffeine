/**
 * Backend module - Handles the sleep-prevention mechanism
 *
 * This is the swappable seam: today it uses Electron's powerSaveBlocker,
 * but it can be replaced by a native `caffeinate` backend without touching
 * the decision (poller) or UI (system-tray) layers.
 */

const { getElectron } = require('./electron');

/**
 * Enable caffeine (prevent sleep)
 * @param {object} state - Tray state object with isCaffeinated / powerSaveBlockerId
 */
const enableCaffeine = state => {
  if (!state.isCaffeinated) {
    const { powerSaveBlocker } = getElectron();
    state.isCaffeinated = true;
    state.powerSaveBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  }
};

/**
 * Disable caffeine (allow sleep)
 * @param {object} state - Tray state object with isCaffeinated / powerSaveBlockerId
 */
const disableCaffeine = state => {
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
