import * as THREE from 'three';

/**
 * GreenTree: 低多边形针叶松树（无需 glb，纯内置 geometry 组合）。
 *
 * 造型（单位 scale=1 下高度约 1.2）：
 *   - 树干：棕色圆柱（radialSegments = 8）
 *   - 树冠：3 层依次收窄的圆锥层 + 顶层尖锥
 *   - 每层都有明显的「层叠切面」，贴近参考图的卡通低面数风格
 *
 * Props:
 *   - position? : [x, y, z] — 世界坐标（y=0 贴地）
 *   - scale?    : number 或 [sx, sy, sz] — 整体缩放
 *   - leafColor? : string — 树冠颜色（默认深绿）
 *   - trunkColor?: string — 树干颜色（默认深棕）
 *   - yRot?     : number  — 绕 Y 轴旋转（弧度）
 *   - castShadow? / receiveShadow?: boolean
 *
 * 注：这是「单颗树」组件，只渲染一个树对象（多 mesh 组成）。
 * 批量使用（每格 N 颗）时建议在外部用 InstancedMesh 分组提交以减少 draw call；
 * 或者直接 JSX map 在数量不大时也可用。
 */
export interface GreenTreeProps {
  position?: [number, number, number];
  scale?: number | [number, number, number];
  leafColor?: string;
  trunkColor?: string;
  yRot?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

// 单个锥层参数（相对单位高度 = 1 情形下的造型）
// 为了避免重复声明，内部共享 geometry 引用：
// 目标总高保持 1.25（与 Maze 侧归一化公式一致）；其中树干 = 总高 × 1/4 = 0.3125，树冠 4 层 = 0.9375
const TOTAL_H = 1.25;
const TRUNK_H = TOTAL_H * 0.25; // 0.3125 —— 树干占整体 1/4
const CANOPY_H = TOTAL_H - TRUNK_H; // 0.9375

// 树冠 4 段高度：保持原 30:28:25:22 相对比例，总量缩到 CANOPY_H
const K = CANOPY_H / (0.30 + 0.28 + 0.25 + 0.22); // ≈ 0.892857
const L1_H = 0.30 * K;
const L2_H = 0.28 * K;
const L3_H = 0.25 * K;
const TOP_H = 0.22 * K;
// 树冠底半径：按同样比例 K 压缩，保持原塔型观感
const L1_R = 0.45 * K; // ≈ 0.4018（同时也是 GREENTREE_UNIT_RADIUS）
const L2_R = 0.36 * K;
const L3_R = 0.27 * K;
const TOP_R = 0.16 * K;
// 树干半径保持（top 0.08 / bot 0.10），只是高度拉长到 TRUNK_H
const TRUNK_GEO = new THREE.CylinderGeometry(0.08, 0.10, TRUNK_H, 8, 1);
const LAYER1_GEO = new THREE.ConeGeometry(L1_R, L1_H, 8, 1);
const LAYER2_GEO = new THREE.ConeGeometry(L2_R, L2_H, 8, 1);
const LAYER3_GEO = new THREE.ConeGeometry(L3_R, L3_H, 8, 1);
const TOP_GEO    = new THREE.ConeGeometry(TOP_R, TOP_H, 8, 1);

// 每个子部件本地 position.y（局部中心）
const TRUNK_Y = TRUNK_H / 2;
const L1_Y = TRUNK_H + L1_H / 2;
const L2_Y = L1_Y + L1_H / 2 + L2_H / 2;
const L3_Y = L2_Y + L2_H / 2 + L3_H / 2;
const TOP_Y = L3_Y + L3_H / 2 + TOP_H / 2;
// 校验：TOP_Y + TOP_H/2 应 ≈ 1.25

export function GreenTree({
  position = [0, 0, 0],
  scale = 1,
  leafColor = '#3f8e5a',
  trunkColor = '#6d4423',
  yRot = 0,
  castShadow = true,
  receiveShadow = true,
}: GreenTreeProps) {
  const [sx, sy, sz] =
    typeof scale === 'number' ? [scale, scale, scale] : scale;

  return (
    <group
      position={position}
      rotation={[0, yRot, 0]}
      scale={[sx, sy, sz]}
    >
      <mesh
        geometry={TRUNK_GEO}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        position={[0, TRUNK_Y, 0]}
      >
        <meshStandardMaterial color={trunkColor} roughness={0.9} metalness={0} />
      </mesh>

      <mesh
        geometry={LAYER1_GEO}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        position={[0, L1_Y, 0]}
      >
        <meshStandardMaterial color={leafColor} roughness={0.75} metalness={0} flatShading />
      </mesh>

      <mesh
        geometry={LAYER2_GEO}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        position={[0, L2_Y, 0]}
      >
        <meshStandardMaterial color={leafColor} roughness={0.75} metalness={0} flatShading />
      </mesh>

      <mesh
        geometry={LAYER3_GEO}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        position={[0, L3_Y, 0]}
      >
        <meshStandardMaterial color={leafColor} roughness={0.75} metalness={0} flatShading />
      </mesh>

      <mesh
        geometry={TOP_GEO}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        position={[0, TOP_Y, 0]}
      >
        <meshStandardMaterial color={leafColor} roughness={0.75} metalness={0} flatShading />
      </mesh>
    </group>
  );
}

export default GreenTree;

/** 调色板（5 种叶子 / 5 种树干一一对应）—— 供外部批量使用时颜色离散分档，保持 InstancedMesh 单材质可用 */
export const LEAF_PALETTE: readonly string[] = [
  '#3f8e5a', // 深绿
  '#68bd7a', // 中绿
  '#8fd19c', // 浅绿
  '#4f9a8e', // 蓝绿
  '#2f6b47', // 墨绿
];
export const TRUNK_PALETTE: readonly string[] = [
  '#6d4423',
  '#8a5a2b',
  '#5a3820',
  '#7a4d2a',
  '#4e2e1a',
];

/** 单位 scale = 1 时树主体总高（供算归一化）—— 最高 ≈ 1.25 */
export const GREENTREE_UNIT_HEIGHT = 1.25;

/** 单位 scale = 1 时树底最大半径（LAYER1_GEO 底半径 = 0.45 × K ≈ 0.4018，XZ 平面最外一圈） */
export const GREENTREE_UNIT_RADIUS = 0.45 * (0.9375 / 1.05);

/** 子部件枚举索引（批量使用时用于映射） */
export const GREENTREE_PART_TRUNK = 0;
export const GREENTREE_PART_LAYER1 = 1;
export const GREENTREE_PART_LAYER2 = 2;
export const GREENTREE_PART_LAYER3 = 3;
export const GREENTREE_PART_TOP = 4;

export function getGreentreeGeometry(part: number): THREE.BufferGeometry {
  switch (part) {
    case GREENTREE_PART_TRUNK: return TRUNK_GEO;
    case GREENTREE_PART_LAYER1: return LAYER1_GEO;
    case GREENTREE_PART_LAYER2: return LAYER2_GEO;
    case GREENTREE_PART_LAYER3: return LAYER3_GEO;
    case GREENTREE_PART_TOP:    return TOP_GEO;
    default: return TRUNK_GEO;
  }
}

export function getGreentreeLocalPosition(part: number): number {
  switch (part) {
    case GREENTREE_PART_TRUNK: return TRUNK_Y;
    case GREENTREE_PART_LAYER1: return L1_Y;
    case GREENTREE_PART_LAYER2: return L2_Y;
    case GREENTREE_PART_LAYER3: return L3_Y;
    case GREENTREE_PART_TOP:    return TOP_Y;
    default: return 0;
  }
}

export const GREENTREE_PARTS_TOTAL = 5;
export const GREENTREE_PALETTE_SIZE = LEAF_PALETTE.length;
