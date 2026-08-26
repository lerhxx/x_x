// ===== Maze Data Types =====

/**
 * 块式迷宫：每个单元格要么是道路，要么是墙壁。
 */
export type CellType = 'wall' | 'path';

export interface Cell {
  type: CellType;
  visited: boolean; // 用于迷宫生成时的 DFS
}

/** 路径方向：t=上(r-1)、r=右(c+1)、b=下(r+1)、l=左(c-1) */
export type PathDirection = 't' | 'r' | 'b' | 'l';

/** 带方向信息的路径单元格 */
export interface PathCell {
  c: number;
  r: number;
  /** 方向：从前一个单元格到本单元格的方向 */
  dir: PathDirection;
  /** 前一个单元格位置 */
  prePos?: { c: number; r: number };
  /** 后一个单元格位置 */
  nextPos?: { c: number; r: number };
}

export interface MazeData {
  width: number; // 扩展后实际网格宽度（奇数）
  height: number; // 扩展后实际网格高度（奇数）
  cells: Cell[][]; // cells[col][row]
  startCol: number;
  startRow: number;
  exitCol: number;
  exitRow: number;
  solutionPath: PathCell[]; // 起点→终点的路径（带方向信息）
}

// ===== Game State =====

export type GameStatus = 'menu' | 'playing' | 'won';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GameRef {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  visitedCells: Set<string>;
  maze: MazeData;
  pointerLocked: boolean;
}
