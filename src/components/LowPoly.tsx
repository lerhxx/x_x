import * as THREE from 'three'
import { useMemo } from 'react'
import { Float } from '@react-three/drei'

// ---------- 随机数（可复现） ----------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 橘色调色板 ----------
const PALETTE: THREE.Color[] = ['#FF5A1F', '#FF6B35', '#FF7F4D', '#FF8F3D', '#FFA24B', '#F04E23', '#E8431F', '#FFB347'].map(
  (c) => new THREE.Color(c)
)
const CAP_COLOR = new THREE.Color('#FF7A2F')

// ---------- 数字轮廓（手工多边形，无字体依赖） ----------
type Pt = [number, number]

// ---------- 一致性顶点扰动：同位置顶点同位移，面不会裂开 ----------
function jitterVertices(geo: THREE.BufferGeometry, jitter: number, seed: number): void {
  const pos = geo.attributes.position as THREE.BufferAttribute
  const rng = mulberry32(seed)
  const memo = new Map<string, [number, number, number]>()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const key = `${x.toFixed(4)}_${y.toFixed(4)}_${z.toFixed(4)}`
    if (!memo.has(key)) {
      memo.set(key, [(rng() - 0.5) * jitter, (rng() - 0.5) * jitter, (rng() - 0.5) * jitter])
    }
    const [dx, dy, dz] = memo.get(key)!
    pos.setXYZ(i, x + dx, y + dy, z + dz)
  }
  pos.needsUpdate = true
}

// ---------- 逐三角形分面着色：低多边形核心观感 ----------
function applyFacetColors(
  geo: THREE.BufferGeometry,
  seed: number,
  { capColor = CAP_COLOR }: { capColor?: THREE.Color } = {}
): void {
  geo.computeVertexNormals()
  const pos = geo.attributes.position as THREE.BufferAttribute
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const rng = mulberry32(seed * 7 + 3)
  const c = new THREE.Color()
  for (let f = 0; f < pos.count / 3; f++) {
    const isCap = Math.abs(nrm.getZ(f * 3)) > 0.9
    if (isCap) {
      c.copy(capColor).offsetHSL(0, 0, (rng() - 0.5) * 0.05)
    } else {
      c.copy(PALETTE[Math.floor(rng() * PALETTE.length)]).offsetHSL(0, (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.07)
    }
    for (let v = 0; v < 3; v++) {
      const idx = (f * 3 + v) * 3
      colors[idx] = c.r
      colors[idx + 1] = c.g
      colors[idx + 2] = c.b
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
}

// ---------- 挤出数字几何 ----------
export function buildDigitGeometry(
  points: Pt[],
  { depth = 0.75, jitter = 0.075, seed = 1 }: { depth?: number; jitter?: number; seed?: number } = {}
): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length; i++) shape.lineTo(points[i][0], points[i][1])
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.center()
  jitterVertices(geo, jitter, seed)
  applyFacetColors(geo, seed)
  return geo
}

// ---------- 低多边形水晶碎块 ----------
function buildCrystalGeometry(kind: number, radius: number, seed: number): THREE.BufferGeometry {
  const Ctor =
    kind === 0 ? THREE.TetrahedronGeometry : kind === 1 ? THREE.OctahedronGeometry : THREE.IcosahedronGeometry
  const geo = new Ctor(radius, 0)
  jitterVertices(geo, radius * 0.35, seed)
  applyFacetColors(geo, seed)
  return geo
}

export const materialProps = {
  vertexColors: true,
  flatShading: true,
  roughness: 0.55,
  metalness: 0.08,
}


// ---------- 环绕水晶碎块 ----------
interface CrystalDef {
  pos: [number, number, number]
  r: number
  kind: number
  seed: number
}

const CRYSTALS: CrystalDef[] = [
  { pos: [-3.1, 1.3, -1.2], r: 0.34, kind: 2, seed: 1 },
  { pos: [3.2, 1.1, -0.8], r: 0.3, kind: 1, seed: 2 },
  { pos: [-2.6, -0.1, 0.6], r: 0.24, kind: 0, seed: 3 },
  { pos: [2.8, -0.3, 0.9], r: 0.28, kind: 2, seed: 4 },
  { pos: [-1.6, 1.7, 1.3], r: 0.18, kind: 0, seed: 5 },
  { pos: [1.8, 1.9, 0.9], r: 0.16, kind: 1, seed: 6 },
  { pos: [0.5, -0.8, -1.4], r: 0.22, kind: 2, seed: 7 },
  { pos: [-3.4, 0.1, 1.6], r: 0.15, kind: 1, seed: 8 },
  { pos: [3.6, -0.2, 1.2], r: 0.19, kind: 0, seed: 9 },
  { pos: [-0.9, 2.2, -1.8], r: 0.14, kind: 2, seed: 10 },
  { pos: [1.0, -0.1, 1.5], r: 0.13, kind: 1, seed: 11 },
  { pos: [4.1, 0.9, -1.6], r: 0.17, kind: 2, seed: 12 },
]

export function Crystals() {
  const geos = useMemo(
    () => CRYSTALS.map((c) => buildCrystalGeometry(c.kind, c.r, c.seed)),
    []
  )
  return (
    <group>
      {CRYSTALS.map((c, i) => (
        <Float key={i} speed={1.2 + (i % 4) * 0.35} rotationIntensity={0.6} floatIntensity={1.4}>
          <mesh geometry={geos[i]} position={c.pos} castShadow>
            <meshStandardMaterial {...materialProps} roughness={0.4} metalness={0.15} />
          </mesh>
        </Float>
      ))}
    </group>
  )
}
