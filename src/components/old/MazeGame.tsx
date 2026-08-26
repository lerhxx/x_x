import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRef, MazeData } from '../../game/types';
import { MazeEnvironment } from './MazeEnvironment';
import { Player } from './Player';
import { HUD } from '../HUD';
import {
  AMBIENT_INTENSITY,
  AMBIENT_COLOR,
  FOG_COLOR,
  FOG_NEAR,
  FOG_FAR,
  EYE_HEIGHT,
} from '../../game/constants';

interface MazeGameProps {
  maze: MazeData;
  onWin: (elapsedSeconds: number) => void;
}

export function MazeGame({ maze, onWin }: MazeGameProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const startRef = useRef<number>(0);

  const gameRef = useRef<GameRef>({
    playerX: maze.startCol + 0.5,
    playerZ: maze.startRow + 0.5,
    playerYaw: 0,
    visitedCells: new Set([`${maze.startCol},${maze.startRow}`]),
    maze,
    pointerLocked: false,
  });

  // Start timer on mount
  useEffect(() => {
    startRef.current = Date.now();
    setStartTime(startRef.current);
  }, []);

  const handleWin = useCallback(() => {
    if (won) return;
    setWon(true);
    const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
    // Exit pointer lock so user can click buttons
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    onWin(elapsed);
  }, [won, onWin]);

  return (
    <div className="game-container">
      <Canvas
        camera={{
          fov: 75,
          near: 0.1,
          far: 50,
          position: [maze.startCol + 0.5, EYE_HEIGHT, maze.startRow + 0.5],
        }}
        className="game-canvas"
      >
        <SceneContent maze={maze} gameRef={gameRef} onWin={handleWin} />
      </Canvas>

      <HUD gameRef={gameRef} isPlaying={!won} startTime={startTime} />

      {/* Click-to-lock hint */}
      <ClickToPlayHint gameRef={gameRef} />
    </div>
  );
}

function ClickToPlayHint({ gameRef }: { gameRef: React.MutableRefObject<GameRef> }) {
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const checkLock = () => {
      setLocked(gameRef.current.pointerLocked);
    };
    const interval = window.setInterval(checkLock, 300);
    return () => clearInterval(interval);
  }, [gameRef]);

  if (locked) return null;

  return (
    <div className="click-hint">
      <div className="click-hint-box">
        <div className="click-hint-icon">🖱️</div>
        <div>点击画面锁定鼠标开始游戏</div>
        <div className="click-hint-sub">WASD 移动 · 鼠标转动视角 · Esc 释放</div>
      </div>
    </div>
  );
}

function SceneContent({
  maze,
  gameRef,
  onWin,
}: {
  maze: MazeData;
  gameRef: React.MutableRefObject<GameRef>;
  onWin: () => void;
}) {
  const { gl, scene } = useThree();

  // Set fog and background color
  useEffect(() => {
    scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
    gl.setClearColor(FOG_COLOR);
  }, [gl, scene]);

  return (
    <>
      <ambientLight intensity={AMBIENT_INTENSITY} color={AMBIENT_COLOR} />
      <MazeEnvironment maze={maze} />
      <Player maze={maze} gameRef={gameRef} onWin={onWin} />
    </>
  );
}
