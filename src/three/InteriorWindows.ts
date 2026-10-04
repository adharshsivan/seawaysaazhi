import * as THREE from 'three';
import { merge, type G } from './geo';

/**
 * Parallax interior mapping ("interior mapping") material.
 *
 * Every window is a single flat quad — 2 triangles — and the fragment shader
 * ray-marches a virtual box room behind the glass, so there is no interior
 * geometry and no texture atlas at all.
 *
 * Variety without repetition:
 *  - 6 room ARCHETYPES (living, bedroom, office, cafe, dim/study, studio),
 *  - every room derives its furniture placement, lamp position, wall art,
 *    curtain side/amount and palette from its own seed hash,
 *  - a 4-way layout VARIANT per archetype changes how many pieces of furniture
 *    a room gets and where they sit,
 *  - 5 wall/floor palettes with hue drift,
 *  - lighting is driven per-window from the CPU (`aMeta.x` brightness), so some
 *    rooms are dark, some are dim night-lights, some are fully lit — with dark
 *    rooms clustering on quiet floors instead of firing at random.
 *
 * Cost: 1 draw call for the whole facade, 2 triangles per window, no textures.
 */

const vertexShader = /* glsl */ `
  attribute vec3 aTangent;
  attribute vec2 aRoom;      // x = room seed, y = pane aspect (w/h)
  attribute float aType;     // room archetype 0..5
  attribute vec3 aMeta;      // x = brightness, y = layout variant, z = palette

  varying vec3 vViewTS;
  varying vec2 vUv;
  varying vec2 vRoom;
  varying float vType;
  varying vec3 vMeta;

  void main() {
    vUv   = uv;
    vRoom = aRoom;
    vType = aType;
    vMeta = aMeta;

    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 n  = normalize(mat3(modelMatrix) * normal);
    vec3 t  = normalize(mat3(modelMatrix) * aTangent);
    vec3 b  = normalize(cross(n, t));

    vec3 vd = cameraPosition - wp.xyz;
    vViewTS = vec3(dot(vd, t), dot(vd, b), dot(vd, n));

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uDepth;
  uniform float uNight;
  uniform vec3  uSkyColor;

  varying vec3 vViewTS;
  varying vec2 vUv;
  varying vec2 vRoom;
  varying float vType;
  varying vec3 vMeta;

  float hash11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float rect(vec2 p, vec2 c, vec2 h){ vec2 d = abs(p - c) - h; return step(max(d.x, d.y), 0.0); }

  void main() {
    float seed = vRoom.x;
    float asp  = max(vRoom.y, 0.25);
    float arch = vType;
    float bright = vMeta.x;
    float variant = vMeta.y;
    float pal = vMeta.z;

    // Four independent hashes from the room seed drive every variation.
    float h1 = hash11(seed * 1.37 + 0.11);
    float h2 = hash11(seed * 2.11 + 4.73);
    float h3 = hash11(seed * 3.77 + 2.31);
    float h4 = hash11(seed * 5.13 + 7.97);
    float h5 = hash11(seed * 6.41 + 1.29);
    float h6 = hash11(seed * 7.87 + 3.61);

    /* ---------- palette (hue-drifted by the room's palette index) ---------- */
    vec3 wallBase, floorBase, ceilBase, tint;
    float lampKind;      // 0 ceiling, 1 floor lamp, 2 desk lamp, 3 pendants, 4 wall sconce
    float curtainP;      // probability this room has curtains at all
    float mainH;         // height of the room's main furniture mass
    float extraN;        // how many extra accent blocks the room gets

    if (arch < 0.5) {                    // 0 living room
      wallBase  = mix(vec3(0.83,0.77,0.70), vec3(0.72,0.71,0.71), h1);
      floorBase = mix(vec3(0.38,0.26,0.17), vec3(0.53,0.41,0.30), h2);
      ceilBase  = vec3(0.90,0.88,0.85);
      tint      = mix(vec3(1.00,0.82,0.58), vec3(1.00,0.90,0.78), h3);
      lampKind  = h5 < 0.55 ? 1.0 : (h5 < 0.8 ? 4.0 : 0.0);
      curtainP  = 0.50; mainH = 0.42; extraN = 2.0;
    } else if (arch < 1.5) {             // 1 bedroom
      wallBase  = mix(vec3(0.81,0.76,0.72), vec3(0.70,0.68,0.67), h1);
      floorBase = mix(vec3(0.46,0.34,0.25), vec3(0.56,0.45,0.35), h2);
      ceilBase  = vec3(0.88,0.86,0.84);
      tint      = mix(vec3(1.00,0.79,0.55), vec3(1.00,0.87,0.72), h3);
      lampKind  = h5 < 0.6 ? 1.0 : 4.0;
      curtainP  = 0.82; mainH = 0.52; extraN = 1.0;
    } else if (arch < 2.5) {             // 2 office
      wallBase  = mix(vec3(0.79,0.81,0.84), vec3(0.70,0.73,0.78), h1);
      floorBase = mix(vec3(0.33,0.33,0.36), vec3(0.43,0.41,0.39), h2);
      ceilBase  = vec3(0.86,0.88,0.91);
      tint      = mix(vec3(0.77,0.86,1.00), vec3(0.86,0.91,1.00), h3);
      lampKind  = h5 < 0.5 ? 2.0 : 0.0;
      curtainP  = 0.24; mainH = 0.34; extraN = 3.0;
    } else if (arch < 3.5) {             // 3 cafe / lounge
      wallBase  = mix(vec3(0.81,0.68,0.54), vec3(0.71,0.61,0.49), h1);
      floorBase = mix(vec3(0.36,0.24,0.16), vec3(0.49,0.35,0.25), h2);
      ceilBase  = vec3(0.83,0.78,0.73);
      tint      = vec3(1.00,0.78,0.51);
      lampKind  = h5 < 0.6 ? 3.0 : 1.0;
      curtainP  = 0.06; mainH = 0.36; extraN = 3.0;
    } else if (arch < 4.5) {             // 4 dim study / spare room
      wallBase  = mix(vec3(0.53,0.51,0.56), vec3(0.45,0.45,0.51), h1);
      floorBase = mix(vec3(0.29,0.26,0.25), vec3(0.36,0.32,0.30), h2);
      ceilBase  = vec3(0.58,0.56,0.61);
      tint      = mix(vec3(0.90,0.80,1.00), vec3(1.00,0.86,0.62), h3);
      lampKind  = h5 < 0.5 ? 4.0 : 1.0;
      curtainP  = 0.55; mainH = 0.38; extraN = 1.0;
    } else {                             // 5 studio / loft
      wallBase  = mix(vec3(0.81,0.76,0.70), vec3(0.71,0.70,0.66), h1);
      floorBase = mix(vec3(0.41,0.29,0.20), vec3(0.51,0.38,0.28), h2);
      ceilBase  = vec3(0.88,0.86,0.83);
      tint      = mix(vec3(1.00,0.84,0.62), vec3(1.00,0.91,0.76), h3);
      lampKind  = h5 < 0.5 ? 0.0 : 3.0;
      curtainP  = 0.42; mainH = 0.44; extraN = 2.0;
    }

    // Palette drift: cool / warm / muted variants of the same room type.
    vec3 drift = mix(vec3(1.0,1.0,1.0), vec3(1.03,1.00,0.94), pal > 0.5 && pal < 1.5 ? 1.0 : 0.0);
    drift = mix(drift, vec3(0.94,0.98,1.05), pal > 1.5 && pal < 2.5 ? 1.0 : 0.0);
    drift = mix(drift, vec3(1.02,0.96,0.92), pal > 2.5 && pal < 3.5 ? 1.0 : 0.0);
    drift = mix(drift, vec3(0.96,0.94,0.92), pal > 3.5 ? 1.0 : 0.0);
    wallBase  *= drift;
    floorBase *= drift;
    ceilBase  *= drift;

    /* ---------- mullion frame (drawn in UV space, free geometry) ---------- */
    vec2 uvp = vUv;
    float fx = 0.018 / max(asp, 0.4);
    float fy = 0.018;
    float frame = 0.0;
    frame = max(frame, 1.0 - step(fx * 1.6, uvp.x));
    frame = max(frame, step(1.0 - fx * 1.6, uvp.x));
    frame = max(frame, 1.0 - step(fy * 1.6, uvp.y));
    frame = max(frame, step(1.0 - fy * 1.6, uvp.y));
    float nMul = (asp > 1.4) ? 3.0 : (asp > 0.8 ? 2.0 : 1.0);
    float gx = fract(uvp.x * nMul);
    frame = max(frame, (1.0 - step(fx * nMul * 0.9, min(gx, 1.0 - gx))) * step(1.5, nMul));
    frame = max(frame, 1.0 - step(fy * 0.9, abs(uvp.y - 0.78)));

    /* ---------- parallax room ---------- */
    vec3 v  = normalize(vViewTS);
    vec3 rd = vec3(-v.x, -v.y, -abs(v.z) - 1e-4);
    vec3 ro = vec3((vUv.x * 2.0 - 1.0) * asp, vUv.y * 2.0 - 1.0, 0.0);
    vec3 inv = 1.0 / rd;
    float tx = (sign(rd.x) * asp - ro.x) * inv.x;
    float ty = (sign(rd.y) - ro.y) * inv.y;
    float tz = (-uDepth - ro.z) * inv.z;
    float t  = min(min(tx, ty), tz);
    vec3  p  = ro + rd * t;
    float depth01 = clamp(-p.z / uDepth, 0.0, 1.0);

    float isCeil = 0.0, isBack = 0.0, isFloor = 0.0;
    vec3 col;
    if (t == ty) {
      if (p.y > 0.0) { col = ceilBase; isCeil = 1.0; }
      else { col = floorBase; isFloor = 1.0; }
    } else if (t == tx) { col = wallBase * 0.87; }
    else { col = wallBase; isBack = 1.0; }

    /* ---------- furniture: procedural placement per room ---------- */
    vec3 furnCol = mix(vec3(0.24,0.21,0.23), vec3(0.52,0.37,0.27), h2);
    furnCol = mix(furnCol, vec3(0.36,0.38,0.44), arch > 1.5 && arch < 2.5 ? 0.6 : 0.0);
    furnCol = mix(furnCol, vec3(0.55,0.32,0.22), arch > 2.5 && arch < 3.5 ? 0.65 : 0.0);

    float sideB = sign(h3 - 0.5);
    float mask = 0.0;

    // main mass (sofa / bed / desk / counter) — height and width vary per room
    vec2 cA = vec2((h1 - 0.5) * asp * 0.42, -0.60 + mainH * 0.42);
    vec2 hA = vec2(asp * (0.32 + 0.24 * h3 + 0.10 * variant), mainH * (0.82 + 0.30 * h4));
    mask = max(mask, isBack * rect(p.xy, cA, hA));

    // tall accent unit pushed to one side (wardrobe / shelf / fridge)
    vec2 cB = vec2(sideB * asp * (0.56 + 0.20 * h4), -0.30 + 0.34 * h2);
    vec2 hB = vec2(asp * (0.09 + 0.09 * h1), 0.34 + 0.26 * h3);
    mask = max(mask, isBack * rect(p.xy, cB, hB));

    // up to two more accent blocks, placed from the variant + seed
    if (variant > 0.5) {
      vec2 cC = vec2(-sideB * asp * (0.26 + 0.30 * h2), 0.24 + 0.22 * h4);
      vec2 hC = vec2(asp * (0.11 + 0.09 * h3), 0.09 + 0.13 * h1);
      mask = max(mask, isBack * rect(p.xy, cC, hC));
    }
    if (variant > 1.5 && extraN > 1.5) {
      vec2 cD = vec2(sideB * asp * (0.16 + 0.22 * h5), -0.66);
      vec2 hD = vec2(asp * (0.16 + 0.12 * h1), 0.14 + 0.12 * h2);
      mask = max(mask, isBack * rect(p.xy, cD, hD));
    }
    if (variant > 2.5 && extraN > 2.5) {
      vec2 cE = vec2(-sideB * asp * (0.52 + 0.16 * h1), -0.48 + 0.20 * h3);
      vec2 hE = vec2(asp * (0.12 + 0.10 * h4), 0.20 + 0.22 * h2);
      mask = max(mask, isBack * rect(p.xy, cE, hE));
    }

    // side-wall furniture silhouette for extra depth on wide panes
    float sideFurn = (1.0 - isBack) * (1.0 - isCeil) * step(0.62, depth01) * 0.22 * step(0.45, h5);
    col *= (1.0 - sideFurn);
    col = mix(col, furnCol, mask);

    /* ---------- lighting rig ---------- */
    float lampX = (h4 - 0.5) * asp * 0.5;
    float lampZ = -uDepth * (0.32 + 0.36 * h3);
    float lamp = 0.0;

    if (lampKind < 0.5) {
      lamp = isCeil * rect(p.xz, vec2(lampX, lampZ), vec2(0.20 + 0.14 * h1, 0.20 + 0.14 * h2));
    } else if (lampKind < 1.5) {
      lamp = isBack * rect(p.xy, vec2(sideB * asp * 0.42, -0.30 + 0.16 * h2), vec2(0.11, 0.15 + 0.06 * h4));
    } else if (lampKind < 2.5) {
      lamp = isBack * rect(p.xy, vec2(-asp * 0.16, -0.50 + 0.10 * h1), vec2(0.15, 0.10));
    } else if (lampKind < 3.5) {
      float px = sideB * asp * 0.22;
      lamp = max(
        isCeil * rect(p.xz, vec2(px, lampZ + uDepth * 0.18), vec2(0.10, 0.10)),
        isCeil * rect(p.xz, vec2(-px, lampZ - uDepth * 0.12), vec2(0.10, 0.10))
      );
    } else {
      lamp = isBack * rect(p.xy, vec2(sideB * asp * 0.46, 0.06 + 0.14 * h2), vec2(0.09, 0.13));
    }

    vec3 warm = mix(vec3(1.00,0.82,0.58), vec3(1.00,0.91,0.79), h1);
    vec3 cool = vec3(0.78,0.87,1.00);
    tint = mix(tint, warm, 0.55);
    tint = mix(tint, cool, arch > 1.5 && arch < 2.5 ? 0.45 : 0.0);

    float isDark = 1.0 - step(0.12, bright);

    // If lights are off, indoor lamps/spill are completely extinguished:
    float roomLightActive = 1.0 - isDark;

    float ao = mix(0.68, 1.12, depth01);
    ao *= mix(1.0, 0.80, mask);
    col *= tint * ao;

    // lamp emission + warm pool on the floor + gentle wall wash near the window (only when lit)
    col += tint * lamp * 1.45 * roomLightActive;
    col += tint * 0.16 * isFloor * (1.0 - depth01) * (0.6 + 0.8 * h4) * roomLightActive;
    col += tint * 0.10 * isBack * (1.0 - depth01) * roomLightActive;

    /* ---------- per-window brightness (lit / dim / dark & day / night) ---------- */
    float dayFactor = 1.0 - uNight;

    // In daytime, all rooms receive natural diffuse daylight through the large windows
    float daylightAmbient = mix(0.38, 0.54, 1.0 - depth01 * 0.45);
    // Night: unlit rooms drop to dark; daytime: rooms stay naturally illuminated by daylight
    float effectiveLevel = mix(
      mix(0.012, mix(0.60, 1.25, bright), roomLightActive),
      mix(daylightAmbient * 0.88, mix(0.85, 1.30, bright), roomLightActive),
      dayFactor
    );
    col *= effectiveLevel;

    // Turned-off rooms at night: subtle indicator LED and faint room outline
    float led = isDark * isBack * rect(p.xy, vec2(-asp * 0.62, -0.52), vec2(0.035, 0.022));
    col += vec3(0.05, 0.20, 0.40) * led * (0.6 + 0.4 * uNight) * uNight;

    /* ---------- curtains ---------- */
    float side = step(0.5, h3);
    float amt  = 0.16 + 0.52 * h2;
    float cu   = mix(vUv.x, 1.0 - vUv.x, side);
    float curtain = step(1.0 - curtainP, h6) * (1.0 - smoothstep(amt - 0.04, amt + 0.03, cu));
    vec3 curtainCol = mix(vec3(0.95,0.88,0.76), vec3(0.76,0.72,0.69), h1);
    curtainCol *= 0.86 + 0.14 * sin(vUv.x * (90.0 + 120.0 * h2));
    curtainCol *= tint * max(effectiveLevel, 0.04) * 0.92;
    col = mix(col, curtainCol, curtain * 0.95);

    /* ---------- glass sheen & daylight ambient reflections ---------- */
    vec3 daylightSkyTint = vec3(0.58, 0.68, 0.78);
    vec3 effectiveSky = mix(daylightSkyTint, uSkyColor, uNight);

    float fres = pow(1.0 - clamp(abs(v.z), 0.0, 1.0), 2.8);
    float reflectivity = mix(
      mix(0.44, 0.65, isDark),
      mix(0.30, 0.86, isDark),
      uNight
    );
    col = mix(col, effectiveSky, fres * reflectivity);
    // Ambient soft blue-gray sheen so daytime windows never look completely dead/black
    col += effectiveSky * mix(0.16, (isDark > 0.5 ? 0.025 : 0.045), uNight);

    /* ---------- frame on top ---------- */
    col = mix(col, vec3(0.07, 0.075, 0.085), frame);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createInteriorMaterial() {
  return new THREE.ShaderMaterial({
    name: 'Window_ParallaxInterior',
    vertexShader,
    fragmentShader,
    uniforms: {
      uDepth: { value: 1.7 },
      uNight: { value: 1 },
      uSkyColor: { value: new THREE.Color('#0d1430') },
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Pane geometry                                                      */
/* ------------------------------------------------------------------ */

export interface Pane {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  /** rotation about Y; 0 faces +Z */
  ry: number;
  /** room variation seed */
  seed: number;
  /** archetype: 0 living, 1 bedroom, 2 office, 3 cafe, 4 dim, 5 studio */
  type: number;
  /** 0.0 = lights off, ~0.35 = dim night-light, 0.8–1.25 = lit */
  bright: number;
  /** layout variant 0..3 */
  variant: number;
  /** palette index 0..4 */
  pal: number;
}

/** Builds one merged geometry carrying the extra attributes the shader needs. */
export function buildPaneGeometry(panes: Pane[]): G {
  const parts: G[] = [];
  for (const p of panes) {
    const g = new THREE.PlaneGeometry(p.w, p.h);
    const n = g.attributes.position.count;
    const tan = new Float32Array(n * 3);
    const room = new Float32Array(n * 2);
    const type = new Float32Array(n);
    const meta = new Float32Array(n * 3);
    const c = Math.cos(p.ry);
    const s = Math.sin(p.ry);
    const aspect = p.w / p.h;
    for (let i = 0; i < n; i++) {
      tan[i * 3] = c;
      tan[i * 3 + 1] = 0;
      tan[i * 3 + 2] = -s;
      room[i * 2] = p.seed;
      room[i * 2 + 1] = aspect;
      type[i] = p.type;
      meta[i * 3] = p.bright;
      meta[i * 3 + 1] = p.variant;
      meta[i * 3 + 2] = p.pal;
    }
    g.setAttribute('aTangent', new THREE.BufferAttribute(tan, 3));
    g.setAttribute('aRoom', new THREE.BufferAttribute(room, 2));
    g.setAttribute('aType', new THREE.BufferAttribute(type, 1));
    g.setAttribute('aMeta', new THREE.BufferAttribute(meta, 3));
    g.rotateY(p.ry);
    g.translate(p.x, p.y, p.z);
    parts.push(g);
  }
  return merge(parts);
}
