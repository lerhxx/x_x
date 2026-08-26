import * as THREE from 'three';

/**
 * Programmatic hedge texture generator.
 * Produces a tileable, layered "trimmed foliage" look without any external asset.
 *
 * Returns three textures:
 *   - color:   albedo map (green foliage with depth)
 *   - bump:    grayscale bump map for surface relief
 *   - ao:      ambient-occlusion-like map (slightly darker in crevices)
 */
export interface HedgeTextures {
  color: THREE.Texture;
  bump: THREE.Texture;
  ao: THREE.Texture;
}

function seededRandom(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function paintCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
  alpha: number,
  blendMode?: GlobalCompositeOperation,
) {
  const prev = ctx.globalCompositeOperation;
  if (blendMode) ctx.globalCompositeOperation = blendMode;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prev;
}

export function createHedgeTextures(size: number = 512, seed: number = 1337): HedgeTextures {
  const rand = seededRandom(seed);

  // ===== Color map =====
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cctx = colorCanvas.getContext('2d')!;

  // Base gradient: foliage green with a hint of brown earth at the bottom
  const baseGrad = cctx.createLinearGradient(0, 0, 0, size);
  baseGrad.addColorStop(0, '#3a8524');
  baseGrad.addColorStop(0.7, '#2c6a18');
  baseGrad.addColorStop(0.95, '#1f4a10');
  baseGrad.addColorStop(1, '#3a2a13'); // bit of trunk/earth at very bottom
  cctx.fillStyle = baseGrad;
  cctx.fillRect(0, 0, size, size);

  // Soft mossy mid-tone patches — gives an organic "leaf cluster" feel
  for (let i = 0; i < 70; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.85;
    const r = 40 + rand() * 80;
    const tone = rand() < 0.5 ? '#2a5a14' : '#4b9a2a';
    paintCircle(cctx, x, y, r, tone, 0.25 + rand() * 0.3);
  }

  // Dark leaf pockets — depth in the crevices
  for (let i = 0; i < 800; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.9;
    const r = 3 + rand() * 10;
    paintCircle(cctx, x, y, r, '#0c2d05', 0.3 + rand() * 0.5);
  }

  // Light sun-catching highlights
  for (let i = 0; i < 500; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.8;
    const r = 2 + rand() * 7;
    paintCircle(cctx, x, y, r, '#7fc94a', 0.25 + rand() * 0.45);
  }

  // Tiny leaf-edge specks — fine detail
  for (let i = 0; i < 2400; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.92;
    const r = 0.8 + rand() * 1.8;
    const tone = rand() < 0.7 ? '#1f4a10' : rand() < 0.5 ? '#5fa82a' : '#86c644';
    paintCircle(cctx, x, y, r, tone, 0.5 + rand() * 0.4);
  }

  // Tiny flowers embedded in foliage (red/pink/yellow specks)
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.85;
    const palette = ['#e84a5f', '#ff7088', '#ffce4a', '#ffffff'];
    const color = palette[Math.floor(rand() * palette.length)];
    paintCircle(cctx, x, y, 1 + rand() * 1.4, color, 0.85);
  }

  // ===== Bump map =====
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 1800; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.92;
    const r = 1.5 + rand() * 5;
    // Mix of slightly darker (concave) and lighter (raised) — net normal = leaves
    const v = rand() < 0.5 ? 0x55 + Math.floor(rand() * 40) : 0xa0 + Math.floor(rand() * 30);
    const c = `rgb(${v},${v},${v})`;
    paintCircle(bctx, x, y, r, c, 0.35 + rand() * 0.5);
  }

  // ===== AO map =====
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = size;
  aoCanvas.height = size;
  const aoctx = aoCanvas.getContext('2d')!;
  aoctx.fillStyle = '#ffffff'; // ambient white = full light
  aoctx.fillRect(0, 0, size, size);

  // Patches of shadow under leaf clusters
  for (let i = 0; i < 350; i++) {
    const x = rand() * size;
    const y = rand() * size * 0.9;
    const r = 4 + rand() * 16;
    paintCircle(aoctx, x, y, r, '#d8d8d8', 0.25 + rand() * 0.5);
  }

  // Darker base near bottom (earth)
  const shadowGrad = aoctx.createLinearGradient(0, 0, 0, size);
  shadowGrad.addColorStop(0, '#ffffff');
  shadowGrad.addColorStop(0.85, '#dadada');
  shadowGrad.addColorStop(1, '#9c9c9c');
  aoctx.globalAlpha = 0.55;
  aoctx.fillStyle = shadowGrad;
  aoctx.fillRect(0, 0, size, size);
  aoctx.globalAlpha = 1;

  // ===== Wrap as THREE.Texture =====
  const wrap = (canvas: HTMLCanvasElement, isColor: boolean) => {
    const tex = new THREE.CanvasTexture(canvas);
    if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  };

  return {
    color: wrap(colorCanvas, true),
    bump: wrap(bumpCanvas, false),
    ao: wrap(aoCanvas, false),
  };
}

/**
 * Build a small "trimmed top of hedge" cap: a slightly-rounded dome that sits
 * on top of walls.  Just a single material, returns a half-torus or capsule.
 */
export function createHedgeCapMaterial(textures: HedgeTextures) {
  return new THREE.MeshStandardMaterial({
    map: textures.color,
    bumpMap: textures.bump,
    aoMap: textures.ao,
    bumpScale: 0.06,
    roughness: 0.95,
    metalness: 0,
    color: '#3d8524',
  });
}
