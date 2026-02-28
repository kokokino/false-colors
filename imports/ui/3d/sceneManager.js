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

import {
  loadCharacter,
  loadThreat,
  loadEnvironment,
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

// 6 seats arranged in a hexagon around the war table
const SEAT_POSITIONS = [
  new Vector3(0, 0, -2),      // seat 0 — front
  new Vector3(1.73, 0, -1),   // seat 1 — front-right
  new Vector3(1.73, 0, 1),    // seat 2 — back-right
  new Vector3(0, 0, 2),       // seat 3 — back
  new Vector3(-1.73, 0, 1),   // seat 4 — back-left
  new Vector3(-1.73, 0, -1),  // seat 5 — front-left
];

// Characters face the center of the table
const SEAT_ROTATIONS = [
  0,                           // seat 0 faces +Z
  -Math.PI / 3,                // seat 1
  -(2 * Math.PI / 3),          // seat 2
  Math.PI,                     // seat 3
  (2 * Math.PI / 3),           // seat 4
  Math.PI / 3,                 // seat 5
];

// Threat token positions on the table surface
const THREAT_SLOT_POSITIONS = [
  new Vector3(-0.6, 0.82, -0.4),
  new Vector3(0, 0.82, -0.4),
  new Vector3(0.6, 0.82, -0.4),
  new Vector3(-0.6, 0.82, 0.4),
  new Vector3(0, 0.82, 0.4),
  new Vector3(0.6, 0.82, 0.4),
];

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
    new Vector3(0, 0.5, 0), // target — table center
    scene
  );
  camera.lowerRadiusLimit = 3;
  camera.upperRadiusLimit = 12;
  camera.lowerBetaLimit = 0.3;
  camera.upperBetaLimit = Math.PI / 2 - 0.05;
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 30;

  // Ambient light
  const ambientLight = new HemisphericLight(
    'ambient',
    new Vector3(0, 1, 0),
    scene
  );
  ambientLight.intensity = 0.4;
  ambientLight.diffuse = new Color3(0.55, 0.42, 0.25);
  ambientLight.groundColor = new Color3(0.1, 0.08, 0.06);

  // Initialize atmosphere (lantern lights, fog, particles)
  initAtmosphere(scene);

  // Create placeholder table if GLB not available
  await createPlaceholderScene(scene);

  // Attempt to load GLB environment
  if (onProgress) {
    onProgress('Loading environment...');
  }
  const warTable = await loadEnvironment(scene, 'war_table');
  if (warTable) {
    // Remove placeholder table
    const placeholder = scene.getMeshByName('placeholder_table');
    if (placeholder) {
      placeholder.dispose();
    }
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
    previousThreats: [],
    previousPhase: null,
  };

  // Start render loop
  engine.runRenderLoop(() => {
    scene.render();
  });

  // Handle resize
  const resizeHandler = () => engine.resize();
  window.addEventListener('resize', resizeHandler);
  sceneState.resizeHandler = resizeHandler;

  return sceneState;
}

// Create placeholder geometry when GLB assets aren't available yet
async function createPlaceholderScene(scene) {
  // Table — dark wood cylinder
  const table = MeshBuilder.CreateCylinder('placeholder_table', {
    diameter: 3,
    height: 0.1,
    tessellation: 24,
  }, scene);
  table.position = new Vector3(0, 0.75, 0);

  const tableMat = new StandardMaterial('tableMat', scene);
  tableMat.diffuseColor = new Color3(0.25, 0.15, 0.08);
  tableMat.specularColor = new Color3(0.1, 0.08, 0.05);
  table.material = tableMat;

  // Table legs
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const leg = MeshBuilder.CreateCylinder(`table_leg_${i}`, {
      diameter: 0.08,
      height: 0.75,
    }, scene);
    leg.position = new Vector3(
      Math.cos(angle) * 1.2,
      0.375,
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
    }

    // Position and rotate
    rootNode.position = SEAT_POSITIONS[seatIndex].clone();
    rootNode.rotation = new Vector3(0, SEAT_ROTATIONS[seatIndex], 0);

    // Initialize idle animations
    initCharacterAnimations(scene, rootNode, seatIndex);

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

  // Update character poses based on phase
  if (game.currentPhase !== sceneState.previousPhase) {
    updatePhasePoses(game);
    sceneState.previousPhase = game.currentPhase;
  }

  // Update threats
  updateThreats(game.activeThreats || []);
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
