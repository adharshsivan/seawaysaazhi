import { useMemo } from 'react';
import * as THREE from 'three';
import { MAT } from '../materials';
import { box, cyl, merge, plankFloor, ring, type G } from '../geo';
import { Instances, type InstanceItem } from '../Instances';
import { makeChairGeos } from './SeatingArea';
import { decorBuilders, type Planter, type Tree } from './Decor';
import { PODIUM } from '../dims';

/**
 * First-floor (podium) roof terrace — group origin = podium roof surface: world [0, PODIUM.h, 0].
 *
 * The roof is solid (full-footprint core + roof band), the wood deck runs right up to the
 * kerb and the tower plinth, and the glass guardrail stands on the kerb. Tables and chairs
 * only: no sofas, no benches, no table lights.
 */

const FRONT = PODIUM.d / 2; // 15
const TOWER_FRONT = 10; // tower front face (the exit door sits here)
const HALF_W = PODIUM.w / 2; // 17
const HALF_D = PODIUM.d / 2; // 15
/** Tower plinth outer faces (kept in step with MainBuilding). */
const PLINTH_X = 12.75;
const PLINTH_Z = 10.75;

const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): G =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

/** Glass guardrail standing on the kerb top (kerb: ±17.0…17.25, 0.4 high). */
export function PodiumTerraceRailing() {
  const glass = useMemo(() => merge(ring(34.3, 30.3, 0.045, 0.75, 0, 0.775, 0)), []);
  const cap = useMemo(() => merge(ring(34.34, 30.34, 0.07, 0.05, 0, 1.175, 0)), []);
  return (
    <group name="PodiumRoofGlassRailing" position={[0, PODIUM.h, 0]}>
      <mesh name="Podium_Roof_Glass_Railing" geometry={glass} material={MAT.glass} renderOrder={10} />
      <mesh name="Podium_Roof_Railing_Cap" geometry={cap} material={MAT.darkMetal} castShadow />
    </group>
  );
}

/* ---------------- Tables & chairs ---------------- */

const TABLES: [number, number][] = [
  [-13.2, 12.9],
  [-9.8, 12.9],
  [-6.4, 12.9],
  [6.4, 12.9],
  [9.8, 12.9],
  [13.2, 12.9],
  [-14.8, 5.0],
  [-14.8, -2.0],
  [-14.8, -9.0],
  [14.8, 5.0],
  [14.8, -2.0],
  [14.8, -9.0],
];

function buildChairItems(): InstanceItem[] {
  const items: InstanceItem[] = [];
  TABLES.forEach(([tx, tz], ti) => {
    const base = Math.PI / 4 + (ti % 2 === 0 ? 0 : Math.PI / 8);
    for (let k = 0; k < 4; k++) {
      const a = base + (k * Math.PI * 2) / 4;
      const x = tx + Math.cos(a) * 0.74;
      const z = tz + Math.sin(a) * 0.74;
      items.push({ p: [x, 0.05, z], r: [0, Math.atan2(tx - x, tz - z), 0] });
    }
  });
  return items;
}

/* ---------------- Wood deck: continuous from the tower plinth to the kerb ---------------- */

function buildWoodDeck(): G {
  const Y = 0.025; // plank centre → top sits 0.05 above the roof surface
  const depth = HALF_D - PLINTH_Z; // 4.25
  const sideW = HALF_W - PLINTH_X; // 4.25
  return merge([
    plankFloor(HALF_W * 2, depth, 0, Y, PLINTH_Z + depth / 2), // front strip (full width)
    plankFloor(HALF_W * 2, depth, 0, Y, -(PLINTH_Z + depth / 2)), // back strip (full width)
    plankFloor(sideW, PLINTH_Z * 2, PLINTH_X + sideW / 2, Y, 0, false), // east strip
    plankFloor(sideW, PLINTH_Z * 2, -(PLINTH_X + sideW / 2), Y, 0, false), // west strip
  ]);
}

/* ---------------- Planters & trees ---------------- */

const PLANTERS: Planter[] = [
  // front, behind the table row (gap in the middle for the exit walkway)
  { x: -9.8, y: 0.05, z: 14.55, len: 10.6 },
  { x: 9.8, y: 0.05, z: 14.55, len: 10.6 },
  // sides, against the kerb
  { x: -16.72, y: 0.05, z: 6.0, len: 5.0, alongZ: true },
  { x: -16.72, y: 0.05, z: -3.0, len: 5.0, alongZ: true },
  { x: 16.72, y: 0.05, z: 6.0, len: 5.0, alongZ: true },
  { x: 16.72, y: 0.05, z: -3.0, len: 5.0, alongZ: true },
  // back
  { x: -8.0, y: 0.05, z: -14.6, len: 9.0 },
  { x: 8.0, y: 0.05, z: -14.6, len: 9.0 },
];
const TREES: Tree[] = [
  { x: -15.9, y: 0.05, z: 13.7, s: 1.0 },
  { x: 15.9, y: 0.05, z: 13.7, s: 1.0 },
  { x: -15.9, y: 0.05, z: -13.7, s: 1.1 },
  { x: 15.9, y: 0.05, z: -13.7, s: 1.1 },
];

/* ---------------- Glazed exit onto the terrace ---------------- */
/*
 * Layers on the bulkhead's front face (z = 11.125), each one touching the previous:
 *   face → warm glow (0.03) → glass doors (0.04) → bronze frame (0.105 in total)
 */

const BULK_Z0 = TOWER_FRONT - 0.025;
const BULK_Z1 = TOWER_FRONT + 1.125;
const BULK_TOP = 2.8;
const DECK = 0.05;

function buildExitDark(): G {
  return merge([
    bx(-1.35, 1.35, DECK, BULK_TOP, BULK_Z0, BULK_Z1), // bulkhead on the deck
    bx(-1.7, 1.7, BULK_TOP, BULK_TOP + 0.26, BULK_Z0, BULK_Z1 + 0.78), // canopy slab sitting on the bulkhead
  ]);
}
function buildExitGlow(): G {
  return bx(-1.0, 1.0, DECK, 2.35, BULK_Z1, BULK_Z1 + 0.03);
}
function buildExitDoors(): G {
  const z0 = BULK_Z1 + 0.03;
  return merge([bx(-1.05, -0.02, DECK, 2.35, z0, z0 + 0.04), bx(0.02, 1.05, DECK, 2.35, z0, z0 + 0.04)]);
}
function buildExitBronze(): G {
  const p: G[] = [];
  const z0 = BULK_Z1;
  const z1 = BULK_Z1 + 0.105;
  for (const x of [-1.12, -0.03, 0.03, 1.12]) p.push(bx(x - 0.04, x + 0.04, DECK, 2.45, z0, z1));
  p.push(bx(-1.16, 1.16, 2.35, 2.45, z0, z1));
  // Pulls start inside the glass (front face at BULK_Z1 + 0.07) so they are attached
  for (const x of [-0.14, 0.14]) p.push(bx(x - 0.025, x + 0.025, 1.0, 1.9, BULK_Z1 + 0.065, BULK_Z1 + 0.12));
  // Canopy columns: foot on the deck, top inside the canopy slab
  for (const x of [-1.55, 1.55]) p.push(cyl(0.08, 0.08, BULK_TOP + 0.1 - DECK, x, (DECK + BULK_TOP + 0.1) / 2, BULK_Z1 + 0.7, 8));
  return merge(p);
}

/* ------------------------------------------------------------------ */

export function PodiumTerrace() {
  const wood = useMemo(buildWoodDeck, []);
  const exitDark = useMemo(buildExitDark, []);
  const doors = useMemo(buildExitDoors, []);
  const exitBronze = useMemo(buildExitBronze, []);
  const exitGlow = useMemo(buildExitGlow, []);

  const planters = useMemo(() => merge([...decorBuilders.planterConcrete(PLANTERS), ...decorBuilders.treePots(TREES)]), []);
  const foliage = useMemo(() => merge([...decorBuilders.planterHedge(PLANTERS), ...decorBuilders.treeCanopies(TREES)]), []);
  const trunks = useMemo(() => merge(decorBuilders.treeTrunks(TREES)), []);

  const chairs = useMemo(makeChairGeos, []);
  const chairItems = useMemo(buildChairItems, []);
  const tableItems = useMemo<InstanceItem[]>(() => TABLES.map(([x, z]) => ({ p: [x, 0.05, z] })), []);

  const tableTop = useMemo(() => new THREE.CylinderGeometry(0.46, 0.46, 0.05, 18).translate(0, 0.74, 0), []);
  const tableBase = useMemo(
    () => merge([cyl(0.035, 0.035, 0.7, 0, 0.36, 0, 8), cyl(0.26, 0.28, 0.04, 0, 0.02, 0, 14)]),
    [],
  );

  return (
    <group name="PodiumTerrace" position={[0, PODIUM.h, 0]}>
      <mesh name="Terrace_Deck_Wood" geometry={wood} material={MAT.wood} receiveShadow />

      <mesh name="Terrace_Exit_Bulkhead" geometry={exitDark} material={MAT.darkMetal} castShadow receiveShadow />
      <mesh name="Terrace_Exit_Glow" geometry={exitGlow} material={MAT.interiorGlow} />
      <mesh name="Terrace_Exit_Doors" geometry={doors} material={MAT.glass} renderOrder={12} />
      <mesh name="Terrace_Exit_Frames" geometry={exitBronze} material={MAT.bronze} castShadow />

      <Instances name="Terrace_TableTops" geometry={tableTop} material={MAT.white} items={tableItems} castShadow />
      <Instances name="Terrace_TableBases" geometry={tableBase} material={MAT.darkMetal} items={tableItems} />
      <Instances name="Terrace_Chairs_Seat" geometry={chairs.soft} material={MAT.cream} items={chairItems} castShadow />
      <Instances name="Terrace_Chairs_Frame" geometry={chairs.frame} material={MAT.darkMetal} items={chairItems} />

      <mesh name="Terrace_Planters" geometry={planters} material={MAT.concrete} castShadow receiveShadow />
      <mesh name="Terrace_Hedges" geometry={foliage} material={MAT.green} castShadow />
      <mesh name="Terrace_Trunks" geometry={trunks} material={MAT.wood} />

      <pointLight name="PL_Terrace" position={[0, 2.6, FRONT - 3]} color="#ffcf9c" intensity={22} distance={16} decay={2} />
    </group>
  );
}
