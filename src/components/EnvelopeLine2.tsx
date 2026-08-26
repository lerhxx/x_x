import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as THREE from 'three';

/* ============================================================
 * EnvelopeLine2 — 粉色信封粒子线框（GLSL 版）
 *
 * 信封形状直接硬编码为 SVG 字符串，同步解析提取轮廓点。
 * 加载后粒子直接汇聚成信封形状，无散开→汇聚动画。
 * ============================================================ */

// ---------- 硬编码 SVG 信封形状（来自 public/envelope.svg） ----------

const ENVELOPE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 980" preserveAspectRatio="xMidYMid meet">
<g transform="translate(0,980) scale(0.1,-0.1)" fill="#000000" stroke="none">
<path d="M2236 7079 c-121 -18 -236 -92 -303 -196 -68 -106 -64 32 -61 -2089 l3 -1919 24 -60 c18 -44 42 -78 90 -126 73 -73 144 -111 235 -128 81 -15 5889 -16 5967 -1 124 24 241 104 299 205 64 113 61 -20 58 2081 l-3 1909 -22 55 c-49 119 -147 210 -273 253 l-65 22 -2945 1 c-1626 1 -2972 -2 -3004 -7z m5952 -193 l33 -12 -33 -30 c-18 -16 -217 -196 -443 -399 -225 -203 -475 -428 -555 -501 -80 -72 -271 -245 -425 -384 -305 -276 -426 -386 -579 -527 -55 -51 -103 -93 -106 -93 -3 0 -21 28 -40 62 -52 90 -136 170 -227 215 -76 37 -79 38 -192 38 -101 0 -123 -3 -171 -24 -71 -32 -157 -85 -196 -123 l-31 -29 -72 46 c-222 143 -420 163 -579 58 -64 -43 -113 -101 -161 -193 l-37 -69 -94 86 c-52 47 -115 104 -140 127 -25 23 -117 106 -205 186 -88 79 -200 180 -250 225 -49 45 -229 207 -400 360 -170 153 -348 313 -395 355 -47 43 -218 196 -380 340 -162 145 -296 267 -298 271 -2 5 9 11 25 15 15 3 33 7 38 9 6 2 1331 3 2945 3 2260 0 2943 -2 2968 -12z m-5763 -461 c154 -137 305 -273 335 -301 30 -28 185 -167 345 -310 655 -585 1155 -1040 1155 -1049 0 -3 -344 -299 -1370 -1180 -294 -253 -597 -513 -674 -578 -106 -92 -140 -117 -147 -106 -10 16 -13 3822 -3 3832 4 4 23 -8 43 -26 20 -17 162 -144 316 -282z m5935 -1600 c0 -1263 -3 -1903 -10 -1921 l-10 -26 -48 43 c-26 24 -83 76 -127 115 -44 39 -172 154 -285 255 -113 101 -329 294 -480 429 -151 134 -297 265 -325 291 -27 25 -122 111 -210 189 -88 79 -259 231 -379 339 -120 108 -232 208 -249 222 -18 15 -27 30 -23 37 7 12 374 350 566 522 52 47 97 87 100 91 8 8 489 443 998 902 255 230 467 415 473 412 5 -4 9 -735 9 -1900z m-3433 195 c74 -26 149 -72 235 -143 l69 -58 73 68 c84 79 148 116 236 139 152 39 284 -26 361 -176 34 -67 38 -186 10 -279 -48 -158 -260 -410 -584 -696 l-88 -77 -57 43 c-218 164 -470 422 -574 584 -96 152 -116 247 -75 357 83 217 219 300 394 238z m1624 -791 c748 -670 1032 -924 1043 -934 6 -6 74 -66 151 -135 77 -69 187 -168 245 -220 58 -52 129 -116 157 -141 l52 -47 -31 -6 c-48 -10 -5921 -7 -5937 3 -17 11 -73 -39 669 598 498 427 1170 1005 1280 1099 14 12 54 47 90 77 l65 56 26 -79 c78 -235 292 -472 704 -782 113 -84 135 -98 163 -98 11 0 80 48 154 107 443 354 684 629 729 830 11 47 14 52 28 40 9 -8 194 -173 412 -368z"/>
</g>
</svg>`;

// ---------- PRNG ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 粒子数据 ----------

interface ParticleData {
  count: number;
  worldW: number;
  worldH: number;
  positions: Float32Array;
  targets: Float32Array;
  randoms: Float32Array;
}

// 模块级缓存：同一 maxCount 只构建一次
const dataCache = new Map<number, ParticleData>();

/** 同步解析硬编码 SVG，提取轮廓点，构建粒子数据 */
function buildEnvelopeData(maxCount: number): ParticleData {
  const loader = new SVGLoader();
  const data = loader.parse(ENVELOPE_SVG);

  // 先收集所有子路径及其长度，按长度等比分配采样点
  const subPathData: { subPath: any; length: number }[] = [];
  data.paths.forEach((shapePath: any) => {
    if (!shapePath.subPaths) return;
    shapePath.subPaths.forEach((subPath: any) => {
      const pts = subPath.getPoints(200);
      // 计算子路径长度
      let len = 0;
      for (let i = 1; i < pts.length; i++) {
        const dx = pts[i].x - pts[i - 1].x;
        const dy = pts[i].y - pts[i - 1].y;
        len += Math.sqrt(dx * dx + dy * dy);
      }
      subPathData.push({ subPath, length: len });
    });
  });

  const totalLength = subPathData.reduce((s, d) => s + d.length, 0);
  const TOTAL_SAMPLES = 120; // 总采样点数
  const rawPoints: { x: number; y: number }[] = [];
  for (const { subPath, length } of subPathData) {
    const n = Math.max(2, Math.round((length / totalLength) * TOTAL_SAMPLES));
    const pts = subPath.getPoints(n);
    pts.forEach((p: any) => {
      rawPoints.push({ x: p.x, y: p.y });
    });
  }

  // 按最小间距去重，保证整条轮廓密度均匀
  const MIN_DIST_SQ = 80; // SVG 坐标系下的最小间距平方
  const extractedPoints: { x: number; y: number }[] = [];
  for (const p of rawPoints) {
    let tooClose = false;
    for (const q of extractedPoints) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      if (dx * dx + dy * dy < MIN_DIST_SQ) { tooClose = true; break; }
    }
    if (!tooClose) extractedPoints.push(p);
  }

  if (extractedPoints.length === 0) {
    throw new Error('SVG 解析未提取到轮廓点');
  }

  // 包围盒
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const p of extractedPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  // 归一化到宽度 = 1，居中
  const scale = 1 / bboxW;
  const worldW = 1;
  const worldH = bboxH * scale;

  const rnd = mulberry32(1337);
  const total = extractedPoints.length;

  const positions: number[] = [];
  const targets: number[] = [];
  const randoms: number[] = [];

  for (let i = 0; i < maxCount; i++) {
    const idx = Math.floor((i / maxCount) * total);
    const p = extractedPoints[idx];

    // 目标位置（汇聚态）：归一化 + 居中 + Y 轴反转
    const tx = (p.x - centerX) * scale;
    const ty = -(p.y - centerY) * scale;
    const tz = 0;
    targets.push(tx, ty, tz);

    // position 直接等于 target（加载即汇聚）
    positions.push(tx, ty, tz);

    randoms.push(rnd());
  }

  return {
    count: maxCount,
    worldW,
    worldH,
    positions: new Float32Array(positions),
    targets: new Float32Array(targets),
    randoms: new Float32Array(randoms),
  };
}

// ---------- GLSL Shader ----------

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;

  attribute vec3 aTarget;
  attribute vec3 aColor;
  attribute float aRandom;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = aTarget;

    // 微浮动
    // float breathe = sin(uTime * 1.6 + aRandom * 6.2831);
    // pos += vec3(breathe, breathe * 0.7, breathe) * 0.004;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = uSize * (0.45 + aRandom * 0.9) * uPixelRatio * (240.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor;
    vAlpha = 1.0;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);

    float core = 1.0 - smoothstep(0.15, 0.25, d);
    float glow = exp(-d * 18.0) * 0.10;
    float alpha = (core + glow) * vAlpha;
    if (alpha < 0.004) discard;

    vec3 col = vColor * (0.5 + glow);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ---------- 组件 ----------

export interface EnvelopeLineProps {
  /** 世界坐标（信封中心基准点） */
  position?: [number, number, number];
  /** 世界尺寸（最大边长），默认 0.6 个单元格 */
  size?: number;
  /** 粒子上限 */
  maxCount?: number;
  /** 主色（默认粉色） */
  color?: string;
}

export function EnvelopeLine({
  position = [0, 0, 0],
  size = 0.15,
  maxCount = 4000,
  color = '#ff8cc8',
}: EnvelopeLineProps) {
  const groupRef = useRef<THREE.Group>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  const baseColor = useMemo(() => new THREE.Color(color), [color]);

  // 1) 同步构建粒子数据（模块级缓存）
  const data = useMemo(() => {
    const cached = dataCache.get(maxCount);
    if (cached) return cached;
    const d = buildEnvelopeData(maxCount);
    dataCache.set(maxCount, d);
    return d;
  }, [maxCount]);

  // 2) geometry：归一化到 size + 粉色明暗
  const geometry = useMemo(() => {
    geometryRef.current?.dispose();
    const g = new THREE.BufferGeometry();

    const norm = size / Math.max(data.worldW, data.worldH);
    const positions = new Float32Array(data.positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = data.positions[i] * norm;
      positions[i + 1] = data.positions[i + 1] * norm;
      positions[i + 2] = data.positions[i + 2] * norm;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aTarget', new THREE.BufferAttribute(positions, 3));

    const colors = new Float32Array(data.count * 3);
    for (let i = 0; i < data.count; i++) {
      // const shade = 0.82 + 0.36 * data.randoms[i];
      const shade = 0.82 + 0.36 * data.randoms[i];
      colors[i * 3] = baseColor.r * shade;
      colors[i * 3 + 1] = baseColor.g * shade;
      colors[i * 3 + 2] = baseColor.b * shade;
    }
    g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('aRandom', new THREE.BufferAttribute(data.randoms, 1));

    geometryRef.current = g;
    return g;
  }, [data, size, baseColor]);

  // 3) material
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0.03 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
    });
    materialRef.current = m;
    return m;
  }, []);

  // 卸载时释放 GPU 资源
  useEffect(() => {
    return () => {
      geometryRef.current?.dispose();
      materialRef.current?.dispose();
    };
  }, []);

  // 4) 仅更新 uTime
  useFrame((state) => {
    const u = materialRef.current?.uniforms;
    if (u) u.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group ref={groupRef} position={position}>
      {geometry && material && <points geometry={geometry} material={material} />}
    </group>
  );
}

export default EnvelopeLine;
