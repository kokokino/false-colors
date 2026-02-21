# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**False Colors** is a cooperative social deduction game in the Kokokino Hub & Spoke architecture. Players (4-6, humans + AI fill-ins) crew a vessel facing escalating threats while suspecting one among them may be a traitor. Inspired by Shadows over Camelot, Avalon, and Werewolves Within.

The first theme is **Phantom Tides** — a ghost ship sailing cursed waters. Future content packs (Hollow Sanctum, Last Signal) share the same core engine.

The Hub (kokokino.com) handles authentication and billing via Lemon Squeezy; False Colors validates SSO tokens and checks subscriptions via Hub API.

## Commands

```bash
# Development (runs on port 3040)
meteor --port 3040 --settings settings.development.json

# Or use npm script
npm run dev

# Run tests once
npm test

# Run tests in watch mode
npm run test-app

# Analyze bundle size
npm run visualize

# Deploy to Meteor Galaxy
meteor deploy false-colors.kokokino.com --settings settings.production.json
```

## Tech Stack

| Technology | Purpose | Status |
|------------|---------|--------|
| **Meteor 3.4** | Real-time framework with MongoDB integration (requires Node.js 22.x) | Active |
| **Mithril.js 2.3** | UI framework - uses JavaScript to generate HTML (no JSX) | Active |
| **Pico CSS** | Classless CSS framework for minimal styling | Active |
| **jsonwebtoken** | JWT validation for SSO tokens | Active |
| **Babylon JS 8** | 3D rendering, WebXR for VR, physics via Havok JS | Planned |
| **PeerJS** | Peer-to-peer voice chat between human players | Planned |
| **Kokoro TTS (Kokoro.js)** | Client-side text-to-speech for AI player voices (WebGPU + WASM) | Planned |
| **Web Speech API** | Client-side speech-to-text for human voice input | Planned |
| **Cloud LLM (GPT-4o-mini)** | AI dialogue style transfer, proxied through Meteor methods | Planned |

## Architecture

### SSO Flow
1. User clicks "Launch" in Hub → Hub generates RS256-signed JWT
2. User redirected to `/sso?token=<jwt>` on spoke
3. Spoke validates JWT signature with Hub's public key
4. Spoke calls Hub API for fresh user data
5. Spoke creates local Meteor session via custom `Accounts.registerLoginHandler`

### Game State Machine (Planned)
Turn-based with authoritative server state. Game state lives in MongoDB, actions via Meteor Methods, reactive updates via DDP publications.

Round flow (Phantom Tides):
1. **Threat Phase** — New threat revealed, doom tracker advances
2. **Toll Phase** (mandatory evil) — Every player takes a harmful action (provides traitor cover)
3. **Discussion Phase** (30s) — Voice/text discussion
4. **Action Phase** — Secretly assign role action to a threat, simultaneous reveal
5. **Accusation** (optional) — Correct = traitor caught; wrong = lose next action

### AI Pipeline (Planned)
- **Decision engine** — Rule-based utility AI on server (no LLM), decides game actions
- **Template engine** — Fills dialogue slots from game state (80% of AI speech, free)
- **Cloud LLM proxy** — Style transfer for personality (~20% of lines, ~$0.001/game via GPT-4o-mini)
- **Kokoro TTS** — Client-side text-to-speech (WebGPU/WASM, 48+ voices, free)
- **Web Speech API** — Client-side STT for human voice commands (free)

### Voice System (Planned)
- PeerJS for human-to-human P2P audio during discussion phases
- Kokoro-82M TTS on client for AI character voices
- Web Speech API for STT (Whisper WASM fallback for non-Chromium)

### 3D Client (Planned)
- Babylon JS 8 scene (ship's war table for Phantom Tides)
- WebXR for VR support; arc-rotate camera for PC
- Each theme is a content pack: scene + roles + dialogue templates + art/audio

### Key Directories
- `imports/hub/` - Hub integration (SSO handler, API client, subscription checking)
- `imports/ui/components/` - Mithril components including `RequireAuth` and `RequireSubscription` HOCs
- `imports/ui/pages/` - Route pages including `SsoCallback` for SSO handling
- `server/accounts.js` - Custom login handler for SSO
- `server/methods.js` - Meteor methods (chat.send, user.getSubscriptionStatus)
- `server/publications.js` - Data publications (chatMessages, userData)
- `imports/game/` - Game state machine, round resolution, AI decision engine (planned)
- `imports/ai/` - AI dialogue templates, cloud LLM proxy, personality system (planned)
- `imports/voice/` - Voice chat manager, TTS integration, STT handling (planned)
- `imports/3d/` - Babylon JS scenes, WebXR setup, theme assets (planned)

### Settings Structure
```json
{
  "public": {
    "appId": "false_colors",
    "appName": "False Colors",
    "hubUrl": "https://kokokino.com",
    "requiredProducts": ["product_id"],
    "game": {
      "minPlayers": 4,
      "maxPlayers": 6,
      "discussionTimeSec": 30,
      "roundCount": 10
    }
  },
  "private": {
    "hubApiKey": "api-key-from-hub",
    "hubApiUrl": "https://kokokino.com/api/spoke",
    "hubPublicKey": "-----BEGIN PUBLIC KEY-----...",
    "ai": {
      "llmProvider": "openai",
      "llmApiKey": "your-api-key",
      "llmModel": "gpt-4o-mini",
      "maxCallsPerGame": 20
    }
  }
}
```

## Code Conventions

### Meteor v3
- Use async/await patterns (no fibers) - e.g., `Meteor.users.findOneAsync()`, `insertAsync()`, `updateAsync()`
- Do not use `autopublish` or `insecure` packages
- When recommending Atmosphere packages, ensure Meteor v3 compatibility

### JavaScript Style
- Use `const` by default, `let` when needed, avoid `var`
- Always use curly braces with `if` blocks
- Avoid early returns - prefer single return statement at end
- Each variable declaration on its own line (no comma syntax)
- Use readable variable names (`document` not `doc`)

### UI Style
- Leverage Pico CSS patterns - avoid inline styles
- Use semantic CSS class names (`warning` not `yellow`)
- Use Mithril for UI; Blaze integration is acceptable for packages like accounts-ui
- Avoid React unless specifically instructed

### Security
- Validate all user input using `check()` from `meteor/check`
- Implement rate limiting on sensitive endpoints
- Never store Hub's private key in spoke code
- Sanitize user content before display to prevent XSS
- All cloud LLM calls proxied through Meteor methods — API keys never leave the server

## Patterns

### Mithril Components
Components are plain objects with lifecycle hooks:
- `oninit(vnode)` - Initialize state, start async operations
- `oncreate(vnode)` - Set up subscriptions, Tracker computations
- `onupdate(vnode)` - React to prop/state changes
- `onremove(vnode)` - Cleanup (stop computations, unsubscribe)
- `view(vnode)` - Return virtual DOM

State lives on `vnode.state`. Call `m.redraw()` after async operations complete.

### Meteor-Mithril Reactivity
The `MeteorWrapper` component in `client/main.js` bridges Meteor's reactivity with Mithril:
```javascript
Tracker.autorun(() => {
  Meteor.user(); Meteor.userId(); Meteor.loggingIn();
  m.redraw();
});
```

### Publications
- Always check `this.userId` before publishing sensitive data
- Return `this.ready()` for unauthenticated users
- Use field projections to limit exposed data

### Methods
- Use `check()` for input validation at method start
- Throw `Meteor.Error('error-code', 'message')` for client-handleable errors
- Common error codes: `not-authorized`, `not-found`, `invalid-message`, `subscription-required`

### Migrations
Uses `quave:migrations` package. Migrations in `server/migrations/` with `up()` and `down()` methods. Auto-run on startup via `Migrations.migrateTo('latest')`.

### Rate Limiting
Configure in `server/rateLimiting.js` using `DDPRateLimiter.addRule()`:
```javascript
DDPRateLimiter.addRule({ type: 'method', name: 'chat.send' }, 10, 10000);
```

### Testing
Run with `meteor test --driver-package meteortesting:mocha`. Tests use Mocha with Node.js assert. Server-only tests wrap in `if (Meteor.isServer)`.

### Database Indexes
Created in `server/indexes.js` during `Meteor.startup()`. Uses TTL indexes for automatic cleanup:
```javascript
collection.createIndexAsync({ createdAt: 1 }, { expireAfterSeconds: 600 });
```
Used for SSO nonces (replay attack prevention) and subscription cache.
