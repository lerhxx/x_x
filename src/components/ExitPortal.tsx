import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WALL_HEIGHT } from '../constants/wall';
import { EXIT_COLOR } from '../constants/flag';

export interface ExitPortalProps {
  x: number;
  z: number;
}

function useFrameAnimation(
  ringRef: React.RefObject<THREE.Mesh | null>,
  innerRef: React.RefObject<THREE.Mesh | null>,
) {
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.8;
      const pulse = 1 + Math.sin(t * 2.5) * 0.08;
      ringRef.current.scale.setScalar(pulse);
    }
    if (innerRef.current) {
      const pulse = 0.5 + Math.sin(t * 3) * 0.15;
      innerRef.current.scale.setScalar(pulse);
      (innerRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.8 + Math.sin(t * 3) * 0.3;
    }
  });
}

export function ExitPortal({ x, z }: ExitPortalProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);

  useFrameAnimation(ringRef, innerRef);

  return (
    <group position={[x, 0, z]}>
      {/* Glowing ring on the floor */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <torusGeometry args={[0.32, 0.04, 8, 32]} />
        <meshStandardMaterial
          color={EXIT_COLOR}
          emissive={EXIT_COLOR}
          emissiveIntensity={1.2}
          roughness={0.3}
        />
      </mesh>

      {/* Inner glow disc */}
      <mesh ref={innerRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.28, 24]} />
        <meshStandardMaterial
          color={EXIT_COLOR}
          emissive={EXIT_COLOR}
          emissiveIntensity={0.8}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Vertical light beam */}
      <mesh position={[0, WALL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.3, WALL_HEIGHT, 16, 1, true]} />
        <meshStandardMaterial
          color={EXIT_COLOR}
          emissive={EXIT_COLOR}
          emissiveIntensity={0.6}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      <directionalLight position={[10, 10, 10]} />
    </group>
  );
}

export default ExitPortal;
