export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
}

export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY',
  POOP = 'POOP',
  SEED = 'SEED',
  BERRY = 'BERRY',
  PROJECTILE = 'PROJECTILE',
  PARTICLE = 'PARTICLE',
}

export interface SimpleVector {
  x: number;
  y: number;
  z: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  position: SimpleVector; // 3D position
  facing?: SimpleVector; // Direction facing
  speed: number;
  color: string;
  size: number;
  markedForDeletion: boolean;
  // Specific props
  hp?: number;
  maxHp?: number;
  damage?: number;
  timer?: number; // For growth or lifetime
  velocity?: SimpleVector; // For particles
}

export interface FarmPatch {
  id: number;
  position: SimpleVector; // 3D position
  hasSeed: boolean;
  hasBerry: boolean;
  growthProgress: number; // 0 to 100
  occupyTimer: number; // ms
}

export interface UpgradeStats {
  maxHp: number;
  attackDamage: number;
  moveSpeed: number;
  orbitals: number; // Count of orbiting weapons
}

export interface GameStats {
  shards: number;
  berries: number;
  timeSurvived: number; // seconds
  enemiesKilled: number;
}