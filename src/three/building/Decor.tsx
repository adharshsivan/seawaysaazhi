import { useMemo } from 'react';
import { MAT } from '../materials';
import { box, cyl, merge, sphere, type G } from '../geo';
import { GROUND_TREES, SITE } from '../site/layout';

type Planter = { x: number; y: number; z: number; len: number; alongZ?: boolean };
type Tree = { x: number; y: number; z: number; s?: number };

function planterConcrete(list: Planter[]): G[] {
  return list.map((p) => (p.alongZ ? box(0.55, 0.5, p.len, p.x, p.y + 0.25, p.z) : box(p.len, 0.5, 0.55, p.x, p.y + 0.25, p.z)));
}
function planterHedge(list: Planter[]): G[] {
  return list.map((p) =>
    p.alongZ ? box(0.45, 0.42, p.len - 0.1, p.x, p.y + 0.68, p.z) : box(p.len - 0.1, 0.42, 0.45, p.x, p.y + 0.68, p.z),
  );
}
function treePots(list: Tree[]): G[] {
  return list.map((t) => cyl(0.42 * (t.s ?? 1), 0.34 * (t.s ?? 1), 0.7, t.x, t.y + 0.35, t.z, 12));
}
function treeTrunks(list: Tree[]): G[] {
  return list.map((t) => cyl(0.05, 0.08, 1.4 * (t.s ?? 1), t.x, t.y + 0.7 + 0.7 * (t.s ?? 1), t.z, 7));
}
function treeCanopies(list: Tree[]): G[] {
  const out: G[] = [];
  for (const t of list) {
    const s = t.s ?? 1;
    const y = t.y + 0.7 + 1.4 * s + 0.5 * s;
    out.push(sphere(0.85 * s, t.x, y, t.z, 9, 7));
    out.push(sphere(0.55 * s, t.x + 0.5 * s, y + 0.35 * s, t.z + 0.2 * s, 8, 6));
    out.push(sphere(0.5 * s, t.x - 0.45 * s, y + 0.25 * s, t.z - 0.3 * s, 8, 6));
  }
  return out;
}

/* ---------------- Rooftop (local space) ---------------- */

/**
 * Roof planting — kept OFF the circulation loop so the terrace stays walkable:
 * a full-width path runs the west side, the east side past the bar, and the
 * band between pavilion and pergola.
 */
const ROOF_PLANTERS: Planter[] = [
  // One planter in the back-east corner; everything else is left open for circulation.
  { x: 11.3, y: 0, z: -7.8, len: 3.2, alongZ: true },
];
const ROOF_TREES: Tree[] = [
  // corner accents, clear of the walkways
  { x: 11.3, y: 0, z: -5.2, s: 0.95 },
  // Paired trees frame the path into the pool without occupying its side walkways.
  { x: -10.65, y: 0, z: 14.4, s: 0.9 },
  { x: 10.65, y: 0, z: 14.4, s: 0.9 },
];

export function RooftopDecor() {
  const concrete = useMemo(() => merge([...planterConcrete(ROOF_PLANTERS), ...treePots(ROOF_TREES)]), []);
  const foliage = useMemo(() => merge([...planterHedge(ROOF_PLANTERS), ...treeCanopies(ROOF_TREES)]), []);
  const trunks = useMemo(() => merge(treeTrunks(ROOF_TREES)), []);
  return (
    <group name="Decor_Rooftop">
      <mesh name="Roof_Planters" geometry={concrete} material={MAT.concrete} castShadow receiveShadow />
      <mesh name="Roof_Foliage" geometry={foliage} material={MAT.green} castShadow />
      <mesh name="Roof_Trunks" geometry={trunks} material={MAT.wood} />
    </group>
  );
}

/* ---------------- Podium terrace + ground (world space) ---------------- */

// Ground trees are planted directly in the shared lawn beds, not in path-blocking pots.
const SITE_TREES: Tree[] = GROUND_TREES.map(([x, z]) => ({ x, z, y: SITE.lawnY - 0.7, s: 1.25 }));

export function SiteDecor() {
  const foliage = useMemo(() => merge(treeCanopies(SITE_TREES)), []);
  const wood = useMemo(() => merge(treeTrunks(SITE_TREES)), []);
  return (
    <group name="Decor_Site">
      <mesh name="Site_Foliage" geometry={foliage} material={MAT.green} castShadow />
      <mesh name="Site_Wood" geometry={wood} material={MAT.wood} />
    </group>
  );
}

/** Re-exported so the podium terrace can build matching planters and trees. */
export const decorBuilders = { planterConcrete, planterHedge, treePots, treeTrunks, treeCanopies };
export type { Planter, Tree };
