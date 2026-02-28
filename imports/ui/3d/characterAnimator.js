import { Animation } from '@babylonjs/core/Animations/animation.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';

// Character animation driver
// Handles idle animations, phase poses, highlight effects, and morph target prep for lip sync

const IDLE_SPEED = 0.5;
const BREATHING_AMPLITUDE = 0.02;

// Per-character animation state
const characterStates = new Map();

// Initialize animations for a character instance
export function initCharacterAnimations(scene, rootNode, seatIndex) {
  if (!rootNode) {
    return;
  }

  const state = {
    rootNode,
    seatIndex,
    idleAnimation: null,
    highlightMesh: null,
    originalY: rootNode.position.y,
  };

  // Subtle breathing idle — bob up and down
  const idleAnim = new Animation(
    `idle_${seatIndex}`,
    'position.y',
    30, // fps
    Animation.ANIMATIONTYPE_FLOAT,
    Animation.ANIMATIONLOOPMODE_CYCLE
  );

  const keys = [
    { frame: 0, value: state.originalY },
    { frame: 30, value: state.originalY + BREATHING_AMPLITUDE },
    { frame: 60, value: state.originalY },
  ];
  idleAnim.setKeys(keys);

  rootNode.animations = rootNode.animations || [];
  rootNode.animations.push(idleAnim);

  state.idleAnimation = scene.beginAnimation(
    rootNode,
    0,
    60,
    true, // loop
    IDLE_SPEED
  );

  characterStates.set(seatIndex, state);
}

// Highlight a character (e.g., the current player's own avatar)
export function setCharacterHighlight(scene, seatIndex, enabled) {
  const state = characterStates.get(seatIndex);
  if (!state || !state.rootNode) {
    return;
  }

  const meshes = state.rootNode.getChildMeshes(false);
  for (const mesh of meshes) {
    if (enabled) {
      mesh.renderOutline = true;
      mesh.outlineWidth = 0.02;
      mesh.outlineColor = new Color3(0.29, 0.44, 0.65); // matches --primary
    } else {
      mesh.renderOutline = false;
    }
  }
}

// Set a phase-specific pose by adjusting character rotation/position
export function setCharacterPose(seatIndex, pose) {
  const state = characterStates.get(seatIndex);
  if (!state || !state.rootNode) {
    return;
  }

  const node = state.rootNode;

  switch (pose) {
    case 'lean_forward':
      node.rotation.x = -0.1; // slight forward lean
      break;
    case 'arms_crossed':
      node.rotation.x = 0.05; // slight back lean
      break;
    case 'attention':
      node.rotation.x = 0;
      break;
    default:
      node.rotation.x = 0;
      break;
  }
}

// Drive a morph target by name (prepared for Phase 4 lip sync via HeadTTS)
// visemeWeights: { visemeName: weight } where weight is 0-1
export function setVisemeWeights(seatIndex, visemeWeights) {
  const state = characterStates.get(seatIndex);
  if (!state || !state.rootNode) {
    return;
  }

  const meshes = state.rootNode.getChildMeshes(false);
  for (const mesh of meshes) {
    const morphManager = mesh.morphTargetManager;
    if (!morphManager) {
      continue;
    }

    for (let i = 0; i < morphManager.numTargets; i++) {
      const target = morphManager.getTarget(i);
      const weight = visemeWeights[target.name];
      if (weight !== undefined) {
        target.influence = weight;
      }
    }
  }
}

// Reset all morph targets to 0 (neutral face)
export function resetVisemes(seatIndex) {
  const state = characterStates.get(seatIndex);
  if (!state || !state.rootNode) {
    return;
  }

  const meshes = state.rootNode.getChildMeshes(false);
  for (const mesh of meshes) {
    const morphManager = mesh.morphTargetManager;
    if (!morphManager) {
      continue;
    }

    for (let i = 0; i < morphManager.numTargets; i++) {
      morphManager.getTarget(i).influence = 0;
    }
  }
}

// Apply a "speaking" bounce animation (simple version before Phase 4 lip sync)
export function triggerSpeakingAnimation(scene, seatIndex, durationMs) {
  const state = characterStates.get(seatIndex);
  if (!state || !state.rootNode) {
    return;
  }

  // Slight scale pulse to indicate speaking
  const scaleAnim = new Animation(
    `speak_${seatIndex}`,
    'scaling',
    30,
    Animation.ANIMATIONTYPE_VECTOR3,
    Animation.ANIMATIONLOOPMODE_CYCLE
  );

  const base = state.rootNode.scaling.clone();
  const pulse = base.scale(1.02);
  scaleAnim.setKeys([
    { frame: 0, value: base },
    { frame: 10, value: pulse },
    { frame: 20, value: base },
  ]);

  const loops = Math.ceil((durationMs / 1000) * (30 / 20));
  state.rootNode.animations.push(scaleAnim);
  const animRef = scene.beginAnimation(state.rootNode, 0, 20, true, 1.5);

  setTimeout(() => {
    animRef.stop();
    state.rootNode.scaling = base;
    // Remove the speaking anim from the array
    const idx = state.rootNode.animations.indexOf(scaleAnim);
    if (idx >= 0) {
      state.rootNode.animations.splice(idx, 1);
    }
  }, durationMs);
}

// Clean up all character animation state
export function disposeAllAnimations() {
  for (const [seatIndex, state] of characterStates) {
    if (state.idleAnimation) {
      state.idleAnimation.stop();
    }
  }
  characterStates.clear();
}
