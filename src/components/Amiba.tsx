import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Sparkles, Text } from '@react-three/drei'
import { CELL_SCALE } from '../constants/global'
import { buildDigitGeometry, materialProps, Crystals } from './LowPoly'
import { EnvelopeLine } from './EnvelopeLine'
import { SceneFence } from './Fence'
import {
  sceneState,
  useSceneBubble,
  type DescriptionId,
} from '../state/sceneStore';

// ---------- 数字轮廓（手工多边形，无字体依赖） ----------
type Pt = [number, number]

// "1"：竖笔 + 左上小旗
const DIGIT_ONE: Pt[] = [
  [0.28, 2.1],
  [-0.28, 2.1],
  [-0.82, 1.6],
  [-0.52, 1.34],
  [-0.28, 1.56],
  [-0.28, 0.0],
  [0.28, 0.0],
]

// "7"：顶横杠 + 斜腿
const DIGIT_SEVEN: Pt[] = [
  [-0.82, 2.1],
  [0.82, 2.1],
  [0.82, 1.72],
  [0.2, 0.0],
  [-0.34, 0.0],
  [0.16, 1.72],
  [-0.82, 1.72],
]

export interface AmibaProps {
  position: [number, number, number];
  size?: number;
  rotationY?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  label?: string;
  descriptionId?: DescriptionId;
  pathCells?: Array<{ c: number; r: number }>;
}

export function Amiba({
  position,
  size = 1,
  rotationY = 0,
  castShadow = true,
  receiveShadow = true,
  label,
  descriptionId = 'amiba',
  pathCells,
}: AmibaProps) {
  const group = useRef<THREE.Group>(null)
  const one = useMemo(() => buildDigitGeometry(DIGIT_ONE, { seed: 11 }), [])
  const seven = useMemo(() => buildDigitGeometry(DIGIT_SEVEN, { seed: 77 }), [])

  useEffect(() => {
    if (!pathCells || pathCells.length === 0) return;
    const keySet = new Set(pathCells.map(({ c, r }) => `${c},${r}`));
    sceneState.register({ id: descriptionId, pathCellKeys: keySet });
    return () => sceneState.unregister(descriptionId);
  }, [descriptionId, pathCells]);

  useSceneBubble(descriptionId);

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (!group.current) return
    group.current.rotation.y = Math.sin(t * 0.35) * 0.22
    group.current.rotation.x = Math.sin(t * 0.22) * 0.05
  })

  const digitScale = size * 0.16;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group ref={group} position={[0, size * 0.25, 0]} scale={digitScale}>
        <Sparkles count={70} scale={[5, 3, 3]} size={1.5} speed={0.05} color="#FF8C42" opacity={0.65} />
        <mesh geometry={one} position={[-0.9, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh geometry={seven} position={[0.9, 0, 0]} castShadow={castShadow} receiveShadow={receiveShadow}>
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <Crystals />
      </group>

      {label && (
        <Text
          position={[-size / 2 - CELL_SCALE * 0.1, size * 0.25, 0]}
          fontSize={CELL_SCALE * 0.15}
          color="#ff8c00"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#333333"
        >
          {label}
        </Text>
      )}

      <EnvelopeLine
        svgUrl='/envelope.svg'
        position={[0.5, 0, 0.5]}
      />

      <SceneFence cellSize={CELL_SCALE} castShadow={castShadow} receiveShadow={receiveShadow} />
    </group>
  )
}

export default Amiba;
