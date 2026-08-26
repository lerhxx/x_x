import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRef, MazeData } from '../../game/types';
import { canMove } from '../../game/mazeGenerator';
import {
  EYE_HEIGHT,
  PLAYER_RADIUS,
  MOVE_SPEED,
  TURN_SPEED,
  MOUSE_SENSITIVITY,
  TORCH_INTENSITY,
  TORCH_DISTANCE,
  TORCH_COLOR,
} from '../../game/constants';

interface PlayerProps {
  maze: MazeData;
  gameRef: React.MutableRefObject<GameRef>;
  onWin: () => void;
}

export function Player({ maze, gameRef, onWin }: PlayerProps) {
  const { camera, gl } = useThree();
  const keysRef = useRef<Set<string>>(new Set());
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const posRef = useRef({ x: maze.startCol + 0.5, z: maze.startRow + 0.5 });
  const isLockedRef = useRef(false);
  const torchRef = useRef<THREE.PointLight>(null);
  const wonRef = useRef(false);

  // Reset when maze changes
  useEffect(() => {
    posRef.current = { x: maze.startCol + 0.5, z: maze.startRow + 0.5 };
    yawRef.current = 0;
    pitchRef.current = 0;
    wonRef.current = false;
    gameRef.current.visitedCells.clear();
    gameRef.current.visitedCells.add(`${maze.startCol},${maze.startRow}`);
  }, [maze, gameRef]);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.code);
      // Prevent page scroll on arrow keys / space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Pointer lock & mouse look
  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };

    const handleLockChange = () => {
      isLockedRef.current = document.pointerLockElement === canvas;
      gameRef.current.pointerLocked = isLockedRef.current;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      yawRef.current -= e.movementX * MOUSE_SENSITIVITY;
      pitchRef.current -= e.movementY * MOUSE_SENSITIVITY;
      // Clamp pitch
      const maxPitch = Math.PI / 2 - 0.05;
      pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
    };

    canvas.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl, gameRef]);

  // Game loop
  useFrame((_, delta) => {
    if (wonRef.current) return;

    // Clamp delta to avoid large jumps
    const dt = Math.min(delta, 0.05);

    // --- Arrow key turning ---
    if (keysRef.current.has('ArrowLeft')) yawRef.current -= TURN_SPEED * dt;
    if (keysRef.current.has('ArrowRight')) yawRef.current += TURN_SPEED * dt;
    if (keysRef.current.has('ArrowUp')) pitchRef.current += TURN_SPEED * dt;
    if (keysRef.current.has('ArrowDown')) pitchRef.current -= TURN_SPEED * dt;
    const maxPitch = Math.PI / 2 - 0.05;
    pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));

    // --- WASD movement ---
    let dx = 0;
    let dz = 0;
    const forwardX = -Math.sin(yawRef.current);
    const forwardZ = -Math.cos(yawRef.current);
    const rightX = Math.cos(yawRef.current);
    const rightZ = -Math.sin(yawRef.current);

    if (keysRef.current.has('KeyW')) {
      dx += forwardX;
      dz += forwardZ;
    }
    if (keysRef.current.has('KeyS')) {
      dx -= forwardX;
      dz -= forwardZ;
    }
    if (keysRef.current.has('KeyA')) {
      dx -= rightX;
      dz -= rightZ;
    }
    if (keysRef.current.has('KeyD')) {
      dx += rightX;
      dz += rightZ;
    }

    // Normalize and apply speed
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) {
      dx = (dx / len) * MOVE_SPEED * dt;
      dz = (dz / len) * MOVE_SPEED * dt;

      // Axis-separated movement for wall sliding
      const newX = posRef.current.x + dx;
      if (canMove(newX, posRef.current.z, PLAYER_RADIUS, maze)) {
        posRef.current.x = newX;
      }

      const newZ = posRef.current.z + dz;
      if (canMove(posRef.current.x, newZ, PLAYER_RADIUS, maze)) {
        posRef.current.z = newZ;
      }
    }

    // --- Update camera ---å
    camera.position.set(posRef.current.x, EYE_HEIGHT, posRef.current.z);
    // camera.lookAt(0, 0, 0 )
    camera.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ');

    // --- Update torch light ---
    if (torchRef.current) {
      torchRef.current.position.set(posRef.current.x, EYE_HEIGHT + 0.2, posRef.current.z);
      // Slight flicker for atmosphere
      const flicker = 1 + Math.sin(performance.now() * 0.012) * 0.06 + Math.sin(performance.now() * 0.03) * 0.03;
      torchRef.current.intensity = TORCH_INTENSITY * flicker;
    }

    // --- Update game ref (for minimap) ---
    gameRef.current.playerX = posRef.current.x;
    gameRef.current.playerZ = posRef.current.z;
    gameRef.current.playerYaw = yawRef.current;

    // Track visited cells for fog of war
    const cellCol = Math.floor(posRef.current.x);
    const cellRow = Math.floor(posRef.current.z);
    const cellKey = `${cellCol},${cellRow}`;
    if (!gameRef.current.visitedCells.has(cellKey)) {
      gameRef.current.visitedCells.add(cellKey);
    }

    // --- Win check ---
    if (cellCol === maze.exitCol && cellRow === maze.exitRow) {
      wonRef.current = true;
      onWin();
    }
  });

  return (
    <pointLight
      ref={torchRef}
      color={TORCH_COLOR}
      intensity={TORCH_INTENSITY}
      distance={TORCH_DISTANCE}
      decay={2}
    />
    // <mesh>
    //   <sphereGeometry args={[ 1, 16, 32 ]} />
    //   <meshStandardMaterial color="#1a0461" />
    // </mesh>
  );
}
