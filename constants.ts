
// 3D World Scale
export const WORLD_RADIUS = 24; // Units

// Physics (Radians per tick for angular speed)
export const PLAYER_BASE_SPEED = 0.04; // Angular speed
export const PLAYER_DASH_SPEED = 0.1;
export const DASH_DURATION = 300; // ms
export const DASH_COOLDOWN = 1000; // ms

// 3D Euclidean Distances (Chord length)
// On radius 24 sphere: 
// 0.1 rads is ~2.4 units.
export const ATTACK_RANGE = 8.0; 
export const COLLISION_RADIUS = 2.5; 
export const PICKUP_RADIUS = 3.0;
export const PATCH_RADIUS = 3.5;

export const ATTACK_COOLDOWN = 400; // ms

// Farming
export const POOP_INTERVAL = 5000; // ms
export const PLANTING_TIME = 2500; // ms standing still
export const GROWTH_TIME = 4000; // ms

// Economy
export const UPGRADE_COST_BASE = 5;
export const UPGRADE_COST_SCALING = 1.5;

// Colors
export const COLORS = {
  PLAYER: 0xec4899, // Pink-500
  PLAYER_IFRAME: 0xffffff,
  ENEMY: 0x3f3f46, // Zinc-700
  POOP: 0x854d0e, // Yellow-800
  SEED: 0xa3e635, // Lime-400
  BERRY: 0xef4444, // Red-500
  PROJECTILE: 0x38bdf8, // Sky-400
  PATCH_EMPTY: 0x374151, // Gray-700
  PATCH_ACTIVE: 0x10b981, // Emerald-500
};

// Audio Frequencies
export const SOUNDS = {
  JUMP: [150, 600],
  SHOOT: [800, 300],
  EXPLOSION: [100, 0],
  PICKUP: [600, 1200],
  PLANT: [200, 400],
};