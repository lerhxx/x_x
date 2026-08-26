import { useEffect, useState } from 'react';
import type { Difficulty, MazeData } from './game/types';
import { generateMaze } from './game/mazeGenerator';
import { DIFFICULTY_SIZES, DIFFICULTY_LABELS } from './constants/global';
import { MazeGame } from './components/Game';
// import { MazeGame } from './components/old/MazeGame';
import './App.css';

interface BestRecord {
  seconds: number;
  date: string;
}

function App() {
  const [status, setStatus] = useState<'menu' | 'playing' | 'won'>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [maze, setMaze] = useState<MazeData | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [bestRecords, setBestRecords] = useState<Record<Difficulty, BestRecord | null>>({
    easy: null,
    medium: null,
    hard: null,
  });

  const startGame = (diff: Difficulty = 'easy') => {
    const { w, h } = DIFFICULTY_SIZES[diff];
    setDifficulty(diff);
    setMaze(generateMaze(w, h));
    setStatus('playing');
  };

  const handleWin = (elapsed: number) => {
    setResult(elapsed);
    setStatus('won');

    // Update best record
    setBestRecords((prev) => {
      const current = prev[difficulty];
      if (!current || elapsed < current.seconds) {
        return {
          ...prev,
          [difficulty]: { seconds: elapsed, date: new Date().toLocaleDateString('zh-CN') },
        };
      }
      return prev;
    });
  };

  const backToMenu = () => {
    setStatus('menu');
    setMaze(null);
    setResult(null);
  };

  useEffect(() => {
    startGame();
  }, [])

  return (
    <div className="app">
      {status === 'menu' && (
        <MenuScreen
          onStart={startGame}
          bestRecords={bestRecords}
        />
      )}

      {status === 'playing' && maze && (
         <MazeGame maze={maze} onWin={handleWin} />
      )}

      {status === 'won' && result !== null && (
        <WinScreen
          elapsed={result}
          difficulty={difficulty}
          bestRecord={bestRecords[difficulty]}
          onPlayAgain={() => startGame(difficulty)}
          onMenu={backToMenu}
        />
      )}
    </div>
  );
}

// ===== Menu Screen =====

function MenuScreen({
  onStart,
  bestRecords,
}: {
  onStart: (diff: Difficulty) => void;
  bestRecords: Record<Difficulty, BestRecord | null>;
}) {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="menu-screen">
      <div className="menu-content">
        <div className="menu-title">
          <span className="menu-title-icon">🌀</span>
          <h1>迷 宫 探 险</h1>
          <p className="menu-subtitle">MAZE ESCAPE · 3D 第一人称迷宫</p>
        </div>

        <div className="menu-difficulty">
          <h2>选择难度</h2>
          {(Object.keys(DIFFICULTY_SIZES) as Difficulty[]).map((diff) => {
            const record = bestRecords[diff];
            return (
              <button
                key={diff}
                className="menu-btn"
                onClick={() => onStart(diff)}
              >
                <span className="menu-btn-name">{DIFFICULTY_LABELS[diff]}</span>
                <span className="menu-btn-record">
                  {record ? `最佳: ${formatTime(record.seconds)}` : '暂无记录'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="menu-rules">
          <h2>玩法说明</h2>
          <ul>
            <li>🔴 你从 <b>红色起点</b> 出发</li>
            <li>🟢 找到对角的 <b>绿色传送门</b> 即可获胜</li>
            <li>🗺️ 小地图只显示你走过的区域</li>
            <li>⌨️ WASD 移动 · 鼠标视角 · 方向键备用</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ===== Win Screen =====

function WinScreen({
  elapsed,
  difficulty,
  bestRecord,
  onPlayAgain,
  onMenu,
}: {
  elapsed: number;
  difficulty: Difficulty;
  bestRecord: BestRecord | null;
  onPlayAgain: () => void;
  onMenu: () => void;
}) {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isNewRecord = bestRecord && bestRecord.seconds === elapsed;

  return (
    <div className="win-screen">
      <div className="win-content">
        <div className="win-icon">🏆</div>
        <h1>成功逃脱！</h1>
        <div className="win-stats">
          <div className="win-stat">
            <span className="win-stat-label">用时</span>
            <span className="win-stat-value">{formatTime(elapsed)}</span>
          </div>
          <div className="win-stat">
            <span className="win-stat-label">难度</span>
            <span className="win-stat-value">{DIFFICULTY_LABELS[difficulty]}</span>
          </div>
          <div className="win-stat">
            <span className="win-stat-label">最佳</span>
            <span className="win-stat-value">
              {bestRecord ? formatTime(bestRecord.seconds) : '--:--'}
            </span>
          </div>
        </div>
        {isNewRecord && <div className="win-new-record">✨ 新纪录！</div>}
        <div className="win-actions">
          <button className="win-btn primary" onClick={onPlayAgain}>
            再来一局
          </button>
          <button className="win-btn" onClick={onMenu}>
            返回菜单
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
