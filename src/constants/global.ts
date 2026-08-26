import type { Difficulty } from '../game/types';

export const CELL_SCALE = 1;

// 注：实际网格尺寸为「2N+1 扩展」后的奇数尺寸，每个单元格要么是墙要么是路。
export const DIFFICULTY_SIZES: Record<Difficulty, { w: number; h: number }> = {
  // easy: { w: 17, h: 17 },
  easy: { w: 11, h: 11 },
  medium: { w: 25, h: 25 },
  hard: { w: 33, h: 33 },
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等 ',
  hard: '困难',
};

export const USE_MOUSE = true;

/** true: 用 Three.js 程序化草地（GrassCellsProcedural）；false: 用 grass.glb 模型 */
export const IS_PURE_GRASS = false;

/** true: 显示海洋颜色调试面板（运行时可调整深水/浅水/泡沫颜色） */
export const OCEAN_DEBUG = false;
