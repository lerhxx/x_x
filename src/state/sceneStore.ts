import { useEffect, useState } from 'react';
import { descriptions } from '../utils/descriptions';

/** 描述 id（作为 key） */
export type DescriptionId = keyof typeof descriptions;

/** 场景注册表：每个场景占用哪些道路单元格 key，以及其描述 id */
export interface SceneRegistration {
  id: DescriptionId;
  /** 场景占用的道路单元格 key 集合（"c,r"）。玩家进入任一道路格即可触发气泡。 */
  pathCellKeys: Set<string>;
}

/** 全局 store：用单例模式模拟，不引入 zustand。 */
class SceneState {
  /** 当前气泡对应的道路单元格 key（玩家在哪个场景的道路格上） */
  activeSceneId: DescriptionId | null = null;
  /** 弹窗当前打开的描述 id */
  openId: DescriptionId | null = null;
  /** 所有注册场景 */
  private registrations: Map<DescriptionId, SceneRegistration> = new Map();
  /** 道路 key → 场景 id 的反查表 */
  private keyToId: Map<string, DescriptionId> = new Map();

  /** 订阅者 */
  private subs: Set<() => void> = new Set();
  subscribe(fn: () => void) {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  }
  private notify() {
    this.subs.forEach((s) => s());
  }

  /** 注册一个场景 */
  register(reg: SceneRegistration) {
    this.registrations.set(reg.id, reg);
    reg.pathCellKeys.forEach((k) => this.keyToId.set(k, reg.id));
  }

  /** 取消注册 */
  unregister(id: DescriptionId) {
    const reg = this.registrations.get(id);
    if (reg) {
      reg.pathCellKeys.forEach((k) => this.keyToId.delete(k));
    }
    this.registrations.delete(id);
  }

  /** 玩家进入道路格：更新 activeSceneId */
  setPlayerCell(cellKey: string | null) {
    const id = cellKey ? this.keyToId.get(cellKey) ?? null : null;
    if (id !== this.activeSceneId) {
      this.activeSceneId = id;
      this.notify();
    }
  }

  /** 打开弹窗 */
  openDescription(id: DescriptionId) {
    this.openId = id;
    this.notify();
  }

  /** 关闭弹窗 */
  closeDescription() {
    this.openId = null;
    this.notify();
  }
}

export const sceneState = new SceneState();

/** 读取 store 的 hook（会在变化时重渲染） */
export function useSceneState() {
  const [, force] = useState(0);
  useEffect(() => sceneState.subscribe(() => force((x) => x + 1)), []);
  return sceneState;
}

/** 某个场景的气泡 hook：返回 showBubble（弹窗打开时隐藏气泡） */
export function useSceneBubble(id: DescriptionId): boolean {
  const s = useSceneState();
  return s.activeSceneId === id && s.openId === null;
}

/**
 * 根据世界坐标更新 store 中的玩家道路格。
 * 每帧调用（在 Player 中 useFrame）。
 */
export function updatePlayerPathCell(
  worldX: number,
  worldZ: number,
  cellScale: number,
  isPath: (c: number, r: number) => boolean,
) {
  const c = Math.floor(worldX / cellScale);
  const r = Math.floor(worldZ / cellScale);
  if (isPath(c, r)) {
    sceneState.setPlayerCell(`${c},${r}`);
  } else {
    sceneState.setPlayerCell(null);
  }
}
