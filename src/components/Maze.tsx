import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { MazeData, PathCell, PathDirection } from '../game/types';
import { CELL_SCALE } from '../constants/global';
import { ExitPortal } from './ExitPortal';
import { LightBeam } from './LightBeam';
import { GrassCellsRenderer as GrassCells } from './GrassCells';
import {
  InteriorTreesCells,
  PerimeterSakuraCells,
  isPerimeterWall,
  type InteriorWallCell,
} from './Wall';
import { Shopee } from './Shopee';
import { Kilox } from './Kilox';
import { Huawei } from './Huawei';
import { Ocean } from './Ocean';
import { SceneGround } from './SceneGround';
import { Amiba } from './Amiba';
import type { DescriptionId } from '../state/sceneStore';

// ===== 场景放置逻辑 =====

/** 场景放置定义 */
interface ScenePlacement {
  /** 在 solutionPath 上的位置比例 [0, 1] */
  pathFraction: number;
  /** 场景占用的单元格数（沿道路方向） */
  length: number;
  /** 模型左侧显示的文字标签 */
  label?: string;
  /** 场景描述 id（对应 descriptions.ts 中的 key） */
  descriptionId: DescriptionId;
  /** 生成场景组件 */
  generateContent: (
    position: [number, number, number],
    rotationY: number,
    size: number,
    label: string | undefined,
    pathCells: Array<{ c: number; r: number }>,
    descriptionId: DescriptionId,
  ) => ReactNode;
}

/**
 * 查找连续直线段：
 *   - 正向：检查 path[idx+1..idx+length-1] 的 dir 是否都相同
 *   - 反向：检查 path[idx-1..idx+length-2] 的 dir 是否都在同一轴（t/b 或 l/r）
 */
function findStraightSegment(
  path: PathCell[],
  startIdx: number,
  length: number,
): { start: number; end: number } | null {
  if (length < 2) return { start: startIdx, end: startIdx };

  // 正向：startIdx..startIdx+length-1
  if (startIdx + length - 1 < path.length) {
    const baseDir = path[startIdx + 1]?.dir;
    if (baseDir) {
      let ok = true;
      for (let j = 2; j < length; j++) {
        if (path[startIdx + j]?.dir !== baseDir) { ok = false; break; }
      }
      if (ok) return { start: startIdx, end: startIdx + length - 1 };
    }
  }

  // 反向：startIdx-1..startIdx+length-2
  if (startIdx > 0 && startIdx + length - 2 < path.length) {
    const baseDir = path[startIdx]?.dir;
    if (baseDir) {
      const baseAxis = (baseDir === 't' || baseDir === 'b') ? 'v' : 'h';
      let ok = true;
      for (let j = 1; j < length - 1; j++) {
        const d = path[startIdx + j]?.dir;
        if (!d) { ok = false; break; }
        const dAxis = (d === 't' || d === 'b') ? 'v' : 'h';
        if (dAxis !== baseAxis) { ok = false; break; }
      }
      if (ok) return { start: startIdx - 1, end: startIdx + length - 2 };
    }
  }

  return null;
}

/** 方向的垂直偏移：水平路径→墙在上/下；垂直路径→墙在左/右 */
function getWallSides(dir: PathDirection): Array<{ dc: number; dr: number }> {
  if (dir === 't' || dir === 'b') {
    return [{ dc: -1, dr: 0 }, { dc: 1, dr: 0 }]; // 左、右
  }
  return [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }]; // 上、下
}

/**
 * 在 solutionPath 上查找场景放置位置。
 * 返回 { contentMap, occupiedCells }。
 */
function findScenePlacements(
  maze: MazeData,
  placements: ScenePlacement[],
  maxSearchOffset = 20,
): { contentMap: Map<string, ReactNode>; occupiedCells: Set<string>; scenePathCells: Array<{ c: number; r: number }> } {
  const contentMap = new Map<string, ReactNode>();
  const occupiedCells = new Set<string>();
  const scenePathCells: Array<{ c: number; r: number }> = [];
  const path = maze.solutionPath;
  if (!path || path.length < 4) return { contentMap, occupiedCells, scenePathCells };
  const w = maze.width;
  const h = maze.height;

  for (const placement of placements) {
    const baseIdx = Math.floor(path.length * placement.pathFraction);
    const length = placement.length;
    let placed = false;

    for (let offset = 0; offset <= maxSearchOffset && !placed; offset++) {
      for (const direction of [1, -1]) {
        const idx = baseIdx + offset * direction;
        if (idx < 0 || idx >= path.length) continue;

        // 查找连续直线段
        const segment = findStraightSegment(path, idx, length);
        if (!segment) continue;

        // 获取段内路径格
        const segmentPathCells: Array<{ c: number; r: number }> = [];
        for (let j = segment.start; j <= segment.end; j++) {
          segmentPathCells.push({ c: path[j].c, r: path[j].r });
        }

        // 确定墙侧方向
        const segDir = path[segment.start + 1]?.dir ?? path[segment.start].dir;
        const sides = getWallSides(segDir);

        // 尝试两侧
        for (const side of sides) {
          const wallCells: Array<{ c: number; r: number }> = [];
          let valid = true;

          for (const pc of segmentPathCells) {
            const wc = pc.c + side.dc;
            const wr = pc.r + side.dr;
            if (wc < 0 || wc >= w || wr < 0 || wr >= h) { valid = false; break; }
            if (maze.cells[wc][wr].type !== 'wall') { valid = false; break; }
            if (isPerimeterWall(wc, wr, w, h)) { valid = false; break; }
            const key = `${wc}-${wr}`;
            if (occupiedCells.has(key)) { valid = false; break; }
            wallCells.push({ c: wc, r: wr });
          }

          if (!valid) continue;

          // 标记所有墙格为已占用
          for (const wc of wallCells) {
            occupiedCells.add(`${wc.c}-${wc.r}`);
          }

          // 收集场景对应的道路单元格
          for (const pc of segmentPathCells) {
            scenePathCells.push({ c: pc.c, r: pc.r });
          }

          // 所有墙格放组件
          if (wallCells.length > 0) {
            // 组件中心 = 所有墙格的中心
            const centerC = wallCells.reduce((s, c) => s + c.c, 0) / wallCells.length;
            const centerR = wallCells.reduce((s, c) => s + c.r, 0) / wallCells.length;

            // 相对于第一个墙格的偏移（ScenePlacements group 已在该格中心）
            const firstCell = wallCells[0];
            const position: [number, number, number] = [
              (centerC - firstCell.c) * CELL_SCALE,
              0,
              (centerR - firstCell.r) * CELL_SCALE,
            ];

            // 路径中心
            const pathCenterC = segmentPathCells.reduce((s, c) => s + c.c, 0) / segmentPathCells.length;
            const pathCenterR = segmentPathCells.reduce((s, c) => s + c.r, 0) / segmentPathCells.length;

            // 旋转：组件正面朝向路径中心
            const dc = pathCenterC - centerC;
            const dr = pathCenterR - centerR;
            const rotationY = Math.atan2(dc, dr);

            // 组件尺寸 = 占用格数 × 单元格尺寸
            const size = wallCells.length * CELL_SCALE;

            contentMap.set(
              `${firstCell.c}-${firstCell.r}`,
              placement.generateContent(position, rotationY, size, placement.label, segmentPathCells, placement.descriptionId),
            );
          }

          placed = true;
          break;
        }
        if (placed) break;
      }
    }
  }

  return { contentMap, occupiedCells, scenePathCells };
}

/** 渲染场景放置点 */
function ScenePlacements({ contentMap }: { contentMap: Map<string, ReactNode> }) {
  const items = useMemo(() => {
    return Array.from(contentMap.entries()).map(([key, node]) => {
      const [c, r] = key.split('-').map(Number);
      return { c, r, node, key };
    });
  }, [contentMap]);

  return (
    <>
      {items.map(({ c, r, node, key }) => (
        <group
          key={key}
          position={[(c + 0.5) * CELL_SCALE, 0, (r + 0.5) * CELL_SCALE]}
        >
          {node}
        </group>
      ))}
    </>
  );
}

interface MazeEnvironmentProps {
  maze: MazeData;
}

export function MazeEnvironment({ maze }: MazeEnvironmentProps) {
  const { width: w, height: h } = maze;

  // 用 findScenePlacements 查找场景放置点（先算，后面 grass/树需要用 occupiedCells 过滤）
  const { contentMap, occupiedCells, scenePathCells } = useMemo(() => {
    const pathLen = maze.solutionPath?.length ?? 0;
    if (pathLen < 10) return { contentMap: new Map<string, ReactNode>(), occupiedCells: new Set<string>(), scenePathCells: [] as Array<{ c: number; r: number }> };
    const step = 5 / pathLen;
    return findScenePlacements(maze, [
      {
        pathFraction: 1 / 4,
        length: 1,
        descriptionId: 'Kilox',
        generateContent: (position, rotationY, size, label, pathCells, descriptionId) => (
          <Kilox position={position} size={size * 0.75} rotationY={rotationY} label={label} descriptionId={descriptionId} pathCells={pathCells} />
        ),
      },
      {
        pathFraction: 1 / 4 + step,
        length: 1,
        descriptionId: 'Huawei',
        generateContent: (position, rotationY, size, label, pathCells, descriptionId) => (
          <Huawei position={position} size={size * 0.75} rotationY={rotationY} label={label} descriptionId={descriptionId} pathCells={pathCells} />
        ),
      },
      {
        pathFraction: 1 / 4 + step * 2,
        length: 1,
        descriptionId: 'Shopee',
        generateContent: (position, rotationY, size, label, pathCells, descriptionId) => (
          <Shopee position={position} size={size * 0.75} rotationY={rotationY} label={label} descriptionId={descriptionId} pathCells={pathCells} />
        ),
      },
      {
        pathFraction: 1 / 4 + step * 3,
        length: 1,
        descriptionId: 17,
        generateContent: (position, rotationY, size, label, pathCells, descriptionId) => (
          <Amiba position={position} size={size * 0.75} rotationY={rotationY} label={label} descriptionId={descriptionId} pathCells={pathCells} />
        ),
      },
    ]);
  }, [maze]);

  // 墙格分类（过滤掉场景占用的格）：
  //   perimeterSakuraCells → 迷宫四边 → 樱花树贴边围绕
  //   interiorWallCells    → 所有内部墙（跳过场景占用格）→ 樱花树群
  //   grassCells           → 所有 wall cells（跳过场景占用格）→ grass 平铺
  //   sceneGroundCells     → 场景占用格 → box 地面替代 grass
  const { perimeterSakuraCells, interiorWallCells, grassCells, sceneGroundCells } = useMemo(() => {
    const sak: Array<{ c: number; r: number }> = [];
    const int: InteriorWallCell[] = [];
    const grass: Array<{ c: number; r: number }> = [];
    const sceneGnd: Array<{ c: number; r: number }> = [];
    const seenInt = new Set<string>();
    for (let c = 0; c < w; c++) {
      for (let r = 0; r < h; r++) {
        if (maze.cells[c][r].type !== 'wall') continue;
        const key = `${c}-${r}`;
        const isOccupied = occupiedCells.has(key);
        if (isOccupied) {
          sceneGnd.push({ c, r });
          continue;
        }
        grass.push({ c, r });
        if (isPerimeterWall(c, r, w, h)) {
          sak.push({ c, r });
          continue;
        }
        if (seenInt.has(key)) continue;
        seenInt.add(key);
        int.push({ c, r });
      }
    }
    return { perimeterSakuraCells: sak, interiorWallCells: int, grassCells: grass, sceneGroundCells: sceneGnd };
  }, [maze, w, h, occupiedCells]);

  return (
    <group>
      {/* 海洋（迷宫四周） */}
      <Ocean width={w} height={h} />

      {/* Floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(w / 2) * CELL_SCALE, 0, (h / 2) * CELL_SCALE]}
      >
        <planeGeometry args={[w * CELL_SCALE, h * CELL_SCALE]} />
        <meshStandardMaterial color="#D29E76" />
      </mesh>

      {/* 场景占用格：用 box 替代 grass，颜色 #D29E76 */}
      <SceneGround cells={sceneGroundCells} />

      {/* 所有墙格底部：grass 贴地平铺 */}
      <GrassCells cells={grassCells} />

      {/* 内部墙 → 樱花树（跳过被场景占用的格） */}
      <InteriorTreesCells cells={interiorWallCells} occupiedCells={occupiedCells} />

      {/* 场景放置点（Kilox / Huawei / Shopee + label） */}
      <ScenePlacements contentMap={contentMap} />

      {/* 场景对应道路单元格上的光柱 */}
      {/* {scenePathCells.map(({ c, r }) => (
        <LightBeam
          key={`beam-${c}-${r}`}
          position={[(c + 0.5) * CELL_SCALE, 0, (r + 0.5) * CELL_SCALE]}
          radiusTop={CELL_SCALE * 0.2}
          radiusBottom={CELL_SCALE * 0.2}
        />
      ))} */}

      {/* 迷宫四边：樱花树贴边围绕（每格 1 棵，最高 1 cell 高度） */}
      <PerimeterSakuraCells cells={perimeterSakuraCells} />

      {/* Exit Portal */}
      <ExitPortal x={(maze.exitCol + 0.5) * CELL_SCALE} z={(maze.exitRow + 0.5) * CELL_SCALE} />

      {/* Start marker (subtle) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[(maze.startCol + 0.5) * CELL_SCALE, 0.01, (maze.startRow + 0.5) * CELL_SCALE]}
      >
        <circleGeometry args={[0.3, 24]} />
        <meshStandardMaterial color="#ff6644" emissive="#ff6644" emissiveIntensity={0.5} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}
