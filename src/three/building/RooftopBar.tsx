import { useMemo } from 'react';
import * as THREE from 'three';
import { MAT } from '../materials';
import { box, cyl, merge, sphere, rng, type G } from '../geo';
import { Instances, type InstanceItem } from '../Instances';

/* Rooftop local space (origin = tower centre at deck level). */
export const BAR = {
  counter: { x0: 7.4, x1: 8.5, z0: -1.0, z1: 6.6, h: 1.15 },
  back: { x0: 9.6, x1: 11.0, z0: -1.0, z1: 6.6, h: 3.0 },
  canopy: { x0: 6.6, x1: 11.4, z0: -1.8, z1: 7.4, h: 3.2 },
};

/** Back-bar shelves project OUT of the cabinet face (toward the counter), so bottles are visible. */
const SHELF_Y = [0.95, 1.4, 1.85];
const SHELF_D = 0.25;
const SHELF_T = 0.045;

const mid = (a: number, b: number) => (a + b) / 2;
const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): G =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** Counter body, on a flush plinth so it stands on the deck instead of hovering. */
function buildWood(): G {
  const c = BAR.counter;
  return bx(c.x0, c.x1, 0.1, c.h, c.z0, c.z1);
}

function buildDark(): G {
  const c = BAR.counter;
  const b = BAR.back;
  const k = BAR.canopy;
  const p: G[] = [];
  p.push(bx(c.x0, c.x1, 0, 0.1, c.z0, c.z1)); // plinth, flush with the body
  p.push(bx(c.x0 - 0.21, c.x1 + 0.09, c.h, c.h + 0.07, c.z0 - 0.12, c.z1 + 0.12)); // stone top
  p.push(bx(b.x0, b.x1, 0, b.h, b.z0, b.z1)); // back-bar cabinet
  p.push(bx(k.x0, k.x1, k.h, k.h + 0.13, k.z0, k.z1)); // canopy slab
  // Pendant cords end at the canopy slab
  for (let i = 0; i < 5; i++) {
    p.push(cyl(0.012, 0.012, 1.0, mid(c.x0, c.x1), k.h - 0.5, c.z0 + 0.6 + i * 1.65, 4));
  }
  return merge(p);
}

/** Bottle glass: body, sloped shoulder and neck. The cap is a separate dark mesh. */
function buildBottleGlassGeometry(): G {
  return merge([
    cyl(0.065, 0.075, 0.2, 0, 0.1, 0, 8),
    cyl(0.046, 0.065, 0.08, 0, 0.24, 0, 8),
    cyl(0.028, 0.032, 0.08, 0, 0.32, 0, 7),
  ]);
}

/** Dark foil cap that tops every bottle. */
function buildBottleCapGeometry(): G {
  return cyl(0.034, 0.034, 0.03, 0, 0.371, 0, 7);
}

function buildBronze(): G {
  const b = BAR.back;
  const k = BAR.canopy;
  const c = BAR.counter;
  const p: G[] = [];
  // Shelves attach to the cabinet face (shorter than the glow panel so no coplanar ends)
  for (const y of SHELF_Y) {
    p.push(bx(b.x0 - SHELF_D, b.x0, y - SHELF_T / 2, y + SHELF_T / 2, b.z0 + 0.15, b.z1 - 0.15));
  }
  // Canopy posts + slats whose tops touch the slab underside
  for (const [x, z] of [
    [k.x0 + 0.12, k.z0 + 0.12],
    [k.x0 + 0.12, k.z1 - 0.12],
    [k.x1 - 0.12, k.z0 + 0.12],
    [k.x1 - 0.12, k.z1 - 0.12],
  ]) {
    p.push(box(0.14, k.h, 0.14, x, k.h / 2, z));
  }
  for (let z = k.z0 + 0.3; z < k.z1 - 0.1; z += 0.45) {
    p.push(box(k.x1 - k.x0 - 0.12, 0.1, 0.07, mid(k.x0, k.x1), k.h - 0.05, z));
  }
  // Foot rail runs against the counter front
  const rail = new THREE.CylinderGeometry(0.028, 0.028, c.z1 - c.z0 - 0.2, 6);
  rail.rotateX(Math.PI / 2);
  rail.translate(c.x0 - 0.028, 0.24, mid(c.z0, c.z1));
  p.push(rail);
  return merge(p);
}

function buildPendants(): G {
  const c = BAR.counter;
  const k = BAR.canopy;
  const p: G[] = [];
  for (let i = 0; i < 5; i++) {
    p.push(sphere(0.13, mid(c.x0, c.x1), k.h - 1.05, c.z0 + 0.6 + i * 1.65, 10, 7));
  }
  return merge(p);
}

function buildLed(): G {
  const c = BAR.counter;
  const b = BAR.back;
  return merge([
    // toe-kick strip on the plinth face
    bx(c.x0 - 0.03, c.x0, 0.035, 0.065, c.z0 + 0.1, c.z1 - 0.1),
    // under the stone overhang
    bx(c.x0 - 0.17, c.x0 - 0.14, c.h - 0.03, c.h, c.z0 + 0.1, c.z1 - 0.1),
    // under each shelf front edge
    ...SHELF_Y.map((y) =>
      bx(b.x0 - SHELF_D + 0.02, b.x0 - SHELF_D + 0.05, y - SHELF_T / 2 - 0.03, y - SHELF_T / 2, b.z0 + 0.2, b.z1 - 0.2),
    ),
  ]);
}

/** Pink panel lying on the cabinet face, behind the bottles. */
function buildBackPanel(): G {
  const b = BAR.back;
  return bx(b.x0 - 0.03, b.x0, 0.4, 2.35, b.z0 + 0.1, b.z1 - 0.1);
}

/** Deep liquor tones — amber whiskey, green gin, red aperitif, gold tequila, clear vodka. */
const BOTTLE_COLORS = ['#8a3c10', '#0f5d2c', '#8f1010', '#c9a227', '#e8e4da', '#1a4a6b', '#b3541e', '#4a1a5e'];

function buildBottleItems(): InstanceItem[] {
  const b = BAR.back;
  const rand = rng(42);
  const items: InstanceItem[] = [];
  for (const y of SHELF_Y) {
    for (let z = b.z0 + 0.35; z < b.z1 - 0.3; z += 0.26) {
      if (rand() < 0.13) continue;
      items.push({
        p: [b.x0 - SHELF_D / 2 + (rand() - 0.5) * 0.06, y + SHELF_T / 2 + 0.01, z + (rand() - 0.5) * 0.04],
        c: BOTTLE_COLORS[Math.floor(rand() * BOTTLE_COLORS.length)],
      });
    }
  }
  return items;
}

function buildStoolItems(): InstanceItem[] {
  const c = BAR.counter;
  const items: InstanceItem[] = [];
  for (let i = 0; i < 8; i++) items.push({ p: [c.x0 - 0.62, 0, c.z0 + 0.55 + i * 1.0] });
  return items;
}

/** BAR sign: a thin backing plate lying on the cabinet face above the bottles. */
const SIGN_Y = 2.65;
function buildSignBack(): G {
  const b = BAR.back;
  return bx(b.x0 - 0.05, b.x0, SIGN_Y - 0.3, SIGN_Y + 0.3, mid(b.z0, b.z1) - 0.65, mid(b.z0, b.z1) + 0.65);
}

export function RooftopBar() {
  const wood = useMemo(buildWood, []);
  const dark = useMemo(buildDark, []);
  const bronze = useMemo(buildBronze, []);
  const pendants = useMemo(buildPendants, []);
  const led = useMemo(buildLed, []);
  const panel = useMemo(buildBackPanel, []);
  const signBack = useMemo(buildSignBack, []);
  const bottleItems = useMemo(buildBottleItems, []);
  const stoolItems = useMemo(buildStoolItems, []);

  const bottleGlassGeo = useMemo(buildBottleGlassGeometry, []);
  const bottleCapGeo = useMemo(buildBottleCapGeometry, []);
  const stoolFrame = useMemo(
    () => merge([cyl(0.025, 0.025, 0.72, 0, 0.36, 0, 8), cyl(0.2, 0.22, 0.03, 0, 0.015, 0, 12), cyl(0.12, 0.12, 0.02, 0, 0.3, 0, 10)]),
    [],
  );
  const stoolSeat = useMemo(() => new THREE.CylinderGeometry(0.19, 0.17, 0.09, 12).translate(0, 0.77, 0), []);

  return (
    <group name="RooftopBar">
      <mesh name="Bar_Counter_Wood" geometry={wood} material={MAT.woodLight} castShadow receiveShadow />
      <mesh name="Bar_Structure_Dark" geometry={dark} material={MAT.darkMetal} castShadow receiveShadow />
      <mesh name="Bar_Sign_Back" geometry={signBack} material={MAT.darkMetal} />
      <mesh name="Bar_Details_Bronze" geometry={bronze} material={MAT.bronze} castShadow />
      <mesh name="Bar_Pendants" geometry={pendants} material={MAT.bulbWarm} />
      <mesh name="Bar_LED_Cyan" geometry={led} material={MAT.neonCyan} />
      <mesh name="Bar_BackPanel_Dark" geometry={panel} material={MAT.darkMetal} />
      <Instances name="Bar_Bottles_Glass" geometry={bottleGlassGeo} material={MAT.bottles} items={bottleItems} />
      <Instances name="Bar_Bottles_Caps" geometry={bottleCapGeo} material={MAT.darkMetal} items={bottleItems} />
      <Instances name="Bar_Stool_Frames" geometry={stoolFrame} material={MAT.darkMetal} items={stoolItems} castShadow />
      <Instances name="Bar_Stool_Seats" geometry={stoolSeat} material={MAT.teal} items={stoolItems} castShadow />
    </group>
  );
}

export { SIGN_Y as BAR_SIGN_Y };
