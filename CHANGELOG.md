# Changelog

All notable changes to cc-caffeine are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-09-11

### Added

- **Native sleep-prevention backend** (`sleep_backend: "native"`): prevents sleep
  via the OS `caffeinate` utility (`src/native.js`) instead of Electron's
  `powerSaveBlocker`, so the server can run as a plain Node process with no
  system tray.
- **Swappable backend seam** (`src/backend.js`): dispatches to a backend by the
  `sleep_backend` config setting; the decision (`poller`) and UI (`system-tray`)
  layers stay backend-agnostic.
- **`sleep_backend` config setting** (`src/config.js`): `"electron"` (default,
  powerSaveBlocker + tray) or `"native"` (OS `caffeinate`, no Electron).
- **Native server startup** (`src/server.js`): runs the polling loop as a plain
  Node process for the native backend; new `native-server` npm script.
- **PID recognition** for the native Node caffeine server (`src/pid.js`).
- Tests for the native backend and config (`test/native.test.js`,
  `test/backend-native.test.js`, `test/pid.test.js`, `test/config.test.js`).
- README configuration section documenting `sleep_backend` and the config file.

### Changed

- `poller` and `system-tray` no longer import each other; the poller ↔ system-tray
  cycle is broken via callback injection (`updateCaffeineStatus` takes an optional
  `onStateChange` callback, `startPolling` stores a `stopPolling` handle on the
  state object).
- `system-tray` awaits `disableCaffeine` on shutdown.
- `electron` no longer force-exits on load failure.
