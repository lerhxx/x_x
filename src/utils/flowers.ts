import * as THREE from 'three';
import { WALL_HEIGHT, WALL_THICKNESS } from '../constants/wall';

export interface WallSegmentLike {
  x: number;
  z: number;
  len: number;
}

/**
 * A flower decoration that sits on top of a hedge.
 * Multiple flowers are baked into one InstancedMesh per draw call.
 */
export interface FlowerInstance {
  position: THREE.Vector3;
  scale: number;
  color: THREE.Color;
}

// ROSE / wild-flower palette: pink, red, white, yellow
const FLOWER_PALETTE = [
  new THREE.Color('#e84a5f'),  // hot red
  new THREE.Color('#ff6e87'),  // pink
  new THREE.Color('#ffd2dc'),  // pale pink
  new THREE.Color('#ffffff'),  // white
  new THREE.Color('#ffec6e'),  // yellow
  new THREE.Color('#f0a93a'),  // amber
  new THREE.Color('#c64282'),  // magenta
];

/**
 * Scatter flowers along the top of walls.  Returns deterministic-ish positions
 * (seeded by wall length + index) so that walls look the same between renders
 * but still give the impression of organic distribution.
 */
export function generateFlowers(
  horizontalWalls: WallSegmentLike[],
  verticalWalls: WallSegmentLike[],
  densityPerUnit: number = 0.45,
  topOffset: number = 0.0,
): FlowerInstance[] {
  const flowers: FlowerInstance[] = [];

  const placeAlong = (
    walls: WallSegmentLike[],
    type: 'H' | 'V',
  ) => {
    walls.forEach((wall, wallIdx) => {
      const count = Math.max(1, Math.round(wall.len * densityPerUnit));
      for (let i = 0; i < count; i++) {
        // Pseudo-random based on (wallIdx, i) so identical walls give identical flowers
        const seed = (wallIdx * 73856093) ^ (i * 19349663);
        const rng = mulberry32(seed >>> 0);

        const t = (i + rng() * 0.5) / count; // along wall 0..1

        let x: number;
        let z: number;
        const y = WALL_HEIGHT + topOffset + 0.01;

        if (type === 'H') {
          x = wall.x + wall.len * t;
          // Slight inset / outset on the wall's normal axis so the flower
          // sits ON the wall rather than inside it
          z = wall.z + (rng() - 0.5) * 0;
        } else {
          x = wall.x;
          z = wall.z + wall.len * t;
        }

        // Small upward offset for variety (some on top, some peeking out)
        const yJitter = y + rng() * 0.04;

        const scale = 0.05 + rng() * 0.05;
        const color = FLOWER_PALETTE[Math.floor(rng() * FLOWER_PALETTE.length)];

        flowers.push({
          position: new THREE.Vector3(x, yJitter, z),
          scale,
          color,
        });
      }
    });
  };

  placeAlong(horizontalWalls, 'H');
  placeAlong(verticalWalls, 'V');

  return flowers;
}

// Deterministic 32-bit PRNG
function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a small set of "leaf clump" spheres that sit on top of walls to
 * suggest trimmed hedge layers.  Uses the same wall coordinate system.
 */
export interface LeafClumpInstance {
  position: THREE.Vector3;
  scale: number;
  colorVariant: number; // 0..1, used to lerp between two foliage greens
}

export function generateLeafClumps(
  horizontalWalls: WallSegmentLike[],
  verticalWalls: WallSegmentLike[],
  spacing: number = 0.4,
): LeafClumpInstance[] {
  const clumps: LeafClumpInstance[] = [];

  const place = (walls: WallSegmentLike[], type: 'H' | 'V') => {
    walls.forEach((wall, wallIdx) => {
      // Place a clump every `spacing` units along the wall
      const count = Math.max(1, Math.floor(wall.len / spacing));
      for (let i = 0; i <= count; i++) {
        const t = (i + 0.5) / (count + 1);
        const seed = wallIdx * 99991 + i * 22441;
        const rng = mulberry32(seed >>> 0);

        let x: number;
        let z: number;
        const y = WALL_HEIGHT + 0.04 + rng() * 0.06;

        if (type === 'H') {
          x = wall.x + wall.len * t;
          z = wall.z;
        } else {
          x = wall.x;
          z = wall.z + wall.len * t;
        }

        // Slight horizontal wiggle along the wall's normal axis
        const wiggle = (rng() - 0.5) * 0.04;
        if (type === 'H') z += wiggle;
        else x += wiggle;

        const scale = 0.18 + rng() * 0.08; // hemisphere size
        const colorVariant = rng();

        clumps.push({
          position: new THREE.Vector3(x, y, z),
          scale,
          colorVariant,
        });
      }
    });
  };

  place(horizontalWalls, 'H');
  place(verticalWalls, 'V');

  return clumps;
}

export { WALL_THICKNESS };
