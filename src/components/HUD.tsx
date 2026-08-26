import { useEffect, useRef, useState } from 'react';
import type { GameRef } from '../game/types';
import { Minimap } from './Minimap';

interface HUDProps {
  gameRef: React.MutableRefObject<GameRef>;
  isPlaying: boolean;
  startTime: number | null;
}

export function HUD({ gameRef, isPlaying, startTime }: HUDProps) {
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number>(0);

  useEffect(() => {
    if (!isPlaying || startTime === null) return;

    const updateTimer = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
      timerRef.current = window.setTimeout(updateTimer, 1000);
    };
    updateTimer();

    return () => clearTimeout(timerRef.current);
  }, [isPlaying, startTime]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="hud">
      {/* Timer */}
      <div className="hud-timer">
        <span className="hud-timer-icon">⏱</span>
        <span className="hud-timer-value">{formatTime(elapsed)}</span>
      </div>

      {/* Minimap */}
      <Minimap gameRef={gameRef} />

      {/* Controls hint */}
      <div className="hud-controls">
        <div className="hud-controls-title">操作说明</div>
        <div className="hud-controls-grid">
          <span className="key">W A S D</span>
          <span>移动</span>
          <span className="key">鼠标</span>
          <span>视角（点击画面锁定）</span>
          <span className="key">← →</span>
          <span>转向</span>
          <span className="key">↑ ↓</span>
          <span>俯仰视角</span>
          <span className="key">Esc</span>
          <span>释放鼠标</span>
          <span className="key">E</span>
          <span>打开信封</span>
        </div>
      </div>

      {/* Goal hint */}
      <div className="hud-goal">
        🎯 找到 <span className="hud-goal-exit">绿色传送门</span> 逃出迷宫
      </div>
    </div>
  );
}
