import * as THREE from 'three';
import { WALL_HEIGHT } from '../constants/wall';
import { EnvelopeLine } from './EnvelopeLine';

export interface LightBeamProps {
  position: [number, number, number];
  /** 顶部半径 */
  radiusTop?: number;
  /** 底部半径 */
  radiusBottom?: number;
  /** 光柱高度，默认为 WALL_HEIGHT */
  height?: number;
  /** 是否在光柱中心显示粉色粒子信封（相机触发汇聚/散开），默认 true */
  envelope?: boolean;
}

/**
 * 垂直光柱 + 地面发光圆环：白色
 * 可选：光柱中心悬浮粉色粒子信封（EnvelopeLine），
 * 相机进入视野时汇聚、经过时散开、离开后重聚。
 */
export function LightBeam({
  position,
  radiusTop = 0.3,
  radiusBottom = 0.3,
  height = WALL_HEIGHT,
  envelope = true,
}: LightBeamProps) {
  return (
    <group position={position}>
      {/* Glowing ring on the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[radiusBottom, radiusBottom * 0.12, 8, 32]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.2}
          roughness={0.3}
        />
      </mesh>

      {/* Vertical light beam */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radiusTop, radiusBottom, height, 16, 1, true]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.6}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 粒子信封：悬浮在光柱顶部上方（墙顶以上，避免被迷宫墙遮挡），无浮动
          光柱进入相机前方视野 → 汇聚成信封；移出视野 → 散开
          宽度 = 地面发光环直径的一半（radiusBottom），与环呼应 */}
      {envelope && (
        // <EnvelopeLine 
        //   position={[0, height + 0.6, 0]} 
        //   size={radiusBottom} 
        //   maxCount={3500} 
        // />
        <EnvelopeLine 
          svgUrl='/envelope.svg'
        />
      )}
    </group>
  );
}

export default LightBeam;
