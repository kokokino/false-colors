 Phase 1: Core Engine Implementation Plan

 Context

 False Colors is a cooperative social deduction game (Phantom Tides theme). Phase 1 delivers a text-only playable prototype: 1 human + AI fill-ins (4-6 players), game state machine, round resolution, rule-based
  AI, dialogue templates, and cloud LLM style transfer via OpenRouter (google/gemini-2.0-flash).

 The codebase is a fully functional Meteor 3.4 spoke with Hub SSO, subscription checking, and a demo chat room. No game code exists yet. Game room patterns will mirror Talon & Lance (auto-created rooms,
 heartbeat, periodic cleanup). AI players must be indistinguishable from humans in the UI.

 ---
 1. Data Model

 New Collections (add to imports/api/collections.js)

 GameRooms — mirrors Talon & Lance pattern:
 { hostId, players: [{ userId, username, slot, peerJsId }], status, maxPlayers,
   createdAt, lastActiveAt, startedAt, finishedAt, countdownStartedAt }
 - Status: waiting → starting → playing → finished
 - countdownStartedAt: set when first player joins, 20-second timer
 - Players array has identical fields for humans and AI — isAI stored server-only in a separate aiSlots array on the doc (never published)

 Games — authoritative game state (created when room transitions to playing):
 { roomId, theme, players: [{ seatIndex, userId, displayName, role, isAI, alignment,
   personality, hasNextAction, supplies, curses }],
   currentRound, maxRounds, currentPhase, phaseStartedAt, phaseDeadline,
   doomLevel, doomThreshold, shipSupplies, activeThreats, tollSubmissions,
   actionSubmissions, revealedActions, accusation, result, endReason,
   llmCallsUsed, createdAt, updatedAt }
 - players[].alignment ("loyal"/"phantom") and players[].isAI — NEVER published to clients
 - actionSubmissions — server-only until reveal
 - Published via observeChanges with field stripping (same pattern as Talon & Lance rooms.current)

 GameMessages — in-game discussion chat:
 { gameId, round, seatIndex, displayName, text, createdAt }
 - No isAI field published — messages look identical regardless of sender

 GameLog — append-only event log:
 { gameId, round, phase, type, data, createdAt }

 All collections get 24-hour TTL indexes for automatic cleanup.

 Indexes (add to server/indexes.js + new migration)

 - GameRooms: { status, createdAt }, { 'players.userId': 1 }, { lastActiveAt, status }, { countdownStartedAt: 1 }
 - Games: { roomId: 1 }, { 'players.userId': 1, status: 1 }, { updatedAt: 1 } (TTL)
 - GameMessages: { gameId, round, createdAt }, { createdAt: 1 } (TTL)
 - GameLog: { gameId, createdAt }, { createdAt: 1 } (TTL)

 ---
 2. Game Room Flow (mirroring Talon & Lance)

 Matchmaking Method: matchmaking.findOrCreate()

 1. Check user isn't already in an active room (same pattern as T&L)
 2. Find a waiting room with players.length < maxPlayers (prefer newest)
 3. If found → join it; if not → create new room
 4. When first player joins, set countdownStartedAt = new Date()
 5. 20-second countdown runs server-side via Meteor.setTimeout
 6. During countdown: more humans can join (up to 6)
 7. Early start: if 6 humans join before timer → start immediately
 8. Timer expires: fill remaining seats with AI to reach minimum 4, transition to starting → playing

 Character Assignment (ALL Players)

 Every player — human AND AI — is assigned a character from the Phantom Tides crew roster. Characters have a name (e.g., "Quartermaster Blackwood", "Navigator Voss"), a role, and a personality. During gameplay,
  only the character name is shown — never the player's real username. This makes AI indistinguishable from humans AND is more immersive.

 Pre-defined crew roster of 6 characters (one per seat), each with a unique name, role, and personality. Randomly shuffled and assigned to all seats when the game starts.

 Alignment Assignment (Phantom Can Be ANYONE)

 The phantom role is assigned randomly to any seat — human or AI. A human player might be the phantom and must sabotage subtly while avoiding suspicion. AI players track suspicion on ALL other players including
  humans. If there's no phantom (probability-based), all players are loyal but still suspicious of each other (paranoia mechanic). The alignment is stored server-only and never published to any client.

 Heartbeat & Cleanup (same as T&L)

 - Client calls rooms.touch(roomId) every 2 minutes + on visibility restore
 - beforeunload calls rooms.leave(roomId)
 - Server cleanup every 30 minutes: remove rooms with lastActiveAt > 5 min stale
 - Host migration: if host leaves, next player becomes host

 Key Files

 - server/roomMethods.js — matchmaking.findOrCreate, rooms.touch, rooms.leave
 - server/roomCleanup.js — periodic stale room removal
 - Room lifecycle imported in server/main.js

 ---
 3. Game State Machine

 File: imports/game/stateMachine.js

 Central advancePhase(gameId) function drives all transitions:

 [Room PLAYING] → create Game doc → THREAT → TOLL → DISCUSSION → ACTION → ACCUSATION → ROUND_END
                                       ↑                                                    |
                                       └────────────────── next round ──────────────────────┘
                                                                                            |
                                                                                       FINISHED (if game over)

 Phase Details

 Phase: Threat
 Duration: Auto (1-2s display)
 Human Action: None
 AI Action: None
 Resolution: Generate 1-2 new threats, existing threats add doom
 ────────────────────────────────────────
 Phase: Toll
 Duration: 30s timeout
 Human Action: Choose: discard supply / add doom / draw curse
 AI Action: Submit with 1-3s random delay
 Resolution: Apply all tolls simultaneously
 ────────────────────────────────────────
 Phase: Discussion
 Duration: 30s
 Human Action: Type in chat
 AI Action: Send 1-3 messages with 3-8s delays
 Resolution: Timer expires → advance
 ────────────────────────────────────────
 Phase: Action
 Duration: 30s timeout
 Human Action: Pick threat to assign action to
 AI Action: Submit with 1-3s random delay
 Resolution: Simultaneous reveal → resolve strengths → check threat completion
 ────────────────────────────────────────
 Phase: Accusation
 Duration: 15s window
 Human Action: Optionally accuse a player
 AI Action: Decide whether to accuse; vote on active accusations
 Resolution: If accusation: vote → resolve (correct=phantom caught, wrong=lose action)
 ────────────────────────────────────────
 Phase: Round End
 Duration: Auto (2s display)
 Human Action: None
 AI Action: None
 Resolution: Check win/loss → increment round or finish game

 Timer Management: imports/game/phaseTimer.js

 - Server-side Meteor.setTimeout per game
 - phaseDeadline published to clients for countdown display
 - Server is authoritative; client countdown is cosmetic

 AI Timing

 AI players submit actions with random human-like delays (1-3 seconds for toll/action, 3-8 seconds between discussion messages). This makes them indistinguishable from humans.

 ---
 4. Round Resolution

 File: imports/game/resolution.js

 Pure functions for testability:

 - resolveTolls(game, submissions) — Apply tolls simultaneously (supply loss, doom increase, curse draw)
 - resolveActions(game, submissions) — Apply action strengths to threats, check completion
 - resolveAccusation(game, accusation) — Majority vote → phantom caught or accuser penalized
 - checkGameEnd(game) — Doom >= threshold? All rounds done? Phantom caught?

 Role Action Strengths (from imports/game/roles.js)

 Each role has a specialty threat type where they contribute strength 3. Off-specialty = strength 1. Quartermaster = strength 2 for anything. Cook = strength 1 but heals 1 supply to all players.

 ┌───────────────┬──────────────────────────────────────┬────────────────────┬───────────────┐
 │     Role      │              Specialty               │ Specialty Strength │ Off-specialty │
 ├───────────────┼──────────────────────────────────────┼────────────────────┼───────────────┤
 │ Navigator     │ fog, reef                            │ 3                  │ 1             │
 ├───────────────┼──────────────────────────────────────┼────────────────────┼───────────────┤
 │ Gunner        │ kraken, storm                        │ 3                  │ 1             │
 ├───────────────┼──────────────────────────────────────┼────────────────────┼───────────────┤
 │ Surgeon       │ illness                              │ 3                  │ 1             │
 ├───────────────┼──────────────────────────────────────┼────────────────────┼───────────────┤
 │ Quartermaster │ any                                  │ 2                  │ 2             │
 ├───────────────┼──────────────────────────────────────┼────────────────────┼───────────────┤
 │ Lookout       │ any (reveals one other action early) │ 2                  │ 2             │
 ├───────────────┼──────────────────────────────────────┼────────────────────┼───────────────┤
 │ Cook          │ any (heals 1 supply to all)          │ 1                  │ 1             │
 └───────────────┴──────────────────────────────────────┴────────────────────┴───────────────┘

 Simultaneous Action Reveal

 1. Each player calls game.submitAction → stored in actionSubmissions (server-only)
 2. When all submitted (or timeout), server writes revealedActions array to game doc
 3. revealedActions IS published → all clients see reveal simultaneously
 4. Resolve and advance phase

 ---
 5. AI Decision Engine

 Files: imports/game/ai/

 - decisionEngine.js — main dispatcher
 - tollStrategy.js — toll decisions
 - actionStrategy.js — threat targeting
 - accusationStrategy.js — accuse/vote logic
 - suspicionTracker.js — tracks observed behavior (server-only)
 - personalities.js — personality definitions

 Strategy Overview

 Loyal AI: Pick highest-utility threat (severity x doom-per-round, weighted by role specialty). Toll = minimize collective harm (sacrifice own supplies when possible). Track suspicion on ALL other players
 (including humans) based on revealed actions, toll choices, and discussion patterns. Accuse only if high suspicion in late game.

 Phantom AI: Cooperate 30-40% early game, escalate sabotage. Target 2nd-3rd priority threats (suboptimal but defensible). Occasionally accuse loyal players to deflect. Toll = choose more harmful options as game
  progresses.

 When human is phantom: The game UI shows the human their secret phantom identity and provides the same action choices as loyal players. The human must choose suboptimal actions manually to sabotage while
 appearing loyal. AI suspicion tracking evaluates human actions the same as any other player.

 Personalities (6 defined, one per possible AI seat)

 Each personality adjusts: toll bias weights, action priority weights, suspicion threshold, and dialogue style. Examples: "grizzled" (terse, cautious), "nervous" (worried, quick to accuse), "jovial" (cheerful,
 slow to accuse).

 ---
 6. Dialogue System & OpenRouter Integration

 Template Engine: imports/ai/templates/phantomTides.js

 Organized by trigger (threatAssessment, tollReaction, accusation, defense, etc.) and style (terse, worried, cheerful, analytical). Slot-filling with {threat_name}, {player_name}, etc.

 ~80% of AI speech uses templates only. ~20% passes through OpenRouter for style transfer. The split is primarily for latency and reliability: template text is instant (no network call), so AI messages appear
 with natural delays. LLM calls add personality at key dramatic moments (accusations, first discussion, banter). The ratio is configurable — we can tune it based on how the game feels. The game is fully
 playable with zero API access (100% templates).

 OpenRouter Proxy: server/aiMethods.js

 // Server-only method (not callable from client)
 'ai.styleTransfer'(gameId, baseText, personalityId)

 - Endpoint: https://openrouter.ai/api/v1/chat/completions
 - Headers: Authorization: Bearer <key>, HTTP-Referer, X-Title
 - Per-game cap: maxCallsPerGame (default 20)
 - Rate limited: 5 calls per 10 seconds via DDPRateLimiter

 Model Fallback Chain

 If the primary model fails, cascade to the next:
 1. google/gemini-2.0-flash (primary)
 2. openai/gpt-4o-mini (fallback 1)
 3. anthropic/claude-3.5-haiku (fallback 2)
 4. Template text — no LLM (final fallback)

 OpenRouter uses the same API endpoint for all models, so fallback is just retrying with a different model ID. Each retry is counted against the per-game cap.

 Settings Addition (to settings.example.json):

 "ai": {
   "openRouterApiKey": "YOUR_OPENROUTER_API_KEY",
   "openRouterModels": [
     "google/gemini-2.0-flash",
     "openai/gpt-4o-mini",
     "anthropic/claude-3.5-haiku"
   ],
   "openRouterBaseUrl": "https://openrouter.ai/api/v1",
   "maxCallsPerGame": 20,
   "maxTokensPerCall": 100,
   "temperature": 0.8
 }

 ---
 7. Publications (Security-Critical)

 game publication — uses observeChanges to strip secrets

 Strips from every document before sending to client:
 - players[].alignment (NEVER leak phantom identity)
 - players[].isAI (NEVER reveal who is AI)
 - actionSubmissions (only reveal after all submitted)
 - tollSubmissions (individual choices hidden)
 - llmCallsUsed (internal)

 Other publications

 - rooms.lobby — open waiting rooms (player count, no sensitive data)
 - rooms.current — single room for players in it
 - gameMessages — scoped to gameId, no isAI field
 - gameLog — scoped to gameId, all events visible

 ---
 8. UI Components

 New Route: /game/:gameId

 Added to client/main.js router.

 Modified: HomePage.js

 Replace demo chat with a "Play" button that calls matchmaking.findOrCreate.

 Component Tree

 GamePage (/game/:gameId)
   RequireAuth → RequireSubscription →
     GameBoard
       GameHeader (round, doom tracker, phase, countdown timer)
       ThreatDisplay (active threats with progress bars)
       PlayerPanel (player list — identical for humans and AI)
       PhasePanel (switches based on currentPhase):
         ThreatReveal / TollSelection / DiscussionChat /
         ActionSelection / ActionReveal / AccusationPanel / RoundEndSummary
       GameLogPanel (scrollable event history)
     GameOverScreen (when finished)

 Key: AI Indistinguishability

 - PlayerPanel shows all players identically (name, role, supplies)
 - No "AI" badge or indicator
 - Discussion chat shows messages with same styling
 - AI messages arrive with human-like timing delays

 ---
 9. File Structure (New Files)

 imports/
   api/collections.js                          # MODIFY: add Games, GameRooms, GameMessages, GameLog
   lib/collections/
     games.js                                  # NEW: client-side collection registrations
   game/
     stateMachine.js                           # NEW: phase transitions & game orchestration
     resolution.js                             # NEW: toll/action/accusation resolution
     threats.js                                # NEW: threat deck & generation
     roles.js                                  # NEW: role definitions & strengths
     curses.js                                 # NEW: curse card effects
     phaseTimer.js                             # NEW: server-side timeout management
     ai/
       decisionEngine.js                       # NEW: AI decision dispatcher
       tollStrategy.js                         # NEW: toll decisions (loyal & phantom)
       actionStrategy.js                       # NEW: action decisions
       accusationStrategy.js                   # NEW: accusation & voting
       suspicionTracker.js                     # NEW: observable behavior tracking
       personalities.js                        # NEW: personality definitions
       aiNames.js                              # NEW: human-sounding name pool
   ai/
     dialogueEngine.js                         # NEW: template selection + LLM decision
     styleTransfer.js                          # NEW: OpenRouter prompt builder
     templates/
       phantomTides.js                         # NEW: Phantom Tides dialogue templates
   ui/
     pages/
       HomePage.js                             # MODIFY: replace chat with "Play" button
       GamePage.js                             # NEW: route wrapper
     components/game/
       GameBoard.js                            # NEW: main game view
       GameHeader.js                           # NEW: round/doom/phase display
       DoomTracker.js                          # NEW: doom progress bar
       CountdownTimer.js                       # NEW: countdown display
       ThreatDisplay.js                        # NEW: threat cards with progress
       PlayerPanel.js                          # NEW: player list
       PhasePanel.js                           # NEW: phase-based component switcher
       ThreatReveal.js                         # NEW: new threat display
       TollSelection.js                        # NEW: toll choice UI
       DiscussionChat.js                       # NEW: in-game chat
       ActionSelection.js                      # NEW: threat assignment UI
       ActionReveal.js                         # NEW: simultaneous reveal
       AccusationPanel.js                      # NEW: accusation/voting
       RoundEndSummary.js                      # NEW: round results
       LobbyWaiting.js                         # NEW: room countdown + player list
       GameOverScreen.js                       # NEW: final results

 server/
   main.js                                     # MODIFY: import new modules
   methods.js                                  # EXISTING: keep as-is
   gameMethods.js                              # NEW: game.submitToll, game.submitAction, etc.
   roomMethods.js                              # NEW: matchmaking.findOrCreate, rooms.touch/leave
   roomCleanup.js                              # NEW: periodic stale room removal
   aiMethods.js                                # NEW: ai.styleTransfer (server-only)
   publications.js                             # MODIFY: add game/room publications
   indexes.js                                  # MODIFY: add new collection indexes
   rateLimiting.js                             # MODIFY: add game method rate limits
   migrations/
     0_steps.js                                # MODIFY: register new migration
     2_create_game_indexes.js                  # NEW: game collection indexes

 client/
   main.js                                     # MODIFY: add /game/:gameId route, import collections
   main.css                                    # MODIFY: add game styles

 settings.example.json                         # MODIFY: add game + ai sections

 ---
 10. Implementation Order

 Step 1: Data Foundation

 Collections, client registrations, indexes, migration. ~30 new files touched: 5.

 Step 2: Game Constants

 threats.js, roles.js, curses.js, aiNames.js, personalities.js. Pure data, no Meteor deps.

 Step 3: Room System

 roomMethods.js (matchmaking.findOrCreate, rooms.touch, rooms.leave), roomCleanup.js, room publications. Mirror Talon & Lance patterns.

 Step 4: Lobby UI

 LobbyWaiting.js, modify HomePage.js with "Play" button, add /game/:gameId route, CountdownTimer.js.

 Step 5: State Machine & Timers

 stateMachine.js, phaseTimer.js. Wire room → game creation.

 Step 6: Resolution Logic

 resolution.js — pure functions for toll/action/accusation/win-loss.

 Step 7: Player Action Methods

 gameMethods.js — submitToll, submitAction, sendMessage, accuse, voteAccusation.

 Step 8: AI Decision Engine

 All files in imports/game/ai/. Wire into state machine with human-like delays.

 Step 9: Dialogue System

 dialogueEngine.js, templates/phantomTides.js, styleTransfer.js.

 Step 10: OpenRouter Integration

 aiMethods.js, settings updates. Wire into dialogue engine.

 Step 11: Game UI Components

 Build in order: display-only → interactive → orchestrator. GameHeader, DoomTracker, ThreatDisplay, PlayerPanel → TollSelection, DiscussionChat, ActionSelection → PhasePanel, GameBoard, GameOverScreen.

 Step 12: Game Publication Security

 observeChanges-based publication stripping alignment + isAI. Verify no secrets leak.

 Step 13: Styles

 CSS for game layout, doom tracker, threat cards, phases, lobby.

 Step 14: Testing

 Full game loop test, security test (alignment never published, isAI never published), AI behavior tests, edge cases.

 ---
 Verification

 1. Manual play-through: Start dev server (meteor --port 3040 --settings settings.development.json), log in via SSO, click Play, watch countdown, AI fills seats, play all rounds via text, verify game ends
 correctly
 2. Security check: Use browser devtools Meteor subscription inspector — confirm no alignment or isAI fields on any client-side document
 3. AI behavior: Watch AI discussion messages arrive with natural delays, verify phantom makes suboptimal-but-defensible choices
 4. OpenRouter: Confirm LLM-styled messages appear with character personality, verify fallback when API key missing
 5. Cleanup: Leave a room, wait 5+ minutes, verify periodic cleanup removes it
 6. Existing tests: npm test — all existing tests still pass
