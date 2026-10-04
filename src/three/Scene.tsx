import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Building, type LayerState } from './Building';
import { applyTimeOfDay } from './materials';

/* ---------------- Camera presets ---------------- */

export const VIEWS = {
  overview: { pos: [58, 40, 62], target: [0, 16, 2], label: 'Overview' },
  rooftop: { pos: [22, 70, 58], target: [0, 36, 7], label: 'Sky terrace' },
  front: { pos: [16, 46, 43], target: [0, 35.4, 19.4], label: 'Infinity pool' },
  bar: { pos: [0, 38.5, 13], target: [9, 36.8, 2.5], label: 'Rooftop bar' },
  lounge: { pos: [-2, 41, 27], target: [-9, 36.4, 13], label: 'Lounge' },
  stage: { pos: [3.5, 41, 2], target: [3.5, 36.6, 13.4], label: 'Stage' },
  cafe: { pos: [8, 39, 2], target: [1, 37.5, -7], label: 'Café pavilion' },
  sign: { pos: [2.5, 41.5, 8], target: [2.5, 40.3, -2.5], label: 'Megham LED' },
  entrance: { pos: [22, 11, 43], target: [0, 4, 20], label: 'Entrance & forecourt' },
  podiumRoof: { pos: [28, 22, 42], target: [0, 10, 8], label: 'Podium roof' },
  parking: { pos: [66, 44, 59], target: [8, 2, 8], label: 'Site & parking' },
  sitePlan: { pos: [0, 143, 26], target: [0, 0, 10], label: 'Site plan' },
} as const;
export type ViewId = keyof typeof VIEWS;

interface SceneProps {
  night: boolean;
  bloom: boolean;
  autoRotate: boolean;
  layers: LayerState;
  view: { id: ViewId; nonce: number };
  onStats: (s: { calls: number; triangles: number }) => void;
  onReady: (root: THREE.Group) => void;
}

function CameraRig({
  view,
  controls,
}: {
  view: SceneProps['view'];
  controls: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const anim = useRef({ active: false, pos: new THREE.Vector3(), target: new THREE.Vector3(), t: 0 });

  useEffect(() => {
    const v = VIEWS[view.id];
    anim.current.pos.set(v.pos[0], v.pos[1], v.pos[2]);
    anim.current.target.set(v.target[0], v.target[1], v.target[2]);
    anim.current.active = true;
    anim.current.t = 0;
  }, [view]);

  useFrame((_, dt) => {
    const a = anim.current;
    const c = controls.current;
    if (!a.active || !c) return;
    a.t += dt;
    const k = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(a.pos, k);
    c.target.lerp(a.target, k);
    c.update();
    if (camera.position.distanceTo(a.pos) < 0.05 && c.target.distanceTo(a.target) < 0.05) a.active = false;
    if (a.t > 4) a.active = false;
  });

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => (anim.current.active = false);
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls]);

  return null;
}

function StatsProbe({ onStats }: { onStats: SceneProps['onStats'] }) {
  const { gl } = useThree();
  const frame = useRef(0);
  useFrame(() => {
    frame.current++;
    if (frame.current % 30 === 0) onStats({ calls: gl.info.render.calls, triangles: gl.info.render.triangles });
  });
  return null;
}

function RendererSetup({ bloom, night }: { bloom: boolean; night: boolean }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMapping = bloom ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = night ? 1.0 : 1.05;
  }, [gl, bloom, night]);
  useEffect(() => {
    applyTimeOfDay(night);
    const bg = night ? '#070912' : '#9fc6ee';
    scene.background = new THREE.Color(bg);
    scene.fog = new THREE.Fog(bg, night ? 130 : 180, night ? 320 : 460);
  }, [scene, night]);
  return null;
}

function ReadyProbe({
  target,
  onReady,
}: {
  target: React.RefObject<THREE.Group | null>;
  onReady: SceneProps['onReady'];
}) {
  useEffect(() => {
    if (target.current) onReady(target.current);
  }, [target, onReady]);
  return null;
}

export function Scene({ night, bloom, autoRotate, layers, view, onStats, onReady }: SceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const building = useRef<THREE.Group | null>(null);
  const sunPos: [number, number, number] = night ? [-45, 60, -30] : [55, 75, 40];

  return (
    <>
      <RendererSetup bloom={bloom} night={night} />
      <ReadyProbe target={building} onReady={onReady} />
      <StatsProbe onStats={onStats} />

      {night ? (
        <>
          <Stars radius={220} depth={80} count={2200} factor={3.4} saturation={0} fade speed={0.4} />
          <hemisphereLight args={['#2a3a6a', '#0a0a12', 0.55]} />
          <directionalLight
            position={sunPos}
            intensity={0.9}
            color="#9fb4ff"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-70}
            shadow-camera-right={70}
            shadow-camera-top={70}
            shadow-camera-bottom={-40}
            shadow-camera-near={5}
            shadow-camera-far={190}
            shadow-bias={-0.0004}
          />
        </>
      ) : (
        <>
          <hemisphereLight args={['#cfe3ff', '#8a7a66', 0.8]} />
          <directionalLight
            position={sunPos}
            intensity={3.0}
            color="#fff3df"
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-70}
            shadow-camera-right={70}
            shadow-camera-top={70}
            shadow-camera-bottom={-40}
            shadow-camera-near={5}
            shadow-camera-far={220}
            shadow-bias={-0.0004}
          />
        </>
      )}

      {/* Offline environment for glass / bronze reflections */}
      <Environment resolution={128} frames={1} key={night ? 'n' : 'd'}>
        {night ? (
          <>
            <Lightformer intensity={0.9} color="#5a74ff" position={[0, 30, 0]} scale={[80, 80, 1]} rotation-x={Math.PI / 2} />
            <Lightformer intensity={2.2} color="#ff5fb0" position={[-25, 8, -18]} scale={[14, 5, 1]} />
            <Lightformer intensity={2.0} color="#3fe3ff" position={[26, 7, 12]} scale={[12, 5, 1]} />
            <Lightformer intensity={1.5} color="#ffb070" position={[10, 5, 28]} scale={[16, 4, 1]} />
          </>
        ) : (
          <>
            <Lightformer intensity={2.5} color="#ffffff" position={[0, 40, 0]} scale={[100, 100, 1]} rotation-x={Math.PI / 2} />
            <Lightformer intensity={1.5} color="#bfe0ff" position={[-30, 12, -18]} scale={[30, 14, 1]} />
            <Lightformer intensity={1.2} color="#ffe6c2" position={[30, 9, 20]} scale={[28, 12, 1]} />
          </>
        )}
      </Environment>

      <Building ref={building} night={night} layers={layers} />

      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI / 2 - 0.02}
        minDistance={4}
        maxDistance={190}
        target={[0, 16, 2]}
      />
      <CameraRig view={view} controls={controls} />

      {bloom && (
        <EffectComposer multisampling={4}>
          <Bloom
            luminanceThreshold={1.0}
            luminanceSmoothing={0.2}
            intensity={night ? 0.95 : 0.45}
            mipmapBlur
            radius={0.65}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}
