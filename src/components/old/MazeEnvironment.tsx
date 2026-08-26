import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MazeData } from '../../game/types';
import { extractWallSegments } from '../../game/mazeGenerator';
import {
  WALL_HEIGHT,
  WALL_THICKNESS,
  WALL_COLOR,
  FLOOR_COLOR,
  CEILING_COLOR,
  EXIT_COLOR,
} from '../../game/constants';

interface MazeEnvironmentProps {
  maze: MazeData;
}

export function MazeEnvironment({ maze }: MazeEnvironmentProps) {
  const wallSegments = useMemo(() => extractWallSegments(maze), [maze]);
  const { width: w, height: h } = maze;

  // Build wall geometries — group into vertical and horizontal for instanced rendering
  const { verticalWalls, horizontalWalls } = useMemo(() => {
    const v: Array<{ x: number; z: number; len: number }> = [];
    const horz: Array<{ x: number; z: number; len: number }> = [];
    for (const seg of wallSegments) {
      if (seg.orientation === 'V') {
        v.push({ x: seg.x1, z: seg.z1, len: seg.z2 - seg.z1 });
      } else {
        horz.push({ x: seg.x1, z: seg.z1, len: seg.x2 - seg.x1 });
      }
    }
    return { verticalWalls: v, horizontalWalls: horz };
  }, [wallSegments]);

  return (
    <group>
      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[w / 2, 0, h / 2]}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Ceiling */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[w / 2, WALL_HEIGHT, h / 2]}
      >
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color={CEILING_COLOR} roughness={0.95} />
      </mesh>

      {/* Walls */}
      <WallGroup walls={horizontalWalls} type="H" />
      <WallGroup walls={verticalWalls} type="V" />

      {/* Exit Portal */}
      <ExitPortal x={maze.exitCol + 0.5} z={maze.exitRow + 0.5} />

      {/* Start marker (subtle) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[maze.startCol + 0.5, 0.01, maze.startRow + 0.5]}
      >
        <circleGeometry args={[0.3, 24]} />
        <meshStandardMaterial color="#ff6644" emissive="#ff6644" emissiveIntensity={0.5} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

// ===== Wall rendering using InstancedMesh =====

interface WallGroupProps {
  walls: Array<{ x: number; z: number; len: number }>;
  type: 'V' | 'H';
}

function WallGroup({ walls, type }: WallGroupProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < walls.length; i++) {
      const wall = walls[i];
      if (type === 'H') {
        // Horizontal wall: along X axis, at z = wall.z
        dummy.position.set(wall.x + wall.len / 2, WALL_HEIGHT / 2, wall.z);
        dummy.scale.set(wall.len, 1, WALL_THICKNESS);
      } else {
        // Vertical wall: along Z axis, at x = wall.x
        dummy.position.set(wall.x, WALL_HEIGHT / 2, wall.z + wall.len / 2);
        dummy.scale.set(WALL_THICKNESS, 1, wall.len);
      }
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [walls, type]);

  if (walls.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, walls.length]}
      key={`${type}-${walls.length}`}
    >
      <boxGeometry args={[1, WALL_HEIGHT, 1]} />
      <meshStandardMaterial color={WALL_COLOR} roughness={0.8} metalness={0.15} />
    </instancedMesh>
  );
}

// ===== Exit Portal =====

interface ExitPortalProps {
  x: number;
  z: number;
}

function ExitPortal({ x, z }: ExitPortalProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.8;
      const pulse = 1 + Math.sin(t * 2.5) * 0.08;
      ringRef.current.scale.setScalar(pulse);
    }
    if (innerRef.current) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.15;
      innerRef.current.scale.setScalar(pulse);
      (innerRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.8 + Math.sin(t * 3) * 0.3;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Glowing ring on the floor */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[0.32, 0.04, 8, 32]} />
        <meshStandardMaterial
          color={EXIT_COLOR}
          emissive={EXIT_COLOR}
          emissiveIntensity={1.2}
          roughness={0.3}
        />
      </mesh>

      {/* Inner glow disc */}
      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.28, 24]} />
        <meshStandardMaterial
          color={EXIT_COLOR}
          emissive={EXIT_COLOR}
          emissiveIntensity={0.8}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Vertical light beam */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.3, WALL_HEIGHT, 16, 1, true]} />
        <meshStandardMaterial
          color={EXIT_COLOR}
          emissive={EXIT_COLOR}
          emissiveIntensity={0.6}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Point light */}
      {/* <pointLight
        color={EXIT_COLOR}
        intensity={EXIT_LIGHT_INTENSITY}
        distance={EXIT_LIGHT_DISTANCE}
        position={[0, 0.5, 0]}
      /> */}
      <directionalLight />
    </group>
  );
}
