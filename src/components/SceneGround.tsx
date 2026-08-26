import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { CELL_SCALE } from '../constants/global';

const SCENE_GROUND_COLOR = '#D29E76';
const SCENE_GROUND_HEIGHT = CELL_SCALE / 10 * 0.3;

export interface SceneGroundProps {
  cells: Array<{ c: number; r: number }>;
}

/**
 * 场景占用格的地面：用 boxGeometry 替代 grass，
 * 高度与 grass 一致（CELL_SCALE/10），颜色 #D29E76。
 * 使用 InstancedMesh 批量渲染。
 */
export function SceneGround({ cells }: SceneGroundProps) {
  const count = cells.length;
  const instRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const inst = instRef.current;
    if (!inst || count === 0) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const { c, r } = cells[i];
      dummy.position.set(
        (c + 0.5) * CELL_SCALE,
        SCENE_GROUND_HEIGHT / 2,
        (r + 0.5) * CELL_SCALE,
      );
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(CELL_SCALE, SCENE_GROUND_HEIGHT, CELL_SCALE);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [cells, count]);

  if (count === 0) return null;

  return (
    <instancedMesh
      ref={instRef}
      args={[undefined, undefined, count]}
      receiveShadow
      castShadow
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={SCENE_GROUND_COLOR} />
    </instancedMesh>
  );
}

export default SceneGround;
