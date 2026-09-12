# cc-caffeine ☕⚡

**Transform your 9-to-5 into 9:30-to-4:30.** Arrive 30min later, leave 30min earlier, while getting the same work done because Claude Code keeps your laptop awake while working.

## 🎯 Installation

Add this repo as a Claude Code plugin marketplace, then install the plugin:

```bash
/plugin marketplace add dakotahp/cc-caffeine
/plugin install cc-caffeine@cc-caffeine
```

Installing the plugin registers its hooks automatically, so no manual hook configuration is needed. The hooks run the plugin's own bundled `caffeine.js`(via `${CLAUDE_PLUGIN_ROOT}`), so no `npx` fetch is required.

*cc-caffine status*:

![](./assets/icon-coffee-empty.png) - Claude Code is idle

![](./assets/icon-coffee-full.png) - Claude Code is working hard

## ✨ Why It's Pure Magic

**Automatic Intelligence**: cc-caffeine knows when Claude Code is working and prevents your computer from sleeping. Period.

**System Tray Chic**: A tiny ☕️ icon in your status bar to know instantly if you're protected.

**Perfect Sessions**: Multiple simultaneous Claude Code sessions? No problem.

**Zero Configuration**: Install, run, forget. It's like coffee, but for your computer.

## 🎯 Use Cases That Will Change Your Life

### ☕ **The Coffee Shop Marathon**
- 3 hours of focus without ever losing your connection
- No more waking your screen every 5 minutes
- Baristas will recognize you as "the developer who never sleeps"
- Your productivity increases proportionally to your caffeine consumption

### 🏠 **Flexible Remote Work**
- Transform your balcony into an outdoor office
- Code from the terrace in fresh air
- No more choosing between "work" and "enjoy the sunshine"
- Your boss will think you're working 24/7 (that's an advantage, right?)

## 🛠️ Technical Features (With Style)

- **🎯 Session-Based Management**: Intelligently manages multiple simultaneous Claude Code sessions
- **🔄 Auto-Cleanup**: Forget to disable - sessions automatically expire after 15 minutes without tool call or user input
- **🚀 Headless**: Just an elegant discreet system tray icon
- **⚡ Native Sleep Prevention**: Electron's power management - cross-platform sleep prevention
- **🍎 Cross-Platform**: Works on macOS, Linux, and Windows (yes, even Windows!)

## 🎭 Claude Code Integration

Hooks will be configured automatically if you import the project as a Claude Code plugin.

Otherwise, configure your Claude Code hooks manually, pointing each command at the local `caffeine.js` (replace `/path/to/cc-caffeine` with your checkout):

```json
{
   "UserPromptSubmit": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "node /path/to/cc-caffeine/caffeine.js caffeinate"
         }
       ]
     }
   ],
   "PreToolUse": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "node /path/to/cc-caffeine/caffeine.js caffeinate"
         }
       ]
     }
   ],
   "PostToolUse": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "node /path/to/cc-caffeine/caffeine.js caffeinate"
         }
       ]
     }
   ],
   "Notification": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "node /path/to/cc-caffeine/caffeine.js uncaffeinate"
         }
       ]
     }
   ],
   "Stop": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "node /path/to/cc-caffeine/caffeine.js uncaffeinate"
         }
       ]
     }
   ],
   "SessionEnd": [
     {
       "hooks": [
         {
           "type": "command",
           "command": "node /path/to/cc-caffeine/caffeine.js uncaffeinate"
         }
       ]
     }
   ]
}
```

## 🎭 OpenCode Integration

OpenCode has no external-command hooks, so cc-caffeine ships a thin in-process
plugin that triggers the same CLI. Install it globally so it loads no matter
which project you run OpenCode from:

```bash
mkdir -p ~/.config/opencode/plugins
cp opencode/cc-caffeine.mjs ~/.config/opencode/plugins/cc-caffeine.mjs
```

OpenCode loads it at startup. Activity events refresh the session and the existing
server (auto-started on the first `caffeinate`) keeps the machine awake, releasing
it after the idle timeout.

To scope cc-caffeine to a single project instead, drop the same file in that
project's `.opencode/plugins/` directory — OpenCode only loads project-local
plugins while running in that project, so this only makes sense if you don't
want the machine kept awake for other projects.

## ⚙️ Configuration (Optional)

cc-caffeine works out of the box with **zero configuration** — the default
Electron backend needs nothing. To change behavior, create a config file at:

```
~/.claude/plugins/cc-caffeine/config.json
```

The directory is created automatically on first run, but the file itself is not. Create it by hand and add only the settings you want. Every setting is optional and falls back to the default below.

```json
{
  "session_timeout_minutes": 15,
  "icon_theme": "orange",
  "sleep_backend": "electron"
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `session_timeout_minutes` | `15` | Minutes of inactivity before a session expires |
| `icon_theme` | `"orange"` | Tray icon theme: `"orange"` (colored) or `"monochrome"` (black/white, auto-adapts to macOS dark mode) |
| `sleep_backend` | `"electron"` | Sleep-prevention mechanism: `"electron"` (powerSaveBlocker + system tray) or `"native"` (the MacOS `caffeinate` utility, no Electron, no tray) |

### Switching to the native backend

Set `sleep_backend` to `"native"` to prevent sleep via the MacOS `caffeinate` utility instead of Electron. The server then runs as a plain Node process with no system tray — useful when you don't want Electron at all.

```json
{
  "sleep_backend": "native"
}
```

> The native backend relies on the `caffeinate` utility, which is available on macOS. The Electron backend remains the cross-platform default.

## 💡 The Secret Sauce

cc-caffeine uses an intelligent client-server approach:

1. **Lightweight Client** (`caffeinate`/`uncaffeinate`) - No Electron loading, just fast JSON writes
2. **System Server** (`server`) - Headless Electron app that monitors sessions and manages power
3. **Communication** - JSON file with atomic locking for perfect coordination

## 📋 Requirements

- Node.js >= 14.0.0 (your coffee of choice)
- Electron (included automatically, like sugar in your espresso)
- A burning desire to code everywhere, all the time

## 🚀 Run without Claude Code

Run from the repo directory (after `npm install`):

```bash
# Start server + system tray
# (optional - will be started automatically)
node caffeine.js server

claude -p 'Write 10 pages of "lorem ipsum"'

node caffeine.js status
```

Manual switch:

```bash
# Activate caffeine for your coding session
echo '{"session_id": "session-abcd"}' | node caffeine.js caffeinate

# Your session is now protected!
# Claude can keep working while you sip coffee

# When you're done (or after 15 minutes of auto-cleanup)
echo '{"session_id": "session-abcd"}' | node caffeine.js uncaffeinate
```

## 💫 Fuel the Revolution

- ⭐️ **Star this repo** - Your star powers the caffeine engine!
- ☕️ **Buy me a coffee** - I'll literally use it to build more features while drinking actual coffee
- 🚀 **Sponsor the revolution** - Help me defeat screen timeouts worldwide!

[![💖 GitHub Sponsors](https://img.shields.io/github/sponsors/samber?style=for-the-badge)](https://github.com/sponsors/samber)

*Every sponsor gets a virtual high-five and the knowledge that somewhere, a developer is "coding" from a ski track because of you.* ✨

**PS**: If you encounter bugs, remember that even the best coffee has some grounds sometimes. But most of the time, it works like thunder. ⚡☕

## 📄 License

MIT - Use it, modify it, share it. Like good coffee, it's meant to be shared.
