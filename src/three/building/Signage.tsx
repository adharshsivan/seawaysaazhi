import { useMemo } from 'react';
import { MAT } from '../materials';
import { box, merge, neonText, type G } from '../geo';
import { PAVILION, PAVILION_ROOF_TOP } from './RooftopCafe';
import { BAR, BAR_SIGN_Y } from './RooftopBar';
import { BUILDING_NAME, CAFE_SIGN_NAME, FACE_Z } from '../dims';
import { CursiveNeon } from './CursiveNeon';

/* ---------------- Rooftop signage (rooftop local space) ---------------- */

/**
 * MEGHAM — standalone LED letters (no board) standing on a rail that is carried by two
 * struts, which are planted on the pavilion roof slab. The rail is as long as the word,
 * so no letter overhangs unsupported.
 */
const LETTER_H = 1.45;
const LETTER_TUBE = 0.12;
const SIGN_X = (PAVILION.x0 + PAVILION.x1) / 2;
/** Over the roof slab (its front edge is 0.55 m beyond the glass line), clear of the slab edge. */
const SIGN_Z = PAVILION.z1 - 0.1;
const RAIL_Y = PAVILION_ROOF_TOP + 0.45;

function buildRoofRail(width: number): G {
  const p: G[] = [];
  const railW = width + 0.3;
  const strutX = railW / 2 - 0.5;
  for (const sx of [-1, 1]) {
    const x = SIGN_X + sx * strutX;
    p.push(box(0.22, 0.05, 0.22, x, PAVILION_ROOF_TOP + 0.025, SIGN_Z)); // foot plate on the slab
    p.push(box(0.08, RAIL_Y - PAVILION_ROOF_TOP, 0.08, x, (RAIL_Y + PAVILION_ROOF_TOP) / 2, SIGN_Z));
  }
  p.push(box(railW, 0.06, 0.08, SIGN_X, RAIL_Y, SIGN_Z));
  return merge(p);
}

export function RooftopSignage() {
  const megham = useMemo(() => neonText(CAFE_SIGN_NAME, LETTER_H, LETTER_TUBE, 1.6), []);
  const rail = useMemo(() => buildRoofRail(megham.width), [megham]);
  const bar = useMemo(() => neonText('BAR', 0.34, 0.045, 1.6), []);

  // Letter bottoms (tube centred on the glyph baseline) rest on the rail top.
  const letterY = RAIL_Y + 0.03 + LETTER_H / 2 + LETTER_TUBE / 2 - 0.03;

  return (
    <group name="Signage_Rooftop">
      <mesh name="Sign_Megham_Rail" geometry={rail} material={MAT.darkMetal} castShadow />
      <mesh
        name="Sign_Megham_LED"
        geometry={megham.geometry}
        material={MAT.neonPink}
        position={[SIGN_X, letterY, SIGN_Z]}
      />
      {/* BAR: letters sit on the plate (plate face is at x = back.x0 - 0.05) */}
      <mesh
        name="Sign_Bar_Neon"
        geometry={bar.geometry}
        material={MAT.neonAmber}
        position={[BAR.back.x0 - 0.05 - 0.02, BAR_SIGN_Y, (BAR.back.z0 + BAR.back.z1) / 2]}
        rotation={[0, -Math.PI / 2, 0]}
      />
    </group>
  );
}

/* ---------------- Entrance signage (world space) ---------------- */

export function EntranceSignage({ night = true }: { night?: boolean }) {
  // On the concrete portal lintel: cursive neon, no backing plate, crisp readable text
  const z = FACE_Z + 1.35;
  return (
    <group name="Signage_Entrance">
      <CursiveNeon
        name="Entrance_Sign_Aazhi"
        text={BUILDING_NAME}
        color="#3aa6ff"
        position={[0, 7.1, z]}
        height={1.25}
        plate={false}
        intensity={1.5}
        night={night}
      />
    </group>
  );
}
