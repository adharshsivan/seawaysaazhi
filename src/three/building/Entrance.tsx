import { useMemo } from 'react';
import { MAT } from '../materials';
import { box, cyl, merge, type G } from '../geo';
import { FACE_Z, PODIUM } from '../dims';
import { ENTRY, SITE } from '../site/layout';
import { getPavingMaterial, mergeSite, ramp, siteSurface } from '../site/siteGeometry';

/**
 * Main entrance (world space).
 *
 * Portal piers + lintel frame the grand opening.
 * Full continuous window framing across the entire 15.3m glazed front.
 * The entrance features refined architectural honed stone paving (NO wood),
 * with a shallow step-free transition to the forecourt, open and free of clutter.
 */
const E = {
  face: FACE_Z, // 15
  doorZ: 15.1,
  portalZ: 15.35,
};

/** Canopy: between the pier inner faces (±7.7), from the sill band face (z 15.4) outward. */
const CANOPY = { x: 7.7, y0: 4.65, y1: 4.95, z0: 15.4, z1: 22.1 };

const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): G =>
  box(x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);

function buildConcrete(): G {
  return merge([
    // Portal piers + lintel
    box(1.8, 6.6, 1.8, -8.6, 3.3, E.portalZ),
    box(1.8, 6.6, 1.8, 8.6, 3.3, E.portalZ),
    box(19.6, 1.4, 1.8, 0, 7.1, E.portalZ),
  ]);
}

function buildStonePaving(): G {
  const e = ENTRY;
  // One continuous landing; the 4 cm transition to the forecourt is sloped, not stepped.
  return mergeSite([
    siteSurface([
      [-11, 12.8], [11, 12.8], [11, e.back], [e.halfWidth, e.back],
      [e.halfWidth, e.landingFront], [-e.halfWidth, e.landingFront],
      [-e.halfWidth, e.back], [-11, e.back],
    ], -0.06, e.surfaceY),
    ramp({ x0: -e.halfWidth, x1: e.halfWidth, z0: e.landingFront, z1: e.rampFront }, e.surfaceY, SITE.pavingY),
  ]);
}

function buildDark(): G {
  const p: G[] = [];
  p.push(bx(-CANOPY.x, CANOPY.x, CANOPY.y0, CANOPY.y1, CANOPY.z0, CANOPY.z1));
  // Continuous top head rail across all central doors AND side windows (spans -7.65 to +7.65)
  p.push(box(15.3, 0.18, 0.18, 0, 3.42, E.doorZ));
  // Vertical mullions
  for (const x of [-4.2, -2.1, 0, 2.1, 4.2]) {
    p.push(box(0.1, 3.35, 0.16, x, 1.77, E.doorZ));
  }
  return merge(p);
}

function buildBronze(): G {
  const p: G[] = [];
  // Canopy columns in two pairs; tops inside the slab, feet on the platform
  for (const [x, z] of [
    [-6.8, 17.0],
    [6.8, 17.0],
    [-6.8, 21.3],
    [6.8, 21.3],
  ]) {
    p.push(cyl(0.11, 0.11, CANOPY.y1 - 0.2 - 0.22, x, (CANOPY.y1 - 0.2 + 0.22) / 2, z, 10));
  }
  // Continuous bronze top cap trim over all central and side windows
  p.push(box(15.3, 0.08, 0.16, 0, 3.42, E.doorZ));
  // Door pulls on the leaf faces
  for (const x of [-0.2, 0.2]) {
    p.push(box(0.05, 1.1, 0.06, x, 1.65, E.doorZ + 0.03 + 0.03));
  }
  // Side-lite vertical mullions connecting directly into the top head frame
  for (const x of [-7.6, -5.9, 5.9, 7.6]) {
    p.push(box(0.1, 3.35, 0.14, x, 1.77, E.doorZ));
  }
  return merge(p);
}

function buildDoors(): G {
  const p: G[] = [];
  // Central sliding door leaves
  for (const x of [-3.15, -1.05, 1.05, 3.15]) p.push(box(1.98, 3.15, 0.06, x, 1.72, E.doorZ));
  // Side window glass leaves (cleanly framed top, bottom, and sides)
  for (const x of [-6.75, 6.75]) p.push(box(1.6, 3.15, 0.05, x, 1.72, E.doorZ));
  return merge(p);
}

/** Lobby glass runs floor → sill-band underside (the band is the lobby ceiling). */
function buildLobbyGlass(): G {
  return bx(-11, 11, 0.1, 4.15, 12.9, 15.0);
}

function buildLobbyGlow(): G {
  return merge([
    bx(-10, 10, 0.22, 4.15, 12.8, 13.0), // back wall glow, resting on the core face
    bx(-9, 9, 4.11, 4.15, 12.9, 15.0), // ceiling glow, flush under the band
  ]);
}

/** Architectural down-lights flush under the canopy slab (underside y = 4.65). */
function buildDownLights(): G {
  const y0 = CANOPY.y0 - 0.03;
  const y1 = CANOPY.y0;
  return merge([
    bx(-6.4, 6.4, y0, y1, 17.03, 17.27),
    bx(-6.4, 6.4, y0, y1, 20.23, 20.47),
    bx(-6.4, -6.0, y0, y1, 17.27, 20.23),
    bx(6.0, 6.4, y0, y1, 17.27, 20.23),
  ]);
}

export function Entrance() {
  const concrete = useMemo(buildConcrete, []);
  const paving = useMemo(buildStonePaving, []);
  const stone = useMemo(getPavingMaterial, []);
  const dark = useMemo(buildDark, []);
  const bronze = useMemo(buildBronze, []);
  const doors = useMemo(buildDoors, []);
  const lobbyGlass = useMemo(buildLobbyGlass, []);
  const glow = useMemo(buildLobbyGlow, []);
  const downLights = useMemo(buildDownLights, []);

  return (
    <group name="Entrance">
      <mesh name="Entrance_Portal_Concrete" geometry={concrete} material={MAT.concrete} castShadow receiveShadow />
      <mesh name="Entrance_StepFree_Stone_Landing" geometry={paving} material={stone} receiveShadow userData={{ surface: 'walkable' }} />
      <mesh name="Entrance_Canopy_Dark" geometry={dark} material={MAT.darkMetal} castShadow receiveShadow />
      <mesh name="Entrance_Frames_Bronze" geometry={bronze} material={MAT.bronze} castShadow />
      <mesh name="Entrance_Doors_Glass" geometry={doors} material={MAT.glass} renderOrder={12} />
      <mesh name="Entrance_Lobby_Glass" geometry={lobbyGlass} material={MAT.glass} renderOrder={11} />
      <mesh name="Entrance_Lobby_Glow" geometry={glow} material={MAT.interiorGlow} />
      <mesh name="Entrance_Canopy_Lights" geometry={downLights} material={MAT.neonAmber} />
      <pointLight name="PL_Lobby" position={[0, 3, PODIUM.d / 2 - 1]} color="#ffcf9c" intensity={20} distance={16} decay={2} />
    </group>
  );
}
