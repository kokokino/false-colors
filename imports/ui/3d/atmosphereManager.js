import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js';
import { Texture } from '@babylonjs/core/Materials/Textures/texture.js';
import { Animation } from '@babylonjs/core/Animations/animation.js';
import '@babylonjs/core/Animations/animatable.js';

// Doom-reactive atmospheric effects
// Fog density, lantern flicker, color grading, ghost particles, threat-specific effects

let atmosphereState = null;

// Color grading presets — interpolate based on doom ratio
const COLOR_LOW_DOOM = {
  ambient: new Color3(0.55, 0.42, 0.25),   // warm amber
  fog: new Color3(0.15, 0.12, 0.08),        // soft dark brown
  clearColor: new Color4(0.08, 0.06, 0.04, 1),
};

const COLOR_HIGH_DOOM = {
  ambient: new Color3(0.15, 0.35, 0.30),    // cold blue-green
  fog: new Color3(0.05, 0.12, 0.10),        // ghostly teal
  clearColor: new Color4(0.03, 0.06, 0.06, 1),
};

export function initAtmosphere(scene) {
  // Enable fog
  scene.fogMode = 2; // exponential
  scene.fogDensity = 0.02;
  scene.fogColor = COLOR_LOW_DOOM.fog.clone();

  // Set clear color
  scene.clearColor = COLOR_LOW_DOOM.clearColor.clone();

  // Create flickering lantern lights
  const lanterns = [];
  const lanternPositions = [
    new Vector3(-1.5, 2, -1.5),
    new Vector3(1.5, 2, -1.5),
    new Vector3(0, 2.5, 1.5),
  ];

  for (let i = 0; i < lanternPositions.length; i++) {
    const light = new PointLight(`lantern_${i}`, lanternPositions[i], scene);
    light.diffuse = new Color3(0.9, 0.65, 0.3);
    light.intensity = 0.6;
    light.range = 8;

    // Flicker animation
    const flickerAnim = new Animation(
      `lanternFlicker_${i}`,
      'intensity',
      30,
      Animation.ANIMATIONTYPE_FLOAT,
      Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // Randomize flicker pattern per lantern
    const base = 0.5 + Math.random() * 0.2;
    const keys = [];
    for (let f = 0; f <= 60; f += 10) {
      keys.push({ frame: f, value: base + (Math.random() * 0.3 - 0.15) });
    }
    flickerAnim.setKeys(keys);
    light.animations = [flickerAnim];
    scene.beginAnimation(light, 0, 60, true, 0.8 + Math.random() * 0.4);

    lanterns.push(light);
  }

  // Ghost particle system (starts hidden, appears at high doom)
  let ghostParticles = null;
  try {
    ghostParticles = new ParticleSystem('ghostParticles', 50, scene);
    ghostParticles.createPointEmitter(
      new Vector3(-3, 0, -3),
      new Vector3(3, 3, 3)
    );
    ghostParticles.color1 = new Color4(0.3, 0.8, 0.7, 0.1);
    ghostParticles.color2 = new Color4(0.2, 0.6, 0.8, 0.05);
    ghostParticles.colorDead = new Color4(0, 0.3, 0.3, 0);
    ghostParticles.minSize = 0.1;
    ghostParticles.maxSize = 0.4;
    ghostParticles.minLifeTime = 2;
    ghostParticles.maxLifeTime = 5;
    ghostParticles.emitRate = 0;
    ghostParticles.gravity = new Vector3(0, 0.2, 0);
    ghostParticles.minEmitPower = 0.1;
    ghostParticles.maxEmitPower = 0.3;
    ghostParticles.start();
  } catch (err) {
    console.warn('[atmosphere] Could not create particle system:', err.message);
  }

  atmosphereState = {
    scene,
    lanterns,
    ghostParticles,
    currentDoomRatio: 0,
  };
}

// Update atmosphere based on doom level
// doomRatio: 0 (safe) to 1 (threshold)
export function updateDoomAtmosphere(doomRatio) {
  if (!atmosphereState) {
    return;
  }

  const { scene, lanterns, ghostParticles } = atmosphereState;
  const t = Math.min(1, Math.max(0, doomRatio));
  atmosphereState.currentDoomRatio = t;

  // Interpolate fog density: 0.02 (low) → 0.08 (high)
  scene.fogDensity = 0.02 + t * 0.06;

  // Interpolate fog color
  Color3.LerpToRef(COLOR_LOW_DOOM.fog, COLOR_HIGH_DOOM.fog, t, scene.fogColor);

  // Interpolate clear color
  scene.clearColor.r = COLOR_LOW_DOOM.clearColor.r + (COLOR_HIGH_DOOM.clearColor.r - COLOR_LOW_DOOM.clearColor.r) * t;
  scene.clearColor.g = COLOR_LOW_DOOM.clearColor.g + (COLOR_HIGH_DOOM.clearColor.g - COLOR_LOW_DOOM.clearColor.g) * t;
  scene.clearColor.b = COLOR_LOW_DOOM.clearColor.b + (COLOR_HIGH_DOOM.clearColor.b - COLOR_LOW_DOOM.clearColor.b) * t;

  // Lantern flicker gets more aggressive at high doom
  for (const light of lanterns) {
    // Shift color from warm to cold
    light.diffuse.r = 0.9 - t * 0.5;
    light.diffuse.g = 0.65 - t * 0.3;
    light.diffuse.b = 0.3 + t * 0.4;
  }

  // Ghost particles appear above 50% doom, intensify toward threshold
  if (ghostParticles) {
    if (t > 0.5) {
      const particleIntensity = (t - 0.5) * 2; // 0→1 over the top half
      ghostParticles.emitRate = Math.floor(particleIntensity * 30);
    } else {
      ghostParticles.emitRate = 0;
    }
  }
}

// Trigger a threat-specific atmospheric effect (brief, during threat reveal)
export function triggerThreatEffect(scene, threatType, durationMs) {
  if (!atmosphereState) {
    return;
  }

  const prevFogDensity = scene.fogDensity;
  const prevFogColor = scene.fogColor.clone();

  switch (threatType) {
    case 'fog':
      // Dense fog burst
      scene.fogDensity = 0.15;
      break;
    case 'storm':
      // Flash: bright then dark
      scene.clearColor = new Color4(0.8, 0.8, 0.9, 1);
      setTimeout(() => {
        if (atmosphereState) {
          updateDoomAtmosphere(atmosphereState.currentDoomRatio);
        }
      }, 100);
      break;
    case 'illness':
      // Sickly green fog
      scene.fogColor = new Color3(0.1, 0.2, 0.05);
      scene.fogDensity = 0.1;
      break;
    case 'kraken':
      // Darken everything briefly
      scene.fogDensity = 0.12;
      scene.fogColor = new Color3(0.05, 0.02, 0.08);
      break;
    case 'reef':
    case 'hull_breach':
      // Slight rumble effect (shift fog briefly)
      scene.fogDensity = prevFogDensity + 0.03;
      break;
  }

  // Restore after duration
  setTimeout(() => {
    if (atmosphereState) {
      updateDoomAtmosphere(atmosphereState.currentDoomRatio);
    }
  }, durationMs || 2000);
}

// Clean up all atmosphere resources
export function disposeAtmosphere() {
  if (!atmosphereState) {
    return;
  }

  for (const light of atmosphereState.lanterns) {
    light.dispose();
  }
  if (atmosphereState.ghostParticles) {
    atmosphereState.ghostParticles.dispose();
  }

  atmosphereState = null;
}
