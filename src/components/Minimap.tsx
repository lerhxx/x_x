import { useEffect, useRef } from 'react';
import type { GameRef } from '../game/types';
import { EXIT_COLOR } from '../game/constants';
import { CELL_SCALE } from '../constants/global';

interface MinimapProps {
  gameRef: React.MutableRefObject<GameRef>;
}

const MINIMAP_SIZE = 180;

export function Minimap({ gameRef }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { maze, playerX, playerZ, playerYaw, visitedCells } = gameRef.current;
      const { width: w, height: h } = maze;
      const cellSize = MINIMAP_SIZE / Math.max(w, h);
      const offsetX = (MINIMAP_SIZE - w * cellSize) / 2;
      const offsetY = (MINIMAP_SIZE - h * cellSize) / 2;

      // Clear
      ctx.fillStyle = '#0a0a12';
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      // Draw visited cells background（只画道路单元格）
      ctx.fillStyle = '#1a1a2e';
      for (const key of visitedCells) {
        const [c, r] = key.split(',').map(Number);
        const cell = maze.cells[c]?.[r];
        if (!cell || cell.type !== 'path') continue;
        ctx.fillRect(
          offsetX + c * cellSize,
          offsetY + r * cellSize,
          cellSize,
          cellSize,
        );
      }

      // 用线段描出墙壁边：对每个已访问的 path 单元格，
      // 若其四方向相邻格是墙或越界，则画那条边作为线段
      ctx.strokeStyle = '#6a7a9e';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();

      const isWallOrOOB = (c: number, r: number): boolean => {
        if (c < 0 || c >= w || r < 0 || r >= h) return true;
        return maze.cells[c][r].type === 'wall';
      };

      for (const key of visitedCells) {
        const [c, r] = key.split(',').map(Number);
        const cell = maze.cells[c]?.[r];
        if (!cell || cell.type !== 'path') continue;

        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;

        // 北边：相邻 (c, r-1)
        if (isWallOrOOB(c, r - 1)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellSize, y);
        }
        // 南边：相邻 (c, r+1)
        if (isWallOrOOB(c, r + 1)) {
          ctx.moveTo(x, y + cellSize);
          ctx.lineTo(x + cellSize, y + cellSize);
        }
        // 西边：相邻 (c-1, r)
        if (isWallOrOOB(c - 1, r)) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + cellSize);
        }
        // 东边：相邻 (c+1, r)
        if (isWallOrOOB(c + 1, r)) {
          ctx.moveTo(x + cellSize, y);
          ctx.lineTo(x + cellSize, y + cellSize);
        }
      }
      ctx.stroke();

      // Draw start marker
      ctx.fillStyle = '#ff6644';
      ctx.fillRect(
        offsetX + maze.startCol * cellSize + cellSize * 0.25,
        offsetY + maze.startRow * cellSize + cellSize * 0.25,
        cellSize * 0.5,
        cellSize * 0.5,
      );

      // Draw exit marker (always visible)
      ctx.fillStyle = EXIT_COLOR;
      ctx.shadowColor = EXIT_COLOR;
      ctx.shadowBlur = 6;
      ctx.fillRect(
        offsetX + maze.exitCol * cellSize + cellSize * 0.2,
        offsetY + maze.exitRow * cellSize + cellSize * 0.2,
        cellSize * 0.6,
        cellSize * 0.6,
      );
      ctx.shadowBlur = 0;

      // Draw player (playerX/Z are in world units; convert to cell space)
      const px = offsetX + (playerX / CELL_SCALE) * cellSize;
      const pz = offsetY + (playerZ / CELL_SCALE) * cellSize;

      // Vision cone
      ctx.fillStyle = 'rgba(255, 204, 119, 0.12)';
      ctx.beginPath();
      ctx.moveTo(px, pz);
      const coneRange = Math.PI / 3;
      const coneLen = cellSize * 3;
      ctx.arc(px, pz, coneLen, -playerYaw - Math.PI / 2 - coneRange / 2, -playerYaw - Math.PI / 2 + coneRange / 2);
      ctx.closePath();
      ctx.fill();

      // Player dot
      ctx.fillStyle = '#ffeeaa';
      ctx.shadowColor = '#ffcc77';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(px, pz, cellSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Direction indicator
      const dirAngle = -Math.PI / 2 - playerYaw;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, pz);
      ctx.lineTo(
        px + Math.cos(dirAngle) * cellSize * 0.6,
        pz + Math.sin(dirAngle) * cellSize * 0.6,
      );
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(rafRef.current);
  }, [gameRef]);

  return (
    <div className="minimap-container">
      <canvas
        ref={canvasRef}
        width={MINIMAP_SIZE}
        height={MINIMAP_SIZE}
        className="minimap-canvas"
      />
      <div className="minimap-label">小地图</div>
    </div>
  );
}
