import { Animation } from '@babylonjs/core/Animations/animation.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';

// Character animation driver
// Handles bone-based idle animations, phase poses, highlight effects, and morph target prep for lip sync

// Per-character animation state
const characterStates = new Map();

// Scene render observer for per-frame bone updates
let renderObserver = null;
let animScene = null;

// Find a bone by name in a skeleton
function findBone(skeleton, name) {
  if (!skeleton) {
    return null;
  }
  return skeleton.bones.find(b => b.name === name) || null;
}

// Get skeleton from a character root node
function getSkeletonFromRoot(rootNode) {
  const meshes = rootNode.getChildMeshes(false);
  for (const mesh of meshes) {
    if (mesh.skeleton) {
      return mesh.skeleton;
    }
  }
  return null;
}

// Get the transform node for a bone (the object we actually animate)
function getBoneTransform(bone) {
  if (!bone || typeof bone.getTransformNode !== 'function') {
    return null;
  }
  return bone.getTransformNode();
}

// Store a bone's rest rotation for later compositing
function captureRestPose(bone) {
  if (!bone) {
    return null;
  }
  const tn = getBoneTransform(bone);
  if (tn && tn.rotationQuaternion) {
    return tn.rotationQuaternion.clone();
  }
  return null;
}

// Per-frame update for all character bone animations
function updateBoneAnimations() {
  const time = performance.now() / 1000; // seconds

  for (const [seatIndex, state] of characterStates) {
    if (!state.skeleton || !state.bones) {
      continue;
    }

    const { bones, offsets, restPoses } = state;

    // Head movement — look left/right with occasional nod
    if (bones.head && restPoses.head) {
      const tn = getBoneTransform(bones.head);
      if (tn) {
        const turnPhase = time * offsets.headTurnSpeed + offsets.headTurnOffset;
        const nodPhase = time * offsets.headNodSpeed + offsets.headNodOffset;
        const yaw = Math.sin(turnPhase) * offsets.headAmplitude;
        const pitch = Math.sin(nodPhase) * offsets.headNodAmplitude;
        const offsetQuat = Quaternion.FromEulerAngles(pitch, yaw, 0);
        tn.rotationQuaternion = restPoses.head.multiply(offsetQuat);
      }
    }

    // Weight shift — hip tilt
    if (bones.hip && restPoses.hip) {
      const tn = getBoneTransform(bones.hip);
      if (tn) {
        const swayPhase = time * offsets.swaySpeed + offsets.swayOffset;
        const tilt = Math.sin(swayPhase) * offsets.swayAmplitude;
        const offsetQuat = Quaternion.FromEulerAngles(0, 0, tilt);
        tn.rotationQuaternion = restPoses.hip.multiply(offsetQuat);
      }
    }

    // Breathing — spine rotation (slight forward/back lean)
    if (bones.spine && restPoses.spine) {
      const tn = getBoneTransform(bones.spine);
      if (tn) {
        const breathPhase = time * offsets.breathSpeed + offsets.breathOffset;
        const breathLean = Math.sin(breathPhase) * 0.02;
        const offsetQuat = Quaternion.FromEulerAngles(breathLean, 0, 0);
        tn.rotationQuaternion = restPoses.spine.multiply(offsetQuat);
      }
    }

    // Arm sway — subtle pendulum
    if (bones.leftArm && restPoses.leftArm) {
      const tn = getBoneTransform(bones.leftArm);
      if (tn) {
        const lPhase = time * offsets.armLSpeed + offsets.armLOffset;
        const lSwing = Math.sin(lPhase) * offsets.armAmplitude;
        const offsetQuat = Quaternion.FromEulerAngles(lSwing, 0, lSwing * 0.4);
        tn.rotationQuaternion = restPoses.leftArm.multiply(offsetQuat);
      }
    }
    if (bones.rightArm && restPoses.rightArm) {
      const tn = getBoneTransform(bones.rightArm);
      if (tn) {
        const rPhase = time * offsets.armRSpeed + offsets.armROffset;
        const rSwing = Math.sin(rPhase) * offsets.armAmplitude;
        const offsetQuat = Quaternion.FromEulerAngles(rSwing, 0, -rSwing * 0.4);
        tn.rotationQuaternion = restPoses.rightArm.multiply(offsetQuat);
      }
    }
  }
}

// Initialize animations for a character instance
export function initCharacterAnimations(scene, rootNode, seatIndex) {
  if (!rootNode) {
    return;
  }

  // Register the per-frame update once
  if (!renderObserver && scene) {
    animScene = scene;
    renderObserver = scene.onBeforeRenderObservable.add(updateBoneAnimations);
  }

  const state = {
    rootNode,
    seatIndex,
    skeleton: null,
    bones: null,
    restPoses: null,
    offsets: null,
    originalY: rootNode.position.y,
  };

  const skeleton = getSkeletonFromRoot(rootNode);
  state.skeleton = skeleton;

  if (skeleton) {
    // Find the bones we want to animate
    state.bones = {
      spine: findBone(skeleton, 'Spine02') || findBone(skeleton, 'Spine01'),
      head: findBone(skeleton, 'Head'),
      hip: findBone(skeleton, 'Hip') || findBone(skeleton, 'Pelvis'),
      leftArm: findBone(skeleton, 'L_Upperarm'),
      rightArm: findBone(skeleton, 'R_Upperarm'),
    };

    // Capture rest poses so we can composite offsets on top
    state.restPoses = {
      spine: captureRestPose(state.bones.spine),
      head: captureRestPose(state.bones.head),
      hip: captureRestPose(state.bones.hip),
      leftArm: captureRestPose(state.bones.leftArm),
      rightArm: captureRestPose(state.bones.rightArm),
    };


    // Randomized per-character offsets so animations don't sync
    state.offsets = {
      breathSpeed: 0.8 + Math.random() * 0.3,
      breathOffset: Math.random() * Math.PI * 2,
      headTurnSpeed: 0.3 + Math.random() * 0.15,
      headTurnOffset: Math.random() * Math.PI * 2,
      headAmplitude: 0.10 + Math.random() * 0.08,
      headNodSpeed: 0.5 + Math.random() * 0.2,
      headNodOffset: Math.random() * Math.PI * 2,
      headNodAmplitude: 0.03 + Math.random() * 0.02,
      swaySpeed: 0.4 + Math.random() * 0.2,
      swayOffset: Math.random() * Math.PI * 2,
      swayAmplitude: 0.012 + Math.random() * 0.008,
      armLSpeed: 0.35 + Math.random() * 0.15,
      armLOffset: Math.random() * Math.PI * 2,
      armRSpeed: 0.30 + Math.random() * 0.15,
      armROffset: Math.random() * Math.PI * 2,
      armAmplitude: 0.03 + Math.random() * 0.02,
    };
  }

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
      mesh.outlineColor = new Color3(0.29, 0.44, 0.65);
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
      node.rotation.x = -0.1;
      break;
    case 'arms_crossed':
      node.rotation.x = 0.05;
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

  state.rootNode.animations = state.rootNode.animations || [];
  state.rootNode.animations.push(scaleAnim);
  const animRef = scene.beginAnimation(state.rootNode, 0, 20, true, 1.5);

  setTimeout(() => {
    animRef.stop();
    state.rootNode.scaling = base;
    const idx = state.rootNode.animations.indexOf(scaleAnim);
    if (idx >= 0) {
      state.rootNode.animations.splice(idx, 1);
    }
  }, durationMs);
}

// Clean up all character animation state
export function disposeAllAnimations() {
  if (renderObserver && animScene) {
    animScene.onBeforeRenderObservable.remove(renderObserver);
    renderObserver = null;
    animScene = null;
  }
  characterStates.clear();
}
