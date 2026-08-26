import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

const FENCE_URL = '/model/wooden-fence.glb';

export interface FenceProps {
  position?: [number, number, number];
  rotationY?: number;
  width?: number;
  height?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/** 加载 wooden-fence.glb 并归一化到指定尺寸 */
export function Fence({
  position = [0, 0, 0],
  rotationY = 0,
  width = 0.22,
  height = 0.35,
  castShadow = true,
  receiveShadow = true,
}: FenceProps) {
  const gltf = useGLTF(FENCE_URL);

  const { cloned, offsetY } = useMemo(() => {
    const cloned = (gltf.scene as THREE.Object3D).clone(true) as THREE.Object3D;
    cloned.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    let offY = 0;
    if (!box.isEmpty()) {
      box.getSize(size);
      const scale = width / Math.max(size.x, size.z);
      cloned.scale.set(scale, scale, scale);
      offY = -box.min.y * scale;
      const scaledHeight = size.y * scale;
      if (scaledHeight < height) {
        const hScale = height / scaledHeight;
        cloned.scale.multiplyScalar(hScale);
        offY = -box.min.y * scale * hScale;
      }
    }
    cloned.traverse((obj) => {
      const mesh = obj as unknown as { isMesh?: boolean };
      if (mesh.isMesh) {
        const m = obj as unknown as THREE.Mesh;
        m.castShadow = castShadow;
        m.receiveShadow = receiveShadow;
      }
    });
    return { cloned, offsetY: offY };
  }, [gltf.scene, width, height, castShadow, receiveShadow]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={cloned} position={[0, offsetY, 0]} />
    </group>
  );
}

/** 在场景单元格的 3 个侧面（背面、左侧、右侧）各放置 4 个 fence */
export interface SceneFenceProps {
  /** 单元格尺寸（世界单位） */
  cellSize?: number;
  /** 每个 fence 的宽度 */
  fenceWidth?: number;
  /** 每个 fence 的高度 */
  fenceHeight?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function SceneFence({
  cellSize = 1,
  fenceWidth = 0.12,
  fenceHeight = 0.15,
  castShadow = true,
  receiveShadow = true,
}: SceneFenceProps) {
  const half = cellSize / 2;
  const spacing = cellSize / 3;
  const offsets = [-half + spacing / 2, -half + spacing + spacing / 2, -half + spacing * 2 + spacing / 2];

  return (
    <>
      {/* 背面 (z = -half), 面朝 -Z 方向 (rotationY = PI) */}
      {offsets.map((x, i) => (
        <Fence key={`b-${i}`} position={[x, 0, -half]} rotationY={Math.PI} width={fenceWidth} height={fenceHeight} castShadow={castShadow} receiveShadow={receiveShadow} />
      ))}
      {/* 左侧 (x = -half), 面朝 -X 方向 (rotationY = PI/2) */}
      {offsets.map((z, i) => (
        <Fence key={`l-${i}`} position={[-half, 0, z]} rotationY={Math.PI / 2} width={fenceWidth} height={fenceHeight} castShadow={castShadow} receiveShadow={receiveShadow} />
      ))}
      {/* 右侧 (x = +half), 面朝 +X 方向 (rotationY = -PI/2) */}
      {offsets.map((z, i) => (
        <Fence key={`r-${i}`} position={[half, 0, z]} rotationY={-Math.PI / 2} width={fenceWidth} height={fenceHeight} castShadow={castShadow} receiveShadow={receiveShadow} />
      ))}
    </>
  );
}

export default Fence;
