import * as THREE from 'three';

/**
 * Shared material palette for the LOKAM building.
 * Every mesh in the asset references one of these, so the whole landmark
 * ships with ~16 reusable materials (great for batching / draw calls).
 */
const std = (opts: THREE.MeshStandardMaterialParameters, name: string) => {
  const m = new THREE.MeshStandardMaterial(opts);
  m.name = name;
  return m;
};

/** Emissive "neon" material. Exports to glTF with KHR_materials_emissive_strength. */
const neon = (hex: string, strength = 2.6, name = 'Neon') => {
  const m = new THREE.MeshStandardMaterial({
    color: '#111111',
    emissive: new THREE.Color(hex),
    emissiveIntensity: strength,
    roughness: 0.4,
    metalness: 0,
    toneMapped: false,
  });
  m.name = name;
  return m;
};

export const MAT = {
  concrete: std({ color: '#d8d2c8', roughness: 0.92, metalness: 0.02 }, 'Concrete_Light'),
  concreteDark: std({ color: '#2b2d33', roughness: 0.85, metalness: 0.05 }, 'Concrete_Dark'),
  darkMetal: std({ color: '#1d2026', roughness: 0.45, metalness: 0.7 }, 'Metal_Dark'),
  bronze: std({ color: '#b98a4f', roughness: 0.35, metalness: 0.85 }, 'Metal_Bronze'),
  wood: std({ color: '#8e5932', roughness: 0.88, metalness: 0 }, 'Wood_Deck'),
  woodLight: std({ color: '#b57948', roughness: 0.85, metalness: 0 }, 'Wood_Light'),
  cream: std({ color: '#efe6d6', roughness: 0.9, metalness: 0 }, 'Fabric_Cream'),
  teal: std({ color: '#1f7d8c', roughness: 0.85, metalness: 0 }, 'Fabric_Teal'),
  coral: std({ color: '#ff6f61', roughness: 0.8, metalness: 0 }, 'Fabric_Coral'),
  green: std({ color: '#3f8f4a', roughness: 0.95, metalness: 0 }, 'Foliage'),
  white: std({ color: '#f4f4f2', roughness: 0.5, metalness: 0.1 }, 'Paint_White'),
  tvScreen: std({
    color: '#123e50',
    emissive: '#1fa8c8',
    emissiveIntensity: 0.55,
    roughness: 0.22,
    metalness: 0.18,
  }, 'Cafe_TV_Screen'),
  poolTile: std({ color: '#11546a', roughness: 0.54, metalness: 0.05 }, 'Pool_Deep_Tile'),
  poolGlass: (() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#52cbdc',
      roughness: 0.09,
      metalness: 0.14,
      transparent: true,
      opacity: 0.53,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.5,
    });
    m.name = 'Pool_Infinity_Edge_Glass';
    return m;
  })(),
  ground: std({ color: '#14161b', roughness: 0.98, metalness: 0 }, 'Ground_Asphalt'),
  plaza: std({ color: '#252830', roughness: 0.92, metalness: 0 }, 'Ground_Plaza'),
  stoneLight: std({ color: '#c4bfb6', roughness: 0.82, metalness: 0.02 }, 'Stone_Light_Paving'),
  stoneTrim: std({ color: '#2b2d35', roughness: 0.76, metalness: 0.06 }, 'Stone_Dark_Border'),
  lawn: std({ color: '#2d5e30', roughness: 0.96, metalness: 0 }, 'Lawn_Grass'),
  fountainWater: (() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#36acc8',
      roughness: 0.08,
      metalness: 0.16,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      envMapIntensity: 1.8,
    });
    m.name = 'Fountain_Water';
    return m;
  })(),

  glass: (() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#9dd0f2',
      roughness: 0.05,
      metalness: 0.4,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
      envMapIntensity: 1.8,
    });
    m.name = 'Glass_Facade';
    return m;
  })(),

  /** Unlit material — per-instance colors give random lit/dim window variety. */
  windows: (() => {
    const m = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: true });
    m.name = 'Windows_Lit';
    return m;
  })(),

  /** Lit liquor glass — per-instance tints read as real bottles under the bar lights. */
  bottles: (() => {
    const m = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.82,
      roughness: 0.12,
      metalness: 0.08,
      envMapIntensity: 1.6,
    });
    m.name = 'Bottles_LiquorGlass';
    return m;
  })(),

  neonPink: neon('#ff2d95', 2.8, 'Neon_Pink'),
  neonCyan: neon('#1be7ff', 2.6, 'Neon_Cyan'),
  neonAmber: neon('#ffb648', 2.4, 'Neon_Amber'),
  neonViolet: neon('#9b5cff', 2.0, 'Neon_Violet'),
  bulbWarm: neon('#ffd78a', 2.2, 'Bulb_Warm'),
  ledWhite: neon('#fff0d6', 2.4, 'LED_Strip_White'),
  fire: neon('#ff7a1f', 3.0, 'Fire_Glow'),
  interiorGlow: neon('#ffdcb0', 1.1, 'Interior_Glow'),

  wire: (() => {
    const m = new THREE.LineBasicMaterial({ color: '#806044' });
    m.name = 'Festoon_Wire_Bronze';
    return m;
  })(),
};

export type MaterialKey = keyof typeof MAT;

/** Night/day switch for the unlit windows, neon signs, and materials. */
export function applyTimeOfDay(night: boolean) {
  MAT.windows.color.setScalar(night ? 1 : 0.55);
  MAT.bottles.color.setScalar(night ? 1 : 0.85);
  MAT.interiorGlow.emissiveIntensity = night ? 1.1 : 0.12;
  MAT.glass.opacity = night ? 0.38 : 0.46;
  MAT.glass.envMapIntensity = night ? 1.4 : 2.0;

  // Daytime unlit signs: dark neutral gray/slate tubes; nighttime: full neon emission
  MAT.neonPink.emissiveIntensity = night ? 2.8 : 0.0;
  MAT.neonPink.color.set(night ? '#111111' : '#22242a');
  MAT.neonPink.roughness = night ? 0.4 : 0.75;

  MAT.neonCyan.emissiveIntensity = night ? 2.6 : 0.0;
  MAT.neonCyan.color.set(night ? '#111111' : '#1e2226');
  MAT.neonCyan.roughness = night ? 0.4 : 0.75;

  MAT.neonAmber.emissiveIntensity = night ? 2.4 : 0.0;
  MAT.neonAmber.color.set(night ? '#111111' : '#262420');
  MAT.neonAmber.roughness = night ? 0.4 : 0.75;

  MAT.neonViolet.emissiveIntensity = night ? 2.0 : 0.0;
  MAT.neonViolet.color.set(night ? '#111111' : '#232028');

  MAT.bulbWarm.emissiveIntensity = night ? 2.2 : 0.0;
  MAT.bulbWarm.color.set(night ? '#111111' : '#c8c4b8');

  MAT.ledWhite.emissiveIntensity = night ? 2.4 : 0.0;
  MAT.ledWhite.color.set(night ? '#111111' : '#303238');

  MAT.fire.emissiveIntensity = night ? 3.0 : 0.15;
}
