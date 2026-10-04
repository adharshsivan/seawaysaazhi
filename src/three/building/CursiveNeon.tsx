import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';

/**
 * Cursive neon sign, baked to a canvas texture at runtime.
 *
 * Readability decisions:
 *  - Uses the bundled Pacifico script (a bold, rounded face that reads well as neon)
 *    instead of whatever "cursive" the OS happens to map to.
 *  - Letters are FILLED (bright body + coloured glow + hot rim) rather than thick
 *    stroked outlines, which used to merge neighbouring script letters into a blob.
 *  - Optional dark backing plate with a neon border for contrast against sky/glass.
 *  - Unlit material (MeshBasicMaterial) so scene lighting never washes it out;
 *    values > 1 feed the bloom pass.
 */

const FAMILY = "'Pacifico','Segoe Script','Brush Script MT','Snell Roundhand','Apple Chancery',cursive";
const FS = 170;



function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeTexture(text: string, color: string, plate: boolean, isNight: boolean) {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `400 ${FS}px ${FAMILY}`;
  const tw = Math.ceil(probe.measureText(text).width);

  const padX = plate ? 130 : 100;
  const W = tw + padX * 2;
  const H = Math.round(FS * (plate ? 1.75 : 1.6));

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;

  if (plate) {
    roundRectPath(ctx, 6, 6, W - 12, H - 12, 44);
    ctx.fillStyle = 'rgba(4,8,20,0.96)';
    ctx.fill();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    roundRectPath(ctx, 20, 20, W - 40, H - 40, 34);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }

  ctx.font = `400 ${FS}px ${FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const cx = W / 2;
  const cy = H / 2 + FS * 0.03;

  if (isNight) {
    // Night: Crisp high-legibility neon with dark contrast perimeter preventing light bleed
    ctx.save();
    ctx.shadowColor = 'rgba(0, 8, 20, 0.95)';
    ctx.shadowBlur = 8;
    ctx.strokeStyle = '#05121e';
    ctx.lineWidth = 9;
    ctx.strokeText(text, cx, cy);
    ctx.restore();

    // Vibrant cyan-blue glow (tight halo, not an overblown smear)
    ctx.save();
    ctx.shadowColor = '#1fa2ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#2ea8ff';
    ctx.fillText(text, cx, cy);
    ctx.restore();

    // Bright luminous core stroke
    ctx.fillStyle = '#bcebff';
    ctx.fillText(text, cx, cy);

    // Razor-sharp white hot center thread
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.strokeText(text, cx, cy);
  } else {
    // Daytime: Elegant unlit architectural dimensional script lettering
    // Subtle drop shadow for depth on concrete
    ctx.save();
    ctx.shadowColor = 'rgba(10, 16, 26, 0.45)';
    ctx.shadowBlur = 7;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#0f2438';
    ctx.fillText(text, cx, cy);
    ctx.restore();

    // Crisp polished deep navy/slate letter body
    ctx.fillStyle = '#16334f';
    ctx.fillText(text, cx, cy);

    // Delicate top-edge metallic bevel highlight
    ctx.strokeStyle = '#3e6284';
    ctx.lineWidth = 2.2;
    ctx.strokeText(text, cx, cy);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

interface Props {
  name?: string;
  text: string;
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  /** total sign height in metres (including padding / plate) */
  height?: number;
  /** draw a dark backing plate with a neon border */
  plate?: boolean;
  /** brightness multiplier (>1 feeds bloom) */
  intensity?: number;
  /** daytime vs nighttime state */
  night?: boolean;
}

export function CursiveNeon({
  name,
  text,
  color,
  position,
  rotation = [0, 0, 0],
  height = 1,
  plate = false,
  intensity = 1.5,
  night = true,
}: Props) {
  // Re-bake once the bundled font has actually loaded.
  const [fontTick, setFontTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    fonts
      ?.load(`400 ${FS}px Pacifico`, text)
      .then(() => alive && setFontTick((n) => n + 1))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [text]);

  const tex = useMemo(() => makeTexture(text, color, plate, night), [text, color, plate, night, fontTick]);
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      name: 'Neon_Cursive',
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    m.color.setScalar(night ? intensity : 1.0);
    return m;
  }, [tex, intensity, night]);

  useEffect(
    () => () => {
      mat.dispose();
      tex.dispose();
    },
    [mat, tex],
  );

  const img = tex.image as HTMLCanvasElement;
  const w = height * (img.width / img.height);

  return (
    <mesh name={name ?? 'Neon_Cursive'} position={position} rotation={rotation} material={mat} renderOrder={13}>
      <planeGeometry args={[w, height]} />
    </mesh>
  );
}
