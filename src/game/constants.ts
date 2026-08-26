import type { Difficulty } from './types';

// ===== World Constants =====

export const CELL_SIZE = 1;
export const WALL_HEIGHT = 1.3;
export const WALL_THICKNESS = 0.12;
export const EYE_HEIGHT = 0.65;
export const PLAYER_RADIUS = 0.22;

// ===== Movement =====

export const MOVE_SPEED = 3.2; // units per second
export const TURN_SPEED = 2.2; // radians per second (arrow keys)
export const MOUSE_SENSITIVITY = 0.0022;

// ===== Lighting =====

export const TORCH_INTENSITY = 3.5;
export const TORCH_DISTANCE = 9;
export const TORCH_COLOR = '#ffcc77';
export const AMBIENT_INTENSITY = 0.12;
export const AMBIENT_COLOR = '#2a2a44';

// ===== Fog =====

export const FOG_COLOR = '#08080f';
export const FOG_NEAR = 1.5;
export const FOG_FAR = 9;

// ===== Exit =====

export const EXIT_COLOR = '#00ff99';
export const EXIT_LIGHT_INTENSITY = 2;
export const EXIT_LIGHT_DISTANCE = 5;

// ===== Difficulty → Maze Size =====
// 注：实际网格尺寸为「2N+1 扩展」后的奇数尺寸，每个单元格要么是墙要么是路。

export const DIFFICULTY_SIZES: Record<Difficulty, { w: number; h: number }> = {
  // easy: { w: 17, h: 17 },
  easy: { w: 11, h: 11 },
  medium: { w: 25, h: 25 },
  hard: { w: 33, h: 33 },
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单 (17×17)',
  medium: '中等 (25×25)',
  hard: '困难 (33×33)',
};

// ===== Colors =====

export const WALL_COLOR = '#0c7308';
export const FLOOR_COLOR = '#612b04';
export const CEILING_COLOR = '#15151f';
