import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import * as THREE from 'three';

// 组件参数
interface MorphParticlesProps {
  svgUrl: string;       // SVG 文件路径
  particleCount?: number; // 粒子总数（建议 2000-8000）
  spreadRadius?: number;  // 粒子初始扩散半径
  speed?: number;         // 汇聚速度 (0.01 - 0.05)
  position?: [number, number, number]; // 组件位置偏移
}

const TARGET_WIDTH = 0.1; // 目标宽度：0.6 个单元格

export const EnvelopeLine: React.FC<MorphParticlesProps> = ({
  svgUrl,
  particleCount = 2000,
  spreadRadius = 3,
  speed = 0.025,
  position = [0, 1, 0],
}) => {
  const pointsRef = useRef<THREE.Points>(null!);
  
  // 存储目标位置和每个粒子的自定义速度倍率
  const targetRef = useRef<Float32Array>(new Float32Array(particleCount * 3));
  const speedFactorRef = useRef<Float32Array>(new Float32Array(particleCount));

  // ---------- 1. 加载 SVG 并提取目标轮廓点 ----------
  useEffect(() => {

    const loader = new SVGLoader();
    loader.load(svgUrl, (data) => {
      const targetPositions: number[] = [];
      const extractedPoints: { x: number; y: number }[] = [];

      // ShapePath 没有直接的 getPoints()，需要通过 subPaths 遍历每个子 Path
      data.paths.forEach((shapePath: any) => {
        if (!shapePath.subPaths) return;
        shapePath.subPaths.forEach((subPath: any) => {
          const pts = subPath.getPoints(200);
          pts.forEach((p: any) => {
            extractedPoints.push({ x: p.x, y: p.y });
          });
        });
      });

      if (extractedPoints.length === 0) return;

      // 计算包围盒，用于居中 + 等比缩放
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      extractedPoints.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const bboxW = maxX - minX;

      // 以宽度为基准缩放到 TARGET_WIDTH，保持宽高比
      const scale = bboxW > 0 ? TARGET_WIDTH / bboxW : 1;

      // 均匀采样到 particleCount 个点
      const total = extractedPoints.length;
      for (let i = 0; i < particleCount; i++) {
        const idx = Math.floor((i / particleCount) * total);
        const p = extractedPoints[idx];
        const x = (p.x - centerX) * scale;
        const y = -(p.y - centerY) * scale;
        targetPositions.push(x, y, 0);
      }

      targetRef.current = new Float32Array(targetPositions);
      // ---------- 2. 初始化粒子位置：四周随机散布 ----------
      const positions = pointsRef.current.geometry.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        // 球体表面随机分布
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = spreadRadius * Math.cbrt(Math.random());

        positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
        positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
        positions[i * 3 + 2] = Math.cos(phi) * r * 0.6;

        // 随机速度倍率 (0.3 ~ 1.0)，制造交错汇聚效果
        speedFactorRef.current[i] = 0.3 + Math.random() * 0.7;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });
  }, [svgUrl, particleCount, spreadRadius]);

  // ---------- 3. 动画循环：插值汇聚 ----------
  useFrame(() => {
    if (!pointsRef.current) return;
    
    const positions = pointsRef.current.geometry.attributes.position.array;
    const targets = targetRef.current;
    const factors = speedFactorRef.current;

    for (let i = 0; i < positions.length; i++) {
      // 每个粒子独立速度 = 基础速度 * 随机倍率
      const step = speed * factors[Math.floor(i / 3)];
      // 当前位置向目标位置插值
      positions[i] += (targets[i] - positions[i]) * step;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  // ---------- 4. 渲染粒子 ----------
  return (
    <points ref={pointsRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(particleCount * 3), 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.01}
        color="#00aaff"
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending} // 叠加混合让轮廓更亮
        depthWrite={false}
      />
    </points>
  );
};