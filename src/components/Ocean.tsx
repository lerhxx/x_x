import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useControls } from 'leva';
import { OCEAN_DEBUG } from '../constants/global';

/**
 * Ocean：在迷宫四周渲染海洋效果。
 * 基于 Voronoi shader，蓝色海面 + 波纹动画。
 *
 * Props:
 *   width, height: 迷宫宽高（单元格数），用于计算海洋平面尺寸和位置
 *   margin: 海洋超出迷宫边界的距离（世界单位）
 */
export interface OceanProps {
  width: number;
  height: number;
  margin?: number;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform vec2  u_resolution;
  uniform float u_time;
  uniform float u_scale;
  uniform vec3  u_deepColor;
  uniform vec3  u_shallowColor;
  uniform vec3  u_foamColor;
  uniform float u_foamThreshold;
  uniform float u_foamStrength;

  varying vec2 vUv;

  vec2 random2(vec2 p) {
    return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
  }

  void main() {
    vec2 st = vUv;
    st.x *= u_resolution.x / u_resolution.y;

    vec3 color = vec3(0.0);

    // Scale
    st *= u_scale;

    // Tile the space
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float m_dist = 1.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 neighbor = vec2(float(i), float(j));
        vec2 offset = random2(i_st + neighbor);
        offset = 0.5 + 0.5 * sin(u_time + 6.2831 * offset) * 0.7;
        vec2 pos = neighbor + offset - f_st;
        float dist = length(pos);
        m_dist = min(m_dist, m_dist * dist);
      }
    }

    // 根据距离混合深浅
    float depth = smoothstep(0.0, 0.45, m_dist);
    color = mix(u_shallowColor, u_deepColor, depth);

    // 白色泡沫（metaball 边缘）
    float foam = 1.0 - step(u_foamThreshold, m_dist);
    color = mix(color, u_foamColor, foam * u_foamStrength);

    gl_FragColor = vec4(color, 1.0);
  }
`;

/** 默认颜色 */
const DEFAULT_DEEP = '#16b3d8';
const DEFAULT_SHALLOW = '#42c7e5';
const DEFAULT_FOAM = '#68cbe2';

export function Ocean({ width, height, margin = 15 }: OceanProps) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const mazeW = width * 1;  // CELL_SCALE = 1
  const mazeH = height * 1;
  const planeW = mazeW + margin * 2;
  const planeH = mazeH + margin * 2;

  // Leva 调试面板
  const ocean = useControls(
    'Ocean 调试',
    OCEAN_DEBUG
      ? {
          deepColor: { value: DEFAULT_DEEP, label: '深水' },
          shallowColor: { value: DEFAULT_SHALLOW, label: '浅水' },
          foamColor: { value: DEFAULT_FOAM, label: '泡沫' },
          scale: { value: 10.0, min: 1, max: 20, step: 0.5, label: '波纹密度' },
          foamThreshold: { value: 0.150, min: 0.01, max: 0.2, step: 0.005, label: '泡沫阈值' },
          foamStrength: { value: 0.3, min: 0, max: 1, step: 0.05, label: '泡沫强度' },
        }
      : {},
    [],
  ) as {
    deepColor: string;
    shallowColor: string;
    foamColor: string;
    scale: number;
    foamThreshold: number;
    foamStrength: number;
  };

  const uniforms = useMemo(
    () => ({
      u_resolution: { value: new THREE.Vector2(planeW, planeH) },
      u_time: { value: 0 },
      u_scale: { value: 6.0 },
      u_deepColor: { value: new THREE.Color(DEFAULT_DEEP) },
      u_shallowColor: { value: new THREE.Color(DEFAULT_SHALLOW) },
      u_foamColor: { value: new THREE.Color(DEFAULT_FOAM) },
      u_foamThreshold: { value: 0.060 },
      u_foamStrength: { value: 0.5 },
    }),
    [planeW, planeH],
  );

  useFrame((state) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    (u.u_time as { value: number }).value = state.clock.elapsedTime;
    if (OCEAN_DEBUG) {
      (u.u_deepColor.value as THREE.Color).set(ocean.deepColor);
      (u.u_shallowColor.value as THREE.Color).set(ocean.shallowColor);
      (u.u_foamColor.value as THREE.Color).set(ocean.foamColor);
      (u.u_scale as { value: number }).value = ocean.scale;
      (u.u_foamThreshold as { value: number }).value = ocean.foamThreshold;
      (u.u_foamStrength as { value: number }).value = ocean.foamStrength;
    }
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[(mazeW / 2), -0.02, (mazeH / 2)]}
    >
      <planeGeometry args={[planeW, planeH]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default Ocean;
