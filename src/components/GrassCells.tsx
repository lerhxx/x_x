import { useLayoutEffect, useMemo, useRef } from 'react';
import { useGraph } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CELL_SCALE, IS_PURE_GRASS } from '../constants/global';

const GRASS_URL = '/model/grass.glb';

export interface GrassCellsProps {
  cells: Array<{ c: number; r: number }>;
}

// 每格 4 个 grass 放置的相对子格中心：4 象限（子格大小 = CELL_SCALE / 2）
const QUAD_OFFSETS: ReadonlyArray<[number, number]> = [
  [-0.25, -0.25], // 左上（-X, -Z）
  [+0.25, -0.25], // 右上（+X, -Z）
  [-0.25, +0.25], // 左下（-X, +Z）
  [+0.25, +0.25], // 右下（+X, +Z）
];
const QUAD_PER_CELL = QUAD_OFFSETS.length;

/**
 * 所有墙格底部 grass.glb 平铺（1 格 4 个，2×2 排满整格，贴地）。
 * 优化点：
 *   - 多子零件合并为单 BufferGeometry → 单 InstancedMesh（1 draw call）
 *   - 关闭 castShadow（贴地草只 receiveShadow）
 *   - 材质降级 MeshLambertMaterial（保留 color/map，去 PBR 开销）
 *   - 归一化缩放 bake 到顶点，实例矩阵只做平移
 */
export function GrassCells({ cells }: GrassCellsProps) {
  const totalCount = cells.length * QUAD_PER_CELL;
  const gltf = useGLTF(GRASS_URL);
  const { nodes, materials } = useGraph(gltf.scene as unknown as THREE.Object3D);

  const { merged, material } = useMemo<{
    merged: THREE.BufferGeometry | null;
    material: THREE.Material;
  }>(() => {
    const srcGeoms: THREE.BufferGeometry[] = [];
    let fallbackMat: THREE.Material = new THREE.MeshLambertMaterial({ color: 0x4a7a3b });
    const sceneBox = new THREE.Box3();
    const tmpBox = new THREE.Box3();
    (gltf.scene as unknown as THREE.Object3D).traverse((obj) => {
      const maybeMesh = obj as unknown as { isMesh?: boolean };
      if (maybeMesh.isMesh) {
        const m = obj as unknown as THREE.Mesh;
        m.updateWorldMatrix(true, false);
        const localMatrix = new THREE.Matrix4().copy(m.matrixWorld);
        // 取第一个非空材质（克隆成 MeshLambertMaterial，保留色/map 去 PBR 开销）
        const srcMat = Array.isArray(m.material)
          ? (m.material[0] as THREE.Material)
          : (m.material as THREE.Material);
        if (srcMat) {
          const anyMat = srcMat as unknown as { color?: THREE.ColorRepresentation; map?: THREE.Texture | null };
          const lmb = new THREE.MeshLambertMaterial();
          if (anyMat.color !== undefined) lmb.color.set(anyMat.color);
          if (anyMat.map) lmb.map = anyMat.map;
          fallbackMat = lmb;
        }
        if (m.geometry) {
          const cloned = (m.geometry as THREE.BufferGeometry).clone();
          cloned.applyMatrix4(localMatrix);
          srcGeoms.push(cloned);
          // 同时算包围盒决定归一化
          tmpBox.makeEmpty();
          const bb = (m.geometry as unknown as { boundingBox?: THREE.Box3 }).boundingBox;
          if (bb) tmpBox.copy(bb);
          else tmpBox.setFromObject(m as unknown as THREE.Object3D);
          tmpBox.applyMatrix4(localMatrix);
          sceneBox.union(tmpBox);
        }
      }
    });

    // 归一化：长宽 = CELL_SCALE/2，高 = CELL_SCALE/10。用 Matrix4 把合并前所有 geometry 先按比例缩放。
    let sxz = 1;
    let sy = 1;
    if (!sceneBox.isEmpty()) {
      const size = new THREE.Vector3();
      sceneBox.getSize(size);
      const xzDim = Math.max(size.x, size.z);
      if (xzDim > 0) sxz = (CELL_SCALE / 2) / xzDim;
      if (size.y > 0) sy = (CELL_SCALE / 10) / size.y;
    }
    const normMat4 = new THREE.Matrix4().makeScale(sxz, sy, sxz);
    for (const g of srcGeoms) g.applyMatrix4(normMat4);

    // 合并 → 单个 BufferGeometry → 一个 InstancedMesh，draw call 从 K 降为 1
    const mergedGeom =
      srcGeoms.length > 0 ? (mergeGeometries(srcGeoms, false) as THREE.BufferGeometry) : null;
    if (mergedGeom) mergedGeom.computeBoundingSphere();

    return { merged: mergedGeom, material: fallbackMat };
  }, [gltf.scene, nodes]);

  const instRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const inst = instRef.current;
    if (!inst || !merged) return;
    const dummy = new THREE.Object3D();
    let instIdx = 0;
    for (let i = 0; i < cells.length; i++) {
      const { c, r } = cells[i];
      const cellCx = (c + 0.5) * CELL_SCALE;
      const cellCz = (r + 0.5) * CELL_SCALE;
      for (const [ox, oz] of QUAD_OFFSETS) {
        dummy.position.set(cellCx + ox * CELL_SCALE, 0, cellCz + oz * CELL_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1); // 归一化已 bake 到 merged geometry
        dummy.updateMatrix();
        inst.setMatrixAt(instIdx, dummy.matrix);
        instIdx++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [cells, merged]);

  void materials;

  if (totalCount === 0) return null;
  if (!merged) return null;

  return (
    <instancedMesh
      ref={instRef}
      args={[merged, material, totalCount]}
      receiveShadow
      frustumCulled={false}
    />
  );
}

// ===== GrassCellsProcedural: 纯 Three.js geometry 模拟草地（无 glb 加载） =====

/**
 * 用程序化 geometry 模拟草地：
 * - 底座：扁方块（泥土 + 草皮双层）
 * - 草叶：多片细锥，随机分布
 * 每格 4 块（2×2），与 GrassCells 一致。
 */
export function GrassCellsProcedural({ cells }: GrassCellsProps) {
  const totalCount = cells.length * QUAD_PER_CELL;

  // 构建合并的草地 geometry（单位尺寸，实例矩阵负责平移）
  const { merged, material } = useMemo<{
    merged: THREE.BufferGeometry;
    material: THREE.Material;
  }>(() => {
    const parts: THREE.BufferGeometry[] = [];

    // 泥土底座 1.0 × 0.04 × 1.0
    const soil = new THREE.BoxGeometry(1, 0.01, 1);
    soil.translate(0, 0.01, 0);
    parts.push(soil);

    // 草皮层 1.0 × 0.04 × 1.0
    const turf = new THREE.BoxGeometry(1, 0.01, 1);
    turf.translate(0, 0.02, 0);
    parts.push(turf);

    const mergedGeom = mergeGeometries(parts, false) as THREE.BufferGeometry;
    mergedGeom.computeBoundingSphere();

    // 材质：用顶点颜色区分泥土/草皮
    const colors = new Float32Array(mergedGeom.attributes.position.count * 3);
    const soilColor = new THREE.Color('#8a6a3f');
    const turfColor = new THREE.Color('#6b9b4a');
    // BoxGeometry 各 24 顶点（6 面 × 4），前 24 为泥土，24~48 为草皮
    const soilVertCount = 24;
    for (let i = 0; i < mergedGeom.attributes.position.count; i++) {
      const c = i < soilVertCount
        ? soilColor
        : turfColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    mergedGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    return { merged: mergedGeom, material: mat };
  }, []);

  // 归一化到：长宽 = CELL_SCALE/2，高 = CELL_SCALE/10
  const sxz = (CELL_SCALE / 2) / 1; // 底座宽 1 → CELL_SCALE/2
  const sy = (CELL_SCALE / 10) / 0.08; // 总高 0.08 → CELL_SCALE/10

  const instRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const inst = instRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    let instIdx = 0;
    for (let i = 0; i < cells.length; i++) {
      const { c, r } = cells[i];
      const cellCx = (c + 0.5) * CELL_SCALE;
      const cellCz = (r + 0.5) * CELL_SCALE;
      for (const [ox, oz] of QUAD_OFFSETS) {
        dummy.position.set(cellCx + ox * CELL_SCALE, 0, cellCz + oz * CELL_SCALE);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(sxz, sy, sxz);
        dummy.updateMatrix();
        inst.setMatrixAt(instIdx, dummy.matrix);
        instIdx++;
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  }, [cells, sxz, sy]);

  if (totalCount === 0) return null;

  return (
    <instancedMesh
      ref={instRef}
      args={[merged, material, totalCount]}
      receiveShadow
      frustumCulled={false}
    />
  );
}

// ===== 统一出口：根据 IS_PURE_GRASS 开关选择实现 =====

export function GrassCellsRenderer(props: GrassCellsProps) {
  if (IS_PURE_GRASS) return <GrassCellsProcedural {...props} />;
  return <GrassCells {...props} />;
}

export default GrassCellsRenderer;
