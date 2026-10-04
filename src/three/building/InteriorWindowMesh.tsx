import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createInteriorMaterial } from '../InteriorWindows';

interface Props {
  name: string;
  geometry: THREE.BufferGeometry;
  night: boolean;
  /** Room depth, in units of the pane half-height. */
  depth?: number;
}

/**
 * Renders a merged set of window quads with the parallax interior shader.
 * One mesh = one draw call for every faked room in the building.
 */
export function InteriorWindowMesh({ name, geometry, night, depth = 1.7 }: Props) {
  const material = useMemo(() => createInteriorMaterial(), []);

  useEffect(() => {
    material.uniforms.uDepth.value = depth;
  }, [material, depth]);

  useEffect(() => {
    material.uniforms.uNight.value = night ? 1 : 0;
    (material.uniforms.uSkyColor.value as THREE.Color).set(night ? '#141c3a' : '#9fc6ee');
  }, [material, night]);

  useEffect(() => () => material.dispose(), [material]);

  return <mesh name={name} geometry={geometry} material={material} />;
}
