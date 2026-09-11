/**
 * Poller module - Decides when to prevent/release sleep
 *
 * Polls the session store and toggles the backend on/off. It does not know
 * about the UI: the caller injects an `onStateChange` callback so the tray
 * layer can react without the poller importing it (breaking the old cycle).
 */

const { getActiveSessionsWithLock, cleanupExpiredSessionsWithLock } = require('./session');
const { enableCaffeine, disableCaffeine } = require('./backend');

/**
 * Update caffeine status based on active sessions
 * @param {object} state - Tray state object
 * @param {(state: object) => void} [onStateChange] - Optional UI callback
 */
const updateCaffeineStatus = async (state, onStateChange) => {
  if (!state) {
    return;
  }

  try {
    await cleanupExpiredSessionsWithLock();
    const activeSessions = await getActiveSessionsWithLock();
    const shouldCaffeinate = activeSessions.length > 0;

    if (shouldCaffeinate && !state.isCaffeinated) {
      await enableCaffeine(state);
    } else if (!shouldCaffeinate && state.isCaffeinated) {
      await disableCaffeine(state);
    }

    if (onStateChange) {
      onStateChange(state);
    }
  } catch (error) {
    console.error('Error updating caffeine status:', error);
  }
};

/**
 * Start polling for session changes
 * @param {object} state - Tray state object
 * @param {number} [interval=10000] - Poll interval in ms
 * @param {(state: object) => void} [onStateChange] - Optional UI callback
 */
const startPolling = (state, interval = 10000, onStateChange) => {
  // Initial check
  updateCaffeineStatus(state, onStateChange);

  // Set up periodic polling
  state.pollInterval = setInterval(() => {
    updateCaffeineStatus(state, onStateChange);
  }, interval);

  // Expose a stop handle on the state so the UI layer can stop polling
  // without importing this module (breaks the poller <-> system-tray cycle).
  state.stopPolling = () => stopPolling(state);
};

/**
 * Stop polling
 * @param {object} state - Tray state object
 */
const stopPolling = state => {
  if (state && state.pollInterval) {
    try {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
    } catch (error) {
      console.error('Error clearing interval:', error.message);
    }
  }
};

module.exports = {
  updateCaffeineStatus,
  startPolling,
  stopPolling
};
