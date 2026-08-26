import type { Cell, MazeData, PathCell, PathDirection } from './types';
import { CELL_SCALE } from '../constants/global';

/** 计算从 from 到 to 的方向 */
function getDirection(from: [number, number], to: [number, number]): PathDirection {
  const dc = to[0] - from[0];
  const dr = to[1] - from[1];
  if (dc > 0) return 'r';
  if (dc < 0) return 'l';
  if (dr < 0) return 't';
  return 'b';
}

/** 将原始坐标数组转换为带方向信息的 PathCell[] */
function buildPathCells(rawPath: Array<[number, number]>): PathCell[] {
  return rawPath.map(([c, r], i) => {
    const prePos = i > 0
      ? { c: rawPath[i - 1][0], r: rawPath[i - 1][1] }
      : undefined;
    const nextPos = i < rawPath.length - 1
      ? { c: rawPath[i + 1][0], r: rawPath[i + 1][1] }
      : undefined;
    // dir: 从前一个单元格到本单元格的方向；首格默认 'b'
    const dir: PathDirection = prePos
      ? getDirection([prePos.c, prePos.r], [c, r])
      : nextPos
        ? getDirection([c, r], [nextPos.c, nextPos.r])
        : 'b';
    return { c, r, dir, prePos, nextPos };
  });
}

/**
 * 生成块式迷宫：每个单元格要么是道路，要么是墙壁。
 *
 * 采用「2N+1 扩展网格 + 递归回溯（迭代 DFS）」算法：
 *   - 输入的逻辑尺寸会先被强制转成奇数（非奇数自动 +1）
 *   - 所有单元格初始化为 wall
 *   - 路径单元格位于奇数坐标 (1,1), (1,3), (3,1), (3,3)…
 *   - 从 (1,1) 出发做 DFS：每次随机选一个方向（步长 2），
 *     若邻居是 wall，则把「当前 → 邻居之间那一格」与「邻居」一并设为 path。
 *
 * 最终迷宫四周一圈永远是墙，起点 (1,1)，终点 (width-2, height-2)。
 */
export function generateMaze(width: number, height: number): MazeData {
  // 强制奇数（外圈一圈墙 + 内部奇数坐标做路径）
  const w = width % 2 === 0 ? width + 1 : width;
  const h = height % 2 === 0 ? height + 1 : height;

  // 初始化：所有格子都是墙
  const cells: Cell[][] = [];
  for (let c = 0; c < w; c++) {
    cells[c] = [];
    for (let r = 0; r < h; r++) {
      cells[c][r] = { type: 'wall', visited: false };
    }
  }

  // 迭代 DFS
  const stack: Array<[number, number]> = [];
  const startC = 1;
  const startR = 1;
  const exitC = w - 2;
  const exitR = h - 2;
  let solutionPath: PathCell[] = [];
  cells[startC][startR].type = 'path';
  cells[startC][startR].visited = true;
  stack.push([startC, startR]);

  // 四方向，步长 = 2（跳过中间那一格）
  const dirs: Array<[number, number]> = [
    [0, -2], // N
    [2, 0],  // E
    [0, 2],  // S
    [-2, 0], // W
  ];

  while (stack.length > 0) {
    const [c, r] = stack[stack.length - 1];

    // 收集未访问的、有效的「跳两格」邻居
    const candidates: Array<[number, number, number, number]> = []; // [nc, nr, midC, midR]
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 1 || nc >= w - 1 || nr < 1 || nr >= h - 1) continue;
      if (cells[nc][nr].visited) continue;
      const midC = c + dc / 2;
      const midR = r + dr / 2;
      candidates.push([nc, nr, midC, midR]);
    }

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    // 随机选一个邻居，挖通「中间墙 + 邻居」
    const [nc, nr, midC, midR] = candidates[Math.floor(Math.random() * candidates.length)];
    cells[midC][midR].type = 'path';
    cells[nc][nr].type = 'path';
    cells[nc][nr].visited = true;
    stack.push([nc, nr]);

    // DFS 栈本身就是「起点→当前格」的路径；首次到达终点时记录
    if (solutionPath.length === 0 && nc === exitC && nr === exitR) {
      // 栈只含步长 2 的奇数坐标格，需补上相邻两格之间的偶数 mid 格
      const rawPath: Array<[number, number]> = [];
      for (let i = 0; i < stack.length; i++) {
        const [pc, pr] = stack[i];
        rawPath.push([pc, pr]);
        if (i < stack.length - 1) {
          const [nxc, nxr] = stack[i + 1];
          rawPath.push([(pc + nxc) / 2, (pr + nxr) / 2]);
        }
      }
      // 转换为带方向信息的 PathCell[]
      solutionPath = buildPathCells(rawPath);
    }
  }

  return {
    width: w,
    height: h,
    cells,
    startCol: startC,
    startRow: startR,
    exitCol: exitC,
    exitRow: exitR,
    solutionPath,
  };
}

// ===== Collision Detection =====

/**
 * 检查位置 (px, pz)（世界单位）是否合法（未与任何墙壁单元格碰撞）。
 *
 * 采用「世界 → cell 空间转换 + AABB 占格检测」：
 *   1) 把世界坐标与半径都除以 CELL_SCALE 转成 cell 空间
 *   2) 玩家作为正方形 AABB，覆盖的每个 cell 都检查
 *   3) 越界 或 落到 type === 'wall' 的格 → 不允许
 *
 * NOTE: 调用方负责把移动拆成小步迭代（防止高速跨格穿透）。
 */
export function canMove(
  px: number,
  pz: number,
  radius: number,
  maze: MazeData,
): boolean {
  // 世界 → cell 空间
  const cellPx = px / CELL_SCALE;
  const cellPz = pz / CELL_SCALE;
  const cellRadius = radius / CELL_SCALE;

  const minCol = Math.floor(cellPx - cellRadius);
  const maxCol = Math.floor(cellPx + cellRadius);
  const minRow = Math.floor(cellPz - cellRadius);
  const maxRow = Math.floor(cellPz + cellRadius);

  for (let c = minCol; c <= maxCol; c++) {
    for (let r = minRow; r <= maxRow; r++) {
      // 越界视为墙
      if (c < 0 || c >= maze.width || r < 0 || r >= maze.height) return false;
      if (maze.cells[c][r].type === 'wall') return false;
    }
  }

  return true;
}
