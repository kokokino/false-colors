import { Animation } from '@babylonjs/core/Animations/animation.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';

// Character animation driver
// Handles bone-based idle animations with periodic gestures, phase poses,
// highlight effects, and morph target prep for lip sync

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

// Smooth interpolation helper (0→1→0 over duration)
function gestureBlend(startTime, now, duration) {
  const elapsed = now - startTime;
  if (elapsed < 0 || elapsed > duration) {
    return 0;
  }
  const t = elapsed / duration;
  // Smooth bell curve: sin² for natural ease in/out
  return Math.sin(t * Math.PI) ** 2;
}

// Gesture definitions — each returns target Euler offsets for specific bones
// { boneName: { pitch, yaw, roll }, duration, ... }
const GESTURES = [
  // Chin touch — raise right forearm toward face, tilt head down
  {
    name: 'chin_touch',
    duration: 4.0,
    targets: {
      rightArm: { pitch: -0.8, yaw: 0.3, roll: 0.2 },
      rightForearm: { pitch: -1.2, yaw: 0, roll: 0 },
      head: { pitch: 0.15, yaw: 0.1, roll: 0 },
      spine: { pitch: 0.05, yaw: 0, roll: 0 },
    },
  },
  // Look around — big head turn, slight spine follow
  {
    name: 'look_right',
    duration: 3.5,
    targets: {
      head: { pitch: 0, yaw: 0.4, roll: 0.05 },
      spine: { pitch: 0, yaw: 0.08, roll: 0 },
    },
  },
  {
    name: 'look_left',
    duration: 3.5,
    targets: {
      head: { pitch: 0, yaw: -0.4, roll: -0.05 },
      spine: { pitch: 0, yaw: -0.08, roll: 0 },
    },
  },
  // Lean forward — inspect the table
  {
    name: 'lean_inspect',
    duration: 4.5,
    targets: {
      spine: { pitch: -0.15, yaw: 0, roll: 0 },
      head: { pitch: -0.1, yaw: 0, roll: 0 },
    },
  },
  // Shoulder shrug — quick raise of both arms
  {
    name: 'shrug',
    duration: 2.5,
    targets: {
      leftClavicle: { pitch: 0, yaw: 0, roll: 0.25 },
      rightClavicle: { pitch: 0, yaw: 0, roll: -0.25 },
      head: { pitch: 0.08, yaw: 0, roll: 0 },
    },
  },
  // Lean back — relax posture
  {
    name: 'lean_back',
    duration: 5.0,
    targets: {
      spine: { pitch: 0.1, yaw: 0, roll: 0 },
      head: { pitch: -0.05, yaw: 0, roll: 0 },
      leftArm: { pitch: 0.15, yaw: 0, roll: 0.1 },
      rightArm: { pitch: 0.15, yaw: 0, roll: -0.1 },
    },
  },
  // Hand on hip — left arm akimbo
  {
    name: 'hand_on_hip',
    duration: 5.0,
    targets: {
      leftArm: { pitch: 0.3, yaw: 0.4, roll: 0.6 },
      leftForearm: { pitch: -0.8, yaw: 0, roll: 0 },
      hip: { pitch: 0, yaw: 0, roll: 0.03 },
    },
  },
  // Scratch head — right hand up to head
  {
    name: 'scratch_head',
    duration: 3.0,
    targets: {
      rightArm: { pitch: -1.0, yaw: 0.2, roll: -0.3 },
      rightForearm: { pitch: -1.0, yaw: 0, roll: 0 },
      head: { pitch: 0.1, yaw: -0.15, roll: 0.05 },
    },
  },
  // Fold arms — both arms across chest
  {
    name: 'fold_arms',
    duration: 5.5,
    targets: {
      leftArm: { pitch: -0.3, yaw: 0.5, roll: 0.4 },
      leftForearm: { pitch: -1.3, yaw: 0.3, roll: 0 },
      rightArm: { pitch: -0.3, yaw: -0.5, roll: -0.4 },
      rightForearm: { pitch: -1.3, yaw: -0.3, roll: 0 },
      spine: { pitch: 0.05, yaw: 0, roll: 0 },
    },
  },
  // Nod thoughtfully
  {
    name: 'thoughtful_nod',
    duration: 3.0,
    targets: {
      head: { pitch: 0.2, yaw: 0.05, roll: 0 },
      spine: { pitch: 0.03, yaw: 0, roll: 0 },
    },
  },
];

// Natural resting pose offsets — applied on top of T-pose rest to bring arms down
// These rotate bones from T-pose into a relaxed standing position
const NATURAL_POSE = {
  leftArm:      Quaternion.FromEulerAngles(0.15, 0, 1.2),    // rotate down ~70deg + slight forward
  rightArm:     Quaternion.FromEulerAngles(0.15, 0, -1.2),   // mirror for right side
  leftForearm:  Quaternion.FromEulerAngles(0, 0, 0.2),       // slight bend at elbow
  rightForearm: Quaternion.FromEulerAngles(0, 0, -0.2),      // mirror
};

// Pick a random gesture and start it for a character
function triggerRandomGesture(state, time) {
  const gesture = GESTURES[Math.floor(Math.random() * GESTURES.length)];
  state.activeGesture = {
    gesture,
    startTime: time,
    endTime: time + gesture.duration,
  };
  // Schedule next gesture 6-14 seconds after this one ends
  state.nextGestureTime = time + gesture.duration + 6 + Math.random() * 8;
}

// Apply a bone rotation: rest pose * natural pose * idle offset * gesture offset
function applyBoneRotation(bone, restPose, naturalOffset, idleOffset, gestureOffset, blend) {
  const tn = getBoneTransform(bone);
  if (!tn || !restPose) {
    return;
  }

  let finalQuat = restPose;

  // Apply natural resting pose (e.g., arms down from T-pose)
  if (naturalOffset) {
    finalQuat = finalQuat.multiply(naturalOffset);
  }

  // Apply idle sway
  finalQuat = finalQuat.multiply(idleOffset);

  // Blend in gesture if active
  if (blend > 0.001 && gestureOffset) {
    const gestureQuat = Quaternion.FromEulerAngles(
      gestureOffset.pitch * blend,
      gestureOffset.yaw * blend,
      gestureOffset.roll * blend
    );
    finalQuat = finalQuat.multiply(gestureQuat);
  }

  tn.rotationQuaternion = finalQuat;
}

// Per-frame update for all character bone animations
function updateBoneAnimations() {
  const time = performance.now() / 1000;

  for (const [seatIndex, state] of characterStates) {
    if (!state.skeleton || !state.bones) {
      continue;
    }

    const { bones, offsets, restPoses } = state;

    // Check if it's time to trigger a new gesture
    if (time >= state.nextGestureTime && !state.activeGesture) {
      triggerRandomGesture(state, time);
    }

    // Calculate gesture blend
    let gestureBlendVal = 0;
    let gestureTargets = null;
    if (state.activeGesture) {
      const { gesture, startTime, endTime } = state.activeGesture;
      gestureBlendVal = gestureBlend(startTime, time, gesture.duration);
      gestureTargets = gesture.targets;
      if (time > endTime) {
        state.activeGesture = null;
      }
    }

    // Get gesture target for a bone key, or null
    const gTarget = (key) => gestureTargets ? (gestureTargets[key] || null) : null;

    // Head — idle look + gesture
    if (bones.head && restPoses.head) {
      const turnPhase = time * offsets.headTurnSpeed + offsets.headTurnOffset;
      const nodPhase = time * offsets.headNodSpeed + offsets.headNodOffset;
      const yaw = Math.sin(turnPhase) * offsets.headAmplitude;
      const pitch = Math.sin(nodPhase) * offsets.headNodAmplitude;
      const idleOffset = Quaternion.FromEulerAngles(pitch, yaw, 0);
      applyBoneRotation(bones.head, restPoses.head, null, idleOffset, gTarget('head'), gestureBlendVal);
    }

    // Hip — idle sway + gesture
    if (bones.hip && restPoses.hip) {
      const swayPhase = time * offsets.swaySpeed + offsets.swayOffset;
      const tilt = Math.sin(swayPhase) * offsets.swayAmplitude;
      const idleOffset = Quaternion.FromEulerAngles(0, 0, tilt);
      applyBoneRotation(bones.hip, restPoses.hip, null, idleOffset, gTarget('hip'), gestureBlendVal);
    }

    // Spine — idle breathing + gesture
    if (bones.spine && restPoses.spine) {
      const breathPhase = time * offsets.breathSpeed + offsets.breathOffset;
      const breathLean = Math.sin(breathPhase) * 0.02;
      const idleOffset = Quaternion.FromEulerAngles(breathLean, 0, 0);
      applyBoneRotation(bones.spine, restPoses.spine, null, idleOffset, gTarget('spine'), gestureBlendVal);
    }

    // Left arm — natural pose + idle sway + gesture
    if (bones.leftArm && restPoses.leftArm) {
      const lPhase = time * offsets.armLSpeed + offsets.armLOffset;
      const lSwing = Math.sin(lPhase) * offsets.armAmplitude;
      const idleOffset = Quaternion.FromEulerAngles(lSwing, 0, lSwing * 0.4);
      applyBoneRotation(bones.leftArm, restPoses.leftArm, NATURAL_POSE.leftArm, idleOffset, gTarget('leftArm'), gestureBlendVal);
    }

    // Right arm — natural pose + idle sway + gesture
    if (bones.rightArm && restPoses.rightArm) {
      const rPhase = time * offsets.armRSpeed + offsets.armROffset;
      const rSwing = Math.sin(rPhase) * offsets.armAmplitude;
      const idleOffset = Quaternion.FromEulerAngles(rSwing, 0, -rSwing * 0.4);
      applyBoneRotation(bones.rightArm, restPoses.rightArm, NATURAL_POSE.rightArm, idleOffset, gTarget('rightArm'), gestureBlendVal);
    }

    // Forearms — natural pose + gesture
    if (bones.leftForearm && restPoses.leftForearm) {
      const idleOffset = Quaternion.Identity();
      applyBoneRotation(bones.leftForearm, restPoses.leftForearm, NATURAL_POSE.leftForearm, idleOffset, gTarget('leftForearm'), gestureBlendVal);
    }
    if (bones.rightForearm && restPoses.rightForearm) {
      const idleOffset = Quaternion.Identity();
      applyBoneRotation(bones.rightForearm, restPoses.rightForearm, NATURAL_POSE.rightForearm, idleOffset, gTarget('rightForearm'), gestureBlendVal);
    }

    // Clavicles — gesture only (shrug)
    if (bones.leftClavicle && restPoses.leftClavicle) {
      const idleOffset = Quaternion.Identity();
      applyBoneRotation(bones.leftClavicle, restPoses.leftClavicle, null, idleOffset, gTarget('leftClavicle'), gestureBlendVal);
    }
    if (bones.rightClavicle && restPoses.rightClavicle) {
      const idleOffset = Quaternion.Identity();
      applyBoneRotation(bones.rightClavicle, restPoses.rightClavicle, null, idleOffset, gTarget('rightClavicle'), gestureBlendVal);
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
    activeGesture: null,
    nextGestureTime: performance.now() / 1000 + 2 + Math.random() * 5, // first gesture 2-7s in
    originalY: rootNode.position.y,
  };

  const skeleton = getSkeletonFromRoot(rootNode);
  state.skeleton = skeleton;

  if (skeleton) {
    // Find all bones we might animate
    state.bones = {
      spine: findBone(skeleton, 'Spine02') || findBone(skeleton, 'Spine01'),
      head: findBone(skeleton, 'Head'),
      hip: findBone(skeleton, 'Hip') || findBone(skeleton, 'Pelvis'),
      leftArm: findBone(skeleton, 'L_Upperarm'),
      rightArm: findBone(skeleton, 'R_Upperarm'),
      leftForearm: findBone(skeleton, 'L_Forearm'),
      rightForearm: findBone(skeleton, 'R_Forearm'),
      leftClavicle: findBone(skeleton, 'L_Clavicle'),
      rightClavicle: findBone(skeleton, 'R_Clavicle'),
    };

    // Capture rest poses for all bones
    state.restPoses = {};
    for (const [key, bone] of Object.entries(state.bones)) {
      state.restPoses[key] = captureRestPose(bone);
    }

    // Randomized per-character offsets so animations don't sync
    state.offsets = {
      breathSpeed: 0.8 + Math.random() * 0.3,
      breathOffset: Math.random() * Math.PI * 2,
      headTurnSpeed: 0.3 + Math.random() * 0.15,
      headTurnOffset: Math.random() * Math.PI * 2,
      headAmplitude: 0.12 + Math.random() * 0.10,
      headNodSpeed: 0.5 + Math.random() * 0.2,
      headNodOffset: Math.random() * Math.PI * 2,
      headNodAmplitude: 0.04 + Math.random() * 0.03,
      swaySpeed: 0.4 + Math.random() * 0.2,
      swayOffset: Math.random() * Math.PI * 2,
      swayAmplitude: 0.02 + Math.random() * 0.01,
      armLSpeed: 0.35 + Math.random() * 0.15,
      armLOffset: Math.random() * Math.PI * 2,
      armRSpeed: 0.30 + Math.random() * 0.15,
      armROffset: Math.random() * Math.PI * 2,
      armAmplitude: 0.05 + Math.random() * 0.03,
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
