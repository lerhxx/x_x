import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_SCALE } from '../constants/global';
import { EnvelopeLine } from './EnvelopeLine2';
import { SceneFence } from './Fence';
import {
  sceneState,
  useSceneBubble,
  type DescriptionId,
} from '../state/sceneStore';

const ROBOT_URLS = [
  '/model/robot.glb',
  '/model/robot-1.glb',
  '/model/robot-2.glb',
];

/** 单个 robot 配置：位置偏移 + 浮动相位 */
interface RobotConfig {
  url: string;
  offsetX: number;
  offsetZ: number;
  phase: number;
}

const ROBOT_CONFIGS: RobotConfig[] = [
  { url: ROBOT_URLS[0], offsetX: -0.35, offsetZ: 0, phase: 0 },
  { url: ROBOT_URLS[1], offsetX: 0, offsetZ: 0, phase: Math.PI / 2 },
  { url: ROBOT_URLS[2], offsetX: 0.35, offsetZ: 0, phase: Math.PI },
];

export interface KiloxProps {
  position: [number, number, number];
  size?: number;
  rotationY?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  bobAmplitude?: number;
  bobSpeed?: number;
  label?: string;
  /** 场景对应的描述 id */
  descriptionId?: DescriptionId;
  /** 场景占用的道路单元格（列,行） */
  pathCells?: Array<{ c: number; r: number }>;
}

/** 加载 glb 并归一化克隆场景 */
function useNormalizedScene(
  url: string,
  size: number,
  castShadow: boolean,
  receiveShadow: boolean,
): { clonedScene: THREE.Object3D; normalizeScale: number; offsetY: number } {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const cloned = (gltf.scene as THREE.Object3D).clone(true) as THREE.Object3D;
    cloned.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(cloned);
    let scale = 1;
    let yOff = 0;
    if (!box.isEmpty()) {
      const s = new THREE.Vector3();
      box.getSize(s);
      const maxDim = Math.max(s.x, Math.max(s.y, s.z));
      if (maxDim > 0) scale = size / maxDim;
      yOff = -box.min.y * scale;
    }
    cloned.traverse((obj) => {
      const maybeMesh = obj as unknown as { isMesh?: boolean };
      if (maybeMesh.isMesh) {
        const m = obj as unknown as THREE.Mesh;
        m.castShadow = castShadow;
        m.receiveShadow = receiveShadow;
      }
    });
    return { clonedScene: cloned, normalizeScale: scale, offsetY: yOff };
  }, [gltf.scene, size, castShadow, receiveShadow]);
}

export function Kilox({
  position,
  size = 1,
  rotationY = 0,
  castShadow = true,
  receiveShadow = true,
  bobAmplitude,
  bobSpeed = 2,
  label,
  descriptionId = 'Kilox',
  pathCells,
}: KiloxProps) {
  // 注册场景道路格
  useEffect(() => {
    if (!pathCells || pathCells.length === 0) return;
    const keySet = new Set(pathCells.map(({ c, r }) => `${c},${r}`));
    sceneState.register({ id: descriptionId, pathCellKeys: keySet });
    return () => sceneState.unregister(descriptionId);
  }, [descriptionId, pathCells]);

  useSceneBubble(descriptionId);

  const robotSize = size * 0.2;
  const rBob = bobAmplitude ?? size * 0.02;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {ROBOT_CONFIGS.map((cfg) => (
        <Robot3D
          key={cfg.url}
          url={cfg.url}
          offsetX={cfg.offsetX}
          offsetZ={cfg.offsetZ}
          phase={cfg.phase}
          size={robotSize}
          bobSpeed={bobSpeed}
          bobAmp={rBob}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      ))}

      {label && (
        <Text
          position={[-size / 2 - CELL_SCALE * 0.1, size * 0.25, 0]}
          fontSize={CELL_SCALE * 0.15}
          color="#ffcc33"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#333333"
        >
          {label}
        </Text>
      )}

      {/* EnvelopeLine 粒子信封 */}
      <EnvelopeLine
        position={[-0.02, 0.2, 0.4]}
      />

      {/* 围栏：单元格 3 个侧面各 4 个 fence */}
      <SceneFence cellSize={CELL_SCALE} castShadow={castShadow} receiveShadow={receiveShadow} />
    </group>
  );
}

/** 单个 robot：加载模型 + 上下浮动动画（按 phase 错开） */
function Robot3D({
  url,
  offsetX,
  offsetZ,
  phase,
  size,
  bobSpeed,
  bobAmp,
  castShadow,
  receiveShadow,
}: {
  url: string;
  offsetX: number;
  offsetZ: number;
  phase: number;
  size: number;
  bobSpeed: number;
  bobAmp: number;
  castShadow: boolean;
  receiveShadow: boolean;
}) {
  const { clonedScene, normalizeScale, offsetY } = useNormalizedScene(
    url,
    size,
    castShadow,
    receiveShadow,
  );
  const ref = useRef<THREE.Object3D>(null);
  const baseY = offsetY + 0.1;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.position.y = baseY + Math.sin(t * bobSpeed + phase) * bobAmp;
    }
  });

  return (
    <primitive
      ref={ref as unknown as React.Ref<THREE.Object3D>}
      object={clonedScene}
      scale={normalizeScale}
      position={[offsetX, baseY, offsetZ]}
    />
  );
}

export default Kilox;
