# False Colors

A cooperative social deduction game for 4-6 players, built as a spoke app in the [Kokokino](https://www.kokokino.com) ecosystem.

## Overview

In False Colors, players crew a vessel facing escalating threats — storms, monsters, sabotage — while suspecting that one among them may be a traitor working against the group. Inspired by Shadows over Camelot's key innovation: **mandatory evil actions** give the traitor natural cover, since everyone must do something harmful each turn.

The first theme is **Phantom Tides** — a ghost ship sailing cursed waters. One crew member may be a phantom, a spirit dragging everyone to the depths. Future content packs (Hollow Sanctum, Last Signal) share the same core engine.

AI players fill empty seats, using rule-based decisions and template dialogue with optional cloud LLM personality. Games work with any mix of humans and AI (minimum 1 human).

## Development Status

**Phase 1: Text Prototype** — Core game engine with text-only Mithril UI. The demo chat currently in the app is a placeholder from the spoke skeleton.

| Phase | Description | Status |
|-------|-------------|--------|
| 1. Core Engine | Game state machine, round resolution, rule-based AI, Phantom Tides theme | Not started |
| 2. 3D Scene | Babylon JS ship table, PC + VR (WebXR) | Planned |
| 3. Voice Chat | PeerJS human audio, discussion timers, text fallback | Planned |
| 4. AI Voice | Kokoro TTS, template dialogue, character voices | Planned |
| 5. Cloud LLM + Polish | Style transfer, STT voice commands, VR whispering | Planned |
| 6. Launch Phantom Tides | Testing, cost monitoring, deploy | Planned |
| 7. Hollow Sanctum | Second theme content pack | Planned |
| 8. Last Signal | Third theme content pack | Planned |

## Architecture

This app follows the Kokokino Hub & Spoke architecture:

- **Hub** — Central authentication and billing system (`kokokino.com`)
- **Spoke** — Independent app that relies on Hub for user management

```
┌─────────────────────────────────────────────────────────────────┐
│                         KOKOKINO HUB                            │
│                        (kokokino.com)                           │
│  • User accounts    • Billing    • SSO tokens    • Spoke API   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SSO Token
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        FALSE COLORS                             │
│              (localhost:3040 or false-colors.kokokino.com)       │
│  • SSO validation  • Game engine    • AI players                │
│  • Voice chat      • 3D scenes      • Subscription checks      │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Hub Integration (Active)
- Complete SSO token validation flow from Hub redirects
- Local session management using Meteor Accounts
- Subscription checking middleware
- Authentication pages (Not Logged In, Subscription Required, Session Expired)

### Game Engine (Planned)
- Turn-based cooperative game with traitor mechanic
- 4-6 players per game (humans + AI fill-ins)
- Mandatory evil actions provide traitor cover
- 8-10 rounds, ~30 minutes per game
- No player elimination

### AI Players (Planned)
- Rule-based utility AI for game decisions (server-side, no LLM)
- Template dialogue system (80% of AI speech, free)
- Cloud LLM style transfer for personality (20%, ~$0.001/game)
- Loyal AI and traitor AI with distinct strategies

### Voice Chat (Planned)
- PeerJS peer-to-peer audio for human players
- Kokoro-82M TTS for AI character voices (client-side, free)
- Web Speech API for speech-to-text (Whisper WASM fallback)

### 3D Visualization (Planned)
- Babylon JS 8 scenes (ship's war table for Phantom Tides)
- WebXR for VR support; arc-rotate camera for PC
- Each theme is a content pack: scene + roles + templates + assets

## Tech Stack

| Technology | Purpose | Status |
|------------|---------|--------|
| **Meteor 3.4** | Real-time framework, MongoDB, user accounts | Active |
| **Mithril.js 2.3** | UI framework (JavaScript-generated HTML) | Active |
| **Pico CSS** | Classless CSS framework | Active |
| **jsonwebtoken** | JWT validation for SSO | Active |
| **Babylon JS 8** | 3D rendering, WebXR, Havok physics | Planned |
| **PeerJS** | P2P voice chat | Planned |
| **Kokoro TTS** | Client-side AI voices (WebGPU + WASM) | Planned |
| **Web Speech API** | Client-side speech-to-text | Planned |
| **Cloud LLM** | AI dialogue style transfer (GPT-4o-mini) | Planned |

## Getting Started

### Prerequisites
- Meteor 3.4+
- Node.js 22.x
- Access to a running Kokokino Hub instance (local or production)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/kokokino/false-colors.git
   cd false-colors
   ```

2. Install dependencies:
   ```bash
   meteor npm install
   ```

3. Copy the example settings file:
   ```bash
   cp settings.example.json settings.development.json
   ```

4. Configure your settings:
   ```json
   {
     "public": {
       "appName": "False Colors",
       "appId": "false_colors",
       "hubUrl": "http://localhost:3000",
       "requiredProducts": ["base_monthly"]
     },
     "private": {
       "hubApiKey": "your-spoke-api-key-from-hub",
       "hubApiUrl": "http://localhost:3000/api/spoke",
       "hubPublicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
     }
   }
   ```

5. Run the development server:
   ```bash
   meteor --settings settings.development.json --port 3040
   ```

   Migrations run automatically on startup. You should see "Created UsedNonces TTL index" in the logs on first run.

### Running with Local Hub

For local development with the Hub:

1. **Start the Hub** (in another terminal):
   ```bash
   cd ../hub
   meteor --settings settings.development.json
   # Hub runs on http://localhost:3000
   ```

2. **Start False Colors**:
   ```bash
   cd ../false-colors
   meteor --settings settings.development.json --port 3040
   # Runs on http://localhost:3040
   ```

3. **Access the app**:
   - Visit http://localhost:3000 to log into the Hub
   - Click "Launch" on False Colors in the Hub
   - You'll be redirected to http://localhost:3040 with SSO token

## Project Structure

```
false-colors/
├── client/
│   ├── main.html          # Main HTML template
│   ├── main.css           # Global styles
│   └── main.js            # Client entry point with routing
├── imports/
│   ├── hub/               # Hub integration utilities
│   │   ├── client.js      # Hub API client
│   │   ├── ssoHandler.js  # SSO token processing
│   │   └── subscriptions.js # Subscription checking
│   ├── ui/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── ChatMessage.js
│   │   │   ├── ChatRoom.js       # Demo placeholder
│   │   │   ├── RequireAuth.js
│   │   │   └── RequireSubscription.js
│   │   ├── layouts/       # Page layouts
│   │   │   └── MainLayout.js
│   │   └── pages/         # Route pages
│   │       ├── HomePage.js
│   │       ├── NotLoggedIn.js
│   │       ├── NoSubscription.js
│   │       ├── SessionExpired.js
│   │       └── SsoCallback.js
│   ├── lib/
│   │   └── collections/   # MongoDB collections
│   │       └── chatMessages.js
│   ├── game/              # Game state machine, round resolution, AI (planned)
│   ├── ai/                # Dialogue templates, LLM proxy, personality (planned)
│   ├── voice/             # Voice chat, TTS, STT (planned)
│   └── 3d/                # Babylon JS scenes, WebXR, theme assets (planned)
├── server/
│   ├── main.js            # Server entry point
│   ├── accounts.js        # Custom login handlers
│   ├── methods.js         # Meteor methods
│   ├── publications.js    # Data publications
│   ├── indexes.js         # Database indexes (TTL for nonces/cache)
│   └── rateLimiting.js    # DDP rate limiter configuration
├── tests/                 # Test files
├── settings.example.json  # Example configuration
└── package.json           # Dependencies
```

## Key Components

### SSO Handler (`imports/hub/ssoHandler.js`)
Handles token validation from Hub redirects:
- Verifies JWT signatures using Hub's public key
- Checks token expiration and app ID
- Prevents replay attacks using nonce tracking

### Hub API Client (`imports/hub/client.js`)
Makes authenticated requests to Hub API:
- Validates user tokens
- Checks subscription status
- Retrieves user information
- Implements caching for performance

### Subscription Middleware (`imports/ui/components/RequireSubscription.js`)
Higher-order component that:
- Checks if user has required subscriptions
- Redirects to appropriate pages if not
- Re-validates subscriptions periodically
- Shows loading states during checks

### Demo Chat (Placeholder)
The current chat implementation demonstrates Meteor's real-time capabilities and will be replaced by the game interface:
- **Server-side**: MongoDB-backed message store with publication (auto-caps at 100 messages)
- **Client-side**: Reactive subscription with Mithril components
- **Methods**: Secure message sending with user validation and rate limiting

## Development Guidelines

### Code Style
- Follow Meteor v3 async/await patterns (no fibers)
- Use Mithril.js for UI components
- Leverage Pico CSS classes for styling
- Follow security best practices for user input

### Security Considerations
- Never store Hub's private key in your code
- Always validate SSO tokens before creating sessions
- Implement rate limiting on sensitive endpoints
- Sanitize user input before display
- All cloud LLM calls proxied through Meteor methods — API keys never leave the server

### Performance Tips
- Cache subscription checks when appropriate
- Use Meteor's reactive data sources efficiently
- Minimize database queries in publications
- Implement pagination for large data sets

## Testing

Run the test suite:
```bash
meteor test --driver-package meteortesting:mocha
```

Tests cover:
- SSO token validation
- Subscription checking
- Chat message functionality
- Authentication flows

## Troubleshooting

### Common Issues

1. **SSO Token Validation Fails**
   - Ensure Hub's public key is correctly configured
   - Check token expiration (tokens expire after 5 minutes)
   - Verify `appId` matches your spoke's configuration

2. **Cannot Connect to Hub API**
   - Verify `hubApiUrl` is correct in settings
   - Check that your API key is valid
   - Ensure CORS is properly configured on Hub

3. **Subscription Checks Fail**
   - Confirm user has required products in Hub
   - Check that product IDs match between Hub and spoke
   - Verify API responses are being parsed correctly

4. **Real-time Data Not Updating**
   - Ensure user is logged in and has subscription
   - Check browser console for errors
   - Verify Meteor methods and publications are working

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](documentation/CONTRIBUTING.md) for details.

## Related Resources

- [Kokokino](https://www.kokokino.com) — Main platform website
- [Kokokino Hub](https://github.com/kokokino/hub) — Central authentication and billing app
- [False Colors on GitHub](https://github.com/kokokino/false-colors) — This repository
- [Hub & Spoke Strategy](documentation/HUB_SPOKE_STRATEGY.md) — Architecture documentation
- [Conventions](documentation/CONVENTIONS.md) — Coding advice
- [Meteor Documentation](https://docs.meteor.com/) — Meteor framework guides
- [Mithril.js Documentation](https://mithril.js.org/) — UI framework reference

## License

MIT License — see [LICENSE](LICENSE) file for details.
