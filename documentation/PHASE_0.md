# Social Deduction VR Game — Brainstorm & Feasibility Analysis

## Context

A new Kokokino Hub & Spoke game combining cooperative social deduction (inspired by Shadows over Camelot, Avalon, Werewolves Within) with VR, voice chat, and AI players that fill in for missing humans. Budget-friendly, pushing compute onto clients where possible.

**Decisions made:**
- **AI approach:** Voice-first hybrid — Kokoro TTS on client + templates + cloud LLM style transfer (~$0.001-0.006/game)
- **First theme:** Phantom Tides (Pirate) — with Hollow Sanctum and Last Signal as future content packs
- **Game model:** Cooperative + traitor (Shadows over Camelot structure), NOT pure social deduction
- **All three themes** share the same core engine; each theme is a content pack (scene + roles + dialogue templates + art/audio)

---

## 1. Feasibility Assessment

**Verdict: Yes, feasible — with the right scope.**

The Kokokino infrastructure (Hub SSO, billing, Meteor spoke) eliminates the hardest backend problems. BabylonPage, AudioManager, TransportManager, room management, and matchmaking from Talon & Lance carry over as templates. This game is *simpler* than Talon & Lance — no rollback netcode, no deterministic physics, no 60fps simulation. Game state lives on the server (Meteor/MongoDB), actions are turn-based, state publishes via DDP.

### Biggest Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **AI dialogue quality** | HIGH | Cooperative mechanics + templates + cloud LLM style transfer (not freeform) |
| **WebXR reliability** | MEDIUM-HIGH | VR enhances but never required; PC must be genuinely fun |
| **Voice pipeline latency** | MEDIUM | Turn-based 30s discussion phases; AI "thinks" then speaks near end of timer |
| **Scope creep** | MEDIUM | Phased development; text-only prototype first; one theme at a time |
| **Cloud AI cost** | LOW | ~$0.001-0.006/game; subscription-gated; per-session caps |

---

## 2. Game Design: Cooperative + Traitor

### Why this model (not pure social deduction)

**Shadows over Camelot's key innovation: mandatory evil actions.** Every player MUST do something harmful each turn. This provides natural cover for a traitor — sabotage looks identical to everyone's forced penalty. An AI traitor doesn't need to lie convincingly; it makes *suboptimal-but-defensible* game actions.

**Cooperative mechanics give AI structured things to do.** Choose which threat to address, contribute resources, vote on proposals, make short template statements. All within small-model capability. Compare to Avalon where AI would need multi-sentence logical arguments — far beyond current tech.

### Core Structure (shared across all themes)

- **4-6 players** (humans + AI fill-in, minimum 1 human)
- **Turn-based** with 30-second discussion phases
- **Cooperative core:** 3-4 simultaneous threats each round
- **Mandatory penalty:** Every player chooses a harmful action before their helpful action (traitor cover)
- **0 or 1 traitor** (uncertainty whether one exists increases paranoia)
- **Accusation with penalty:** Wrong accusations cost you your next action
- **8-10 rounds, ~30 minutes per game**
- **No player elimination** (everyone participates every round)

---

## 3. Three Themes (Content Packs)

### PHANTOM TIDES (Pirate) — FIRST

**Setting:** Crew of a ghost ship sailing cursed waters. Supernatural threats (kraken, storms, cursed islands). One crew member may be a phantom — a spirit dragging everyone to the depths.

**Roles:** Navigator, Gunner, Surgeon, Quartermaster, Lookout, Cook (each with unique actions)

**Round flow:**
1. **Threat Phase** — New threat revealed (kraken, hull breach, illness, fog). Doom tracker advances.
2. **Toll Phase** (mandatory evil) — Each player discards a supply, adds a doom token, or draws a curse card.
3. **Discussion** (30s) — Voice/text: "The hull breach is critical, we need Surgeon and Quartermaster on it."
4. **Action Phase** — Secretly assign role action to a threat. Simultaneous reveal. Enough crew = resolved.
5. **Accusation** (optional) — Correct = phantom in brig. Wrong = lose next action.

**Phantom's strategy:** Sees threats one round early. Assigns to non-critical threats. Penalty choices look identical to everyone else's.

**VR:** Ship's war table with tactical ocean map. Lean-to-whisper. Hand-tracked token placement. Ship rocks, waves crash, ghost lights.

**PC:** Isometric table view. Click to assign. Text/voice chat.

### HOLLOW SANCTUM (Dark Fantasy) — SECOND

Monks maintaining monastery seals. Cultist traitor breaks seals. Same core mechanics with ritual assignment, resource sacrifice, inquisition. VR: circular stone chamber, hand-tracked ritual gestures, deepening shadows.

### LAST SIGNAL (Sci-Fi) — THIRD

Space station crew vs mysterious signal. Compromised crew member. Same core mechanics with system repair, signal exposure, tribunal. VR: station bridge, consoles, claustrophobic corridors, spatial audio.

---

## 4. AI Pipeline (Voice-First Hybrid)

### Architecture

```
SERVER (Meteor)                          CLIENT (Browser)
+---------------------------+            +---------------------------+
| Game State (MongoDB)      |  ←DDP→     | Babylon JS Scene          |
| Round Resolution          |            | (WebXR for VR)            |
| AI Decision Engine        |            |                           |
|   (rule-based utility AI) |            |                           |
|                           |            |                           |
| Template Engine           |            |                           |
|   ↓ (20% of lines)       |            |                           |
| Cloud LLM Proxy       ---|--→GPT-4o---→| Kokoro-82M TTS           |
|   (style transfer)       |  ←mini--←  |   (WebGPU/WASM)          |
|                           |            |   → AI speaks aloud       |
|                           |            |                           |
| DDPRateLimiter            |            | Web Speech API (STT)      |
| Session usage caps        |            |   → human speech to text  |
| API keys in settings.private           |   (fallback: Whisper WASM)|
+---------------------------+            +---------------------------+
         ↕ PeerJS/geckos.io
    Human-to-human voice chat (P2P)
```

### How AI dialogue works

1. **AI decision engine** (server, rule-based, free) decides what the AI wants to say
2. **Template engine** (server, free) fills slots: *"I'm working on {kraken}. It's at {high} severity."*
3. **80% of the time:** Template text sent directly to client
4. **20% of the time:** Template passed through cloud LLM for style transfer:
   - *Input:* "You are Quartermaster Blackwood, gruff and sarcastic. Rephrase under 20 words: 'I worked on the hull breach because it was the biggest threat.'"
   - *Output:* "The hull was about to kill us all, mate. What did you want me to do, polish the cannons?"
5. **Client receives text** via DDP, runs **Kokoro-82M TTS** to speak it aloud

### Cost breakdown

| Model option | Input price | Output price | Cost per game* | Monthly (100 DAU × 3 games) |
|-------------|------------|-------------|---------------|------------------------------|
| **GPT-4o-mini** | $0.15/1M tok | $0.60/1M tok | **$0.001** | **$9** |
| **Claude 3.5 Haiku** | $0.80/1M tok | $4.00/1M tok | **$0.006** | **$54** |
| **Gemini 2.0 Flash** | $0.10/1M tok | $0.40/1M tok | **$0.0007** | **$6** |

\*~20 LLM calls/game × ~180 tokens each. GPT-4o-mini or Gemini Flash recommended for cost.

### STT (human speech recognition)

| Option | When used | Latency | Cost |
|--------|-----------|---------|------|
| **Web Speech API** (primary) | Chrome/Edge users (majority) | <1s streaming | Free |
| **Whisper tiny WASM** (fallback) | Firefox, Safari, VR browsers | 2-5s per utterance | Free |

Web Speech API is the primary choice — free, <1s latency, zero download. Whisper WASM is the fallback for non-Chromium browsers or when Web Speech API isn't available in VR headset browsers.

### TTS (AI speaks)

**Kokoro-82M via Kokoro.js** — runs 100% client-side.
- ~150MB one-time download (cached in IndexedDB)
- 48+ voices with voice blending for unique character identities
- WebGPU acceleration with WASM fallback
- Each AI character gets a distinct blended voice (e.g., gruff quartermaster, nervous lookout)
- Fallback: `speechSynthesis` Web API (lower quality, zero download)

### Security

- All cloud LLM calls proxied through Meteor methods — **API keys never leave the server**
- `Meteor.settings.private` stores keys (same pattern as Hub API key in Talon & Lance)
- Per-session usage caps via `DDPRateLimiter` (same pattern as `server/rateLimiting.js`)
- Server validates: authenticated user + active subscription + in active game session before proxying

### Graceful Degradation

| Tier | Hardware | AI Voice | Human Voice | Detection |
|------|----------|----------|-------------|-----------|
| **Full VR** | VR headset + GPU | Kokoro TTS | Web Speech API / Whisper | `navigator.xr` + `navigator.gpu` |
| **Standard PC** | PC with GPU | Kokoro TTS | Web Speech API | `navigator.gpu` |
| **Lite** | Weak PC / no mic | Text bubbles | Text chat | Fallback |

---

## 5. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Framework** | Meteor 3.4 | Spoke app. Game state in MongoDB, actions via Methods, reactive DDP |
| **UI** | Mithril.js + Pico CSS | Lobby, settings, text chat |
| **Rendering** | Babylon JS 8 + WebXR | 3D scene, VR via `WebXRDefaultExperience`, PC via arc-rotate camera |
| **Voice Chat** | PeerJS (P2P) + geckos.io (relay) | Audio MediaStreams, extend TransportManager pattern |
| **TTS** | Kokoro-82M (Kokoro.js) | Client-side, WebGPU + WASM fallback, ~150MB cached |
| **STT** | Web Speech API + Whisper WASM | Free, client-side, Chrome primary / WASM fallback |
| **AI Decisions** | Rule-based utility AI | Server-side Meteor methods, no LLM |
| **AI Dialogue** | Templates + GPT-4o-mini | 80% templates (free) + 20% cloud style transfer ($0.001/game) |
| **Auth/Billing** | Kokokino Hub SSO | Existing infrastructure |
| **Database** | MongoDB (via Meteor) | Game rooms, game state, chat, users |

### NOT needed (vs. Talon & Lance)

- No rollback netcode, no deterministic physics, no GameLoop, no GameSimulation
- Turn-based with authoritative server state — fundamentally simpler

---

## 6. AI Player Design

### Decision-making (rule-based, no LLM)

```
AI evaluates game state:
  - Threat severity levels
  - Own resources/role abilities
  - Other players' past contributions
  - Suspicion scores (exponential moving average)

Loyal AI: Pick highest-utility threat, personality-weighted randomness
Traitor AI: Pick 2nd-3rd highest utility (suboptimal but defensible)
           Cooperate genuinely 30-40% of the time to maintain cover
           Gradually increase sabotage as game progresses
```

### AI traitor strategy (no lying required)

1. **Mandatory evil provides cover** — everyone does harmful things, traitor's look identical
2. **Suboptimal action selection** — work on 2nd priority threat, justify with template: "I thought {threat_B} was more urgent"
3. **Intermittent cooperation** — genuinely help 30-40% of the time, making record ambiguous
4. **Deflection** — occasionally accuse others to create noise
5. **Escalation** — cooperate early rounds, sabotage later rounds (mirrors human traitor play)

### Dialogue templates (80% of AI speech)

```javascript
// Organized by game event, slots filled from game state
penaltyJustification: "Had no choice but to lose {resource}. We need to focus on {threat}."
actionExplanation:    "I'm putting my {role} abilities on {threat}. It's our biggest problem."
strategyAdvice:       "{player}, your {role} bonus works best against {threat}. Can you handle it?"
accusationDefense:    "Check the log — I resolved {count} threats. Does that look like a phantom?"
accusation:           "{player} hasn't resolved anything in {rounds} rounds. Something's off."
```

### Cloud LLM personality layer (20% of AI speech)

For reactions, banter, and moments where personality matters. The LLM receives:
- Character name + personality trait + role
- The template output to rephrase
- Brief game context
- Instruction: "Rephrase in character, under 20 words"

Result: Template content with character voice. Cheap, fast, effective.

---

## 7. Development Phases

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **1. Core Engine** | 4-6 weeks | Text-only Mithril UI. Game state machine, round resolution, rule-based AI. Phantom Tides theme. Playable 1 human + AI via text chat. |
| **2. 3D Scene** | 4-6 weeks | Babylon JS ship table scene. PC + VR (WebXR). Character models, ocean map, threat tokens. |
| **3. Voice Chat** | 3-4 weeks | PeerJS audio for human voice. Discussion phase timers. Mute/unmute. Text fallback. |
| **4. AI Voice** | 3-4 weeks | Kokoro TTS integration. Template dialogue. Character voice identities. Capability detection. |
| **5. Cloud LLM + Polish** | 4-6 weeks | Cloud LLM style transfer via Meteor proxy. STT for voice commands. VR whispering. Balance tuning. |
| **6. Launch Phantom Tides** | 2-4 weeks | Testing, cost monitoring, Hub integration, deploy first theme. |
| **7. Hollow Sanctum** | 3-5 weeks | Second theme content pack (scene, roles, templates, art/audio). |
| **8. Last Signal** | 3-5 weeks | Third theme content pack. |

**Phase 1 is the critical validation point.** If the game is fun as a text-only prototype with 1 human + AI players, the foundation is solid. If it isn't fun in text, VR and voice won't save it.

---

## 8. Key Advice

1. **Cooperative + traitor, not pure social deduction.** Makes AI viable and game fun even solo.
2. **Mandatory evil actions are the secret weapon.** AI traitors don't need to lie — everyone does harmful things.
3. **Kokoro TTS is free and good.** 48+ voices, runs in browser, $0 per game.
4. **Cloud LLM for personality is dirt cheap.** $0.001/game via GPT-4o-mini. Don't bother with browser LLMs yet.
5. **Web Speech API for STT.** Free, <1s, works in Chrome. Whisper WASM as fallback only.
6. **VR-first, PC-always.** Design for VR but every mechanic must work with mouse/keyboard.
7. **Text prototype first.** Validate fun before investing in 3D/VR/voice.
8. **One engine, three skins.** Core mechanics are theme-agnostic. Each content pack is scene + roles + templates + assets.
