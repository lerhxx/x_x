import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MazeData } from '../game/types';
import { WALL_HEIGHT } from '../constants/wall';
import { createHedgeTextures } from '../utils/hedgeTexture';

// ============================================================
// Fireflies — glowing points that drift around the maze
// ============================================================

interface FireflyData {
  baseX: number;
  baseY: number;
  baseZ: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;
  speedX: number;
  speedY: number;
  speedZ: number;
  ampX: number;
  ampY: number;
  ampZ: number;
  flickerPhase: number;
  flickerSpeed: number;
}

const FIREFLY_COUNT = 90;

export function Fireflies({ maze }: { maze: MazeData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const data = useMemo<FireflyData[]>(() => {
    return Array.from({ length: FIREFLY_COUNT }, () => ({
      baseX: Math.random() * maze.width,
      baseY: 0.4 + Math.random() * 1.0,
      baseZ: Math.random() * maze.height,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseZ: Math.random() * Math.PI * 2,
      speedX: 0.25 + Math.random() * 0.4,
      speedY: 0.15 + Math.random() * 0.25,
      speedZ: 0.25 + Math.random() * 0.4,
      ampX: 0.4 + Math.random() * 1.2,
      ampY: 0.15 + Math.random() * 0.3,
      ampZ: 0.4 + Math.random() * 1.2,
      flickerPhase: Math.random() * Math.PI * 2,
      flickerSpeed: 1.5 + Math.random() * 3,
    }));
  }, [maze.width, maze.height]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();

    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const d = data[i];
      const x = d.baseX + Math.sin(t * d.speedX + d.phaseX) * d.ampX;
      const y = d.baseY + Math.sin(t * d.speedY + d.phaseY) * d.ampY;
      const z = d.baseZ + Math.cos(t * d.speedZ + d.phaseZ) * d.ampZ;

      const flicker = 0.6 + 0.4 * Math.sin(t * d.flickerSpeed + d.flickerPhase);
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(0.035 * (0.5 + flicker * 0.5));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color shifts from warm yellow to cool green
      tmpColor.setHSL(0.13 + flicker * 0.04, 1, 0.65);
      meshRef.current.setColorAt(i, tmpColor);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, FIREFLY_COUNT]}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial
        color="#ffee88"
        emissive="#ffcc44"
        emissiveIntensity={4}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

// ============================================================
// Floating petals — slowly drifting colored specks
// ============================================================

interface PetalData {
  x: number;
  y: number;
  z: number;
  vy: number;
  driftAmp: number;
  driftFreq: number;
  driftPhase: number;
  rotSpeed: THREE.Vector3;
  rotPhase: THREE.Vector3;
  scale: number;
}

const PETAL_COUNT = 50;
const PETAL_COLORS = ['#ffb3d1', '#ff8aa8', '#ffffff', '#ffe88a', '#d6a3ff', '#ffd1f0'];

export function FloatingPetals({ maze }: { maze: MazeData }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const data = useMemo<PetalData[]>(() => {
    return Array.from({ length: PETAL_COUNT }, () => ({
      x: Math.random() * maze.width,
      y: 0.3 + Math.random() * 2.0,
      z: Math.random() * maze.height,
      vy: -0.08 - Math.random() * 0.12,
      driftAmp: 0.25 + Math.random() * 0.6,
      driftFreq: 0.3 + Math.random() * 0.5,
      driftPhase: Math.random() * Math.PI * 2,
      rotSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ),
      rotPhase: new THREE.Vector3(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      ),
      scale: 0.05 + Math.random() * 0.05,
    }));
  }, [maze.width, maze.height]);

  const colors = useMemo(() => {
    return Array.from({ length: PETAL_COUNT }, () => {
      const c = new THREE.Color(PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)]);
      return c;
    });
  }, []);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < PETAL_COUNT; i++) {
      meshRef.current.setColorAt(i, colors[i]);
    }
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [colors]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const dummy = new THREE.Object3D();
    const dt = Math.min(delta, 0.05);

    for (let i = 0; i < PETAL_COUNT; i++) {
      const d = data[i];
      d.y += d.vy * dt;
      if (d.y < 0.05) {
        d.y = 2.5 + Math.random() * 0.8;
        d.x = Math.random() * maze.width;
        d.z = Math.random() * maze.height;
      }

      const driftX = Math.sin(t * d.driftFreq + d.driftPhase) * d.driftAmp;
      const driftZ = Math.cos(t * d.driftFreq * 0.7 + d.driftPhase) * d.driftAmp;

      dummy.position.set(d.x + driftX, d.y, d.z + driftZ);
      dummy.rotation.set(
        t * d.rotSpeed.x + d.rotPhase.x,
        t * d.rotSpeed.y + d.rotPhase.y,
        t * d.rotSpeed.z + d.rotPhase.z,
      );
      dummy.scale.setScalar(d.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PETAL_COUNT]}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffaadd"
        emissiveIntensity={0.7}
        roughness={0.4}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

// ============================================================
// Floating magic light orbs — at fixed cell positions
// ============================================================

const ORB_COUNT = 6;
const ORB_COLOR = '#ffb060';

interface OrbData {
  position: THREE.Vector3;
  phase: number;
  speed: number;
  amp: number;
}

export function LightOrbs({ maze }: { maze: MazeData }) {
  const groupRef = useRef<THREE.Group>(null);

  const orbs = useMemo<OrbData[]>(() => {
    // Place orbs at scattered cells (not start/exit)
    const cells: Array<[number, number]> = [];
    for (let c = 0; c < maze.width; c++) {
      for (let r = 0; r < maze.height; r++) {
        if (c === maze.startCol && r === maze.startRow) continue;
        if (c === maze.exitCol && r === maze.exitRow) continue;
        cells.push([c, r]);
      }
    }
    // Pick ORB_COUNT random cells, spread out
    const picked: Array<[number, number]> = [];
    const minDist = Math.max(2, Math.min(maze.width, maze.height) / 3);
    let attempts = 0;
    while (picked.length < ORB_COUNT && attempts < 200) {
      const [c, r] = cells[Math.floor(Math.random() * cells.length)];
      const ok = picked.every(([pc, pr]) => Math.hypot(pc - c, pr - r) >= minDist);
      if (ok) picked.push([c, r]);
      attempts++;
    }

    return picked.map(([c, r]) => ({
      position: new THREE.Vector3(c + 0.5, 0.9, r + 0.5),
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 0.5,
      amp: 0.15 + Math.random() * 0.1,
    }));
  }, [maze]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const d = orbs[i];
      if (!d) return;
      child.position.y = d.position.y + Math.sin(t * d.speed + d.phase) * d.amp;
      // Pulse the orb's emissive intensity
      const mesh = child.children[0] as THREE.Mesh;
      if (mesh?.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 2.5 + Math.sin(t * d.speed * 2 + d.phase) * 0.8;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {orbs.map((orb, i) => (
        <group key={i} position={orb.position}>
          {/* Visible glowing core */}
          <mesh>
            <sphereGeometry args={[0.08, 12, 10]} />
            <meshStandardMaterial
              color={ORB_COLOR}
              emissive={ORB_COLOR}
              emissiveIntensity={3}
              toneMapped={false}
            />
          </mesh>
          {/* Warm point light */}
          <pointLight
            color={ORB_COLOR}
            intensity={2.2}
            distance={3.5}
            decay={1.5}
          />
        </group>
      ))}
    </group>
  );
}

// ============================================================
// Start arch — overhead hedge arch at the spawn cell
// ============================================================

interface StartArchProps {
  maze: MazeData;
  textures: ReturnType<typeof createHedgeTextures>;
}

export function StartArch({ maze, textures }: StartArchProps) {
  const cx = maze.startCol + 0.5;
  const cz = maze.startRow + 0.5;
  const archHeight = WALL_HEIGHT * 1.6;
  const archWidth = 1.1;

  // Pick arch orientation based on which side has an opening.
  // 扩展网格中相邻格为墙槽，type === 'path' 表示该方向有开口。
  const N = maze.startRow > 0 ? maze.cells[maze.startCol][maze.startRow - 1].type : 'wall';
  const S = maze.startRow < maze.height - 1 ? maze.cells[maze.startCol][maze.startRow + 1].type : 'wall';
  // Orient arch along whichever axis is "open" (no wall) — default to X axis
  const alongX = N === 'path' || S === 'path';
  const rotation: [number, number, number] = alongX ? [0, 0, 0] : [0, Math.PI / 2, 0];

  return (
    <group position={[cx, 0, cz]} rotation={rotation}>
      {/* Left post */}
      <mesh position={[-archWidth / 2, archHeight / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.15, archHeight, 8]} />
        <meshStandardMaterial
          map={textures.color}
          bumpMap={textures.bump}
          bumpScale={0.05}
          color="#3a6b3a"
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      {/* Right post */}
      <mesh position={[archWidth / 2, archHeight / 2, 0]}>
        <cylinderGeometry args={[0.12, 0.15, archHeight, 8]} />
        <meshStandardMaterial
          map={textures.color}
          bumpMap={textures.bump}
          bumpScale={0.05}
          color="#3a6b3a"
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      {/* Top curved beam — half-torus */}
      <mesh position={[0, archHeight, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[archWidth / 2, 0.13, 8, 16, Math.PI]} />
        <meshStandardMaterial
          map={textures.color}
          bumpMap={textures.bump}
          bumpScale={0.05}
          color="#3a6b3a"
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      {/* Decorative glowing flowers on the arch (5 small emissive dots) */}
      {Array.from({ length: 5 }).map((_, i) => {
        const t = i / 4;
        const angle = Math.PI * (1 - t);
        const x = Math.cos(angle) * (archWidth / 2);
        const y = archHeight + Math.sin(angle) * (archWidth / 2);
        const colors = ['#ff88aa', '#ffdd66', '#ffffff', '#ff88aa', '#cc99ff'];
        return (
          <mesh key={i} position={[x, y, 0]}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshStandardMaterial
              color={colors[i]}
              emissive={colors[i]}
              emissiveIntensity={2.5}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
