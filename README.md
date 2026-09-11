# cc-caffeine ☕⚡

**Transform your 9-to-5 into 9:30-to-4:30.** Arrive 30min later, leave 30min earlier, while getting the same work done because **Claude Code stays powered in your backpack while commuting.**

Work smarter, not longer.

## 🌍 The Modern Developer's Freedom

Tired of your laptop going to sleep during that perfect coding session because you left your desk 10 minutes? Frustrated when Claude Code disconnects mid-commute because your computer decided it was "idle"?

**cc-caffeine is your personal rebellion against screen timeout.** It keeps your machine awake so you can:

- 🚇 Code on the RER between Paris and suburbs
- ☕ Sip a latte at Starbucks during 3-hour debugging sessions
- 🚴‍♂️ Pedal to the coworking space while maintaining your active connection
- 📱 Respond to your girlfriend calls during work hours, without Claude Code interruptions

<img width="4032" height="1152" alt="image" src="https://github.com/user-attachments/assets/e1db7f4c-bd49-4ec5-8da4-2595c7f9b80a" />

## 🎯 Installation

Add this repo as a Claude Code plugin marketplace, then install the plugin:

```bash
/plugin marketplace add dakotahp/cc-caffeine
/plugin install cc-caffeine@cc-caffeine
```

Installing the plugin registers its hooks automatically, so no manual hook
configuration is needed. The hooks run the plugin's own bundled `caffeine.js`
(via `${CLAUDE_PLUGIN_ROOT}`), so no `npx` fetch is required.

*cc-caffine status*:

![](./assets/icon-coffee-empty.png) - Claude Code is idle

![](./assets/icon-coffee-full.png) - Claude Code is working hard

## 🌟 The Nomad Developer Manifesto

> "I'll never choose between coding and traveling again. With cc-caffeine, I can do both. My laptop will never sleep while I traverse cities in 5G, my Claude Code will stay connected in my backpack, and my productivity will soar. The future of mobile development is here, and it smells like coffee."

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

Otherwise, configure your Claude Code hooks manually, pointing each command at the
local `caffeine.js` (replace `/path/to/cc-caffeine` with your checkout):

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
