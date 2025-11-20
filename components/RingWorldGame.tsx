
import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GameState, EntityType, Entity, FarmPatch, GameStats, UpgradeStats, SimpleVector } from '../types';
import { 
  WORLD_RADIUS, COLORS, PLAYER_BASE_SPEED, PLAYER_DASH_SPEED, 
  DASH_DURATION, DASH_COOLDOWN, ATTACK_RANGE, ATTACK_COOLDOWN,
  POOP_INTERVAL, PLANTING_TIME, GROWTH_TIME,
  UPGRADE_COST_BASE, UPGRADE_COST_SCALING, COLLISION_RADIUS, PICKUP_RADIUS, PATCH_RADIUS
} from '../constants';
import { audioService } from '../services/audioService';

interface GameProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  setStats: React.Dispatch<React.SetStateAction<GameStats>>;
  setUpgrades: React.Dispatch<React.SetStateAction<UpgradeStats>>;
  upgrades: UpgradeStats;
  stats: GameStats;
  onGameOver: (finalStats: GameStats) => void;
}

const RingWorldGame: React.FC<GameProps> = ({ 
  gameState, setGameState, setStats, setUpgrades, upgrades, stats, onGameOver 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  
  // Game State Logic Refs
  const playerRef = useRef<Entity>({
    id: 'player',
    type: EntityType.PLAYER,
    position: { x: 0, y: WORLD_RADIUS, z: 0 },
    facing: { x: 0, y: 0, z: 1 },
    speed: 0,
    color: '#ec4899',
    size: 1,
    markedForDeletion: false,
    hp: 100,
    maxHp: 100
  });
  
  const entitiesRef = useRef<Entity[]>([]);
  const patchesRef = useRef<FarmPatch[]>([]);
  const keysRef = useRef<Set<string>>(new Set());
  
  // ThreeJS Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshMap = useRef<Map<string, THREE.Object3D>>(new Map());
  const patchMeshes = useRef<THREE.Mesh[]>([]);
  const cameraOffsetRef = useRef(new THREE.Vector3(0, 20, 30));
  const cameraLookAtRef = useRef(new THREE.Vector3(0, 0, 0));
  
  // Timers
  const poopTimerRef = useRef(0);
  const dashTimerRef = useRef(0);
  const dashCooldownRef = useRef(0);
  const attackCooldownRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const difficultyTimerRef = useRef(0);
  const spawnRateRef = useRef(2000);
  const screenShakeRef = useRef(0);

  // Initialize Logic
  useEffect(() => {
    const newPatches: FarmPatch[] = [];
    const patchCount = 10;
    // Distribute patches on sphere (Fibonacci Sphere-ish or Random)
    for (let i = 0; i < patchCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / patchCount);
      const theta = Math.sqrt(patchCount * Math.PI) * phi;
      
      const x = WORLD_RADIUS * Math.cos(theta) * Math.sin(phi);
      const y = WORLD_RADIUS * Math.sin(theta) * Math.sin(phi);
      const z = WORLD_RADIUS * Math.cos(phi);

      newPatches.push({
        id: i,
        position: { x, y, z },
        hasSeed: false,
        hasBerry: false,
        growthProgress: 0,
        occupyTimer: 0
      });
    }
    patchesRef.current = newPatches;
  }, []);

  // Setup ThreeJS
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f1a);
    scene.fog = new THREE.FogExp2(0x0f0f1a, 0.012);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    // Planet
    const planetGeo = new THREE.SphereGeometry(WORLD_RADIUS, 64, 64);
    const planetMat = new THREE.MeshStandardMaterial({ 
      color: 0x22c55e,
      roughness: 0.8,
      flatShading: false
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.receiveShadow = true;
    scene.add(planet);
    
    // Decor: Stars
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1000;
    const starPos = new Float32Array(starCount * 3);
    for(let i=0; i<starCount * 3; i++) {
      starPos[i] = (Math.random() - 0.5) * 300;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Patch Visuals
    patchesRef.current.forEach((p, i) => {
       const geo = new THREE.CylinderGeometry(3, 3, 0.5, 16);
       const mat = new THREE.MeshStandardMaterial({ color: COLORS.PATCH_EMPTY });
       const mesh = new THREE.Mesh(geo, mat);
       
       mesh.position.set(p.position.x, p.position.y, p.position.z);
       mesh.lookAt(0, 0, 0);
       mesh.rotateX(Math.PI / 2); // Align with surface
       
       scene.add(mesh);
       patchMeshes.current[i] = mesh;
    });

    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      meshMap.current.forEach(obj => scene.remove(obj));
      meshMap.current.clear();
    };
  }, []);

  // Input Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      if (e.code === 'KeyP') setGameState(gameState === GameState.PLAYING ? GameState.PAUSED : GameState.PLAYING);
      if (e.code === 'KeyM') audioService.toggleMute();
      if (e.code === 'Digit1') buyUpgrade(1);
      if (e.code === 'Digit2') buyUpgrade(2);
      if (e.code === 'Digit3') buyUpgrade(3);
      if (e.code === 'Digit4') buyUpgrade(4);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      if (e.code === 'Space') triggerDash();
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, upgrades, stats.berries]);

  const buyUpgrade = (slot: number) => {
    if (gameState !== GameState.PLAYING) return;
    const cost = Math.floor(UPGRADE_COST_BASE * Math.pow(UPGRADE_COST_SCALING, getTotalUpgrades()));
    if (stats.berries < cost) return;

    setStats(prev => ({ ...prev, berries: prev.berries - cost }));
    audioService.playTone('PICKUP');

    setUpgrades(prev => {
      const next = { ...prev };
      if (slot === 1) next.maxHp += 20;
      if (slot === 2) next.attackDamage += 5;
      if (slot === 3) next.moveSpeed += 0.1;
      if (slot === 4) next.orbitals += 1;
      
      if (slot === 1) {
        playerRef.current.hp = (playerRef.current.hp || 0) + 20;
        playerRef.current.maxHp = next.maxHp;
      }
      return next;
    });
  };

  const getTotalUpgrades = () => {
    const hpUps = (upgrades.maxHp - 100) / 20;
    const atkUps = (upgrades.attackDamage - 10) / 5;
    const spdUps = Math.round((upgrades.moveSpeed - 1.0) * 10);
    const orbUps = upgrades.orbitals;
    return hpUps + atkUps + spdUps + orbUps;
  };

  const triggerDash = () => {
    if (dashCooldownRef.current <= 0) {
      dashTimerRef.current = DASH_DURATION;
      dashCooldownRef.current = DASH_COOLDOWN;
      audioService.playTone('JUMP');
      spawnParticles(playerRef.current.position, 10, COLORS.PLAYER_IFRAME);
    }
  };

  const spawnParticles = (pos: SimpleVector, count: number, color: number) => {
    for (let i = 0; i < count; i++) {
      entitiesRef.current.push({
        id: Math.random().toString(),
        type: EntityType.PARTICLE,
        position: { ...pos },
        speed: 0,
        color: String(color), 
        size: 0.3 + Math.random() * 0.3,
        markedForDeletion: false,
        velocity: { 
          x: (Math.random() - 0.5) * 0.5, 
          y: (Math.random() - 0.5) * 0.5,
          z: (Math.random() - 0.5) * 0.5
        },
        timer: 500
      });
    }
  };

  const spawnEnemy = () => {
    // Spawn enemy on opposite side of planet roughly
    const pPos = new THREE.Vector3(playerRef.current.position.x, playerRef.current.position.y, playerRef.current.position.z);
    const randomVec = new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize();
    
    // Force away from player
    if (randomVec.dot(pPos) > 0) randomVec.negate();
    
    const spawnPos = randomVec.multiplyScalar(WORLD_RADIUS);

    entitiesRef.current.push({
      id: Math.random().toString(),
      type: EntityType.ENEMY,
      position: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
      speed: (PLAYER_BASE_SPEED * 0.5) + (difficultyTimerRef.current / 60000) * 0.01,
      color: 'red',
      size: 1.5,
      markedForDeletion: false,
      hp: 10 + Math.floor(difficultyTimerRef.current / 10000),
      maxHp: 10,
      damage: 10
    });
  };

  const getDistance = (p1: SimpleVector, p2: SimpleVector) => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  };

  // 3D Helper to create meshes
  const createMeshForEntity = (e: Entity): THREE.Object3D => {
    if (e.type === EntityType.PLAYER) {
      const group = new THREE.Group();
      
      // Body
      const geo = new THREE.SphereGeometry(1, 16, 16);
      const mat = new THREE.MeshStandardMaterial({ color: COLORS.PLAYER, roughness: 0.3 });
      const body = new THREE.Mesh(geo, mat);
      body.position.y = 1.0;
      group.add(body);
      
      // Horn
      const hornGeo = new THREE.ConeGeometry(0.2, 1.2, 8);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, metalness: 0.8, roughness: 0.2 });
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(0, 1.8, 0.6); // Top front
      horn.rotation.x = Math.PI / 4;
      group.add(horn);

      // Eyes
      const eyeGeo = new THREE.SphereGeometry(0.15);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      eyeL.position.set(-0.3, 1.2, 0.8);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      eyeR.position.set(0.3, 1.2, 0.8);
      group.add(eyeL);
      group.add(eyeR);

      return group;
    }
    if (e.type === EntityType.ENEMY) {
      const geo = new THREE.IcosahedronGeometry(1.2, 0);
      const mat = new THREE.MeshStandardMaterial({ color: COLORS.ENEMY, roughness: 0.9 });
      const mesh = new THREE.Mesh(geo, mat);
      return mesh;
    }
    if (e.type === EntityType.POOP) {
      const geo = new THREE.TetrahedronGeometry(0.6);
      const mat = new THREE.MeshStandardMaterial({ color: COLORS.POOP });
      return new THREE.Mesh(geo, mat);
    }
    if (e.type === EntityType.PROJECTILE) {
      const geo = new THREE.SphereGeometry(0.5);
      const mat = new THREE.MeshBasicMaterial({ color: COLORS.PROJECTILE, emissive: COLORS.PROJECTILE });
      return new THREE.Mesh(geo, mat);
    }
    if (e.type === EntityType.PARTICLE) {
      const geo = new THREE.BoxGeometry(e.size, e.size, e.size);
      const mat = new THREE.MeshBasicMaterial({ color: Number(e.color) || 0xffffff });
      return new THREE.Mesh(geo, mat);
    }
    return new THREE.Mesh(new THREE.BoxGeometry(1,1,1), new THREE.MeshBasicMaterial({color: 'white'}));
  };

  // Main Game Loop
  const loop = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    // --- Logic Updates ---
    
    // Timers
    if (dashTimerRef.current > 0) dashTimerRef.current -= deltaTime;
    if (dashCooldownRef.current > 0) dashCooldownRef.current -= deltaTime;
    if (attackCooldownRef.current > 0) attackCooldownRef.current -= deltaTime;
    if (screenShakeRef.current > 0) screenShakeRef.current = Math.max(0, screenShakeRef.current - deltaTime);
    
    poopTimerRef.current += deltaTime;
    spawnTimerRef.current += deltaTime;
    difficultyTimerRef.current += deltaTime;

    if (spawnTimerRef.current > spawnRateRef.current) {
      spawnEnemy();
      spawnTimerRef.current = 0;
      spawnRateRef.current = Math.max(500, 2000 - (difficultyTimerRef.current / 1000));
    }

    // -- Player Movement (Spherical) --
    const playerPos = new THREE.Vector3(playerRef.current.position.x, playerRef.current.position.y, playerRef.current.position.z);
    const normal = playerPos.clone().normalize();
    
    let inputX = 0;
    let inputY = 0;
    if (keysRef.current.has('ArrowLeft') || keysRef.current.has('KeyA')) inputX -= 1;
    if (keysRef.current.has('ArrowRight') || keysRef.current.has('KeyD')) inputX += 1;
    if (keysRef.current.has('ArrowUp') || keysRef.current.has('KeyW')) inputY -= 1; // "Forward" on sphere relative to camera
    if (keysRef.current.has('ArrowDown') || keysRef.current.has('KeyS')) inputY += 1;

    const isDashing = dashTimerRef.current > 0;
    const currentSpeed = (isDashing ? PLAYER_DASH_SPEED : PLAYER_BASE_SPEED) * upgrades.moveSpeed;

    if (inputX !== 0 || inputY !== 0) {
       // Determine Move Direction based on Camera
       if (cameraRef.current) {
           // Get camera basis in world space
           const camFwd = new THREE.Vector3();
           cameraRef.current.getWorldDirection(camFwd);
           
           // Project camera vectors onto the player's tangent plane
           // Tangent plane normal is 'normal'.
           // Project V onto plane: V_proj = V - (V . N) * N
           
           const forward = camFwd.clone().sub(normal.clone().multiplyScalar(camFwd.dot(normal))).normalize();
           const right = new THREE.Vector3().crossVectors(forward, normal).normalize();

           // Depending on coordinate system, cross product order might flip 'right'. 
           // Typically Cross(Fwd, Up) = Right. Here Up=Normal. Cross(Fwd, Normal) might be Left?
           // Let's test.

           const moveDir = forward.clone().multiplyScalar(-inputY).add(right.clone().multiplyScalar(inputX)).normalize();

           if (moveDir.lengthSq() > 0.1) {
               // Rotate player position around axis perpendicular to moveDir and Normal
               const axis = new THREE.Vector3().crossVectors(normal, moveDir).normalize();
               
               playerPos.applyAxisAngle(axis, currentSpeed);
               
               // Update State
               playerRef.current.position.x = playerPos.x;
               playerRef.current.position.y = playerPos.y;
               playerRef.current.position.z = playerPos.z;
               
               // Store Facing Direction
               playerRef.current.facing = { x: moveDir.x, y: moveDir.y, z: moveDir.z };
           }
       }
    }

    // Poop
    if (poopTimerRef.current > POOP_INTERVAL) {
      entitiesRef.current.push({
        id: Math.random().toString(),
        type: EntityType.POOP,
        position: { ...playerRef.current.position },
        speed: 0,
        color: String(COLORS.POOP),
        size: 0.8,
        markedForDeletion: false
      });
      audioService.playTone('PLANT');
      poopTimerRef.current = 0;
    }

    // Patches & Farming
    const isStandingStill = inputX === 0 && inputY === 0 && !isDashing;
    patchesRef.current.forEach((patch, i) => {
      const patchPos = new THREE.Vector3(patch.position.x, patch.position.y, patch.position.z);
      const dist = playerPos.distanceTo(patchPos);
      const isOnPatch = dist < PATCH_RADIUS;

      // Visual update
      if (patchMeshes.current[i]) {
         const mesh = patchMeshes.current[i];
         const mat = mesh.material as THREE.MeshStandardMaterial;
         
         if (patch.hasBerry) {
           mat.color.setHex(COLORS.BERRY);
           mat.emissive.setHex(0x550000);
         } else if (patch.hasSeed) {
           mat.color.setHex(COLORS.SEED);
           mat.emissive.setHex(0x002200);
         } else {
           mat.color.setHex(COLORS.PATCH_EMPTY);
           mat.emissive.setHex(0x000000);
           if (isOnPatch && isStandingStill && !patch.hasSeed) {
              const pulse = (Math.sin(time / 100) + 1) / 2;
              mat.color.lerp(new THREE.Color(COLORS.SEED), pulse * 0.5);
           }
         }
      }

      if (isOnPatch && isStandingStill && !patch.hasSeed && !patch.hasBerry) {
        patch.occupyTimer += deltaTime;
        if (patch.occupyTimer > PLANTING_TIME) {
           patch.hasSeed = true;
           patch.occupyTimer = 0;
           patch.growthProgress = 0;
           spawnParticles(patch.position, 8, COLORS.SEED);
           audioService.playTone('PLANT');
        }
      } else {
        patch.occupyTimer = 0;
      }

      if (patch.hasSeed && !patch.hasBerry) {
        patch.growthProgress += deltaTime;
        if (patch.growthProgress > GROWTH_TIME) {
          patch.hasSeed = false;
          patch.hasBerry = true;
          spawnParticles(patch.position, 8, COLORS.BERRY);
        }
      }
      
      if (patch.hasBerry && isOnPatch) {
          patch.hasBerry = false;
          setStats(s => ({...s, berries: s.berries + 5}));
          audioService.playTone('PICKUP');
          spawnParticles(patch.position, 12, COLORS.BERRY);
      }
    });

    // Orbitals
    if (upgrades.orbitals > 0 && attackCooldownRef.current <= 0) {
       let nearest = null;
       let minD = Infinity;
       entitiesRef.current.forEach(e => {
         if (e.type === EntityType.ENEMY) {
           const d = getDistance(playerRef.current.position, e.position);
           if (d < minD) { minD = d; nearest = e; }
         }
       });

       if (nearest && minD < ATTACK_RANGE * 2) {
         for(let i=0; i<upgrades.orbitals; i++) {
           const offset = (i * 0.5) - ((upgrades.orbitals-1)*0.25);
           // Initial pos slightly above player
           const spawnP = playerPos.clone().add(new THREE.Vector3(0, 2, 0)); // Crude
           
           // Better projectile logic: Move along sphere surface or fly?
           // Let's make them fly.
           const targetP = new THREE.Vector3(nearest.position.x, nearest.position.y, nearest.position.z);
           const velocity = targetP.sub(playerPos).normalize();

           entitiesRef.current.push({
             id: Math.random().toString(),
             type: EntityType.PROJECTILE,
             position: { x: playerPos.x, y: playerPos.y + 2, z: playerPos.z },
             speed: 1.5,
             color: String(COLORS.PROJECTILE),
             size: 0.5,
             markedForDeletion: false,
             velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
             timer: 1000
           });
         }
         audioService.playTone('SHOOT');
         attackCooldownRef.current = ATTACK_COOLDOWN;
       }
    }

    // Entity Updates & Collisions
    entitiesRef.current.forEach(entity => {
      const entityPos = new THREE.Vector3(entity.position.x, entity.position.y, entity.position.z);

      if (entity.type === EntityType.ENEMY) {
         // Move towards player on sphere
         // Axis of rotation is cross(EnemyPos, PlayerPos)
         const axis = new THREE.Vector3().crossVectors(entityPos, playerPos).normalize();
         // Angle is speed / radius
         if (axis.lengthSq() > 0.001) {
             entityPos.applyAxisAngle(axis, entity.speed);
             entity.position.x = entityPos.x;
             entity.position.y = entityPos.y;
             entity.position.z = entityPos.z;
         }
         
         const d = playerPos.distanceTo(entityPos);
         
         // Collision with Player
         if (d < COLLISION_RADIUS && !isDashing) {
           playerRef.current.hp = (playerRef.current.hp || 0) - entity.damage!;
           screenShakeRef.current = 200;
           audioService.playTone('EXPLOSION');
           
           // Knockback
           const backAxis = axis.negate();
           entityPos.applyAxisAngle(backAxis, 0.2); 
           entity.position = { x: entityPos.x, y: entityPos.y, z: entityPos.z };

           if ((playerRef.current.hp || 0) <= 0) {
             onGameOver(stats);
             setGameState(GameState.GAME_OVER);
           }
         } else if (d < COLLISION_RADIUS && isDashing) {
           entity.hp! -= upgrades.attackDamage;
           spawnParticles(entity.position, 5, COLORS.PLAYER_IFRAME);
           if (entity.hp! <= 0) {
              entity.markedForDeletion = true;
              setStats(s => ({...s, enemiesKilled: s.enemiesKilled + 1, shards: s.shards + 10}));
              spawnParticles(entity.position, 10, COLORS.ENEMY);
              audioService.playTone('EXPLOSION');
           }
         }
         
         // Auto attack melee
         if (!isDashing && d < ATTACK_RANGE && attackCooldownRef.current <= 0 && upgrades.orbitals === 0) {
            entity.hp! -= upgrades.attackDamage;
            spawnParticles(entity.position, 3, COLORS.PLAYER);
            audioService.playTone('SHOOT');
            attackCooldownRef.current = ATTACK_COOLDOWN;
            if (entity.hp! <= 0) {
              entity.markedForDeletion = true;
              setStats(s => ({...s, enemiesKilled: s.enemiesKilled + 1, shards: s.shards + 10}));
              spawnParticles(entity.position, 10, COLORS.ENEMY);
              audioService.playTone('EXPLOSION');
           }
         }
      }
      else if (entity.type === EntityType.PROJECTILE) {
         // Straight line flight
         entity.position.x += (entity.velocity?.x || 0) * entity.speed;
         entity.position.y += (entity.velocity?.y || 0) * entity.speed;
         entity.position.z += (entity.velocity?.z || 0) * entity.speed;

         entity.timer = (entity.timer || 0) - deltaTime;
         if ((entity.timer || 0) <= 0) entity.markedForDeletion = true;
         
         entitiesRef.current.forEach(target => {
           if (target.type === EntityType.ENEMY && !target.markedForDeletion) {
             const d = getDistance(entity.position, target.position);
             if (d < COLLISION_RADIUS) {
               entity.markedForDeletion = true;
               target.hp! -= upgrades.attackDamage;
               spawnParticles(target.position, 5, COLORS.PROJECTILE);
               if (target.hp! <= 0) {
                 target.markedForDeletion = true;
                 setStats(s => ({...s, enemiesKilled: s.enemiesKilled + 1, shards: s.shards + 10}));
                 spawnParticles(target.position, 10, COLORS.ENEMY);
                 audioService.playTone('EXPLOSION');
               }
             }
           }
         });
      }
      else if (entity.type === EntityType.POOP) {
        const d = playerPos.distanceTo(entityPos);
        if (d < PICKUP_RADIUS) {
          entity.markedForDeletion = true;
          audioService.playTone('PICKUP');
          spawnParticles(playerRef.current.position, 5, COLORS.POOP);
        }
      }
      else if (entity.type === EntityType.PARTICLE) {
        entity.timer = (entity.timer || 0) - deltaTime;
        if ((entity.timer || 0) <= 0) entity.markedForDeletion = true;
        entity.position.x += (entity.velocity?.x || 0);
        entity.position.y += (entity.velocity?.y || 0);
        entity.position.z += (entity.velocity?.z || 0);
      }
    });

    entitiesRef.current = entitiesRef.current.filter(e => !e.markedForDeletion);

    // --- Render Update ---
    
    const allEntities = [...entitiesRef.current, playerRef.current];
    const activeIds = new Set<string>();

    allEntities.forEach(e => {
      activeIds.add(e.id);
      let mesh = meshMap.current.get(e.id);
      
      if (!mesh) {
        mesh = createMeshForEntity(e);
        sceneRef.current?.add(mesh);
        meshMap.current.set(e.id, mesh);
      }

      mesh.position.set(e.position.x, e.position.y, e.position.z);
      
      // Orientation
      const ePos = new THREE.Vector3(e.position.x, e.position.y, e.position.z);
      mesh.lookAt(ePos.clone().multiplyScalar(2)); // Look away from center (Up)
      
      // Player orientation override
      if (e.type === EntityType.PLAYER) {
          // Align 'Up' with surface normal
          const up = ePos.clone().normalize();
          // We want to look in 'facing' direction, but constrained to surface tangent
          const facing = new THREE.Vector3(
              playerRef.current.facing?.x, 
              playerRef.current.facing?.y, 
              playerRef.current.facing?.z
          ).normalize();

          if (facing.lengthSq() > 0) {
              // Create lookAt matrix manually or use a target
              const target = ePos.clone().add(facing);
              mesh.up = up;
              mesh.lookAt(target);
          }

          if (isDashing) {
              mesh.rotateZ(time * 0.02);
          }
      }

      if (e.type === EntityType.ENEMY) {
          // Look at player
          const up = ePos.clone().normalize();
          mesh.up = up;
          mesh.lookAt(playerRef.current.position.x, playerRef.current.position.y, playerRef.current.position.z);
      }
      
      // Special Player Effects
      if (e.type === EntityType.PLAYER) {
        const body = (mesh as THREE.Group).children[0] as THREE.Mesh;
        if (body) {
           (body.material as THREE.MeshStandardMaterial).color.setHex(
             isDashing ? COLORS.PLAYER_IFRAME : COLORS.PLAYER
           );
        }
      }
    });

    meshMap.current.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        sceneRef.current?.remove(mesh);
        meshMap.current.delete(id);
      }
    });

    // Camera Logic (Third Person Follow)
    if (cameraRef.current) {
       const normal = playerPos.clone().normalize();
       
       // Determine "Behind" vector
       // If we have a facing direction, behind is -facing
       const facing = new THREE.Vector3(
           playerRef.current.facing?.x || 0, 
           playerRef.current.facing?.y || 0, 
           playerRef.current.facing?.z || 1
       ).normalize();

       const height = 15;
       const distance = 25;
       
       // Target Position: Player + (Normal * Height) - (Facing * Distance)
       const targetPos = playerPos.clone()
           .add(normal.multiplyScalar(height))
           .sub(facing.multiplyScalar(distance));
           
       // Smoothly interpolate camera position
       cameraRef.current.position.lerp(targetPos, 0.1);
       
       // Look at player (smoothed)
       cameraLookAtRef.current.lerp(playerPos, 0.1);
       cameraRef.current.lookAt(cameraLookAtRef.current);

       // Apply Shake
       if (screenShakeRef.current > 0) {
           cameraRef.current.position.x += (Math.random() - 0.5);
           cameraRef.current.position.y += (Math.random() - 0.5);
       }
    }
    
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    
    requestRef.current = requestAnimationFrame(loop);
  }, [gameState, upgrades, onGameOver, stats, setStats]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  return (
    <div className="relative w-full h-full">
       <div ref={containerRef} className="absolute top-0 left-0 w-full h-full z-0" />
       {/* Mobile Controls Overlay */}
      <div className="absolute bottom-8 left-8 md:hidden flex flex-col gap-4 pointer-events-none z-20">
        <div className="flex gap-4 ml-8 pointer-events-auto">
             <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur-sm"
                 onTouchStart={() => keysRef.current.add('ArrowUp')}
                 onTouchEnd={() => keysRef.current.delete('ArrowUp')}>↑</button>
        </div>
        <div className="flex gap-4 pointer-events-auto">
           <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur-sm"
             onTouchStart={() => keysRef.current.add('ArrowLeft')}
             onTouchEnd={() => keysRef.current.delete('ArrowLeft')}>←</button>
           <div className="w-16 h-16"></div>
           <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur-sm"
             onTouchStart={() => keysRef.current.add('ArrowRight')}
             onTouchEnd={() => keysRef.current.delete('ArrowRight')}>→</button>
        </div>
        <div className="flex gap-4 ml-8 pointer-events-auto">
             <button className="w-16 h-16 bg-white/20 rounded-full active:bg-white/40 backdrop-blur-sm"
                 onTouchStart={() => keysRef.current.add('ArrowDown')}
                 onTouchEnd={() => keysRef.current.delete('ArrowDown')}>↓</button>
        </div>
      </div>
      
      <div className="absolute bottom-8 right-8 md:hidden pointer-events-auto z-20">
        <button 
           className="w-24 h-24 bg-pink-500/50 rounded-full active:bg-pink-500/80 text-white font-bold backdrop-blur-sm border border-white/30"
           onTouchStart={triggerDash}
        >DASH</button>
      </div>
    </div>
  );
};

export default RingWorldGame;
