import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MAT } from '../materials';
import { cyl, merge } from '../geo';
import { FOUNTAIN, SITE } from './layout';

const profile = (points: [number, number][]) =>
  new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 28);

function makeSail() {
  const outline = new THREE.Shape();
  outline.moveTo(-0.25, 0);
  outline.lineTo(0.25, 0);
  outline.quadraticCurveTo(0.36, 0.58, -0.16, 1.02);
  outline.quadraticCurveTo(0.08, 0.35, -0.25, 0);
  const fin = new THREE.ExtrudeGeometry(outline, {
    depth: 0.065, bevelEnabled: true, bevelThickness: 0.012,
    bevelSize: 0.012, bevelSegments: 1, steps: 1, curveSegments: 6,
  });
  fin.translate(0, 0.34, -0.0325);
  const second = fin.clone().scale(0.75, 0.72, 1).rotateY(Math.PI / 2).translate(0.08, 0.095, 0.08);
  const pedestal = cyl(0.3, 0.34, 0.22, 0, 0.23, 0, 20);
  const stand = pedestal.toNonIndexed();
  pedestal.dispose();
  return merge([fin, second, stand]);
}

function rippleTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = 128 + Math.round(13 * Math.sin(x * Math.PI / 8 + Math.cos(y * Math.PI / 8)));
      data[i + 1] = 128 + Math.round(13 * Math.cos(y * Math.PI / 8 + Math.sin(x * Math.PI / 8)));
      data[i + 2] = 253;
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.name = 'Forecourt_Water_Normal';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Small reflecting fountain, kept off the straight door-to-gate approach. */
export function ForecourtFountain({ night, lighting }: { night: boolean; lighting: boolean }) {
  const basin = useMemo(() => profile([
    [0, 0], [1.08, 0], [1.12, 0.36], [0.96, 0.36], [0.96, 0.12], [0, 0.12], [0, 0],
  ]), []);
  const coping = useMemo(() => profile([
    [0.96, 0.36], [1.12, 0.36], [1.12, 0.42], [0.96, 0.42], [0.96, 0.36],
  ]), []);
  const sculpture = useMemo(makeSail, []);
  const waterSurface = useMemo(() =>
    new THREE.RingGeometry(0.314, 0.953, 32).rotateX(-Math.PI / 2).translate(0, 0.28, 0), []);
  const normal = useMemo(rippleTexture, []);
  const water = useMemo(() => {
    const material = MAT.fountainWater.clone();
    material.name = 'Forecourt_Reflecting_Water';
    material.normalMap = normal;
    material.normalScale.set(0.2, 0.2);
    material.roughness = 0.23;
    material.opacity = 0.75;
    return material;
  }, [normal]);

  useEffect(() => {
    normal.needsUpdate = true;
    water.needsUpdate = true;
    return () => { normal.dispose(); water.dispose(); };
  }, [normal, water]);
  useFrame((_, dt) => {
    normal.offset.x = (normal.offset.x + Math.min(dt, 0.05) * 0.013) % 1;
    normal.offset.y = (normal.offset.y + Math.min(dt, 0.05) * 0.008) % 1;
  });

  return (
    <group name="Forecourt_Reflecting_Fountain" position={[FOUNTAIN.x, SITE.pavingY, FOUNTAIN.z]}
      userData={{ collision: { type: 'cylinder', radius: FOUNTAIN.radius, height: 1.4 } }}>
      <mesh name="Fountain_Hollow_Basin" geometry={basin} material={MAT.concrete} castShadow receiveShadow />
      <mesh name="Fountain_Stone_Rim" geometry={coping} material={MAT.stoneTrim} castShadow />
      <mesh name="Fountain_Bronze_Sail" geometry={sculpture} material={MAT.bronze} castShadow />
      <mesh name="Fountain_Water" geometry={waterSurface} material={water} renderOrder={2} />
      <pointLight name="PL_Forecourt_Water" position={[0, 0.34, 0]} color="#7cd5da"
        intensity={night && lighting ? 3 : 0} distance={4.5} decay={2} />
    </group>
  );
}