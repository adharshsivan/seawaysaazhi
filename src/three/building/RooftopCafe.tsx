import { useMemo } from 'react';
import { MAT } from '../materials';
import { box, cyl, merge, plankFloor, sphere, type G } from '../geo';
import { RX, Z0, Z1 } from '../dims';
import { POOL } from './InfinityPool';

/* Rooftop local space: origin = tower centre at deck level (y = 0). */

/** Inner face of the roof upstand (the deck and every strip stop exactly here). */
const INNER = RX - 0.15; // 11.85
const DECK_Z0 = Z0 + 0.15; // -9.85 — inner face of the back upstand
const DECK_Z1 = POOL.z0; // the deck ends at the pool coping
const DECK_D = DECK_Z1 - DECK_Z0;
const DECK_CZ = (DECK_Z0 + DECK_Z1) / 2;
/** Slab top relative to the deck surface. */
const SLAB_TOP = -0.12;

export const BULKHEAD = { x0: -11.2, x1: -5.2, z0: -9.4, z1: -4.2, h: 4.4 };
export const PAVILION = { x0: -3.0, x1: 8.0, z0: -9.4, z1: -3.2, h: 3.8 };
export const PERGOLA = { x0: -4.5, x1: 5.0, z0: -1.8, z1: 6.5, h: 3.3 };

/** Pavilion roof slab thickness / top (used by the sign mounts). */
export const PAVILION_ROOF_TOP = PAVILION.h + 0.26;

const mid = (a: number, b: number) => (a + b) / 2;
const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): G =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** Planks rest on an underlay that rests on the roof slab: nothing floats. */
function buildDeck(): G {
  return plankFloor(INNER * 2, DECK_D, 0, -0.025, DECK_CZ);
}

function buildDarkMetal(): G {
  const p: G[] = [];
  const b = BULKHEAD;
  const v = PAVILION;
  const vw = v.x1 - v.x0;
  const vd = v.z1 - v.z0;

  // Underlay: from the slab top up to the underside of the planks
  p.push(bx(-INNER, INNER, SLAB_TOP, -0.05, DECK_Z0, DECK_Z1));
  // Bulkhead core, rooted 5 cm into the deck so no seam flickers at its foot
  p.push(bx(b.x0, b.x1, -0.05, b.h, b.z0, b.z1));
  // Pavilion roof slab (the pavilion floor is simply the deck — no plinth to sink furniture into)
  p.push(box(vw + 1.1, 0.26, vd + 1.1, mid(v.x0, v.x1), v.h + 0.13, mid(v.z0, v.z1)));

  // Pendant cords reach the roof slab
  for (let i = 0; i < 5; i++) {
    p.push(cyl(0.012, 0.012, 1.1, v.x0 + 1.4 + i * 2.1, v.h - 0.55, mid(v.z0, v.z1), 4));
  }
  return merge(p);
}

/** Real rooftop bulkhead door on the east face of the stair/elevator block. */
function buildCafeEntranceDoor(): { dark: G; glass: G; frame: G; glow: G } {
  const b = BULKHEAD;
  const cx = b.x1 + 0.05;
  const cz = mid(b.z0, b.z1);
  return {
    dark: box(0.12, 2.55, 1.55, cx, 1.275, cz),
    glass: box(0.045, 2.2, 1.25, cx + 0.08, 1.16, cz),
    frame: merge([
      box(0.08, 2.45, 0.08, cx + 0.12, 1.23, cz - 0.72),
      box(0.08, 2.45, 0.08, cx + 0.12, 1.23, cz + 0.72),
      box(0.08, 0.08, 1.52, cx + 0.12, 2.44, cz),
      box(0.06, 0.78, 0.05, cx + 0.16, 1.22, cz + 0.28),
    ]),
    glow: box(0.025, 2.05, 1.1, cx + 0.15, 1.17, cz),
  };
}

/**
 * Two TVs directly mounted flush onto the glass wall — no rods, no sticks, no bulky hardware.
 * Left TV is centered specifically within the LEFT glass panel zone (x = -0.25).
 * Right TV is centered specifically within the RIGHT glass panel zone (x = 5.25).
 * Neither TV overlaps or sits on top of any structural beam.
 */
function buildCafeTVs(): { frames: G; screens: G; glow: G } {
  const v = PAVILION;
  const p: G[] = [];
  const s: G[] = [];
  const g: G[] = [];

  const w = 2.0;
  const h = 1.12;
  const y = 2.05; // centered vertically in the 3.8m tall glass panel (1.49m floor clearance)
  const z = v.z0 + 0.08; // directly flush against the inside of the glass wall

  // Left glass-wall panel center is -0.25; Right glass-wall panel center is 5.25
  for (const x of [-0.25, 5.25]) {
    // Ultra-slim commercial display bezel
    p.push(box(w + 0.08, h + 0.08, 0.04, x, y, z));
    // High-resolution display screen
    s.push(box(w, h, 0.02, x, y, z + 0.02));
    // Subtle lower accent LED
    g.push(box(w - 0.2, 0.02, 0.015, x, y - h / 2 - 0.02, z + 0.02));
  }
  return { frames: merge(p), screens: merge(s), glow: merge(g) };
}

type PergolaBox = { x0: number; x1: number; z0: number; z1: number; h: number };

/** Bronze pergola: 4 posts, perimeter beams, shade slats that run between the beam centres. */
function pergolaParts(g: PergolaBox): G[] {
  const p: G[] = [];
  for (const [x, z] of [
    [g.x0, g.z0],
    [g.x1, g.z0],
    [g.x0, g.z1],
    [g.x1, g.z1],
  ]) {
    p.push(box(0.16, g.h, 0.16, x, g.h / 2, z));
  }
  p.push(box(g.x1 - g.x0 + 0.16, 0.15, 0.15, mid(g.x0, g.x1), g.h, g.z0));
  p.push(box(g.x1 - g.x0 + 0.16, 0.15, 0.15, mid(g.x0, g.x1), g.h, g.z1));
  p.push(box(0.15, 0.15, g.z1 - g.z0, g.x0, g.h, mid(g.z0, g.z1)));
  p.push(box(0.15, 0.15, g.z1 - g.z0, g.x1, g.h, mid(g.z0, g.z1)));
  // Slats: ends sit inside the beams, tops touch the beam undersides.
  for (let x = g.x0 + 0.4; x < g.x1 - 0.2; x += 0.62) {
    p.push(box(0.08, 0.1, g.z1 - g.z0, x, g.h - 0.12, mid(g.z0, g.z1)));
  }
  return p;
}

function buildBronze(): G {
  const p: G[] = [];
  const b = BULKHEAD;
  const v = PAVILION;

  // Bulkhead slat screens: floor to roof, attached to the faces
  const slatT = 0.08;
  const slatD = 0.14;
  for (let x = b.x0 + 0.2; x < b.x1 - 0.1; x += 0.32) {
    p.push(box(slatT, b.h, slatD, x, b.h / 2, b.z1 + slatD / 2));
  }
  for (let z = b.z0 + 0.2; z < b.z1 - 0.1; z += 0.32) {
    p.push(box(slatD, b.h, slatT, b.x1 + slatD / 2, b.h / 2, z));
  }

  // Back wall posts: clean center divider at x = 2.5 creating two equal glass bays (span -3.0 to 2.5 and 2.5 to 8.0)
  for (const x of [v.x0, mid(v.x0, v.x1), v.x1]) {
    p.push(box(0.13, v.h, 0.13, x, v.h / 2, v.z0));
  }
  // Front posts
  for (const x of [v.x0, v.x0 + 3.67, v.x0 + 7.33, v.x1]) {
    p.push(box(0.13, v.h, 0.13, x, v.h / 2, v.z1));
  }
  for (const x of [v.x0, v.x1]) p.push(box(0.13, v.h, 0.13, x, v.h / 2, mid(v.z0, v.z1)));

  // Continuous perimeter head rails at ceiling line
  const railY = v.h - 0.05;
  p.push(box(v.x1 - v.x0 + 0.13, 0.11, 0.13, mid(v.x0, v.x1), railY, v.z1));
  p.push(box(v.x1 - v.x0 + 0.13, 0.11, 0.13, mid(v.x0, v.x1), railY, v.z0));
  p.push(box(0.13, 0.11, v.z1 - v.z0 - 0.13, v.x0, railY, mid(v.z0, v.z1)));
  p.push(box(0.13, 0.11, v.z1 - v.z0 - 0.13, v.x1, railY, mid(v.z0, v.z1)));

  p.push(...pergolaParts(PERGOLA));
  return merge(p);
}

/**
 * Vertical glass wall panels only — NO horizontal glass over the floor.
 * This completely eliminates the blue glass floor effect and floor blinking.
 */
function buildGlass(): G {
  const v = PAVILION;
  const t = 0.03;
  const w = v.x1 - v.x0;
  const d = v.z1 - v.z0;
  return merge([
    // North wall (back glass)
    box(w - 0.26, v.h - 0.1, t, mid(v.x0, v.x1), v.h / 2, v.z0 + 0.05),
    // South wall (front glass)
    box(w - 0.26, v.h - 0.1, t, mid(v.x0, v.x1), v.h / 2, v.z1 - 0.05),
    // West wall
    box(t, v.h - 0.1, d - 0.26, v.x0 + 0.05, v.h / 2, mid(v.z0, v.z1)),
    // East wall
    box(t, v.h - 0.1, d - 0.26, v.x1 - 0.05, v.h / 2, mid(v.z0, v.z1)),
  ]);
}

function buildInteriorGlow(): G {
  const v = PAVILION;
  const b = BULKHEAD;
  return merge([
    // ceiling panel flush under the roof slab
    bx(v.x0 + 0.5, v.x1 - 0.5, v.h - 0.05, v.h, v.z0 + 0.5, v.z1 - 0.5),
    // lift-door glow: lies over the slats (0.14), from the deck up
    bx(b.x1, b.x1 + 0.16, 0, 2.5, mid(b.z0, b.z1) - 0.75, mid(b.z0, b.z1) + 0.75),
  ]);
}

function buildPendants(): G {
  const v = PAVILION;
  const p: G[] = [];
  for (let i = 0; i < 5; i++) {
    p.push(sphere(0.16, v.x0 + 1.4 + i * 2.1, v.h - 1.15, mid(v.z0, v.z1), 10, 7));
  }
  return merge(p);
}

/** Cyan strip mounted on the inner face of the upstand (back + sides; the front is open to the pool). */
function buildLedStrips(): G {
  const y0 = 0.275;
  const y1 = 0.325;
  const t = 0.03;
  return merge([
    bx(-INNER + t, INNER - t, y0, y1, DECK_Z0, DECK_Z0 + t),
    bx(-INNER, -INNER + t, y0, y1, DECK_Z0, Z1),
    bx(INNER - t, INNER, y0, y1, DECK_Z0, Z1),
  ]);
}

/**
 * Violet wash strip along the SOUTH face of the bulkhead only.
 * No strip on the east face where the entrance door is, completely preventing any line through the doorway.
 */
function buildVioletWash(): G {
  const b = BULKHEAD;
  const t = 0.04;
  const y0 = 0.02;
  const y1 = 0.06;
  return bx(b.x0 + 0.2, b.x1 - 0.1, y0, y1, b.z1 + 0.14, b.z1 + 0.14 + t);
}

export function RooftopCafe() {
  const deck = useMemo(buildDeck, []);
  const dark = useMemo(buildDarkMetal, []);
  const bronze = useMemo(buildBronze, []);
  const glass = useMemo(buildGlass, []);
  const glow = useMemo(buildInteriorGlow, []);
  const pendants = useMemo(buildPendants, []);
  const led = useMemo(buildLedStrips, []);
  const violet = useMemo(buildVioletWash, []);
  const entrance = useMemo(buildCafeEntranceDoor, []);
  const tvs = useMemo(buildCafeTVs, []);

  return (
    <group name="RooftopCafe">
      <mesh name="Deck_Planks" geometry={deck} material={MAT.wood} receiveShadow />
      <mesh name="Cafe_Structure_Dark" geometry={dark} material={MAT.darkMetal} castShadow receiveShadow />
      <mesh name="Cafe_Frames_Bronze" geometry={bronze} material={MAT.bronze} castShadow receiveShadow />
      <mesh name="Cafe_Pavilion_Glass" geometry={glass} material={MAT.glass} renderOrder={11} />
      <mesh name="Cafe_Entrance_Door" geometry={entrance.dark} material={MAT.darkMetal} castShadow />
      <mesh name="Cafe_Entrance_Glass" geometry={entrance.glass} material={MAT.glass} renderOrder={12} />
      <mesh name="Cafe_Entrance_Frame" geometry={entrance.frame} material={MAT.bronze} castShadow />
      <mesh name="Cafe_Entrance_Glow" geometry={entrance.glow} material={MAT.interiorGlow} />
      <mesh name="Cafe_TV_Frames" geometry={tvs.frames} material={MAT.darkMetal} castShadow />
      <mesh name="Cafe_TV_Screens" geometry={tvs.screens} material={MAT.tvScreen} />
      <mesh name="Cafe_TV_Glow_Strips" geometry={tvs.glow} material={MAT.neonCyan} />
      <mesh name="Cafe_Interior_Glow" geometry={glow} material={MAT.interiorGlow} />
      <mesh name="Cafe_Pendants" geometry={pendants} material={MAT.bulbWarm} />
      <mesh name="LED_Strip_Cyan" geometry={led} material={MAT.neonCyan} />
      <mesh name="LED_Wash_Violet" geometry={violet} material={MAT.neonViolet} />
    </group>
  );
}
