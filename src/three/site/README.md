# Aazhi Seaways Site

The building and rooftop are unchanged. This module owns the ground-level forecourt, roads, parking, planting, gate and perimeter lighting. Coordinates are metres, Y-up; +Z is toward the street.

## Layout

- `layout.ts` is the shared dimensional plan for paving, planting, entrance transitions and car placement.
- The main gate is open, with both leaves retracted outside the traffic opening. It provides a 10 m drive and a 3 m pedestrian passage on each side.
- Two parking areas provide 40 marked 3 x 5.4 m bays, with 7.2 m drive aisles. Fifteen cars occupy explicit bay IDs rather than random world positions.
- A continuous front apron and rear connection form a drive loop. The sample vehicle circuit uses 6 m centreline turn radii for a 4.6 x 2.16 m vehicle envelope.
- Pedestrian paths run behind both rows. Marked crossings beyond the last bays connect the outer paths to the building-side paths. Actual sloped curb cuts join each crossing.
- The street sidewalk is interrupted at the driveway, not placed across it.
- The stone entrance landing is at Y=0.22; its front transition slopes to the forecourt at Y=0.18. No entrance furniture or bollards remain.
- Lawn surfaces are generated inside the edging contours and subtracted from the paving geometry. Trees and lamps are confined to those beds.
- The 2.24 m reflecting fountain is offset from the central approach. Its basin is hollow, so the water is visible below the coping.

## Integration

`Site_Ground.userData.lokamNavigation` contains the sampled vehicle circuit, pedestrian waypoints, nominal vehicle size, and the results of the analytical layout checks. Surface meshes also have `userData.surface` set to `drivable` or `walkable`; the parking group stores its bay rectangles.

`validateSiteLayout()` checks car containment, a sampled vehicle envelope against the continuous drivable plan and parked cars, an 0.8 m player envelope along the pedestrian paths, and tree/lamp placement inside the lawn beds. It runs when the site is instantiated. These are layout checks, not a physics engine: the host game must still bake navigation/collision geometry, assign its own player controller and test parking manoeuvres for its vehicles.

Paving is merged by material and uses a single shared 256px stone texture. Cars are instanced. The fountain uses a 64px repeating normal map; the motion only updates its UV offset. All site materials use standard Three.js materials, with textures embedded by the GLB exporter. UV animation needs to be re-applied by the host game after import.

Use the viewer's **Site plan** preset to inspect all connections, or **Entrance & forecourt** for the pedestrian approach.