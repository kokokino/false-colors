import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js';
import { AssetContainer } from '@babylonjs/core/assetContainer.js';
import '@babylonjs/loaders/glTF/index.js';

// Asset loader with caching via Babylon AssetContainers
// Load once, instantiate many times

const containerCache = new Map();
const loadingPromises = new Map();

const ASSET_BASE = '/assets/3d/';

// Character name to GLB file mapping
const CHARACTER_FILES = {
  blackwood: 'characters/blackwood.glb',
  voss: 'characters/voss.glb',
  thorne: 'characters/thorne.glb',
  crane: 'characters/crane.glb',
  maren: 'characters/maren.glb',
  delgado: 'characters/delgado.glb',
};

// Threat type to GLB file mapping
const THREAT_FILES = {
  fog: 'threats/fog.glb',
  reef: 'threats/reef.glb',
  kraken: 'threats/kraken.glb',
  storm: 'threats/storm.glb',
  illness: 'threats/illness.glb',
  hull_breach: 'threats/hull_breach.glb',
};

// Prop files
const PROP_FILES = {
  gold_coin: 'props/gold_coin.glb',
  skull: 'props/skull.glb',
  compass: 'props/compass.glb',
  doom_crystal: 'props/doom_crystal.glb',
  resolve_gem: 'props/resolve_gem.glb',
  curse_card: 'props/curse_card.glb',
};

// Environment files
const ENVIRONMENT_FILES = {
  war_table: 'environment/war_table.glb',
  ocean_map: 'environment/ocean_map.glb',
  lantern: 'environment/lantern.glb',
  helm: 'environment/helm.glb',
};

// Load a GLB file into an AssetContainer (cached)
async function loadContainer(scene, relativePath) {
  const cacheKey = relativePath;

  if (containerCache.has(cacheKey)) {
    return containerCache.get(cacheKey);
  }

  // Prevent duplicate concurrent loads of the same asset
  if (loadingPromises.has(cacheKey)) {
    return loadingPromises.get(cacheKey);
  }

  const promise = SceneLoader.LoadAssetContainerAsync(
    ASSET_BASE,
    relativePath,
    scene
  ).then(container => {
    containerCache.set(cacheKey, container);
    loadingPromises.delete(cacheKey);
    return container;
  }).catch(err => {
    loadingPromises.delete(cacheKey);
    console.warn(`[assetLoader] Failed to load ${relativePath}:`, err.message);
    return null;
  });

  loadingPromises.set(cacheKey, promise);
  return promise;
}

// Instantiate meshes from a cached container into the scene
function instantiateFromContainer(container, name) {
  if (!container) {
    return null;
  }
  const instance = container.instantiateModelsToScene(
    (sourceName) => `${name}_${sourceName}`,
    false  // don't clone materials (share them)
  );
  return instance;
}

// Load and instantiate a character model
export async function loadCharacter(scene, characterName) {
  const file = CHARACTER_FILES[characterName.toLowerCase()];
  if (!file) {
    console.warn(`[assetLoader] Unknown character: ${characterName}`);
    return null;
  }
  const container = await loadContainer(scene, file);
  return instantiateFromContainer(container, characterName);
}

// Load and instantiate a threat token model
export async function loadThreat(scene, threatType, instanceId) {
  const file = THREAT_FILES[threatType];
  if (!file) {
    console.warn(`[assetLoader] Unknown threat type: ${threatType}`);
    return null;
  }
  const container = await loadContainer(scene, file);
  return instantiateFromContainer(container, `threat_${instanceId}`);
}

// Load and instantiate a prop model
export async function loadProp(scene, propName) {
  const file = PROP_FILES[propName];
  if (!file) {
    console.warn(`[assetLoader] Unknown prop: ${propName}`);
    return null;
  }
  const container = await loadContainer(scene, file);
  return instantiateFromContainer(container, propName);
}

// Load and instantiate an environment model
export async function loadEnvironment(scene, envName) {
  const file = ENVIRONMENT_FILES[envName];
  if (!file) {
    console.warn(`[assetLoader] Unknown environment piece: ${envName}`);
    return null;
  }
  const container = await loadContainer(scene, file);
  return instantiateFromContainer(container, envName);
}

// Pre-load all character models (call during game init for faster scene setup)
export async function preloadCharacters(scene, onProgress) {
  const names = Object.keys(CHARACTER_FILES);
  let loaded = 0;
  const results = [];
  for (const name of names) {
    const container = await loadContainer(scene, CHARACTER_FILES[name]);
    results.push({ name, loaded: !!container });
    loaded++;
    if (onProgress) {
      onProgress(loaded, names.length);
    }
  }
  return results;
}

// Pre-load environment pieces
export async function preloadEnvironment(scene) {
  const names = Object.keys(ENVIRONMENT_FILES);
  for (const name of names) {
    await loadContainer(scene, ENVIRONMENT_FILES[name]);
  }
}

// Clear the cache and dispose all containers (call on scene teardown)
export function disposeAll() {
  for (const [key, container] of containerCache) {
    container.dispose();
  }
  containerCache.clear();
  loadingPromises.clear();
}
