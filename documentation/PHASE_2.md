# Phase 2: 3D Scene — Implementation Plan

## Context

Phase 1 (Core Engine) is complete — the game is fully playable as a text-only Mithril UI with game state machine, round resolution, rule-based AI, and the Phantom Tides theme. Phase 2 adds a Babylon JS 8 3D scene: a ghost ship war table with crew avatars, threat tokens, and atmospheric effects.

**Workflow decision:** Assets first, then code. Complete all 3D models before touching the codebase.

**UI decision:** Full 3D experience with all UI overlaid on the canvas — but keep the existing text-only view as a separate mode the user can toggle to. Both views coexist side by side during development; the 3D view is the target experience, the text view is the fallback.

**Key decisions from our research:**
- **3D model tool:** Sloyd.ai (Plus plan, $15/mo or $150/yr annual)
- **Lip sync pipeline:** HeadTTS (Kokoro TTS + Oculus viseme output) — implemented in Phase 4, but models prepared now
- **Facial morph targets:** FACEIT Blender addon (~$50) + TalkingHead viseme script
- **Image generation:** SuperMachine.art for concept art / image-to-3D input
- **3D engine:** Babylon JS 8 with WebXR support

---

## Part A: Asset Creation (Sloyd + Blender + SuperMachine)

This is the creative/manual work that happens outside the codebase. It produces GLB files that get loaded by the code in Part B.

### A1. Tool Setup

**Sloyd.ai**
- Sign up at sloyd.ai
- Check the "It might be your lucky day" discount button on the pricing page before paying
- Start with the free Starter tier (10 export credits/mo) to test quality
- Upgrade to Plus ($15/mo, or $150/yr annual) when ready for production assets
- Key features to use: Text-to-3D, Image-to-3D, custom art styles, auto-rigging, GLB export

**Blender**
- Download Blender 4.x from blender.org (free)
- Install FACEIT addon (~$50) from superhivemarket.com — automates facial blend shape creation
- Download the TalkingHead viseme build script: https://github.com/met4citizen/TalkingHead/blob/main/blender/build-visemes-from-arkit.py

**SuperMachine.art**
- Use existing subscription for concept art generation
- Generate consistent character reference images to feed into Sloyd's image-to-3D

### A2. Art Style Direction

Before generating any models, establish a consistent visual style. Sloyd supports custom styles — create one and apply it across all assets.

**Recommended style direction:** Stylized low-poly with a dark nautical palette. Think board game miniatures meets Sea of Thieves concept art. Slightly exaggerated proportions (larger heads/hands for readability at distance and in VR). Muted teal/gray/brown base with ghostly blue-green glow accents.

**Style consistency workflow:**
1. Generate 2-3 concept art pieces in SuperMachine establishing the look
2. Create a custom Sloyd style from those reference images
3. Apply that style to all subsequent generations

### A3. Character Models (6 Crew Members)

Each character needs: body mesh, basic skeleton rig, 5-7 facial morph targets for lip sync (Phase 4), and a distinct silhouette readable at table distance.

#### SuperMachine Prompts for Concept Art

Generate front-facing T-pose or 3/4 view character art for each crew member. Use these as image-to-3D input for Sloyd.

**General style prefix for all characters:**
> "Stylized low-poly game character, dark fantasy pirate ghost ship crew, muted nautical colors, slightly exaggerated proportions, board game miniature aesthetic, dark teal and weathered brown palette, ghostly blue-green accents, full body, standing pose, simple background"

**Blackwood — Quartermaster (Grizzled)**
> "{style prefix}, weathered middle-aged man, heavy build, thick arms, leather apron over a salt-stained coat, tool belt with hammer and nails, ledger book tucked under one arm, scarred hands, short cropped gray hair, stern weathered face, practical boots"

**Voss — Navigator (Analytical)**
> "{style prefix}, lean sharp-featured woman, cartographer, long coat with star charts sewn into the lining, compass pendant, rolled maps in a shoulder tube, wire-rimmed spectacles, hair pulled back tight, ink-stained fingers, calculating expression"

**Thorne — Gunner (Reckless)**
> "{style prefix}, broad-shouldered man with wild energy, naval officer coat torn at the sleeves, powder burns on his hands, bandolier of shot across chest, wild dark hair, confident reckless grin, lightning scar down one arm, heavy boots"

**Crane — Surgeon (Nervous)**
> "{style prefix}, thin anxious woman, doctor, bloodstained surgeon's apron over dark clothes, medical bag at hip, round spectacles, hair escaping from a bun, fidgeting hands holding a scalpel, haunted wide eyes, slightly hunched posture"

**Maren — Lookout (Jovial)**
> "{style prefix}, fit athletic woman, lighthouse keeper turned sailor, spyglass strapped to back, crow's nest rope burns on hands, warm smile, windswept short hair, bright alert eyes, layered vest over billowing shirt, perched stance like she's about to climb"

**Delgado — Cook (Devout)**
> "{style prefix}, stocky gentle man, ship's cook, worn apron with prayer beads around neck, large ladle in hand, flour-dusted arms, kind face with sad eyes, small religious icon hanging from belt, simple headwrap, warm grounding presence"

#### Sloyd Text-to-3D Prompts (Alternative to Image-to-3D)

If text-to-3D works better for some characters, try these directly in Sloyd:

- **Blackwood:** "Stylized low-poly pirate quartermaster, heavy build, leather apron, tool belt, scarred hands, stern face, game character"
- **Voss:** "Stylized low-poly female navigator cartographer, long coat, compass, rolled maps, spectacles, lean build, game character"
- **Thorne:** "Stylized low-poly pirate gunner, broad shoulders, torn naval coat, bandolier, wild hair, lightning scar, game character"
- **Crane:** "Stylized low-poly nervous female surgeon, thin build, bloodstained apron, medical bag, round spectacles, game character"
- **Maren:** "Stylized low-poly female lookout, athletic, spyglass on back, windswept hair, warm smile, sailor vest, game character"
- **Delgado:** "Stylized low-poly ship cook, stocky, worn apron, prayer beads, ladle, kind face, headwrap, game character"

#### Blender Post-Processing (Per Character)

After exporting GLB from Sloyd, open each character in Blender:

1. **Verify/fix topology** — Ensure mouth area has enough edge loops (3-4 concentric loops around mouth opening). Add with Ctrl+R in Edit Mode if needed.
2. **Run FACEIT** — Place facial landmarks, generate ARKit blend shapes automatically (~15 min per character with the addon)
3. **Run TalkingHead viseme script** — Converts 52 ARKit shapes to 15 Oculus visemes automatically
4. **Verify morph targets** — Test each viseme with the shape key sliders
5. **Export GLB** — File > Export > glTF 2.0, ensure "Shape Keys" is checked
6. **Verify** — Load into https://gltf-viewer.donmccurdy.com/ and check morph target sliders work

**Tutorials for learning this workflow:**
- **Blender basics (if needed):** Blender's official "First Steps" tutorial at docs.blender.org
- **Shape keys intro:** "Lip-Syncing With Shape Keys" at blender-models.com/articles-tutorials/animation/lip-syncing-with-shape-keys/
- **FACEIT workflow:** TalkingHead's FACEIT guide at github.com/met4citizen/TalkingHead/blob/main/blender/Faceit/FACEIT.md
- **Stylized shape keys:** "Basic Expression Shapekeys" by Julien Kaspar at studio.blender.org/training/stylized-character-workflow/
- **Video tutorial:** "How to Generate Lip Sync for Mouth Shape Keys" (Freedom Arts) on YouTube, Blender 3.6 (workflow identical in 4.x)
- **Edge loops for faces:** blenderbasecamp.com/blender-facial-rigging-edge-loop-guide/
- **GLB export verification:** Load exported files in gltf-viewer.donmccurdy.com to confirm morph targets

**Time estimate per character:**
- Sloyd generation + iteration: 30-60 min
- Blender FACEIT pass: 30-60 min
- Total: ~1-2 hours per character, ~6-12 hours for all 6

### A4. Prop Models

Generate in Sloyd via text-to-3D. These are simpler — no rigging or morph targets needed. Export as GLB directly.

**Threat tokens (6 types):**
- "Stylized low-poly fog bank, swirling mist, ghostly blue, game token, dark fantasy"
- "Stylized low-poly jagged reef, sharp rocks, bone coral, game token, dark fantasy"
- "Stylized low-poly kraken tentacle, sea monster, dark purple, game token, dark fantasy"
- "Stylized low-poly storm cloud, lightning bolts, dark gray swirl, game token, dark fantasy"
- "Stylized low-poly plague vial, sickly green, bubbling liquid, game token, dark fantasy"
- "Stylized low-poly cracked ship hull piece, broken planks, water seeping, game token, dark fantasy"

**Game pieces:**
- "Stylized low-poly gold doubloon coin, pirate treasure, game piece"
- "Stylized low-poly skull token, dark bone, game piece, pirate"
- "Stylized low-poly ghost ship compass, brass and crystal, cursed glow"
- "Stylized low-poly doom tracker crystal, dark energy, glowing cracks, ominous"
- "Stylized low-poly resolve gem, blue-white crystal, faint inner glow"
- "Stylized low-poly curse card, tattered parchment with dark rune, ghostly"

**Environment pieces:**
- "Stylized low-poly pirate ship captain's table, dark wood, nautical charts, candle holders"
- "Stylized low-poly ocean map, parchment with sea routes, compass rose, dark ink"
- "Stylized low-poly ship lantern, brass and glass, ghostly blue flame"
- "Stylized low-poly ship helm wheel, dark weathered wood, brass fittings"

**Time estimate:** 15-30 min per prop in Sloyd, ~4-8 hours for all props

### A5. Asset File Organization

Place all exported GLB files in the project:

```
public/assets/3d/
  characters/
    blackwood.glb
    voss.glb
    thorne.glb
    crane.glb
    maren.glb
    delgado.glb
  threats/
    fog.glb
    reef.glb
    kraken.glb
    storm.glb
    illness.glb
    hull_breach.glb
  props/
    gold_coin.glb
    skull.glb
    compass.glb
    doom_crystal.glb
    resolve_gem.glb
    curse_card.glb
  environment/
    war_table.glb
    ocean_map.glb
    lantern.glb
    helm.glb
```

Babylon JS serves these via `SceneLoader.ImportMeshAsync("", "/assets/3d/characters/", "blackwood.glb", scene)`.

---

## Part B: Babylon JS Integration (Code)

### B1. Install Babylon JS 8

```bash
meteor npm install @babylonjs/core @babylonjs/loaders @babylonjs/materials
```

`@babylonjs/loaders` includes the glTF/GLB loader. `@babylonjs/materials` provides PBR material extensions.

### B2. Create the 3D Scene Component

**New file:** `imports/ui/components/game/GameScene.js`

A Mithril component that:
- Creates a `<canvas>` element in `oncreate`
- Initializes Babylon Engine + Scene
- Loads the war table environment
- Positions 6 crew avatars around the table (by `seatIndex`)
- Loads threat tokens onto the table based on game state
- Sets up an ArcRotateCamera (PC) with orbit controls
- Lights the scene (warm ambient + ghostly point lights)
- Cleans up engine in `onremove`

### B3. Create Asset Loader

**New file:** `imports/ui/3d/assetLoader.js`

Handles loading and caching GLB files:
- Pre-loads character models during game init
- Lazy-loads threat tokens as they appear
- Uses Babylon's `AssetContainer` for instancing (load once, clone for each use)
- Shows loading progress to the user

### B4. Create Scene Manager

**New file:** `imports/ui/3d/sceneManager.js`

Bridges Meteor reactive data with the 3D scene:
- Listens to game state changes via Tracker.autorun
- Updates character positions, threat token visibility, doom effects
- Triggers animations on phase transitions (threat reveal, action reveal, etc.)
- Manages camera focus (zoom to active threat during reveal, pan to accusation target, etc.)

### B5. Integrate with Game Board — Dual View Architecture

**Modified file:** `imports/ui/components/game/GameBoard.js`

Two complete views, user toggles between them:

**3D View (new, target experience):**
- Full-viewport Babylon canvas
- All UI panels (player list, chat, toll buttons, action buttons, etc.) rendered as HTML overlays positioned on top of the canvas using CSS `position: absolute` / `pointer-events`
- Phase panels appear as floating cards over the 3D scene
- No sidebar — information is presented contextually in the 3D space + overlay panels

**Text View (existing, fallback):**
- Current Mithril UI preserved exactly as-is
- No 3D canvas loaded at all (saves GPU/memory)
- Accessible, works on low-end devices

**Toggle mechanism:**
- A view toggle button in the game header (or a user preference stored in their profile)
- Switching destroys one view and creates the other (not both rendered simultaneously)
- Game state is the same regardless of view — both read from the same Meteor subscription

### B6. Character Animation System

**New file:** `imports/ui/3d/characterAnimator.js`

Drives character animations:
- Idle animations (breathing, subtle movement) — loop continuously
- Phase-specific poses (leaning forward during discussion, arms crossed during accusation)
- Morph target driver for lip sync (prepared for Phase 4 HeadTTS integration)
- Highlight/glow effect on the player's own character

### B7. Atmosphere & Effects

**New file:** `imports/ui/3d/atmosphereManager.js`

Doom-reactive environmental effects:
- Ocean fog density increases with doom level
- Lantern flames flicker more aggressively at high doom
- Color grading shifts from warm amber (low doom) to cold blue-green (high doom)
- Ghost particle effects appear as doom approaches threshold
- Threat-specific effects (rain/lightning for storms, green mist for illness, etc.)

### B8. WebXR Setup (VR Ready)

**Modified file:** `imports/ui/3d/sceneManager.js`

Add WebXR support for future VR:
- `WebXRDefaultExperience` initialization behind a feature flag
- VR camera positioned at a seat around the war table
- Hand tracking input for token interaction (Phase 5)
- Graceful fallback when WebXR not available

---

## Part C: Implementation Order

### Step 1: Asset Creation Sprint (~2 weeks)
- Set up Sloyd, Blender, FACEIT
- Generate concept art in SuperMachine
- Create all 6 character models (image-to-3D or text-to-3D, iterate on quality)
- Create threat tokens and props
- Create war table environment
- Blender pass on characters: add morph targets via FACEIT
- Export all GLB files, verify in glTF viewer
- Place in `public/assets/3d/` directory structure

### Step 2: Babylon JS Foundation (~1 week)
- Install Babylon JS 8 packages
- Create GameScene component with canvas, engine, basic scene
- Implement assetLoader with GLB loading and caching
- Set up ArcRotateCamera with sensible defaults
- Load war table and static environment
- Basic lighting (ambient + 2-3 point lights)

### Step 3: Character Placement & Data Binding (~1 week)
- Load 6 character models, position around table by seatIndex
- Create sceneManager to bridge Meteor reactive state → 3D scene
- Bind character highlight to current player
- Show/hide threat tokens based on `game.activeThreats`
- Display doom level via atmospheric effects

### Step 4: Phase Animations & Polish (~1-2 weeks)
- Threat reveal animation (token rises from table, glows)
- Action reveal animation (tokens move to threats, strength numbers appear)
- Accusation spotlight effect
- Idle character animations
- Doom atmosphere transitions
- Camera movements per phase (zoom, pan, focus)

### Step 5: Full 3D UI Overlay (~1-2 weeks)
- Design overlay panel layout (floating cards for player list, chat, phase controls)
- Build HTML overlay components positioned over the Babylon canvas
- Toll buttons, action buttons, accusation UI as overlay panels
- Chat/discussion panel as floating overlay
- Player status indicators as overlay or 3D nameplates above characters
- Ensure pointer-events pass through to canvas where needed (orbit camera)

### Step 6: Dual View Toggle (~3-4 days)
- Add view toggle to game header (3D / Text)
- Wire toggle to conditionally render GameScene vs existing GameBoard children
- Store preference in user profile or localStorage
- Ensure clean creation/destruction of Babylon engine on toggle
- Verify existing text-only view still works perfectly
- Test responsiveness on different screen sizes
- WebXR feature flag (no interaction yet, just view)

---

## Key Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `public/assets/3d/**/*.glb` | Create | All 3D model assets |
| `imports/ui/components/game/GameScene.js` | Create | Mithril component wrapping Babylon canvas |
| `imports/ui/3d/assetLoader.js` | Create | GLB loading, caching, instancing |
| `imports/ui/3d/sceneManager.js` | Create | Reactive data → 3D scene bridge + WebXR |
| `imports/ui/3d/characterAnimator.js` | Create | Character animation driver |
| `imports/ui/3d/atmosphereManager.js` | Create | Doom-reactive environment effects |
| `imports/ui/components/game/GameScene3DOverlay.js` | Create | HTML overlay panels for 3D view (phase UI, chat, player list) |
| `imports/ui/components/game/GameBoard.js` | Modify | Add 3D/Text view toggle, conditionally render views |
| `client/main.css` | Modify | Canvas sizing, overlay positioning, floating panels |
| `package.json` | Modify | Add @babylonjs/* dependencies |

---

## Verification

- **Asset quality:** Load each GLB in gltf-viewer.donmccurdy.com — check mesh integrity, PBR materials, morph target sliders
- **Scene rendering:** `npm run dev` → navigate to a game → 3D scene loads without errors, characters positioned, threats visible
- **Reactive updates:** Play through a full game in 3D view — verify threats appear/disappear, doom atmosphere changes, phase transitions animate
- **Overlay UI:** All game actions (toll, action, accusation, chat) work correctly via overlay panels in 3D view
- **View toggle:** Switch between 3D and Text views mid-game — game state unaffected, both views functional
- **Text view preserved:** Toggle to text-only mode — existing UI still works exactly as before, no regressions
- **Performance:** Target 60fps on mid-range hardware. Monitor with Babylon Inspector (`scene.debugLayer.show()`)
- **Memory:** Switching to text view fully disposes the Babylon engine (no GPU leak)
- **Tests:** Existing `npm test` suite passes (no game logic changes in Phase 2)

---

## Budget Summary

| Item | Cost | Notes |
|------|------|-------|
| Sloyd Plus | $15/mo (or $150/yr) | 1-2 months during asset creation |
| FACEIT addon | ~$50 one-time | Blender facial morph target automation |
| Blender | Free | |
| SuperMachine | Existing subscription | Concept art for image-to-3D |
| Babylon JS | Free (open source) | |
| **Total** | **~$65-80** | Plus existing SuperMachine sub |
