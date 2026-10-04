import { useMemo } from 'react';
import { MAT } from '../materials';
import { box, cyl, merge, ring, rng, sphere, type G } from '../geo';
import { PODIUM, TOWER, TOWER_BASE, TOWER_H, ROOF_Y, DECK_Y, Z1 } from '../dims';
import { buildPaneGeometry, type Pane } from '../InteriorWindows';
import { InteriorWindowMesh } from './InteriorWindowMesh';
import { POOL } from './InfinityPool';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/*  A face is described by its outward rotation; u runs along the face */
/* ------------------------------------------------------------------ */

interface Face {
  ry: number;
  /** half-width of the face */
  half: number;
  /** distance from building centre to the face plane */
  off: number;
}

const TW = TOWER.w; // 24
const TD = TOWER.d; // 20

const TOWER_FACES: Face[] = [
  { ry: 0, half: TW / 2, off: TD / 2 },
  { ry: Math.PI, half: TW / 2, off: TD / 2 },
  { ry: Math.PI / 2, half: TD / 2, off: TW / 2 },
  { ry: -Math.PI / 2, half: TD / 2, off: TW / 2 },
];

/** world position of a point on a face, u along the face, n outward by `out`. */
function fp(f: Face, u: number, y: number, out = 0): [number, number, number] {
  const c = Math.cos(f.ry);
  const s = Math.sin(f.ry);
  return [c * u + s * (f.off + out), y, -s * u + c * (f.off + out)];
}

/** Axis-aligned box sitting on a face (w along u, d outward). */
function faceBox(f: Face, u: number, y: number, out: number, w: number, h: number, d: number): G {
  const [x, yy, z] = fp(f, u, y, out + d / 2);
  return box(w, h, d, x, yy, z, f.ry);
}

/** Box from min/max extents. */
const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): G =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/* ---------------- Tower grid ---------------- */

const PIER_W = 1.5; // corner pier width
const CTR_W = 1.7; // central pier width
const BAYS_PER_ZONE = 3;
const BAND_H = 0.62; // horizontal spandrel band
const SILL = 0.42;
const WIN_H = TOWER.fh - BAND_H - SILL + 0.2; // ~2.76

/** Piers run from 0.1 m inside the face line to 0.65 m proud of it. */
const PIER_IN = -0.1;
const PIER_D = 0.75;
const PIER_OUT = PIER_IN + PIER_D; // 0.65
/** Spandrel / slab-edge beam front face (recessed behind the piers). */
const BAND_OUT = 0.5;

/** Bay centres + widths for one face. */
function bays(f: Face): { u: number; w: number }[] {
  const out: { u: number; w: number }[] = [];
  const zoneA0 = -f.half + PIER_W;
  const zoneA1 = -CTR_W / 2;
  const zoneB0 = CTR_W / 2;
  const zoneB1 = f.half - PIER_W;
  for (const [a, b] of [
    [zoneA0, zoneA1],
    [zoneB0, zoneB1],
  ]) {
    const w = (b - a) / BAYS_PER_ZONE;
    for (let i = 0; i < BAYS_PER_ZONE; i++) out.push({ u: a + w * (i + 0.5), w });
  }
  return out;
}

interface BalconySpec {
  u: number;
  bw: number;
}

function getBalconySpecs(f: Face): BalconySpec[] {
  const isFrontBack = f.half === TW / 2;
  const bw = isFrontBack ? 5.8 : 4.8;
  const uA = (-f.half + PIER_W - CTR_W / 2) / 2;
  const uB = (CTR_W / 2 + f.half - PIER_W) / 2;
  return [
    { u: uA, bw },
    { u: uB, bw },
  ];
}

/* ---------------- Roof structure (all heights absolute) ---------------- */

/** Slab edge: 0.15 beyond the glazing line; fascia flush with the pier faces. */
const SLAB_X = TW / 2 + 0.15; // 12.15
const SLAB_Z0 = -TD / 2 - 0.15; // -10.15
const SLAB_Z1 = Z1 + 0.15; // 23.65
const FASCIA_X = TW / 2 + PIER_OUT; // 12.65 — flush with pier outer faces
const FASCIA_Z0 = -TD / 2 - PIER_OUT; // -10.65
const FASCIA_Z1 = SLAB_Z1 + 0.5; // 24.15
/** Fascia has exactly the height of a spandrel band, so the top floor matches every other floor. */
const FASCIA_Y0 = TOWER_BASE + TOWER_H - 0.1;
const FASCIA_Y1 = FASCIA_Y0 + BAND_H;
const UPSTAND_T = 0.3;
const UPSTAND_H = 0.62;
const RAIL_TOP = DECK_Y + 1.1;

/** A box from (x0,z0)-(x1,z1) with the pool rectangle removed. 4 pieces, no overlap. */
function slabAround(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): G[] {
  const h = POOL;
  return [
    bx(x0, x1, y0, y1, z0, h.z0),
    bx(x0, x1, y0, y1, h.z1, z1),
    bx(x0, h.x0, y0, y1, h.z0, h.z1),
    bx(h.x1, x1, y0, y1, h.z0, h.z1),
  ];
}

/** Glass guardrail on the roof edge: sits on the upstand, and straight on the slab at the open front. */
function buildRoofRail(): { glass: G; cap: G } {
  const h = 0.0225; // half glass thickness
  const c = 0.04; // half cap width
  const xc = SLAB_X - UPSTAND_T / 2; // 12.0 — centre of the side upstands
  const zBack = SLAB_Z0 + UPSTAND_T / 2; // -10.0
  const zFront = Z1; // 23.5 — on the slab's front strip
  const upTop = ROOF_Y + UPSTAND_H;
  const capY1 = RAIL_TOP + 0.05;
  return {
    glass: merge([
      bx(-xc - h, xc + h, upTop, RAIL_TOP, zBack - h, zBack + h),
      bx(-xc - h, -xc + h, upTop, RAIL_TOP, zBack + h, zFront - h),
      bx(xc - h, xc + h, upTop, RAIL_TOP, zBack + h, zFront - h),
      bx(-xc - h, xc + h, ROOF_Y, RAIL_TOP, zFront - h, zFront + h),
    ]),
    cap: merge([
      bx(-xc - c, xc + c, RAIL_TOP, capY1, zBack - c, zBack + c),
      bx(-xc - c, -xc + c, RAIL_TOP, capY1, zBack + c, zFront - c),
      bx(xc - c, xc + c, RAIL_TOP, capY1, zBack + c, zFront - c),
      bx(-xc - c, xc + c, RAIL_TOP, capY1, zFront - c, zFront + c),
    ]),
  };
}

/* ------------------------------------------------------------------ */
/*  Podium dimensions                                                  */
/* ------------------------------------------------------------------ */

const { w: PW, d: PD, h: PH } = PODIUM;
const LOBBY_X = 11.0; // half width of the glazed entrance lobby
const LOBBY_Z0 = 12.8; // back wall of the lobby void
const JAMB = 0.6; // concrete jamb either side of the lobby
const CORE_X = PW / 2 - 0.6; // 16.4
const CORE_Z = PD / 2 - 0.6; // 14.4
/** Ground band, first-floor sill band and roof band extents. */
const PLINTH_OUT = 0.6;

/* ------------------------------------------------------------------ */
/*  White concrete frame                                               */
/* ------------------------------------------------------------------ */

function buildWhiteFrame(): G {
  const p: G[] = [];

  /* ----- Tower piers: corners are CLOSED. ----- */
  // Front/back corner legs run out to the corner (u = half + 0.65); side legs stop
  // at the inner face of the front/back leg (u = half - 0.1) so nothing overlaps.
  const yC = TOWER_BASE + TOWER_H / 2;
  TOWER_FACES.forEach((f, fi) => {
    const frontBack = fi < 2;
    for (const s of [-1, 1]) {
      const uIn = s * (f.half - PIER_W);
      const uOut = frontBack ? s * (f.half + PIER_OUT) : s * (f.half + PIER_IN);
      const lo = Math.min(uIn, uOut);
      const hi = Math.max(uIn, uOut);
      p.push(faceBox(f, (lo + hi) / 2, yC, PIER_IN, hi - lo, TOWER_H, PIER_D));
    }
    p.push(faceBox(f, 0, yC, PIER_IN, CTR_W, TOWER_H, PIER_D));
  });

  /* ----- Spandrel bands: one per floor line (the roof fascia is the last one). ----- */
  TOWER_FACES.forEach((f) => {
    for (let fl = 1; fl < TOWER.floors; fl++) {
      const y = TOWER_BASE + fl * TOWER.fh;
      const spanW = f.half * 2 - PIER_W * 2 + 0.2;
      p.push(faceBox(f, 0, y + BAND_H / 2 - 0.1, PIER_IN + 0.05, spanW, BAND_H, BAND_OUT - PIER_IN - 0.05));
    }
  });

  /* ----- Tower base plinth: 0.1 m beyond the pier faces. ----- */
  p.push(bx(-TW / 2 - 0.75, TW / 2 + 0.75, TOWER_BASE, TOWER_BASE + 0.7, -TD / 2 - 0.75, TD / 2 + 0.75));

  /* ----- Roof: fascia (flush with piers) → slab (inset 0.5) → upstand. ----- */
  p.push(...slabAround(-FASCIA_X, FASCIA_X, FASCIA_Y0, FASCIA_Y1, FASCIA_Z0, FASCIA_Z1));
  p.push(...slabAround(-SLAB_X, SLAB_X, FASCIA_Y1, ROOF_Y, SLAB_Z0, SLAB_Z1));
  // Upstand sits ON the slab (it used to float 12 cm above it). Front is left open at the pool.
  const upY1 = ROOF_Y + UPSTAND_H;
  p.push(bx(-SLAB_X, SLAB_X, ROOF_Y, upY1, SLAB_Z0, SLAB_Z0 + UPSTAND_T));
  p.push(bx(-SLAB_X, -SLAB_X + UPSTAND_T, ROOF_Y, upY1, SLAB_Z0 + UPSTAND_T, SLAB_Z1));
  p.push(bx(SLAB_X - UPSTAND_T, SLAB_X, ROOF_Y, upY1, SLAB_Z0 + UPSTAND_T, SLAB_Z1));

  /* ----- Podium ----- */
  const POD_OUT = 0.2; // outer offset of the podium facade lines (±17.2, ±15.2)
  const POD_X = PW / 2 + POD_OUT; // 17.2
  const POD_Z = PD / 2 + POD_OUT; // 15.2
  const PIER_IN_X = PW / 2 - 1.6; // 15.4
  const PIER_IN_Z = PD / 2 - 1.6; // 13.4

  // Ground plinth stops at the lobby bay so the entrance threshold is level.
  p.push(bx(-PW / 2 - PLINTH_OUT, PW / 2 + PLINTH_OUT, 0, 0.5, -PD / 2 - PLINTH_OUT, LOBBY_Z0));
  p.push(bx(-PW / 2 - PLINTH_OUT, -LOBBY_X, 0, 0.5, LOBBY_Z0, PD / 2 + PLINTH_OUT));
  p.push(bx(LOBBY_X, PW / 2 + PLINTH_OUT, 0, 0.5, LOBBY_Z0, PD / 2 + PLINTH_OUT));

  // Mid-floor horizontal slab band (y = 4.15 to 4.95, height 0.8) — connects flush to the corner piers
  p.push(bx(-POD_X, POD_X, 4.15, 4.95, -POD_Z, POD_Z));

  // Solid spandrel backing wall behind the decorative slats (y = 4.95 to 6.6)
  // Continuous from corner pier to corner pier, closing all empty voids and gaps
  p.push(bx(-PIER_IN_X, PIER_IN_X, 4.95, 6.6, -PD / 2 - 0.15, -PD / 2 + 0.05));
  p.push(bx(-PW / 2 - 0.15, -PW / 2 + 0.05, 4.95, 6.6, -PIER_IN_Z, PIER_IN_Z));
  p.push(bx(PW / 2 - 0.05, PW / 2 + 0.15, 4.95, 6.6, -PIER_IN_Z, PIER_IN_Z));
  // Front spandrel wall flanks the entrance opening
  p.push(bx(-PIER_IN_X, -LOBBY_X, 4.95, 6.6, PD / 2 - 0.05, PD / 2 + 0.15));
  p.push(bx(LOBBY_X, PIER_IN_X, 4.95, 6.6, PD / 2 - 0.05, PD / 2 + 0.15));

  // First-floor continuous window sill beam (y = 6.6 to 6.95, height 0.35) — ties directly into corner piers
  p.push(bx(-POD_X, POD_X, 6.6, 6.95, -POD_Z, -PD / 2 + 0.15));
  p.push(bx(-POD_X, POD_X, 6.6, 6.95, PD / 2 - 0.15, POD_Z));
  p.push(bx(-POD_X, -PW / 2 + 0.15, 6.6, 6.95, -POD_Z, POD_Z));
  p.push(bx(PW / 2 - 0.15, POD_X, 6.6, 6.95, -POD_Z, POD_Z));

  // Podium roof band (y = 8.2 to 9.3 = PH) — ring meeting the corner pier tops seamlessly
  p.push(...ring(POD_X * 2, POD_Z * 2, 1.1, 1.1, 0, PH - 0.55, 0));

  // Corner piers: closed L-shapes running from ground to roof band, seamlessly meeting all beams
  const pierTop = PH - 0.05;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const xa = sx > 0 ? [PIER_IN_X, POD_X] : [-POD_X, -PIER_IN_X];
      const za = sz > 0 ? [PD / 2 - 0.75, POD_Z] : [-POD_Z, -PD / 2 + 0.75];
      p.push(bx(xa[0], xa[1], 0, pierTop, za[0], za[1]));
      const xb = sx > 0 ? [PW / 2 - 0.75, POD_X] : [-POD_X, -PW / 2 + 0.75];
      const zb = sz > 0 ? [PIER_IN_Z, POD_Z] : [-POD_Z, -PIER_IN_Z];
      p.push(bx(xb[0], xb[1], 0, pierTop, zb[0], zb[1]));
    }
  }

  // Lobby jambs close the gap between the glazed lobby and the ground-floor panes.
  for (const s of [-1, 1]) {
    const x0 = s > 0 ? LOBBY_X : -LOBBY_X - JAMB;
    p.push(bx(x0, x0 + JAMB, 0.5, 4.15, PD / 2 - 0.75, PD / 2 + 0.15));
  }

  // Podium terrace kerb
  p.push(...ring(PW + 0.5, PD + 0.5, 0.25, 0.4, 0, PH + 0.2, 0));
  return merge(p);
}

/* ------------------------------------------------------------------ */
/*  Cores, balconies, details                                          */
/* ------------------------------------------------------------------ */

function buildFacadeDetails(): {
  dark: G;
  white: G;
  wood: G;
  balconyGlass: G;
  bronze: G;
  led: G;
  soffitLed: G;
  planter: G;
  hedge: G;
} {
  const dark: G[] = [];
  const white: G[] = [];
  const wood: G[] = [];
  const balconyGlass: G[] = [];
  const bronze: G[] = [];
  const led: G[] = [];
  const soffitLed: G[] = [];
  const planter: G[] = [];
  const hedge: G[] = [];

  /* ----- Opaque cores: the building is solid behind the faked interiors. ----- */
  dark.push(bx(-TW / 2 + 0.6, TW / 2 - 0.6, TOWER_BASE, TOWER_BASE + TOWER_H, -TD / 2 + 0.6, TD / 2 - 0.6));
  // Podium core is FULL footprint on both floors — only the ground-floor lobby is hollow.
  dark.push(bx(-CORE_X, CORE_X, 0, PH, -CORE_Z, LOBBY_Z0));
  dark.push(bx(-CORE_X, -LOBBY_X, 0, PH, LOBBY_Z0, CORE_Z));
  dark.push(bx(LOBBY_X, CORE_X, 0, PH, LOBBY_Z0, CORE_Z));
  dark.push(bx(-LOBBY_X, LOBBY_X, 4.9, PH, LOBBY_Z0, CORE_Z)); // first floor above the lobby

  const DEP = 1.75;
  const yLedA = TOWER_BASE + 0.7;
  const yLedB = TOWER_BASE + TOWER_H - 0.6;

  TOWER_FACES.forEach((f) => {
    // White LED strips set into the pier faces, near each pier's inner edge.
    for (const u of [-f.half + PIER_W - 0.1, f.half - PIER_W + 0.1, -(CTR_W / 2 - 0.1), CTR_W / 2 - 0.1]) {
      led.push(faceBox(f, u, (yLedA + yLedB) / 2, PIER_OUT - 0.03, 0.08, yLedB - yLedA, 0.05));
    }

    const bSpecs = getBalconySpecs(f);

    for (let fl = 1; fl < TOWER.floors; fl++) {
      const y = TOWER_BASE + fl * TOWER.fh;
      // Balcony slab is the floor-edge beam continued outward: its top is flush with the band top.
      const yb = y + BAND_H - 0.1 - 0.14;

      bSpecs.forEach((spec, bi) => {
        const { u, bw } = spec;
        const uL = u - bw / 2 + 0.05;
        const uR = u + bw / 2 - 0.05;
        const proj = DEP - BAND_OUT;

        // 1. Slab — starts at the band face, so it is supported by the building.
        white.push(faceBox(f, u, yb, BAND_OUT, bw, 0.28, proj));

        // 2. Wood deck insert
        wood.push(faceBox(f, u, yb + 0.15, BAND_OUT + 0.04, bw - 0.14, 0.025, proj - 0.08));

        // 3. Frameless glass on 3 sides, standing on the slab
        const gH = 1.02;
        const gY = yb + 0.65;
        balconyGlass.push(faceBox(f, u, gY, DEP - 0.07, bw - 0.1, gH, 0.03));
        balconyGlass.push(faceBox(f, uL, gY, BAND_OUT, 0.04, gH, DEP - 0.07 - BAND_OUT));
        balconyGlass.push(faceBox(f, uR, gY, BAND_OUT, 0.04, gH, DEP - 0.07 - BAND_OUT));

        // 4. Slim handrail cap (returns end where the front rail begins — no overlap)
        const rY = yb + 1.17;
        bronze.push(faceBox(f, u, rY, DEP - 0.09, bw, 0.05, 0.09));
        bronze.push(faceBox(f, uL, rY, BAND_OUT, 0.09, 0.05, DEP - 0.09 - BAND_OUT));
        bronze.push(faceBox(f, uR, rY, BAND_OUT, 0.09, 0.05, DEP - 0.09 - BAND_OUT));

        // 5. Warm soffit light, flush under the slab
        soffitLed.push(faceBox(f, u, yb - 0.155, BAND_OUT + 0.4, bw - 0.8, 0.03, 0.22));

        // 6. One potted plant in a back corner of the balcony
        const potSide = (fl + bi) % 2 === 0 ? 1 : -1;
        const [px, py, pz] = fp(f, u + potSide * (bw / 2 - 0.75), yb + 0.15, DEP - 0.75);
        planter.push(cyl(0.28, 0.22, 0.44, px, py + 0.22, pz, 12));
        planter.push(cyl(0.3, 0.3, 0.06, px, py + 0.42, pz, 12));
        bronze.push(cyl(0.04, 0.04, 0.42, px, py + 0.65, pz, 6));
        hedge.push(sphere(0.38, px, py + 0.88, pz, 9, 7));
        hedge.push(sphere(0.26, px + 0.12, py + 0.98, pz + 0.08, 8, 6));
        hedge.push(sphere(0.24, px - 0.1, py + 0.86, pz - 0.06, 8, 6));
      });
    }
  });

  return {
    dark: merge(dark),
    white: merge(white),
    wood: merge(wood),
    balconyGlass: merge(balconyGlass),
    bronze: merge(bronze),
    led: merge(led),
    soffitLed: merge(soffitLed),
    planter: merge(planter),
    hedge: merge(hedge),
  };
}

/* ------------------------------------------------------------------ */
/*  Wood slat accent panels                                            */
/* ------------------------------------------------------------------ */

function buildWoodSlats(): G {
  const p: G[] = [];
  // Run from inside the first band to inside the roof fascia so no slat end hangs in mid-air.
  const y0 = TOWER_BASE + 0.9;
  const y1 = FASCIA_Y0 + 0.2;
  TOWER_FACES.forEach((f) => {
    for (const dir of [-1, 1]) {
      const u0 = dir * (CTR_W / 2 + 0.12);
      for (let i = 0; i < 5; i++) {
        p.push(faceBox(f, u0 + dir * i * 0.17, (y0 + y1) / 2, 0.05, 0.11, y1 - y0, 0.24));
      }
    }
  });

  // Podium architectural slat fins: cleanly framed between mid-slab (y = 4.95) and sill beam (y = 6.6)
  // Ending flush with the corner piers with zero gaps and zero floating ends
  const z = PD / 2 + 0.06;
  const x = PW / 2 + 0.06;
  const fy0 = 4.95;
  const fy1 = 6.6;
  const fh = fy1 - fy0;
  const fcy = (fy0 + fy1) / 2;
  const frontEnd = PW / 2 - 1.7; // meets the corner pier at 15.4 cleanly
  const sideEnd = PD / 2 - 1.7;  // meets the corner pier at 13.4 cleanly
  for (let u = -frontEnd; u <= frontEnd + 0.01; u += 0.34) {
    if (Math.abs(u) > LOBBY_X - 0.1) p.push(box(0.12, fh, 0.2, u, fcy, z));
    p.push(box(0.12, fh, 0.2, u, fcy, -z));
  }
  for (let u = -sideEnd; u <= sideEnd + 0.01; u += 0.34) {
    p.push(box(0.2, fh, 0.12, x, fcy, u));
    p.push(box(0.2, fh, 0.12, -x, fcy, u));
  }
  return merge(p);
}

/* ------------------------------------------------------------------ */
/*  Window panes (parallax interiors)                                  */
/* ------------------------------------------------------------------ */

// 0 living, 1 bedroom, 2 office, 3 cafe, 4 dim, 5 studio
const TOWER_FLOOR_TYPES = [2, 0, 1, 2, 5, 0, 1];

function pickType(base: number, rand: () => number): number {
  const r = rand();
  if (r < 0.09) return 4;
  if (r < 0.22) return (base + 1 + Math.floor(rand() * 2)) % 6;
  return base;
}

/** Floors have a quietness score; dark rooms cluster into runs along a floor line. */
function makeLightState(quiet: number, rand: () => number) {
  let run = 0;
  return () => {
    const pOff = 0.1 + 0.36 * quiet * quiet + (run > 0 ? 0.32 : 0);
    if (rand() < pOff) {
      run++;
      return 0.035 + rand() * 0.05;
    }
    run = 0;
    if (rand() < 0.16) return 0.28 + rand() * 0.16;
    return 0.82 + rand() * 0.44;
  };
}

function buildPanes(): Pane[] {
  const panes: Pane[] = [];
  const rand = rng(20260);
  const meta = () => ({
    seed: rand() * 600 + 12,
    variant: Math.floor(rand() * 4),
    pal: Math.floor(rand() * 5),
  });

  // Tower
  TOWER_FACES.forEach((f) => {
    const bs = bays(f);
    for (let fl = 0; fl < TOWER.floors; fl++) {
      const nextLight = makeLightState(rand(), rand);
      const base = TOWER_FLOOR_TYPES[fl];
      const y = TOWER_BASE + fl * TOWER.fh;
      const yc = y + BAND_H + SILL + WIN_H / 2 - 0.25;
      for (const b of bs) {
        const [x, yy, z] = fp(f, b.u, yc, -0.3);
        const bright = nextLight();
        panes.push({ x, y: yy, z, w: b.w - 0.12, h: WIN_H, ry: f.ry, type: pickType(base, rand), bright, ...meta() });
      }
    }
  });

  // Podium storefronts. Bays run pier-face to pier-face (half - 1.6, matching the
  // corner-pier inner faces) and panes overlap 2 cm into their supports, so no
  // unfinished gap remains at any beam/wall junction.
  const pFaces: Face[] = [
    { ry: 0, half: PW / 2, off: PD / 2 },
    { ry: Math.PI, half: PW / 2, off: PD / 2 },
    { ry: Math.PI / 2, half: PD / 2, off: PW / 2 },
    { ry: -Math.PI / 2, half: PD / 2, off: PW / 2 },
  ];
  pFaces.forEach((f, fi) => {
    const usable = f.half - 1.6;

    // Ground floor bays (the front lobby bay is glazed by the Entrance instead).
    const ground: { u: number; w: number }[] = [];
    if (fi === 0) {
      const a = LOBBY_X + JAMB - 0.02; // die 2 cm into the jamb
      const end = usable + 0.02; // die 2 cm into the corner pier
      for (const s of [-1, 1]) ground.push({ u: (s * (a + end)) / 2, w: end - a });
    } else {
      const n = Math.max(3, Math.round((usable * 2) / 3.4));
      const w = (usable * 2) / n;
      for (let i = 0; i < n; i++) ground.push({ u: -usable + w * (i + 0.5), w: w + 0.02 });
    }
    for (const b of ground) {
      const [x, y, z] = fp(f, b.u, 2.5, -0.28);
      // Ground floor is always fully lit.
      const bright = 0.96 + rand() * 0.32;
      panes.push({ x, y, z, w: b.w - 0.02, h: 4.0, ry: f.ry, type: rand() < 0.72 ? 3 : 0, bright, ...meta() });
    }

    // First floor
    const n = Math.max(3, Math.round((usable * 2) / 3.4));
    const w = (usable * 2) / n;
    for (let i = 0; i < n; i++) {
      const [x, y, z] = fp(f, -usable + w * (i + 0.5), 7.85, -0.28);
      const bright = rand() < 0.24 ? 0.04 + rand() * 0.05 : rand() < 0.2 ? 0.3 + rand() * 0.14 : 0.8 + rand() * 0.45;
      panes.push({ x, y, z, w: w - 0.02, h: 2.15, ry: f.ry, type: pickType(rand() < 0.5 ? 2 : 5, rand), bright, ...meta() });
    }
  });

  return panes;
}

/* ------------------------------------------------------------------ */

export function MainBuilding({ night }: { night: boolean }) {
  const white = useMemo(buildWhiteFrame, []);
  const facade = useMemo(buildFacadeDetails, []);
  const roofRail = useMemo(buildRoofRail, []);
  const slats = useMemo(buildWoodSlats, []);
  const paneGeo = useMemo(() => buildPaneGeometry(buildPanes()), []);

  return (
    <>
      <group name="MainBuilding">
        <mesh name="Frame_White_Concrete" geometry={white} material={MAT.concrete} castShadow receiveShadow />
        <mesh name="Facade_Core_Dark" geometry={facade.dark} material={MAT.darkMetal} castShadow receiveShadow />
        <mesh name="Facade_Slats_Wood" geometry={slats} material={MAT.bronze} castShadow />
        <mesh name="Balcony_Slabs" geometry={facade.white} material={MAT.concrete} castShadow receiveShadow />
        <mesh name="Balcony_Decks" geometry={facade.wood} material={MAT.woodLight} receiveShadow />
        <mesh name="Balcony_Railing_Caps" geometry={facade.bronze} material={MAT.darkMetal} castShadow />
        <mesh name="Balcony_Planters" geometry={facade.planter} material={MAT.white} castShadow />
        <mesh name="Balcony_Hedges" geometry={facade.hedge} material={MAT.green} castShadow />
        <mesh name="Balcony_Soffit_Lights" geometry={facade.soffitLed} material={MAT.bulbWarm} />
      </group>
      <group name="FacadeGlass">
        <mesh name="Balcony_Glass" geometry={facade.balconyGlass} material={MAT.glass} renderOrder={10} />
        <mesh name="Rooftop_Glass_Railing" geometry={roofRail.glass} material={MAT.glass} renderOrder={10} />
        <mesh name="Rooftop_Railing_Cap" geometry={roofRail.cap} material={MAT.darkMetal} castShadow />
      </group>
      <group name="FacadeWindows">
        <InteriorWindowMesh name="Windows_ParallaxInteriors" geometry={paneGeo} night={night} />
        <mesh name="Facade_LED_Strips" geometry={facade.led} material={MAT.ledWhite} />
      </group>
    </>
  );
}
