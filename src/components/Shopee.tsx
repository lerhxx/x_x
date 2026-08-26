import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CELL_SCALE } from '../constants/global';
import { EnvelopeLine } from './EnvelopeLine';
import { SceneFence } from './Fence';
import {
  sceneState,
  useSceneBubble,
  type DescriptionId,
} from '../state/sceneStore';

const SHOPEE_URL = '/model/shopee-logo.glb';
const SHEBI_URL = '/model/shebi-2.glb';
const HEBI_URL = '/model/hebi-1.glb';

export interface ShopeeProps {
  position: [number, number, number];
  size?: number;
  rotationY?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  label?: string;
  descriptionId?: DescriptionId;
  pathCells?: Array<{ c: number; r: number }>;
}

/** 加载 glb 并归一化：最大边长 -> targetSize，底部对齐 y=0
 *  有动画时用 SkeletonUtils.clone 正确克隆骨架 */
function useNormalizedModel(
  url: string,
  targetSize: number,
  castShadow: boolean,
  receiveShadow: boolean,
): { clonedScene: THREE.Object3D; normalizeScale: number; offsetY: number; animations: THREE.AnimationClip[] } {
  const gltf = useGLTF(url);
  return useMemo(() => {
    // 有动画 → SkeletonUtils.clone 保留骨架绑定
    const cloned = gltf.animations && gltf.animations.length > 0
      ? SkeletonUtils.clone(gltf.scene) as THREE.Object3D
      : (gltf.scene as THREE.Object3D).clone(true) as THREE.Object3D;
    cloned.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(cloned);
    let scale = 1;
    let yOff = 0;
    if (!box.isEmpty()) {
      const s = new THREE.Vector3();
      box.getSize(s);
      const maxDim = Math.max(s.x, Math.max(s.y, s.z));
      if (maxDim > 0) scale = targetSize / maxDim;
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
    return { clonedScene: cloned, normalizeScale: scale, offsetY: yOff, animations: gltf.animations ?? [] };
  }, [gltf.scene, gltf.animations, targetSize, castShadow, receiveShadow]);
}

export function Shopee({
  position,
  size = 1,
  rotationY = 0,
  castShadow = true,
  receiveShadow = true,
  label,
  descriptionId = 'Shopee',
  pathCells,
}: ShopeeProps) {
  useEffect(() => {
    if (!pathCells || pathCells.length === 0) return;
    const keySet = new Set(pathCells.map(({ c, r }) => `${c},${r}`));
    sceneState.register({ id: descriptionId, pathCellKeys: keySet });
    return () => sceneState.unregister(descriptionId);
  }, [descriptionId, pathCells]);

  useSceneBubble(descriptionId);

  // 主模型 shopee-logo：保留原有的 0.3 缩放 + offsetY=0.35
  const shopee = useNormalizedModel(SHOPEE_URL, size, castShadow, receiveShadow);

  // shebi / hebi：归一化到 size 的 0.35，底部贴地
  const shebi = useNormalizedModel(SHEBI_URL, size * 0.35, castShadow, receiveShadow);
  const hebi = useNormalizedModel(HEBI_URL, size * 0.35, castShadow, receiveShadow);

  // shebi 动画：AnimationMixer 播放 clips
  const shebiMixerRef = useRef<THREE.AnimationMixer | null>(null);
  useEffect(() => {
    if (!shebi.animations || shebi.animations.length === 0) return;
    const mixer = new THREE.AnimationMixer(shebi.clonedScene);
    const action = mixer.clipAction(shebi.animations[0]);
    action.reset().play();
    action.timeScale = 1;
    shebiMixerRef.current = mixer;
    return () => {
      action.stop();
      mixer.uncacheAction(shebi.animations[0]);
      shebiMixerRef.current = null;
    };
  }, [shebi.clonedScene, shebi.animations]);

  // hebi 动画：AnimationMixer 播放 clips
  const hebiMixerRef = useRef<THREE.AnimationMixer | null>(null);
  useEffect(() => {
    if (!hebi.animations || hebi.animations.length === 0) return;
    const mixer = new THREE.AnimationMixer(hebi.clonedScene);
    const action = mixer.clipAction(hebi.animations[0]);
    action.reset().play();
    action.timeScale = 1;
    hebiMixerRef.current = mixer;
    return () => {
      action.stop();
      mixer.uncacheAction(hebi.animations[0]);
      hebiMixerRef.current = null;
    };
  }, [hebi.clonedScene, hebi.animations]);

  useFrame((_, delta) => {
    if (shebiMixerRef.current) shebiMixerRef.current.update(delta);
    if (hebiMixerRef.current) hebiMixerRef.current.update(delta);
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 主 shopee-logo */}
      <primitive
        object={shopee.clonedScene}
        position={[0, 0.3, 0]}
        scale={shopee.normalizeScale * 0.8}
      />

      {/* shebi：左侧（减小 X 偏移确保在墙格内） */}
      <primitive
        object={shebi.clonedScene}
        position={[-size * 0.45, shebi.offsetY + 0.05, 0.15]}
        scale={shebi.normalizeScale * 0.01}
      />

      {/* hebi：右侧 */}
      <primitive
        object={hebi.clonedScene}
        position={[size * 0.4, hebi.offsetY + 0.05, 0.1]}
        scale={hebi.normalizeScale * 0.01}
      />

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

      <EnvelopeLine
        svgUrl='/envelope.svg'
        position={[-0.02, 0.1, 0.5]}
      />

      {/* 围栏：单元格 3 个侧面各 4 个 fence */}
      <SceneFence cellSize={CELL_SCALE} castShadow={castShadow} receiveShadow={receiveShadow} />
    </group>
  );
}

export default Shopee;
