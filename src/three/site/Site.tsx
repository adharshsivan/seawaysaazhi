import { useMemo } from 'react';
import * as THREE from 'three';
import { MAT } from '../materials';
import { box, cyl, merge, rng, type G } from '../geo';
import { Instances, type InstanceItem } from '../Instances';
import {
  SITE, PARK, DRIVE_INNER, BUILDING_AND_ENTRY, COURT_BEDS,
  PERIMETER_BEDS, OCCUPIED_BAYS, PARKING_BAYS, SITE_LAMPS, PEDESTRIAN_ROUTES,
  vehicleCircuit, validateSiteLayout, type Point2, type SiteRect,
} from './layout';
import { getPavingMaterial, insetRect, mergeSite, ramp, rampX, rectPoints, roundedRect, siteSurface } from './siteGeometry';
import { ForecourtFountain } from './ForecourtFountain';

const rect = (x0: number, x1: number, z0: number, z1: number): SiteRect => ({ x0, x1, z0, z1 });
const slab = (area: SiteRect, top: number, bottom = -0.06) => siteSurface(rectPoints(area), bottom, top);
const reflect = (points: Point2[], side: number): Point2[] => points.map(([x, z]) => [side * x, z]);
const roadPaint = (w: number, d: number, x: number, z: number) => box(w, 0.005, d, x, 0.0055, z);

function buildDrive() {
  return mergeSite([
    siteSurface(rectPoints(rect(-PARK.outerEdge, PARK.outerEdge, SITE.driveBack, SITE.driveFront)), -0.08, SITE.roadY, [DRIVE_INNER]),
    slab(rect(-SITE.driveHalfWidth, SITE.driveHalfWidth, SITE.driveFront, SITE.streetNear), SITE.roadY, -0.08),
    slab(rect(-100, 100, SITE.streetNear, SITE.streetFar), SITE.roadY, -0.08),
  ]);
}

function buildPaving() {
  // Notches reserve real sloped connections instead of overlaying ramps on a flat path.
  const court: Point2[] = [
    [-21.2, -17.8], [21.2, -17.8], [21.2, 19.2], [19.8, 19.2],
    [19.8, 22.2], [21.2, 22.2], [21.2, 23.5], [18.9, 25.8],
    [8.25, 25.8], [8.25, 24.4], [5.25, 24.4], [5.25, 25.8],
    [-5.25, 25.8], [-5.25, 24.4], [-8.25, 24.4], [-8.25, 25.8],
    [-18.9, 25.8], [-21.2, 23.5], [-21.2, 22.2], [-19.8, 22.2],
    [-19.8, 19.2], [-21.2, 19.2],
  ];
  const parts: G[] = [siteSurface(court, -0.06, SITE.pavingY, [
    BUILDING_AND_ENTRY, ...COURT_BEDS.map((bed) => roundedRect(bed)),
  ])];

  for (const side of [-1, 1]) {
    const positiveWalk: Point2[] = [
      [PARK.outerWalkX0, -14.4], [PARK.outerWalkX1, -14.4],
      [PARK.outerWalkX1, 22.2], [41.25, 22.2], [41.25, 19.2], [PARK.outerWalkX0, 19.2],
    ];
    parts.push(siteSurface(reflect(positiveWalk, side), -0.06, SITE.pavingY));
    parts.push(side > 0
      ? rampX(rect(19.8, PARK.innerEdge, 19.2, 22.2), SITE.pavingY, SITE.roadY)
      : rampX(rect(-PARK.innerEdge, -19.8, 19.2, 22.2), SITE.roadY, SITE.pavingY));
    parts.push(side > 0
      ? rampX(rect(PARK.outerEdge, 41.25, 19.2, 22.2), SITE.roadY, SITE.pavingY)
      : rampX(rect(-41.25, -PARK.outerEdge, 19.2, 22.2), SITE.pavingY, SITE.roadY));

    const xa = side > 0 ? 5.25 : -8.25;
    const xb = side > 0 ? 8.25 : -5.25;
    parts.push(ramp(rect(xa, xb, 24.4, 26), SITE.pavingY, SITE.roadY));
    parts.push(ramp(rect(xa, xb, SITE.driveFront, 34.9), SITE.roadY, SITE.pavingY));
    parts.push(slab(rect(xa, xb, 34.9, 40.5), SITE.pavingY));
  }
  // The city sidewalk has a real 10.5 m opening at the driveway.
  parts.push(slab(rect(-100, -5.25, 40.5, 42.78), SITE.pavingY));
  parts.push(slab(rect(5.25, 100, 40.5, 42.78), SITE.pavingY));
  parts.push(slab(rect(-100, 100, 57.22, 59.5), SITE.pavingY));
  return mergeSite(parts);
}

function buildLandscape() {
  const grass: G[] = [];
  const edging: G[] = [];
  for (const bed of [...COURT_BEDS, ...PERIMETER_BEDS]) {
    const inner = insetRect(bed, SITE.curbWidth);
    const radius = COURT_BEDS.includes(bed) ? 0.6 : 0.9;
    const outerPoints = roundedRect(bed, radius);
    const innerPoints = roundedRect(inner, radius - SITE.curbWidth);
    grass.push(siteSurface(innerPoints, -0.06, SITE.lawnY));
    edging.push(siteSurface(outerPoints, -0.06, SITE.pavingY, [innerPoints]));
  }
  return { grass: mergeSite(grass), edging: mergeSite(edging) };
}

function buildCurbs() {
  const parts: G[] = [];
  const add = (area: SiteRect) => parts.push(slab(area, SITE.pavingY));
  add(rect(-21.45, 21.45, -18, -17.8));
  for (const side of [-1, 1]) {
    const mirrored = (area: SiteRect) => side > 0 ? area : rect(-area.x1, -area.x0, area.z0, area.z1);
    add(mirrored(rect(21.2, 21.45, -17.8, 19.2)));
    add(mirrored(rect(21.2, 21.45, 22.2, 23.5)));
    parts.push(siteSurface(reflect([
      [21.2, 23.5], [21.45, 23.5], [21.45, 23.6], [19.1, 26], [18.9, 25.8],
    ], side), -0.06, SITE.pavingY));
    add(mirrored(rect(PARK.outerEdge, PARK.outerWalkX0, -14.62, 19.2)));
    add(mirrored(rect(PARK.outerWalkX0, PARK.outerWalkX1, -14.62, -14.4)));
    add(mirrored(rect(PARK.outerWalkX1, PARK.outerWalkX1 + 0.22, -14.62, 22.42)));
    add(mirrored(rect(PARK.outerEdge, PARK.outerWalkX1, 22.2, 22.42)));
    add(mirrored(rect(5, 5.25, SITE.driveFront, SITE.streetNear)));
    add(mirrored(rect(5.25, 100, 42.78, SITE.streetNear)));
  }
  for (const [x0, x1] of [[-19.1, -8.25], [-5.25, 5.25], [8.25, 19.1]]) add(rect(x0, x1, 25.8, 26));
  add(rect(-100, 100, SITE.streetFar, 57.22));
  return mergeSite(parts);
}

function arrow(x: number, z: number, angle: number): G {
  const local: Point2[] = [[-0.13, 1.15], [0.13, 1.15], [0.13, -0.28], [0.58, -0.28], [0, -1.15], [-0.58, -0.28], [-0.13, -0.28]];
  const points: Point2[] = local.map(([px, pz]) => [x + px * Math.cos(angle) - pz * Math.sin(angle), z + px * Math.sin(angle) + pz * Math.cos(angle)]);
  return siteSurface(points, 0.003, 0.008);
}

function buildTrafficMarkings() {
  const parts: G[] = [];
  for (let x = -96; x < 100; x += 8) parts.push(roadPaint(3.4, 0.14, x, 50));
  for (const side of [-1, 1]) {
    // Full pedestrian links across the parking aisle, beyond the last parking bay.
    for (let x = PARK.innerEdge + 0.2; x < PARK.outerEdge - 0.1; x += 0.95) {
      parts.push(roadPaint(0.48, 2.8, side * x, 20.7));
    }
    // Gate footways cross the front drive via marked, flush crossings.
    for (let z = 26.3; z < SITE.driveFront - 0.2; z += 0.95) {
      parts.push(roadPaint(2.8, 0.48, side * 6.75, z));
    }
    parts.push(arrow(side * PARK.aisleCenter, 8.5, side > 0 ? 0 : Math.PI));
  }
  parts.push(arrow(-2.5, 38, 0), arrow(2.5, 38, Math.PI));
  return mergeSite(parts);
}

export function Ground({ night, lighting }: { night: boolean; lighting: boolean }) {
  const terrain = useMemo(() => new THREE.PlaneGeometry(230, 180).rotateX(-Math.PI / 2).translate(0, -0.06, 12), []);
  const drive = useMemo(buildDrive, []);
  const paving = useMemo(buildPaving, []);
  const landscape = useMemo(buildLandscape, []);
  const curbs = useMemo(buildCurbs, []);
  const markings = useMemo(buildTrafficMarkings, []);
  const material = useMemo(getPavingMaterial, []);
  const checks = useMemo(validateSiteLayout, []);
  const navigation = useMemo(() => ({
    units: 'metres', vehicleWidth: 2.16, vehicleLength: 4.6,
    aisleWidth: PARK.aisleWidth, minimumTurnRadius: 6,
    drivingCircuit: vehicleCircuit().map(({ x, z }) => [x, SITE.roadY, z]),
    pedestrianRoutes: PEDESTRIAN_ROUTES,
    validationErrors: checks,
  }), [checks]);

  return (
    <group name="Site_Ground" userData={{ lokamNavigation: navigation }}>
      <mesh name="Context_Ground" geometry={terrain} material={MAT.plaza} receiveShadow />
      <mesh name="Continuous_Drive_And_Street" geometry={drive} material={MAT.ground} receiveShadow userData={{ surface: 'drivable' }} />
      <mesh name="Forecourt_And_Pedestrian_Paving" geometry={paving} material={material} receiveShadow userData={{ surface: 'walkable' }} />
      <mesh name="Contained_Lawn_Beds" geometry={landscape.grass} material={MAT.lawn} receiveShadow />
      <mesh name="Landscape_Edging" geometry={landscape.edging} material={MAT.concrete} receiveShadow />
      <mesh name="Continuous_Curbs_With_Crossing_Gaps" geometry={curbs} material={MAT.concrete} receiveShadow />
      <mesh name="Traffic_And_Crosswalk_Markings" geometry={markings} material={MAT.white} />
      <ForecourtFountain night={night} lighting={lighting} />
    </group>
  );
}

function buildBayLines() {
  const parts: G[] = [];
  for (const side of [-1, 1]) {
    for (const rowCenter of [PARK.innerRow, PARK.outerRow]) {
      for (let i = 0; i <= PARK.count; i++) parts.push(roadPaint(PARK.bayDepth, 0.085, side * rowCenter, PARK.startZ + i * PARK.bayWidth));
      const head = rowCenter === PARK.innerRow ? PARK.innerEdge : PARK.outerEdge;
      parts.push(roadPaint(0.085, PARK.count * PARK.bayWidth, side * head, PARK.startZ + PARK.count * PARK.bayWidth / 2));
    }
  }
  return merge(parts);
}

function buildWheelStops() {
  return merge(PARKING_BAYS.map((bay) => {
    const x = bay.side * (bay.row === 'inner' ? PARK.innerEdge + 0.45 : PARK.outerEdge - 0.45);
    return box(0.16, 0.09, 1.65, x, 0.045, bay.cz);
  }));
}

function carParts() {
  const body = merge([
    box(1.95, 0.66, 4.45, 0, 0.62, 0),
    box(1.86, 0.16, 2.6, 0, 0.98, -0.25),
    box(1.72, 0.56, 2.35, 0, 1.3, -0.3),
  ]);
  const glass = box(1.76, 0.5, 2.25, 0, 1.32, -0.3);
  const wheels = [[-0.94, 1.42], [0.94, 1.42], [-0.94, -1.42], [0.94, -1.42]].map(([x, z]) => {
    const geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 10);
    geometry.rotateZ(Math.PI / 2);
    geometry.translate(x, 0.35, z);
    return geometry;
  });
  const dark = merge([...wheels, box(1.9, 0.14, 4.3, 0, 0.3, 0)]);
  const headlights = merge([-0.62, 0.62].map((x) => box(0.42, 0.16, 0.07, x, 0.86, 2.24)));
  const rearLights = merge([-0.62, 0.62].map((x) => box(0.42, 0.14, 0.07, x, 0.86, -2.24)));
  return { body, glass, dark, headlights, rearLights };
}

export function Parking() {
  const lines = useMemo(buildBayLines, []);
  const stops = useMemo(buildWheelStops, []);
  const cars = useMemo(carParts, []);
  const items = useMemo<InstanceItem[]>(() => {
    const random = rng(45821);
    const colors = ['#e8e7e1', '#364955', '#92382d', '#647b7a', '#bb9360', '#252a33'];
    return OCCUPIED_BAYS.map((bay) => ({ p: [bay.cx, SITE.roadY, bay.cz], r: [0, bay.rotation, 0], c: colors[Math.floor(random() * colors.length)] }));
  }, []);
  const transforms = useMemo(() => items.map(({ p, r }) => ({ p, r })), [items]);
  return (
    <group name="Site_Parking" userData={{ bays: PARKING_BAYS, parked: OCCUPIED_BAYS.map(({ id }) => id) }}>
      <mesh name="Parking_Bay_Markings" geometry={lines} material={MAT.white} />
      <mesh name="Parking_Head_WheelStops" geometry={stops} material={MAT.concreteDark} />
      <Instances name="Cars_Bodies" geometry={cars.body} material={MAT.white} items={items} castShadow />
      <Instances name="Cars_Glass" geometry={cars.glass} material={MAT.glass} items={transforms} />
      <Instances name="Cars_Wheels" geometry={cars.dark} material={MAT.darkMetal} items={transforms} castShadow />
      <Instances name="Cars_Headlamps_Unlit" geometry={cars.headlights} material={MAT.white} items={transforms} />
      <Instances name="Cars_TailLamps_Unlit" geometry={cars.rearLights} material={MAT.coral} items={transforms} />
    </group>
  );
}

function buildPerimeter() {
  const panels: G[] = [];
  const piers: G[] = [];
  const caps: G[] = [];
  const posts = new Map<string, Point2>();
  const isGatePier = (x: number, z: number) => Math.abs(z - SITE.gateZ) < 0.001 && Math.abs(Math.abs(x) - SITE.gatePierX) < 0.001;
  const runs: [Point2, Point2][] = [
    [[-48, -25], [-48, 34]], [[48, -25], [48, 34]], [[-48, -25], [48, -25]],
    [[-48, 34], [-9, 34]], [[9, 34], [48, 34]],
  ];
  for (const [[ax, az], [bx, bz]] of runs) {
    const length = Math.hypot(bx - ax, bz - az);
    const count = Math.ceil(length / 6);
    const dx = (bx - ax) / count;
    const dz = (bz - az) / count;
    const angle = -Math.atan2(dz, dx);
    for (let i = 0; i <= count; i++) posts.set(`${(ax + dx * i).toFixed(2)},${(az + dz * i).toFixed(2)}`, [ax + dx * i, az + dz * i]);
    for (let i = 0; i < count; i++) {
      const startGate = isGatePier(ax + dx * i, az + dz * i);
      const endGate = isGatePier(ax + dx * (i + 1), az + dz * (i + 1));
      const startOffset = startGate ? 0.6 : 0.35;
      const endOffset = endGate ? 0.6 : 0.35;
      const runLength = length / count;
      const centreOffset = (startOffset - endOffset) / 2;
      const x = ax + dx * (i + 0.5) + dx / runLength * centreOffset;
      const z = az + dz * (i + 0.5) + dz / runLength * centreOffset;
      panels.push(box(runLength - startOffset - endOffset, 1.8, 0.42, x, 0.9, z, angle));
      caps.push(box(runLength - startOffset - endOffset, 0.1, 0.5, x, 1.85, z, angle));
    }
  }
  for (const [x, z] of posts.values()) {
    if (isGatePier(x, z)) continue;
    piers.push(box(0.7, 2.2, 0.7, x, 1.1, z));
    caps.push(box(0.76, 0.08, 0.76, x, 2.24, z));
  }
  // Existing twin-pier identity, now wide enough for a road and separate footways.
  piers.push(box(1.2, 4.2, 1.2, -9, 2.1, 34), box(1.2, 4.2, 1.2, 9, 2.1, 34));
  piers.push(box(19.2, 0.5, 0.9, 0, 4.45, 34));
  const leaves: G[] = [];
  for (const side of [-1, 1]) {
    const centre = side * 12.85;
    // Sliding leaves remain fully retracted against the outside face of the wall.
    leaves.push(box(6.3, 0.11, 0.1, centre, 0.175, 34.37), box(6.3, 0.11, 0.1, centre, 2.075, 34.37));
    for (let i = 0; i <= 10; i++) leaves.push(box(0.07, 1.9, 0.08, centre - 3.15 + i * 0.63, 1.125, 34.37));
    leaves.push(box(6.6, 0.08, 0.16, centre, 0.08, 34.37));
  }
  return { panels: merge(panels), piers: merge(piers), caps: merge(caps), leaves: merge(leaves) };
}

export function PerimeterWall() {
  const geometry = useMemo(buildPerimeter, []);
  const gateLight = useMemo(() => box(15.6, 0.04, 0.18, 0, 4.18, 34), []);
  return (
    <group name="Site_Perimeter" userData={{ gateState: 'open', clearVehicleWidth: 10, footwayWidth: 3 }}>
      <mesh name="Wall_Panels" geometry={geometry.panels} material={MAT.concreteDark} castShadow receiveShadow />
      <mesh name="Wall_And_Gate_Piers" geometry={geometry.piers} material={MAT.concrete} castShadow receiveShadow />
      <mesh name="Wall_Coping" geometry={geometry.caps} material={MAT.bronze} />
      <mesh name="Gate_Leaves_Retracted" geometry={geometry.leaves} material={MAT.bronze} castShadow />
      <mesh name="Gate_Header_Light" geometry={gateLight} material={MAT.neonAmber} />
    </group>
  );
}

function buildLamps() {
  const bodies: G[] = [];
  const lenses: G[] = [];
  for (const [x, z] of SITE_LAMPS) {
    const dir = x < 0 ? 1 : -1;
    const base = SITE.lawnY;
    bodies.push(cyl(0.1, 0.14, 6.8, x, base + 3.4, z, 8));
    bodies.push(box(1.8, 0.15, 0.34, x + dir * 0.86, base + 6.76, z));
    lenses.push(box(1.35, 0.035, 0.28, x + dir * 1.02, base + 6.6675, z));
  }
  return { bodies: merge(bodies), lenses: merge(lenses) };
}

export function StreetLights({ night }: { night: boolean }) {
  const lamps = useMemo(buildLamps, []);
  return (
    <group name="Site_StreetLights">
      <mesh name="Perimeter_Lamp_Bodies" geometry={lamps.bodies} material={MAT.darkMetal} castShadow />
      <mesh name="Perimeter_Lamp_Lenses" geometry={lamps.lenses} material={MAT.neonAmber} />
      <pointLight name="PL_Parking_West" position={[-37, 6.5, 4]} color="#ffdfb1" intensity={night ? 95 : 0} distance={47} decay={2} />
      <pointLight name="PL_Parking_East" position={[37, 6.5, 4]} color="#ffdfb1" intensity={night ? 95 : 0} distance={47} decay={2} />
    </group>
  );
}