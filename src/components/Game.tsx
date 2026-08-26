import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameRef, MazeData } from '../game/types';
import { MazeEnvironment } from './Maze';
import { Player } from './SpherePlayer';
import { HUD } from './HUD';
import { Description } from './Description';
import { AMBIENT_INTENSITY, AMBIENT_COLOR } from '../constants/light';
import { EYE_HEIGHT } from '../constants/player';
import { CELL_SCALE } from '../constants/global';
import { OrbitControls } from '@react-three/drei';
import { Perf } from 'r3f-perf';
import { sceneState, useSceneState, type DescriptionId } from '../state/sceneStore';

interface MazeGameProps {
  maze: MazeData;
  onWin: (elapsedSeconds: number) => void;
}

export function MazeGame({ maze, onWin }: MazeGameProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const startRef = useRef<number>(0);

  const gameRef = useRef<GameRef>({
    playerX: (maze.startCol + 0.5) * CELL_SCALE,
    playerZ: (maze.startRow + 0.5) * CELL_SCALE,
    playerYaw: 0,
    visitedCells: new Set([`${maze.startCol},${maze.startRow}`]),
    maze,
    pointerLocked: false,
  });

  // 订阅全局场景 state：触发重新渲染弹窗/E 键处理
  useSceneState();

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

  // E 键全局处理：
  //  - 弹窗已打开 → 关闭（弹窗内的 E 监听也会生效）
  //  - 弹窗未打开 + 玩家在某个场景道路格上（activeSceneId） → 打开对应描述
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'e') return;
      // 忽略 input / textarea 的 e
      const tgt = e.target as HTMLElement | null;
      if (tgt && /^(INPUT|TEXTAREA)$/.test(tgt.tagName)) return;

      if (sceneState.openId) {
        sceneState.closeDescription();
      } else if (sceneState.activeSceneId) {
        sceneState.openDescription(sceneState.activeSceneId as DescriptionId);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const openId = sceneState.openId as DescriptionId | null;

  return (
    <div className="game-container">
      <Canvas
        camera={{
          fov: 75,
          near: 0.1,
          far: 50,
          position: [(maze.startCol + 0.5) * CELL_SCALE, EYE_HEIGHT, (maze.startRow + 0.5) * CELL_SCALE],
        }}
        className="game-canvas"
      >
        <Perf position="top-left" />
        <OrbitControls />
        <SceneContent maze={maze} gameRef={gameRef} onWin={handleWin} />
      </Canvas>

      <HUD gameRef={gameRef} isPlaying={!won} startTime={startTime} />
    
      {/* Click-to-lock hint */}
      {/* <ClickToPlayHint gameRef={gameRef} /> */}

      {openId && (
        <Description
          id={openId}
          onClose={() => sceneState.closeDescription()}
        />
      )}
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
  // useEffect(() => {
  //   scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);
  //   gl.setClearColor(FOG_COLOR);
  // }, [gl, scene]);

  useEffect(() => {
    scene.background = new THREE.Color('#ffffff');
  }, [scene])

  return (
    <>
      <ambientLight intensity={AMBIENT_INTENSITY} color={AMBIENT_COLOR} position={[10, 10, 10]} />
      <MazeEnvironment maze={maze} />
      <Player maze={maze} gameRef={gameRef} onWin={onWin} />
    </>
  );
}
