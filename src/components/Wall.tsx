import { useLayoutEffect, useMemo, useRef } from 'react';
import { useGraph } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CELL_SCALE } from '../constants/global';

// GLTF 资产位置
const SAKURA_URL = '/model/sakura-tree.glb';

/** (c,r) 种子的确定性 LCG 伪随机 */
export function createLcg(c: number, r: number) {
  let s = (c * 73856093) ^ (r * 19349663);
  if (s === 0) s = 1;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * 判断墙格是否属于「迷宫四边（含四角）」——
 * 这类墙格用樱花树贴边围绕。
 */
export function isPerimeterWall(c: number, r: number, w: number, h: number): boolean {
  return c === 0 || c === w - 1 || r === 0 || r === h - 1;
}

// ===== 内部墙单元格类型 =====

export interface InteriorWallCell {
  c: number;
  r: number;
}

// ===== 1. InteriorTreesCells: 内部墙格樱花树（1 主 + 3~4 小）+ 跳过已占用格 =====

interface InteriorTreesCellsProps {
  cells: InteriorWallCell[];
  /** 已被场景占用的墙格 key 集合（"c-r"），这些格不渲染樱花树 */
  occupiedCells?: Set<string>;
}

export function InteriorTreesCells({ cells, occupiedCells }: InteriorTreesCellsProps) {
  // 过滤掉被场景占用的格
  const treeCells = useMemo(() => {
    if (!occupiedCells || occupiedCells.size === 0) return cells;
    return cells.filter(({ c, r }) => !occupiedCells.has(`${c}-${r}`));
  }, [cells, occupiedCells]);

  return <PerimeterSakuraCells cells={treeCells} />;
}

// ===== 2. SakuraWallCells: 樱花树墙（每格 1 主树 + 3~4 小树） =====
//   用于外围墙和内部墙（内部墙通过 InteriorTreesCells 的 content 机制跳过有 content 的格）

interface SakuraWallCellsProps {
  cells: Array<{ c: number; r: number }>;
}

export function PerimeterSakuraCells({ cells }: SakuraWallCellsProps) {
  const gltf = useGLTF(SAKURA_URL);
  const { nodes, materials } = useGraph(gltf.scene as unknown as THREE.Object3D);

  const { meshParts, normalizeScale } = useMemo<{
    meshParts: Array<{ mesh: THREE.Mesh; localMatrix: THREE.Matrix4 }>;
    normalizeScale: number;
  }>(() => {
    const result: Array<{ mesh: THREE.Mesh; localMatrix: THREE.Matrix4 }> = [];
    const sceneBox = new THREE.Box3();
    const tmpBox = new THREE.Box3();
    (gltf.scene as unknown as THREE.Object3D).traverse((obj) => {
      const maybeMesh = obj as unknown as { isMesh?: boolean };
      if (maybeMesh.isMesh) {
        const m = obj as unknown as THREE.Mesh;
        m.updateWorldMatrix(true, false);
        const localMatrix = new THREE.Matrix4().copy(m.matrixWorld);
        result.push({ mesh: m, localMatrix });
        if (m.geometry) {
          tmpBox.makeEmpty();
          const bb = (m.geometry as unknown as { boundingBox?: THREE.Box3 }).boundingBox;
          if (bb) tmpBox.copy(bb);
          else tmpBox.setFromObject(m as unknown as THREE.Object3D);
          tmpBox.applyMatrix4(localMatrix);
          sceneBox.union(tmpBox);
        }
      }
    });
    let scale = 1;
    if (!sceneBox.isEmpty()) {
      const size = new THREE.Vector3();
      sceneBox.getSize(size);
      const maxDim = Math.max(size.x, Math.max(size.y, size.z));
      if (maxDim > 0) scale = CELL_SCALE * 2 / maxDim;
    }
    return { meshParts: result, normalizeScale: scale };
  }, [gltf.scene, nodes]);

  // 预计算每格的树实例（1 主 + 4~9 小）
  const treeInstances = useMemo(() => {
    const result: Array<{
      x: number; z: number; scale: number; yRot: number;
    }> = [];
    for (const { c, r } of cells) {
      const rng = createLcg(c, r);
      const cx = (c + 0.5) * CELL_SCALE;
      const cz = (r + 0.5) * CELL_SCALE;

      // 1 棵主树：高度 0.4~0.6，居中
      const mainHeight = 0.4 + rng() * 0.2;
      result.push({
        x: cx, z: cz,
        scale: normalizeScale * mainHeight,
        yRot: rng() * Math.PI * 2,
      });

      // 3~4 棵小树：高度 0.2~0.5，围绕主树
      const smallCount = 4 + Math.floor(rng() * 6); // 3..4
      for (let i = 0; i < smallCount; i++) {
        const angle = (i / smallCount) * Math.PI * 2 + rng() * 0.5;
        const dist = 0.2 + rng() * 0.2; // 距中心 0.2~0.4 cell
        const smallHeight = 0.2 + rng() * 0.3;
        result.push({
          x: cx + Math.cos(angle) * dist * CELL_SCALE,
          z: cz + Math.sin(angle) * dist * CELL_SCALE,
          scale: normalizeScale * smallHeight,
          yRot: rng() * Math.PI * 2,
        });
      }
    }
    return result;
  }, [cells, normalizeScale]);

  const totalCount = treeInstances.length;
  const instancedRefs = useRef<Array<THREE.InstancedMesh | null>>([]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const composed = new THREE.Matrix4();
    for (let partIdx = 0; partIdx < meshParts.length; partIdx++) {
      const inst = instancedRefs.current[partIdx];
      if (!inst) continue;
      const partLocal = meshParts[partIdx].localMatrix;
      for (let i = 0; i < treeInstances.length; i++) {
        const t = treeInstances[i];
        dummy.position.set(t.x, 0, t.z);
        dummy.rotation.set(0, t.yRot, 0);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        composed.multiplyMatrices(dummy.matrix, partLocal);
        inst.setMatrixAt(i, composed);
      }
      inst.instanceMatrix.needsUpdate = true;
    }
  }, [treeInstances, meshParts]);

  void materials;

  if (totalCount === 0) return null;
  if (meshParts.length === 0) return null;

  return (
    <>
      {meshParts.map((part, idx) => {
        const srcGeom = part.mesh.geometry;
        const srcMat = Array.isArray(part.mesh.material)
          ? (part.mesh.material[0] as THREE.Material)
          : (part.mesh.material as THREE.Material);
        return (
          <instancedMesh
            key={idx}
            ref={(el) => {
              instancedRefs.current[idx] = el;
            }}
            args={[srcGeom, srcMat, totalCount]}
            castShadow
            receiveShadow
          />
        );
      })}
    </>
  );
}
