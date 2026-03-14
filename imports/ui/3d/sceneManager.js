import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import '@babylonjs/core/Animations/animatable.js';

import {
  loadCharacter,
  loadThreat,
  loadProp,
  loadEnvironment,
  loadEnvironmentInstance,
  preloadCharacters,
  preloadEnvironment,
  disposeAll as disposeAssets,
} from './assetLoader.js';
import {
  initCharacterAnimations,
  setCharacterHighlight,
  setCharacterPose,
  triggerSpeakingAnimation,
  disposeAllAnimations,
} from './characterAnimator.js';
import {
  initAtmosphere,
  updateDoomAtmosphere,
  triggerThreatEffect,
  disposeAtmosphere,
} from './atmosphereManager.js';

// Y offset for the cabin floor (characters and furniture sit on this plane)
const FLOOR_Y = 0.45;

// 6 seats arranged in a hexagon around the war table
const SEAT_POSITIONS = [
  new Vector3(0, FLOOR_Y, -2),      // seat 0 — front
  new Vector3(1.73, FLOOR_Y, -1),   // seat 1 — front-right
  new Vector3(1.73, FLOOR_Y, 1),    // seat 2 — back-right
  new Vector3(0, FLOOR_Y, 2),       // seat 3 — back
  new Vector3(-1.73, FLOOR_Y, 1),   // seat 4 — back-left
  new Vector3(-1.73, FLOOR_Y, -1),  // seat 5 — front-left
];

// Compute Y rotation so a character at seatPos faces the table center (0,0,0).
// Models face -Z at rotation.y = 0 (confirmed empirically from Tripo exports).
// Direction from seat to center is (-x, -z). We want the model's -Z axis to
// align with that direction. rotation.y = atan2(-x, -z) works when forward is +Z;
// since forward is -Z we add PI.
function faceCenter(seatPos) {
  return Math.atan2(-seatPos.x, -seatPos.z);
}

// Per-character scale and rotation corrections for models of varying size/orientation
// scale: uniform scale factor to normalize height so characters stand taller than the table
// rotationOffset: extra Y rotation if the model's forward isn't +Z
const CHARACTER_ADJUSTMENTS = {
  blackwood:  { scale: 1.4, rotationOffset: 0 },
  voss:       { scale: 1.4, rotationOffset: 0 },
  thorne:     { scale: 1.7, rotationOffset: 0 },
  crane:      { scale: 1.4, rotationOffset: 0 },
  maren:      { scale: 1.4, rotationOffset: 0 },
  delgado:    { scale: 1.5, rotationOffset: 0 },
};

// Threat token positions on the table surface
const THREAT_SLOT_POSITIONS = [
  new Vector3(-0.6, FLOOR_Y + 0.82, -0.4),
  new Vector3(0, FLOOR_Y + 0.82, -0.4),
  new Vector3(0.6, FLOOR_Y + 0.82, -0.4),
  new Vector3(-0.6, FLOOR_Y + 0.82, 0.4),
  new Vector3(0, FLOOR_Y + 0.82, 0.4),
  new Vector3(0.6, FLOOR_Y + 0.82, 0.4),
];

// Prop placement positions on/around the table
const PROP_POSITIONS = {
  ocean_map:    new Vector3(0, FLOOR_Y + 0.81, 0),         // flat on table center
  compass:      new Vector3(0.8, FLOOR_Y + 0.83, 0),        // on table, offset right
  doom_crystal: new Vector3(-0.9, FLOOR_Y + 0.83, 0),       // on table, offset left
  lantern_0:    new Vector3(-1.5, FLOOR_Y + 1.5, -1.5),     // hanging/mounted, left-front
  lantern_1:    new Vector3(1.5, FLOOR_Y + 1.5, -1.5),      // hanging/mounted, right-front
  lantern_2:    new Vector3(0, FLOOR_Y + 1.8, 1.5),          // hanging/mounted, back-center
  helm:         new Vector3(1.0, FLOOR_Y + 0.5, 5.5),         // visible through cabin window, on "deck"
};

// Scale factors for props (most are too large or small at default)
const PROP_SCALES = {
  ocean_map:    0.5,
  compass:      0.15,
  doom_crystal: 0.15,
  lantern:      0.6,
  helm:         1.2,
  cabin:        1.0,
  gold_coin:    0.08,
  skull:        0.08,
  resolve_gem:  0.06,
  curse_card:   0.1,
};

let sceneState = null;

// Initialize the 3D scene on a canvas element
export async function initScene(canvas, onProgress) {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
  });

  const scene = new Scene(engine);
  scene.useRightHandedSystem = false;

  // Camera — orbit around the war table
  const camera = new ArcRotateCamera(
    'camera',
    -Math.PI / 2, // alpha — horizontal angle
    Math.PI / 3,  // beta — vertical angle (looking down at ~60deg)
    6,            // radius — distance from target
    new Vector3(0, FLOOR_Y + 0.5, 0), // target — table center
    scene
  );
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2 - 0.05;
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 30;

  // Ambient light — slightly brighter for character readability
  const ambientLight = new HemisphericLight(
    'ambient',
    new Vector3(0, 1, 0),
    scene
  );
  ambientLight.intensity = 0.85;
  ambientLight.diffuse = new Color3(0.65, 0.55, 0.40);
  ambientLight.groundColor = new Color3(0.25, 0.20, 0.15);

  // Initialize atmosphere (lantern lights, fog, particles)
  initAtmosphere(scene);

  // Load environment
  if (onProgress) {
    onProgress('Loading environment...');
  }

  // Load war table (with floor plane fallback)
  const warTable = await loadEnvironment(scene, 'war_table');
  if (warTable && warTable.rootNodes && warTable.rootNodes.length > 0) {
    warTable.rootNodes[0].position.y = FLOOR_Y;
  } else {
    await createPlaceholderScene(scene);
  }

  // Load ocean map onto the table
  const oceanMap = await loadEnvironment(scene, 'ocean_map');
  if (oceanMap && oceanMap.rootNodes && oceanMap.rootNodes.length > 0) {
    const mapNode = oceanMap.rootNodes[0];
    mapNode.position = PROP_POSITIONS.ocean_map.clone();
    mapNode.scaling = new Vector3(PROP_SCALES.ocean_map, PROP_SCALES.ocean_map, PROP_SCALES.ocean_map);
  }

  // Load lantern GLBs at the three lantern light positions
  for (let i = 0; i < 3; i++) {
    const lanternInstance = await loadEnvironmentInstance(scene, 'lantern', `lantern_${i}`);
    if (lanternInstance && lanternInstance.rootNodes && lanternInstance.rootNodes.length > 0) {
      const lanternNode = lanternInstance.rootNodes[0];
      const posKey = `lantern_${i}`;
      lanternNode.position = PROP_POSITIONS[posKey].clone();
      const s = PROP_SCALES.lantern;
      lanternNode.scaling = new Vector3(s, s, s);
    }
  }

  // Load helm as background decoration
  const helm = await loadEnvironment(scene, 'helm');
  if (helm && helm.rootNodes && helm.rootNodes.length > 0) {
    const helmNode = helm.rootNodes[0];
    helmNode.position = PROP_POSITIONS.helm.clone();
    const s = PROP_SCALES.helm;
    helmNode.scaling = new Vector3(s, s, s);
  }

  // Load cabin room (surrounds the scene)
  let cabinMeshes = [];
  const cabin = await loadEnvironment(scene, 'cabin');
  if (cabin && cabin.rootNodes && cabin.rootNodes.length > 0) {
    const cabinNode = cabin.rootNodes[0];
    cabinNode.position = new Vector3(0, 0, 3.0);
    const s = PROP_SCALES.cabin;
    cabinNode.scaling = new Vector3(s, s, s);
    // Collect all cabin meshes for camera occlusion hiding
    cabinMeshes = cabinNode.getChildMeshes(false);
  }

  // Load compass on the table
  const compass = await loadProp(scene, 'compass');
  if (compass && compass.rootNodes && compass.rootNodes.length > 0) {
    const compassNode = compass.rootNodes[0];
    compassNode.position = PROP_POSITIONS.compass.clone();
    const s = PROP_SCALES.compass;
    compassNode.scaling = new Vector3(s, s, s);
  }

  // Load doom crystal on the table (visual doom indicator)
  const doomCrystal = await loadProp(scene, 'doom_crystal');
  let doomCrystalNode = null;
  if (doomCrystal && doomCrystal.rootNodes && doomCrystal.rootNodes.length > 0) {
    doomCrystalNode = doomCrystal.rootNodes[0];
    doomCrystalNode.position = PROP_POSITIONS.doom_crystal.clone();
    const s = PROP_SCALES.doom_crystal;
    doomCrystalNode.scaling = new Vector3(s, s, s);
  }

  // Floor plane (always present, even with GLB table)
  const existingFloor = scene.getMeshByName('floor');
  if (!existingFloor) {
    const floor = MeshBuilder.CreateGround('floor', { width: 10, height: 10 }, scene);
    const floorMat = new StandardMaterial('floorMat', scene);
    floorMat.diffuseColor = new Color3(0.12, 0.08, 0.05);
    floorMat.specularColor = new Color3(0.02, 0.02, 0.02);
    floor.material = floorMat;
  }

  // Pre-load character models
  if (onProgress) {
    onProgress('Loading characters...');
  }
  await preloadCharacters(scene, (loaded, total) => {
    if (onProgress) {
      onProgress(`Loading characters (${loaded}/${total})...`);
    }
  });

  sceneState = {
    engine,
    scene,
    camera,
    ambientLight,
    characterNodes: new Map(),
    threatNodes: new Map(),
    propNodes: new Map(),
    doomCrystalNode,
    previousThreats: [],
    previousPhase: null,
    previousGoldCount: 0,
    previousSkullCount: 0,
  };

  // Start render loop with cabin occlusion fading
  const tableCenter = new Vector3(0, FLOOR_Y + 0.5, 0);
  engine.runRenderLoop(() => {
    // Hide cabin meshes on the camera's side (XZ half-plane through cabin center).
    // Splits the cabin in half relative to its own center — the near half is hidden.
    const cabinCenterZ = 3.0; // matches cabinNode.position.z
    if (cabinMeshes.length > 0) {
      const camX = camera.position.x;
      const camZ = camera.position.z;
      // Direction from camera to table center on XZ plane
      const dirLen = Math.sqrt(camX * camX + camZ * camZ);
      if (dirLen > 0.01) {
        const camDirX = -camX / dirLen;
        const camDirZ = -camZ / dirLen;

        for (const mesh of cabinMeshes) {
          const meshPos = mesh.getAbsolutePosition();
          // Mesh position relative to cabin center
          const relX = meshPos.x;
          const relZ = meshPos.z - cabinCenterZ;
          // Project onto camera direction
          const proj = relX * camDirX + relZ * camDirZ;
          // Negative = mesh is on camera's side of cabin center. Hide it.
          mesh.isVisible = proj > -1.0;
        }
      }
    }
    scene.render();
  });

  // Handle resize
  const resizeHandler = () => engine.resize();
  window.addEventListener('resize', resizeHandler);
  sceneState.resizeHandler = resizeHandler;

  return sceneState;
}

// Create placeholder geometry when GLB table isn't available
async function createPlaceholderScene(scene) {
  // Table — dark wood cylinder
  const table = MeshBuilder.CreateCylinder('placeholder_table', {
    diameter: 3,
    height: 0.1,
    tessellation: 24,
  }, scene);
  table.position = new Vector3(0, FLOOR_Y + 0.75, 0);

  const tableMat = new StandardMaterial('tableMat', scene);
  tableMat.diffuseColor = new Color3(0.25, 0.15, 0.08);
  tableMat.specularColor = new Color3(0.1, 0.08, 0.05);
  table.material = tableMat;

  // Table legs — parent them to the table so they get removed together
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const leg = MeshBuilder.CreateCylinder(`placeholder_table_leg_${i}`, {
      diameter: 0.08,
      height: 0.75,
    }, scene);
    leg.position = new Vector3(
      Math.cos(angle) * 1.2,
      FLOOR_Y + 0.375,
      Math.sin(angle) * 1.2
    );
    leg.material = tableMat;
  }

  // Floor — dark planks
  const floor = MeshBuilder.CreateGround('floor', {
    width: 10,
    height: 10,
  }, scene);
  const floorMat = new StandardMaterial('floorMat', scene);
  floorMat.diffuseColor = new Color3(0.12, 0.08, 0.05);
  floorMat.specularColor = new Color3(0.02, 0.02, 0.02);
  floor.material = floorMat;
}

// Place character models around the table based on game players array
export async function placeCharacters(players, mySeatIndex) {
  if (!sceneState) {
    return;
  }
  const { scene, characterNodes } = sceneState;

  for (const player of players) {
    const seatIndex = player.seatIndex;

    // Skip if already placed
    if (characterNodes.has(seatIndex)) {
      continue;
    }

    // Load character model (or create placeholder)
    const characterName = player.displayName || `seat_${seatIndex}`;
    const instance = await loadCharacter(scene, characterName);

    let rootNode;

    if (instance && instance.rootNodes && instance.rootNodes.length > 0) {
      rootNode = instance.rootNodes[0];

      // Apply per-character scale and rotation corrections
      const adjustKey = characterName.toLowerCase();
      const adj = CHARACTER_ADJUSTMENTS[adjustKey] || { scale: 1.4, rotationOffset: 0 };
      rootNode.scaling = new Vector3(adj.scale, adj.scale, adj.scale);

      // Position and rotate to face center
      rootNode.position = SEAT_POSITIONS[seatIndex].clone();
      rootNode.rotation = new Vector3(0, faceCenter(SEAT_POSITIONS[seatIndex]) + adj.rotationOffset, 0);
    } else {
      // Placeholder — colored capsule
      rootNode = new TransformNode(`char_placeholder_${seatIndex}`, scene);
      const body = MeshBuilder.CreateCapsule(`char_body_${seatIndex}`, {
        radius: 0.15,
        height: 0.8,
      }, scene);
      body.parent = rootNode;
      body.position.y = 0.4;

      const headSphere = MeshBuilder.CreateSphere(`char_head_${seatIndex}`, {
        diameter: 0.25,
      }, scene);
      headSphere.parent = rootNode;
      headSphere.position.y = 0.9;

      // Color by seat index
      const mat = new StandardMaterial(`charMat_${seatIndex}`, scene);
      const hue = seatIndex / 6;
      mat.diffuseColor = Color3.FromHSV(hue * 360, 0.5, 0.6);
      body.material = mat;
      headSphere.material = mat;

      rootNode.position = SEAT_POSITIONS[seatIndex].clone();
      rootNode.rotation = new Vector3(0, faceCenter(SEAT_POSITIONS[seatIndex]), 0);
    }

    // Initialize idle animations
    initCharacterAnimations(scene, rootNode, seatIndex, characterName.toLowerCase());

    // Highlight the player's own character
    if (seatIndex === mySeatIndex) {
      setCharacterHighlight(scene, seatIndex, true);
    }

    characterNodes.set(seatIndex, rootNode);
  }
}

// Update threat tokens on the table
export async function updateThreats(activeThreats) {
  if (!sceneState) {
    return;
  }
  const { scene, threatNodes, previousThreats } = sceneState;

  // Find new threats
  const currentIds = new Set(activeThreats.map(t => t.id));
  const previousIds = new Set(previousThreats.map(t => t.id));

  // Remove departed threats
  for (const [id, node] of threatNodes) {
    if (!currentIds.has(id)) {
      node.dispose();
      threatNodes.delete(id);
    }
  }

  // Add new threats
  let slotIndex = 0;
  for (const threat of activeThreats) {
    if (!threatNodes.has(threat.id)) {
      const instance = await loadThreat(scene, threat.type, threat.id);
      let node;

      if (instance && instance.rootNodes && instance.rootNodes.length > 0) {
        node = instance.rootNodes[0];
        // Scale threat tokens to be visible on the table
        node.scaling = new Vector3(0.15, 0.15, 0.15);
      } else {
        // Placeholder — colored box
        node = MeshBuilder.CreateBox(`threat_${threat.id}`, {
          size: 0.2,
        }, scene);
        const mat = new StandardMaterial(`threatMat_${threat.id}`, scene);
        mat.diffuseColor = getThreatColor(threat.type);
        mat.emissiveColor = getThreatColor(threat.type).scale(0.3);
        node.material = mat;
      }

      // Position on table
      const pos = THREAT_SLOT_POSITIONS[slotIndex % THREAT_SLOT_POSITIONS.length];
      if (pos) {
        node.position = pos.clone();
      }

      // Add emissive glow to make threats more visible
      const meshes = node.getChildMeshes ? node.getChildMeshes(false) : [];
      for (const mesh of meshes) {
        if (mesh.material) {
          mesh.material.emissiveColor = getThreatColor(threat.type).scale(0.2);
        }
      }

      threatNodes.set(threat.id, node);

      // Trigger atmospheric effect for new threats
      if (!previousIds.has(threat.id)) {
        triggerThreatEffect(scene, threat.type, 2000);
      }
    }
    slotIndex++;
  }

  sceneState.previousThreats = [...activeThreats];
}

// Update gold coins and skulls displayed on the table
async function updateScoreTokens(game) {
  if (!sceneState) {
    return;
  }
  const { scene, propNodes } = sceneState;

  const goldCount = (game.goldCoins || []).length;
  const skullCount = (game.skulls || []).length;

  // Add new gold coins
  if (goldCount > sceneState.previousGoldCount) {
    for (let i = sceneState.previousGoldCount; i < goldCount; i++) {
      const coin = await loadProp(scene, 'gold_coin');
      if (coin && coin.rootNodes && coin.rootNodes.length > 0) {
        const coinNode = coin.rootNodes[0];
        const s = PROP_SCALES.gold_coin;
        coinNode.scaling = new Vector3(s, s, s);
        // Stack coins in a row on the left side of the table
        coinNode.position = new Vector3(-0.4 + (i * 0.12), FLOOR_Y + 0.84, -0.7);
        propNodes.set(`gold_${i}`, coinNode);
      }
    }
  }
  sceneState.previousGoldCount = goldCount;

  // Add new skulls
  if (skullCount > sceneState.previousSkullCount) {
    for (let i = sceneState.previousSkullCount; i < skullCount; i++) {
      const skull = await loadProp(scene, 'skull');
      if (skull && skull.rootNodes && skull.rootNodes.length > 0) {
        const skullNode = skull.rootNodes[0];
        const s = PROP_SCALES.skull;
        skullNode.scaling = new Vector3(s, s, s);
        // Stack skulls in a row on the right side of the table
        skullNode.position = new Vector3(0.4 + (i * 0.12), FLOOR_Y + 0.84, -0.7);
        propNodes.set(`skull_${i}`, skullNode);
      }
    }
  }
  sceneState.previousSkullCount = skullCount;
}

// Update doom crystal visual based on doom level
function updateDoomCrystal(doomRatio) {
  if (!sceneState || !sceneState.doomCrystalNode) {
    return;
  }

  const node = sceneState.doomCrystalNode;
  // Pulse scale with doom
  const baseScale = PROP_SCALES.doom_crystal;
  const pulseScale = baseScale * (1 + doomRatio * 0.5);
  node.scaling = new Vector3(pulseScale, pulseScale, pulseScale);

  // Shift emissive color from dim to bright ominous red-purple
  const meshes = node.getChildMeshes ? node.getChildMeshes(false) : [];
  for (const mesh of meshes) {
    if (mesh.material) {
      mesh.material.emissiveColor = new Color3(
        0.3 * doomRatio,
        0.05 * doomRatio,
        0.2 * doomRatio
      );
    }
  }
}

// Get a representative color for a threat type
function getThreatColor(type) {
  const colors = {
    fog: new Color3(0.6, 0.7, 0.8),
    reef: new Color3(0.5, 0.35, 0.25),
    kraken: new Color3(0.4, 0.2, 0.5),
    storm: new Color3(0.3, 0.3, 0.4),
    illness: new Color3(0.3, 0.5, 0.2),
    hull_breach: new Color3(0.4, 0.25, 0.15),
  };
  return colors[type] || new Color3(0.5, 0.5, 0.5);
}

// Update the scene based on current game state
export function updateGameState(game, mySeatIndex) {
  if (!sceneState || !game) {
    return;
  }

  // Update doom atmosphere
  const doomRatio = game.doomLevel / (game.doomThreshold || 30);
  updateDoomAtmosphere(doomRatio);
  updateDoomCrystal(doomRatio);

  // Update character poses based on phase
  if (game.currentPhase !== sceneState.previousPhase) {
    updatePhasePoses(game);
    sceneState.previousPhase = game.currentPhase;
  }

  // Update threats
  updateThreats(game.activeThreats || []);

  // Update score tokens (gold coins and skulls)
  updateScoreTokens(game);
}

// Set character poses based on current phase
function updatePhasePoses(game) {
  if (!sceneState) {
    return;
  }

  const phase = game.currentPhase;
  const players = game.players || [];

  for (const player of players) {
    switch (phase) {
      case 'discussion':
        setCharacterPose(player.seatIndex, 'lean_forward');
        break;
      case 'accusation':
        setCharacterPose(player.seatIndex, 'arms_crossed');
        break;
      case 'action':
      case 'threat':
        setCharacterPose(player.seatIndex, 'attention');
        break;
      default:
        setCharacterPose(player.seatIndex, 'default');
        break;
    }
  }
}

// Focus camera on a specific seat (e.g., during accusation)
export function focusOnSeat(seatIndex, durationMs) {
  if (!sceneState) {
    return;
  }

  const pos = SEAT_POSITIONS[seatIndex];
  if (!pos) {
    return;
  }

  const { camera, scene } = sceneState;
  const targetAlpha = Math.atan2(pos.x, pos.z) - Math.PI / 2;

  // Animate camera to face the target seat
  const alphaAnim = new Animation(
    'cameraFocus',
    'alpha',
    30,
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  alphaAnim.setKeys([
    { frame: 0, value: camera.alpha },
    { frame: 30, value: targetAlpha },
  ]);

  camera.animations = [alphaAnim];
  scene.beginAnimation(camera, 0, 30, false, 1);
}

// Reset camera to default overview position
export function resetCamera() {
  if (!sceneState) {
    return;
  }

  const { camera } = sceneState;
  camera.alpha = -Math.PI / 2;
  camera.beta = Math.PI / 3;
  camera.radius = 6;
}

// Setup WebXR (behind feature flag, for future VR support)
export async function initWebXR() {
  if (!sceneState) {
    return null;
  }

  // Check if WebXR is available
  if (!navigator.xr) {
    console.info('[sceneManager] WebXR not available in this browser');
    return null;
  }

  try {
    const { WebXRDefaultExperience } = await import('@babylonjs/core/XR/webXRDefaultExperience.js');
    const xr = await WebXRDefaultExperience.CreateAsync(sceneState.scene, {
      floorMeshes: [sceneState.scene.getMeshByName('floor')],
    });
    console.info('[sceneManager] WebXR initialized');
    return xr;
  } catch (err) {
    console.warn('[sceneManager] WebXR init failed:', err.message);
    return null;
  }
}

// Get the Babylon engine (for external resize calls, etc.)
export function getEngine() {
  return sceneState?.engine || null;
}

// Get the Babylon scene
export function getScene() {
  return sceneState?.scene || null;
}

// Dispose the entire 3D scene and release GPU resources
export function disposeScene() {
  if (!sceneState) {
    return;
  }

  const { engine, scene, resizeHandler } = sceneState;

  // Clean up sub-systems
  disposeAllAnimations();
  disposeAtmosphere();
  disposeAssets();

  // Remove resize listener
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }

  // Stop render loop and dispose
  engine.stopRenderLoop();
  scene.dispose();
  engine.dispose();

  sceneState = null;
}
