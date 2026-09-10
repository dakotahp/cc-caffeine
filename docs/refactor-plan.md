# Refactor Plan: Split the Three Concerns in `system-tray.js`

> Status: **plan, not yet implemented**. This is the **first next step** — a pure
> refactor with **no functional change**. It is a prerequisite for the native
> `caffeinate` work (`docs/native-caffeinate-plan.md`): the `backend.js` file this
> refactor creates is exactly the seam that plan fills in.

## Why

`src/system-tray.js` (257 lines) mixes three concerns that the native-caffeinate
and opencode efforts will need to change independently:

| Concern | What it is | Current functions in `system-tray.js` |
|---|---|---|
| **Mechanism** | *how* sleep is prevented | `enableCaffeine`, `disableCaffeine` (→ `powerSaveBlocker`) |
| **Decision** | *when* to prevent/release (idle) | `updateCaffeineStatus`, `startPolling`, `stopPolling` |
| **UI** | the system tray indicator | `createIcon`, `createSystemTray`, `updateTrayIcon`, `getSystemTray`, `getSystemTrayState`, `shutdownServer` |

Today they're coupled in one file. Splitting them lets the mechanism become
swappable (native vs Electron) and the UI become optional (tray off) without
touching the other two.

## Target structure

```
src/
├── backend.js      NEW — mechanism: enableCaffeine / disableCaffeine
├── poller.js       NEW — decision:  updateCaffeineStatus / startPolling / stopPolling
└── system-tray.js  SLIM — UI only:  createIcon / createSystemTray / updateTrayIcon /
                                     getSystemTray / getSystemTrayState / shutdownServer
```

`backend.js` is the same file the native plan extends — so this refactor is the
prerequisite, not throwaway work.

## Dependency graph (after split)

```
poller ──uses──▶ backend        (decision calls enable/disable)
poller ──uses──▶ session        (getActiveSessions, cleanupExpired)
poller ──uses──▶ system-tray    (updateTrayIcon)   ← the coupling to resolve
system-tray ──uses──▶ backend   (disable, in shutdownServer)
system-tray ──uses──▶ pid       (removePidFileWithLock, in shutdownServer)
backend ──uses──▶ electron      (powerSaveBlocker, for now)
```

### The one problem: a cycle between `poller` and `system-tray`

`updateCaffeineStatus` (decision) currently calls `updateTrayIcon` (UI), and
`shutdownServer` (UI) calls `stopPolling` (decision). That's a circular import.
CommonJS tolerates it at runtime (calls are deferred, not at module load), but
it's ugly and it's exactly the coupling the native work wants gone (when the tray
is off, there's nothing to update).

**Resolution — callback injection (no functional change):**

- `updateCaffeineStatus(state, onStateChange)` takes an optional callback instead
   of importing `updateTrayIcon`. The UI passes `updateTrayIcon` in.
- `stopPolling` stays in `poller.js`; `shutdownServer` calls it via the state
   object / a passed-in reference, so `system-tray` no longer imports `poller`.

Result: `poller` no longer imports `system-tray`; the cycle is gone. The callback
is also the seam for "tray off" mode (pass no callback → no UI update).

## File-by-file changes

### 1. `src/backend.js` (NEW) — mechanism

Move `enableCaffeine`/`disableCaffeine` here verbatim. Still uses
`powerSaveBlocker` (no native yet — that's the next plan). Depends on
`electron.js`. Exports `enableCaffeine`, `disableCaffeine`.

### 2. `src/poller.js` (NEW) — decision

Move `updateCaffeineStatus`, `startPolling`, `stopPolling` here. Change
`updateCaffeineStatus` to take an `onStateChange` callback (see above) instead of
calling `updateTrayIcon` directly. Depends on `session.js` + `backend.js`.

### 3. `src/system-tray.js` (SLIM) — UI

Keep `createIcon`, `createSystemTray`, `updateTrayIcon`, `getSystemTray`,
`getSystemTrayState`, `shutdownServer`. `createSystemTray`/`startPolling` wiring
passes `updateTrayIcon` as the `onStateChange` callback. `shutdownServer` calls
`backend.disableCaffeine` + `poller.stopPolling` + `pid.removePidFileWithLock`.

### 4. `src/server.js` — update imports

`server.js` currently imports `getSystemTray`, `startPolling`, `shutdownServer`
from `system-tray.js`. After the split, `startPolling` lives in `poller.js`.
Update the import; the call sites stay the same.

### 5. Tests

- Existing `test/*.js` keep passing unchanged (they don't import `system-tray`).
- Optionally add a smoke test that `backend.enableCaffeine`/`disableCaffeine`
   toggle `state.isCaffeinated` (mock `powerSaveBlocker`).

## What does NOT change

- Behavior: identical. Same `powerSaveBlocker` calls, same polling interval, same
   tray.
- `src/session.js`, `src/pid.js`, `src/config.js`, `src/commands.js`,
   `src/electron.js`, `hooks/hooks.json` — unchanged.
- No native `caffeinate`, no `tray` config flag, no opencode plugin — those are
   later plans.

## Verification

- `node --test` passes (no functional change).
- `npm run lint` clean.
- Manual: `node caffeine.js caffeinate` → tray appears, `pmset -g assertions`
   shows the assertion; `uncaffeinate` + idle → tray clears. Same as before.

## Decision: TypeScript vs JSDoc for new files

The user asked whether new files should start as TypeScript. **Recommendation:
JSDoc types, not TS.**

| | JSDoc (`@typedef`/`@param`/`@returns`) | TypeScript |
|---|---|---|
| New deps | none | `typescript` devDep (~30MB, dev-only) |
| Build step | none | `tsc` compile + output dir, **or** native type-stripping |
| Fits CJS + `node --test` + ESLint | yes, unchanged | awkward — codebase is CommonJS; native type-stripping is ESM-oriented and doesn't type-check |
| Editor type-checking | yes (via optional `checkJs`) | yes |
| Bloat | none | real, for a 7-file project |

The project is small and CommonJS. TS here means either a compile step (bloat +
complexity) or native type-stripping (no type-checking, awkward with CJS). JSDoc
gives editor types with zero deps and zero build step, and works with the
existing toolchain unchanged. **If TS is wanted later, it's a separate migration,
not part of this refactor.** New files in this plan carry JSDoc types.

## Phasing

1. Create `src/backend.js` (move mechanism).
2. Create `src/poller.js` (move decision, add `onStateChange` callback).
3. Slim `src/system-tray.js` to UI; wire the callback.
4. Update `src/server.js` imports.
5. Run `node --test` + `npm run lint`; manual smoke test.
