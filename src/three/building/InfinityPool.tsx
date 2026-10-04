import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MAT } from '../materials';
import { box, merge, pad, rng, type G } from '../geo';
import { RX, Z1 } from '../dims';

/**
 * Roof-side infinity pool (roof-local space, y = 0 is the deck walking surface).
 *
 * The pool is a real basin cut INTO the roof structure: MainBuilding builds the
 * crown fascia and roof slab around the rectangle exported here, and the basin
 * floor sits flush with the underside of the fascia. The water therefore has a
 * genuine ~1 m of depth instead of floating a few centimetres over solid slab.
 *
 *  - runs edge to edge between the side upstands (walls touch, no gaps)
 *  - 4.2 m wide entry steps open through the terrace-side wall
 *  - front edge is a clear glass weir; water appears to spill off the roof
 *  - no rails, trough or props inside the swimming volume
 */
const EDGE = 0.15;
export const POOL = {
  x0: -RX + EDGE,
  x1: RX - EDGE,
  z0: 15.55,
  z1: Z1 - 0.32,
  /** top of the structural floor slab (bottom of the slab = fascia underside) */
  floorY: -1.05,
  waterY: -0.06,
  /** coping sits on the walls: bottom 0.015, top 0.125 */
  copingY0: 0.015,
  copingY1: 0.125,
} as const;

const { x0: X0, x1: X1, z0: Z0P, z1: Z1P, floorY: FY, waterY: WY } = POOL;
const W = X1 - X0;
const D = Z1P - Z0P;
const CZ = (Z0P + Z1P) / 2;
const WALL = 0.22;
const TILE = 0.03;
const COPE = 0.36;

/** Entry steps: three treads walking in from the deck through the back wall. */
const STEP_W = 4.2;
const STEP_X0 = X0 + WALL + TILE;
const STEP_X1 = STEP_X0 + STEP_W;
const TREAD_TOPS = [-0.2, -0.48, -0.76];
const TREAD_Z = [Z0P, Z0P + 0.85, Z0P + 1.45, Z0P + 2.05];

const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): G =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

function makeWaterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, '#0a6d90');
  gradient.addColorStop(0.5, '#1cb3c6');
  gradient.addColorStop(1, '#075f84');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const random = rng(8027);
  for (let i = 0; i < 38; i++) {
    const x = random() * 256;
    const y = random() * 256;
    const length = 18 + random() * 64;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + length * 0.25, y - 6, x + length * 0.65, y + 8, x + length, y);
    ctx.strokeStyle = `rgba(196,251,255,${(0.08 + random() * 0.28).toFixed(3)})`;
    ctx.lineWidth = 1 + random() * 2;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'InfinityPool_Water_Ripples';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.6, 0.7);
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Concrete shell: floor slab, walls and coping. No overlapping volumes. */
function buildBasin(): G {
  const wallTop = POOL.copingY0;
  const openEnd = STEP_X1; // back wall / coping stop where the entry steps begin
  return merge([
    // floor slab (bottom flush with the fascia underside)
    bx(X0, X1, FY - 0.12, FY, Z0P, Z1P),
    // side walls
    bx(X0, X0 + WALL, FY, wallTop, Z0P, Z1P),
    bx(X1 - WALL, X1, FY, wallTop, Z0P, Z1P),
    // terrace-side wall, open over the entry steps
    bx(openEnd, X1 - WALL, FY, wallTop, Z0P, Z0P + WALL),
    // coping on top of the walls
    bx(X0, X0 + COPE, POOL.copingY0, POOL.copingY1, Z0P, Z1P),
    bx(X1 - COPE, X1, POOL.copingY0, POOL.copingY1, Z0P, Z1P),
    bx(openEnd, X1 - COPE, POOL.copingY0, POOL.copingY1, Z0P, Z0P + COPE),
  ]);
}

function buildTile(): G {
  const top = WY + 0.04;
  return merge([
    bx(X0 + WALL + TILE, X1 - WALL - TILE, FY, FY + TILE, Z0P + WALL + TILE, Z1P - 0.04),
    // wall linings (inner faces only)
    bx(X0 + WALL, X0 + WALL + TILE, FY, top, Z0P, Z1P - 0.04),
    bx(X1 - WALL - TILE, X1 - WALL, FY, top, Z0P, Z1P - 0.04),
    bx(STEP_X1, X1 - WALL - TILE, FY, top, Z0P + WALL, Z0P + WALL + TILE),
  ]);
}

function buildSteps(): G {
  const parts: G[] = [];
  for (let i = 0; i < 3; i++) {
    parts.push(bx(STEP_X0, STEP_X1, FY, TREAD_TOPS[i], TREAD_Z[i], TREAD_Z[i + 1]));
  }
  return merge(parts);
}

/** Clear weir wall: top is level with the water so it reads as spilling over. */
function buildGlass(): G {
  return bx(X0 + WALL, X1 - WALL, FY, WY + 0.02, Z1P - 0.04, Z1P);
}

/** LED strips sit on the tile faces, below the waterline. */
function buildGlow(): G {
  const y = -0.9;
  return merge([
    bx(X1 - WALL - TILE - 0.03, X1 - WALL - TILE, y - 0.015, y + 0.015, Z0P + 0.5, Z1P - 0.4),
    bx(X0 + WALL + TILE, X0 + WALL + TILE + 0.03, y - 0.015, y + 0.015, Z0P + 2.2, Z1P - 0.4),
    bx(X0 + 1.0, X1 - 1.0, FY + TILE, FY + TILE + 0.03, Z1P - 0.3, Z1P - 0.26),
  ]);
}

export function InfinityPool({ night }: { night: boolean }) {
  const basin = useMemo(buildBasin, []);
  const tile = useMemo(buildTile, []);
  const steps = useMemo(buildSteps, []);
  const glass = useMemo(buildGlass, []);
  const glow = useMemo(buildGlow, []);
  const waterGeo = useMemo(
    () => pad(W - 2 * WALL, D - 0.04, 0, WY, (Z0P + Z1P - 0.04) / 2),
    [],
  );
  const texture = useMemo(makeWaterTexture, []);
  const water = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        name: 'InfinityPool_Water',
        map: texture,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        roughness: 0.12,
        metalness: 0.26,
        emissive: '#06708c',
        emissiveIntensity: 0.34,
        envMapIntensity: 1.5,
      }),
    [texture],
  );

  useEffect(() => {
    water.emissiveIntensity = night ? 0.34 : 0.12;
  }, [night, water]);
  useEffect(() => () => { water.dispose(); texture.dispose(); }, [water, texture]);

  useFrame((_, delta) => {
    texture.offset.x = (texture.offset.x + delta * 0.006) % 1;
    texture.offset.y = (texture.offset.y - delta * 0.011 + 1) % 1;
  });

  return (
    <group name="InfinityPool">
      <mesh name="Pool_Basin_And_Coping" geometry={basin} material={MAT.concrete} castShadow receiveShadow />
      <mesh name="Pool_Tile_Lining" geometry={tile} material={MAT.poolTile} receiveShadow />
      <mesh name="Pool_Entry_Steps" geometry={steps} material={MAT.white} receiveShadow />
      <mesh name="Pool_Vanishing_Edge_Glass" geometry={glass} material={MAT.poolGlass} renderOrder={8} />
      <mesh name="Pool_Water_Surface" geometry={waterGeo} material={water} renderOrder={7} />
      <mesh name="Pool_Underwater_Lighting" geometry={glow} material={MAT.neonCyan} />
      <pointLight name="PL_Pool_Cyan" position={[0, 0.9, CZ]} color="#49d9ec" intensity={night ? 16 : 2} distance={17} decay={2} />
    </group>
  );
}
