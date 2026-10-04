/** Master dimensions (metres, Y-up) shared by all building parts. */
export const PODIUM = { w: 34, d: 30, h: 9.3 }; // 2 retail floors
export const TOWER = { w: 24, d: 20, cx: 0, cz: 0, floors: 7, fh: 3.6 };
export const TOWER_BASE = PODIUM.h;
export const TOWER_H = TOWER.floors * TOWER.fh; // 25.2 — facade height (all floors equal)
/**
 * The roof/terrace structure is a SEPARATE band above the top occupied floor.
 * Keeping it out of the floor stack is what makes the top floor the same height
 * as every other floor — otherwise the crown slab eats the top-floor glazing.
 */
export const ROOF_STRUCT = 0.95;
export const ROOF_Y = TOWER_BASE + TOWER_H + ROOF_STRUCT; // 35.45 — top of roof structure
export const DECK_Y = ROOF_Y + 0.12; // rooftop deck walking surface

/** Rooftop deck extents (local space, origin = tower centre at DECK_Y). */
export const RX = TOWER.w / 2; // 12  half width
export const RZ = TOWER.d / 2; // 10  tower half depth
export const Z0 = -RZ; // -10 back edge of deck
/**
 * Front edge of the rooftop deck. The deck, the crown slab and the glass railing
 * all derive from this, so the whole sky terrace (z -10 → Z1) is usable café space.
 * The front part cantilevers past the tower without plaza-level columns.
 */
export const Z1 = 23.5;

/** World-space origin of the rooftop group. */
export const ROOF_ORIGIN: [number, number, number] = [TOWER.cx, DECK_Y, TOWER.cz];

/** Entrance (world space). */
export const FACE_Z = PODIUM.d / 2; // 15 — podium front face

/**
 * Brand names — change these to rename the whole asset.
 * BUILDING_NAME is the single blue cursive neon at the front entrance.
 * CAFE_SIGN_LINES is the rooftop cafe name in the block neon font.
 */
export const BUILDING_NAME = 'Aazhi Seaways';
export const CAFE_SIGN_NAME = 'MEGHAM';
