import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRef, MazeData, PathDirection } from '../game/types';
import { canMove } from '../game/mazeGenerator';
import {
  EYE_HEIGHT,
  PLAYER_RADIUS,
  MOVE_SPEED,
  TURN_SPEED,
  MOUSE_SENSITIVITY,
} from '../constants/player';
import { TORCH_INTENSITY } from '../constants/light';
import { CELL_SCALE, USE_MOUSE } from '../constants/global';
import { updatePlayerPathCell } from '../state/sceneStore';

// 防穿墙：每步最大位移 = 0.2 个单元格（世界单位）
const MAX_STEP = 0.2 * CELL_SCALE;
// 走到墙边时留一点 epsilon，防止贴墙抖动
const MOVE_EPSILON = 0.05;

/** 将路径方向 (t/r/b/l) 转换为相机 yaw 值
 *  forward = (-sin(yaw), -cos(yaw))
 *  r (+x) → yaw = -π/2
 *  l (-x) → yaw =  π/2
 *  t (-z) → yaw =  0
 *  b (+z) → yaw =  π
 */
function directionToYaw(dir?: PathDirection): number {
  switch (dir) {
    case 'r': return -Math.PI / 2;
    case 'l': return Math.PI / 2;
    case 't': return 0;
    case 'b': return Math.PI;
    default: return 0;
  }
}


interface PlayerProps {
  maze: MazeData;
  gameRef: React.MutableRefObject<GameRef>;
  onWin: () => void;
}

export function Player({ maze, gameRef, onWin }: PlayerProps) {
  const { camera, gl } = useThree();
  const keysRef = useRef<Set<string>>(new Set());
  // 初始 yaw：面向下一个道路单元格
  const initialYaw = directionToYaw(maze.solutionPath[0]?.dir);
  const yawRef = useRef(initialYaw);
  const pitchRef = useRef(0);
  const posRef = useRef({ x: (maze.startCol + 0.5) * CELL_SCALE, z: (maze.startRow + 0.5) * CELL_SCALE });
  const isLockedRef = useRef(false);
  const torchRef = useRef<THREE.PointLight>(null);
  const wonRef = useRef(false);

  // Reset when maze changes
  useEffect(() => {
    posRef.current = { x: (maze.startCol + 0.5) * CELL_SCALE, z: (maze.startRow + 0.5) * CELL_SCALE };
    yawRef.current = directionToYaw(maze.solutionPath[0]?.dir);
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
    }

    const handleLockChange = () => {
      isLockedRef.current = document.pointerLockElement === canvas;
      gameRef.current.pointerLocked = isLockedRef.current;
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isLockedRef.current) return;
      yawRef.current -= e.movementX * MOUSE_SENSITIVITY;
      pitchRef.current -= e.movementY * MOUSE_SENSITIVITY;
      // Clamp pitch
      const maxPitch = Math.PI / 2 - 0.05;
      pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
    };

    if (USE_MOUSE) {
      canvas.addEventListener('click', handleClick);
      document.addEventListener('pointerlockchange', handleLockChange);
      document.addEventListener('mousemove', handleMouseMove);
    }

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

      // 把整帧位移拆成小步迭代（防高速跨格穿墙）。
      // 每轴分别推进，遇到墙就停在该轴（保留另一轴继续 → 实现滑墙）。
      const radius = PLAYER_RADIUS + MOVE_EPSILON + 0.05;

      // --- X 轴 ---
      const stepCountX = Math.ceil(Math.abs(dx) / MAX_STEP);
      const stepX = dx / stepCountX;
      for (let i = 0; i < stepCountX; i++) {
        const next = posRef.current.x + stepX;
        if (canMove(next, posRef.current.z, radius, maze)) {
          posRef.current.x = next;
        } else {
          break;
        }
      }

      // --- Z 轴 ---
      const stepCountZ = Math.ceil(Math.abs(dz) / MAX_STEP);
      const stepZ = dz / stepCountZ;
      for (let i = 0; i < stepCountZ; i++) {
        const next = posRef.current.z + stepZ;
        if (canMove(posRef.current.x, next, radius, maze)) {
          posRef.current.z = next;
        } else {
          break;
        }
      }
    }

    

    // --- Update torch light ---
    if (torchRef.current) {
      torchRef.current.position.set(posRef.current.x, EYE_HEIGHT, posRef.current.z);
      // Slight flicker for atmosphere
      const flicker = 1 + Math.sin(performance.now() * 0.012) * 0.06 + Math.sin(performance.now() * 0.03) * 0.03;
      torchRef.current.intensity = TORCH_INTENSITY * flicker;

      if (USE_MOUSE) {
        // --- Update camera ---å
        camera.position.set(posRef.current.x, EYE_HEIGHT, posRef.current.z);
        camera.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ');
        // camera.lookAt(torchRef.current.position )
      }
    }


    // --- Update game ref (for minimap) ---
    gameRef.current.playerX = posRef.current.x;
    gameRef.current.playerZ = posRef.current.z;
    gameRef.current.playerYaw = yawRef.current;

    // Track visited cells for fog of war
    const cellCol = Math.floor(posRef.current.x / CELL_SCALE);
    const cellRow = Math.floor(posRef.current.z / CELL_SCALE);
    const cellKey = `${cellCol},${cellRow}`;
    if (!gameRef.current.visitedCells.has(cellKey)) {
      gameRef.current.visitedCells.add(cellKey);
    }

    // --- Win check ---
    if (cellCol === maze.exitCol && cellRow === maze.exitRow) {
      wonRef.current = true;
      onWin();
    }

    // --- 更新场景道路格（用于气泡触发） ---
    updatePlayerPathCell(
      posRef.current.x,
      posRef.current.z,
      CELL_SCALE,
      (c, r) =>
        c >= 0 &&
        c < maze.width &&
        r >= 0 &&
        r < maze.height &&
        maze.cells[c][r].type === 'path',
    );
  });

  return (
    // <pointLight
    //   ref={torchRef}
    //   color={TORCH_COLOR}
    //   intensity={TORCH_INTENSITY}
    //   distance={TORCH_DISTANCE}
    //   decay={2}
    // />
    <mesh ref={torchRef}>
      <icosahedronGeometry args={[ PLAYER_RADIUS, 1 ]} />
      <meshStandardMaterial flatShading color="cyan" />
    </mesh>
  );
}
