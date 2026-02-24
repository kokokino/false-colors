# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**False Colors** is a cooperative social deduction game in the Kokokino Hub & Spoke architecture. Players (4-6, humans + AI fill-ins) crew a vessel facing escalating threats while suspecting one among them may be a traitor. Inspired by Shadows over Camelot, Avalon, and Werewolves Within.

The first theme is **Phantom Tides** — a ghost ship sailing cursed waters. Future content packs (Hollow Sanctum, Last Signal) share the same core engine.

The Hub (kokokino.com) handles authentication and billing via Lemon Squeezy; False Colors validates SSO tokens and checks subscriptions via Hub API.

## Commands

```bash
npm run dev                  # Development server on port 3040
npm test                     # Run tests once (needs no other Meteor running on port 3000)
npm run test-app             # Tests in watch mode (full-app)
npm run visualize            # Bundle size analysis
npm run prod-deploy          # Deploy to Meteor Galaxy
```

Note: `npm test` uses port 3000 by default. If the dev server is running, tests will fail with a port conflict. Stop the dev server first or use `meteor test --once --driver-package meteortesting:mocha --port 3050`.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Meteor 3.4** | Real-time framework with MongoDB (requires Node.js 22.x) |
| **Mithril.js 2.3** | UI framework — plain JS objects, no JSX |
| **Pico CSS** | Classless CSS framework |
| **OpenRouter** | LLM proxy for AI dialogue style transfer (Mistral Small Creative → Llama-4-Scout → GPT-4o-mini fallback chain) |

**Planned but not yet implemented:** Babylon JS 8 (3D/WebXR), PeerJS (voice chat), Kokoro TTS (AI voices), Web Speech API (STT)

## Architecture

### SSO Flow
1. User clicks "Launch" in Hub → Hub generates RS256-signed JWT
2. User redirected to `/sso?token=<jwt>` on spoke
3. Spoke validates JWT signature with Hub's public key
4. Spoke calls Hub API for fresh user data
5. Spoke creates local Meteor session via custom `Accounts.registerLoginHandler`

### Game State Machine
Turn-based with authoritative server state. Game state lives in MongoDB `games` collection, actions via Meteor Methods, reactive updates via DDP publications. The `game` publication uses `observeChanges` to strip secret fields (alignment, isAI, actionSubmissions, tollSubmissions, threatDeck) before sending to clients.

Round flow (Phantom Tides):
1. **Threat Phase** (2s auto) — New threat revealed, doom tracker advances (2 threats drawn from round 6+)
2. **Toll Phase** (30s) — Every player takes a harmful action: lose supply, add doom, or risk a curse
3. **Discussion Phase** (30s) — Text chat; AI players generate template-based dialogue with optional LLM style transfer
4. **Action Phase** (30s) — Secretly assign role action to a threat, simultaneous reveal and resolution
5. **Accusation** (15s, optional) — Nominate a suspect, majority vote decides; correct = traitor caught, wrong = accuser loses next action
6. **Round End** (2s auto) — Summarize, check win/loss conditions, advance round

Game ends when: doom reaches threshold (doom loss), all threats resolved and rounds complete (loyal win), or phantom is caught/phantom wins by doom.

### AI Pipeline
- **Decision engine** (`imports/game/ai/`) — Rule-based utility AI on server, personality-weighted strategies for toll, action, and accusation decisions
- **Suspicion tracker** — Per-game tracking of AI suspicion toward each player
- **Dialogue engine** (`imports/ai/dialogueEngine.js`) — Template-based dialogue with slot filling (~80% of AI speech, free)
- **LLM style transfer** (`imports/ai/llmProxy.js`) — OpenRouter with model fallback chain (~20% of lines, ~$0.001/game)
- **6 AI personalities**: grizzled, nervous, jovial, analytical, reckless, devout — each with tuned traits for tollCaution, actionOptimality, suspicionThreshold, accuseEagerness, chatFrequency

### Server Method Organization
- `server/methods.js` — User/subscription methods (`user.getSubscriptionStatus`, `user.hasAccess`)
- `server/gameMethods.js` — Game phase methods (`game.submitToll`, `game.submitAction`, `game.sendMessage`, `game.accuse`, `game.voteAccusation`)
- `server/roomMethods.js` — Matchmaking (`matchmaking.findOrCreate`, `rooms.touch`, `rooms.leave`)
- `server/roomCleanup.js` — Periodic cleanup of stale/finished rooms (every 30 min)

### Collections

Collection instances are defined in `imports/api/collections.js`. Enums and constants are re-exported from `imports/lib/collections/games.js`. Import collections from `api/collections.js`; import enums/constants from `lib/collections/games.js`.

Six MongoDB collections — all game data is ephemeral (24-hour TTL indexes on `createdAt`/`updatedAt`):
- `usedNonces` — SSO replay prevention (10-min TTL)
- `subscriptionCache` — Hub subscription cache (5-min TTL)
- `gameRooms` — Rooms/matchmaking
- `games` — Live game state (the main document)
- `gameMessages` — Chat messages
- `gameLogs` — Append-only event log

### Concurrency & Submission Patterns

**Atomic submissions** — All player submissions (toll, action, vote) use atomic check-and-push to prevent TOCTOU races:
```js
const updated = await Games.updateAsync(
  { _id: gameId, currentPhase: GamePhase.TOLL, 'tollSubmissions.seatIndex': { $ne: player.seatIndex } },
  { $push: { tollSubmissions: { seatIndex, choice } }, $set: { updatedAt: new Date() } }
);
if (updated === 0) { throw new Meteor.Error('already-submitted', '...'); }
```
Follow this pattern for any new submission-type method.

**In-memory resolve locks** — `stateMachine.js` uses a module-level `Map<string, boolean>` (`resolveLocks`) keyed like `advance_<gameId>`, `toll_<gameId>` etc. to prevent concurrent resolution from timer, AI, and human callers. Always use `try/finally` to release locks.

**Circular dependency resolution** — `stateMachine.js` and `decisionEngine.js` avoid circular imports via `imports/game/resolverRegistry.js`. `stateMachine.js` registers its resolve functions; `decisionEngine.js` retrieves them at call time via `getResolver()`.

### Disconnect Handling

When a subscriber disconnects from the `game` publication, a 30-second grace timer starts. If the player doesn't reconnect, `convertToAi()` replaces them with an AI mid-game. The timer is cleared on reconnection.

### Expert Mode & Phase Timers

Phase timers are server-side `Meteor.setTimeout` stored in a module-level Map. Games have an `expertMode` flag (set at creation if all humans have `isExpertPlayer: true`). Expert mode uses shorter durations (e.g., toll: 30s vs 45s novice, discussion: 45s vs 60s).

### Scoring System

Win/loss at round 10: `goldCoins.length > skulls.length` = `LOYAL_WIN`, otherwise `CREW_LOSS`. If doom hits threshold: `PHANTOM_WIN` (phantom exists) or `DOOM_LOSS` (no phantom).

Gold coins: threat defeated, correct accusation (−3 doom), clean sailing (doom didn't rise). Skulls: doom crossing 5 or 10 (one-time each), threat active 2+ rounds (escalated), threat causing 4+ doom (ravaged), false accusation. Both are arrays of `{ round, reason, description }` on the game document.

Accused phantom stays in game with `phantomRevealed: true`, action strength capped at 1, forced doom toll.

### Key Directories
- `imports/hub/` — SSO handler, Hub API client, subscription checking
- `imports/game/` — State machine, resolution, roles, threats, curses, phase timer
- `imports/game/ai/` — Decision engine, strategies (toll/action/accusation), personalities, suspicion tracker
- `imports/ai/` — Dialogue engine, LLM proxy (OpenRouter), style transfer, dialogue templates
- `imports/lib/collections/games.js` — Enums: `RoomStatus`, `GamePhase`, `Alignment`, `GameResult`, and game constants (`MAX_PLAYERS`, `PHANTOM_PROBABILITY`, etc.)
- `imports/ui/components/game/` — Mithril components for all game phases (board, panels, modals)
- `imports/ui/components/` — Shared components including `RequireAuth` and `RequireSubscription` HOCs
- `server/migrations/` — Database migrations via `quave:migrations`

### Settings Structure
```json
{
  "public": {
    "appId": "false_colors",
    "hubUrl": "https://kokokino.com",
    "requiredProducts": ["base-monthly"],
    "game": {
      "minPlayers": 6, "maxPlayers": 6,
      "discussionTimeSec": 30, "roundCount": 10,
      "doomThreshold": 30
    }
  },
  "private": {
    "hubApiKey": "...", "hubApiUrl": "https://kokokino.com/api/spoke",
    "hubPublicKey": "-----BEGIN PUBLIC KEY-----...",
    "ai": {
      "openRouterApiKey": "...",
      "openRouterModels": ["mistralai/mistral-small-creative", "meta-llama/llama-4-scout", "openai/gpt-4o-mini"],
      "openRouterBaseUrl": "https://openrouter.ai/api/v1",
      "maxCallsPerGame": 20, "maxTokensPerCall": 100, "temperature": 0.8
    }
  }
}
```

## Code Conventions

### Meteor v3
- Use async/await patterns (no fibers) — `findOneAsync()`, `insertAsync()`, `updateAsync()`, `removeAsync()`
- `observeChanges()` returns a Promise in Meteor 3 — always `await` it
- Do not use `autopublish` or `insecure` packages
- When recommending Atmosphere packages, ensure Meteor v3 compatibility

### JavaScript Style
- Use `const` by default, `let` when needed, avoid `var`
- Always use curly braces with `if` blocks
- Avoid early returns — prefer single return statement at end
- Each variable declaration on its own line (no comma syntax)
- Use readable variable names (`document` not `doc`)

### UI Style
- Leverage Pico CSS patterns — avoid inline styles
- Use semantic CSS class names (`warning` not `yellow`)
- Use Mithril for UI; Blaze integration is acceptable for packages like accounts-ui
- Avoid React unless specifically instructed

### Security
- Validate all user input using `check()` from `meteor/check`
- Rate limiting configured in `server/rateLimiting.js` via `DDPRateLimiter.addRule()`
- Never store Hub's private key in spoke code
- All cloud LLM calls proxied through Meteor methods — API keys never leave the server

## Patterns

### Mithril Components
Components are plain objects with lifecycle hooks. State lives on `this` (the vnode state object), not `vnode.state` directly. Call `m.redraw()` after async operations. Components never use `onbeforeupdate`.

Reactive data pattern — subscribe and autorun in `oncreate`, clean up in `onremove`:
```js
export const MyComponent = {
  oninit(vnode) { this.data = null; },
  oncreate(vnode) {
    this.sub = Meteor.subscribe('myPub', args);
    this.computation = Tracker.autorun(() => {
      this.data = Collection.findOne(query);
      m.redraw();
    });
  },
  onremove() { this.sub.stop(); this.computation.stop(); },
  view(vnode) { /* ... */ }
};
```

### Client Routing
`m.route.prefix = ''` (clean URLs, no hash). Every route is wrapped via `layoutRoute()` → `MeteorWrapper > MainLayout`. `MeteorWrapper` bridges Meteor reactivity with Mithril by reading `Meteor.user()`, `Meteor.userId()`, and `Meteor.loggingIn()` inside `Tracker.autorun`, triggering `m.redraw()` on auth changes.

### Publications
- Always check `this.userId` before publishing sensitive data
- Return `this.ready()` for unauthenticated users
- The `game` publication uses `observeChanges` to strip secret fields — never publish `alignment`, `isAI`, `actionSubmissions`, `tollSubmissions`, `threatDeck`

### Methods
- Use `check()` for input validation at method start
- Throw `Meteor.Error('error-code', 'message')` for client-handleable errors
- Common error codes: `not-authorized`, `not-found`, `not-in-game`, `wrong-phase`, `already-submitted`, `subscription-required`

### Migrations
Uses `quave:migrations` package. Migrations in `server/migrations/` with `up()` and `down()` methods. Auto-run on startup via `Migrations.migrateTo('latest')`.

### CSS
All styles live in `client/main.css`. Pico CSS is imported via npm in `client/main.js`. Use Pico CSS variables (`--pico-primary`, `--pico-del-color`, etc.) for colors. Loading spinner: apply `.loading` class to any element (pure CSS `::after` pseudo-element, no children needed).

### Testing
Mocha with Node.js `assert`. All tests in `tests/main.js`. Server-only tests wrap in `if (Meteor.isServer)` and must `require()` server modules explicitly (not top-level imports). Test fixtures use `makeGame(overrides)` and `makeThreat(overrides)` helpers that construct plain objects (not DB-inserted). Method tests use `Meteor.callAsync()` and check `error.error` (the error code).
