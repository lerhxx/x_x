import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';

const ENVELOPE_URL = '/model/envelope.glb';

export interface EnvelopeProps {
  /** 世界坐标 */
  position: [number, number, number];
  /** 归一化尺寸（最大边长） */
  size?: number;
  /** 绕 Y 轴旋转 */
  rotationY?: number;
  /** 是否开启动画（Z 轴 ±15° 摆动：3 次 → 回正 → 停 1 秒 → 循环） */
  animated?: boolean;
  /** 气泡是否可见（玩家在对应道路格上时 true） */
  showBubble?: boolean;
  /** 阴影 */
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * Envelope：加载 envelope.glb。
 * - 支持位置/尺寸/旋转/动画
 * - 当 showBubble 为 true 时，右上角显示 Html 气泡框，内容为 'E'
 */
export function Envelope({
  position,
  size = 0.3,
  rotationY = 0,
  animated = true,
  showBubble = false,
  castShadow = true,
  receiveShadow = true,
}: EnvelopeProps) {
  const gltf = useGLTF(ENVELOPE_URL);

  const { clonedScene, normalizeScale, offsetY } = useMemo(() => {
    const cloned = (gltf.scene as THREE.Object3D).clone(true) as THREE.Object3D;
    cloned.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(cloned);
    let scale = 1;
    let yOff = 0;
    if (!box.isEmpty()) {
      const s = new THREE.Vector3();
      box.getSize(s);
      const maxDim = Math.max(s.x, Math.max(s.y, s.z));
      if (maxDim > 0) scale = size / maxDim;
      yOff = -box.min.y * scale;
    }
    cloned.traverse((obj) => {
      const maybeMesh = obj as unknown as { isMesh?: boolean };
      if (maybeMesh.isMesh) {
        const m = obj as unknown as THREE.Mesh;
        m.castShadow = castShadow;
        m.receiveShadow = receiveShadow;
      }
    });
    return { clonedScene: cloned, normalizeScale: scale, offsetY: yOff };
  }, [gltf.scene, size, castShadow, receiveShadow]);

  const groupRef = useRef<THREE.Group>(null);

  // 动画时序（循环）：
  //   阶段A：±15° 绕 Z 轴来回摆动 3 次（3 个完整往返，每个往返 = 2*SWING_ONEWAY）
  //   阶段B：回正（angle → 0），耗时 RETURN_DUR
  //   阶段C：停 1 秒，再开始
  const DEG_15 = (15 * Math.PI) / 180;
  const SWING_ONEWAY = 0.15; // 15° → -15° 的单向时间
  const SWING_ROUNDTRIP = SWING_ONEWAY * 2; // 一次往返
  const SWING_ROUNDS = 3;
  const SWING_DUR = SWING_ROUNDTRIP * SWING_ROUNDS;
  const RETURN_DUR = 0.15;
  const PAUSE_DUR = 1.0;
  const CYCLE = SWING_DUR + RETURN_DUR + PAUSE_DUR;

  useFrame((state) => {
    if (!groupRef.current || !animated) return;
    const t = state.clock.elapsedTime;
    const phase = t % CYCLE;

    let angleZ = 0;
    if (phase < SWING_DUR) {
      // 摆动阶段：phaseP ∈ [0, SWING_ROUNDS)
      const phaseP = phase / SWING_ROUNDTRIP;
      // sin(2π * phaseP)：一个往返对应 1 个完整正弦周期（+15→-15→+15）
      angleZ = Math.sin(2 * Math.PI * phaseP) * DEG_15;
    } else if (phase < SWING_DUR + RETURN_DUR) {
      // 回正阶段：从摆动结束值线性回到 0
      // 摆动结束处正好是 3 个完整正弦周期，sin(6π)=0 → 已是 0，这里兜底
      const p = (phase - SWING_DUR) / RETURN_DUR;
      const lastAngle = Math.sin(2 * Math.PI * SWING_ROUNDS) * DEG_15; // 0
      angleZ = lastAngle * (1 - p);
    } else {
      angleZ = 0;
    }

    groupRef.current.position.y = yOffRef.current;
    groupRef.current.rotation.y = baseRotRef.current;
    groupRef.current.rotation.z = angleZ;
  });

  const yOffRef = useRef(0);
  const baseRotRef = useRef(0);
  yOffRef.current = offsetY;
  baseRotRef.current = rotationY;

  // 右上角气泡框：纯 HTML 元素，背景 bubble.png，文字 E
  const bubbleSize = Math.max(0.22, size * 0.8);

  return (
    <group position={position}>
      <group ref={groupRef} scale={normalizeScale}>
        <primitive object={clonedScene} />
      </group>

      {/* 右上角气泡框：纯 HTML 元素，背景 bubble.png，文字 E */}
      {showBubble && (
        <Html
          transform
          occlude
          distanceFactor={3}
          position={[size * 0.6, size * 0.9, -size * 0.2]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'relative',
              width: 12,
              height: 12,
              backgroundImage: 'url(/bubble.png)',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.5))',
              userSelect: 'none',
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 4,
                color: '#000000',
                fontFamily:
                  '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
                textShadow: '0 1px 2px rgba(255,255,255,0.8)',
                marginLeft: 1,
                marginTop: -1,
              }}
            >
              E
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

export default Envelope;
