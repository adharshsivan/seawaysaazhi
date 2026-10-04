import { Suspense, useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Scene, VIEWS, type ViewId } from './three/Scene';
import { LAYERS, type LayerId, type LayerState } from './three/Building';
import { exportGLB } from './three/exportGLB';
import { BUILDING_NAME, CAFE_SIGN_NAME } from './three/dims';
import { cn } from './utils/cn';

interface AssetStats {
  meshes: number;
  instancedMeshes: number;
  instances: number;
  materials: number;
  triangles: number;
  lights: number;
}

function analyse(root: THREE.Object3D): AssetStats {
  const mats = new Set<THREE.Material>();
  let meshes = 0;
  let instancedMeshes = 0;
  let instances = 0;
  let triangles = 0;
  let lights = 0;
  root.traverse((o) => {
    if ((o as THREE.Light).isLight) lights++;
    const m = o as THREE.Mesh;
    if (!m.isMesh && !(o as THREE.LineSegments).isLineSegments) return;
    const geo = m.geometry as THREE.BufferGeometry;
    const count = geo.index ? geo.index.count : geo.attributes.position?.count ?? 0;
    const tris = Math.floor(count / 3);
    const mat = m.material as THREE.Material;
    if (mat) mats.add(mat);
    if ((o as THREE.InstancedMesh).isInstancedMesh) {
      instancedMeshes++;
      const n = (o as THREE.InstancedMesh).count;
      instances += n;
      triangles += tris * n;
    } else if (m.isMesh) {
      meshes++;
      triangles += tris;
    }
  });
  return { meshes, instancedMeshes, instances, materials: mats.size, triangles, lights };
}

const DEFAULT_LAYERS = LAYERS.reduce((acc, l) => ({ ...acc, [l.id]: true }), {} as LayerState);

export default function App() {
  const [night, setNight] = useState(true);
  const [bloom, setBloom] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [view, setView] = useState<{ id: ViewId; nonce: number }>({ id: 'overview', nonce: 0 });
  const [frame, setFrame] = useState({ calls: 0, triangles: 0 });
  const [asset, setAsset] = useState<AssetStats | null>(null);
  const [root, setRoot] = useState<THREE.Group | null>(null);
  const [exporting, setExporting] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const onReady = useCallback((g: THREE.Group) => {
    setRoot(g);
    setAsset(analyse(g));
  }, []);
  const onStats = useCallback((s: { calls: number; triangles: number }) => setFrame(s), []);

  const toggleLayer = (id: LayerId) => setLayers((l) => ({ ...l, [id]: !l[id] }));
  const goto = (id: ViewId) => {
    setAutoRotate(false);
    setView((v) => ({ id, nonce: v.nonce + 1 }));
  };

  const handleExport = async () => {
    if (!root) return;
    setExporting(true);
    try {
      await exportGLB(root, `${BUILDING_NAME.toLowerCase().replace(/\s+/g, '_')}.glb`);
    } finally {
      setExporting(false);
    }
  };

  const dpr = useMemo<[number, number]>(() => [1, 1.75], []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070912] text-white font-sans select-none">
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [40, 30, 46], fov: 42, near: 0.3, far: 500 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Suspense fallback={null}>
          <Scene
            night={night}
            bloom={bloom}
            autoRotate={autoRotate}
            layers={layers}
            view={view}
            onStats={onStats}
            onReady={onReady}
          />
        </Suspense>
      </Canvas>

      {/* Header */}
      <header className="pointer-events-none absolute left-0 top-0 p-5 md:p-7">
        <div className="pointer-events-auto inline-flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur-md">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cyan-300/80">Lokam Mini · Landmark asset</span>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            <span className="bg-gradient-to-r from-pink-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              {BUILDING_NAME}
            </span>
          </h1>
          <span className="text-sm font-medium tracking-wide text-white/70">
            {CAFE_SIGN_NAME[0] + CAFE_SIGN_NAME.slice(1).toLowerCase()} Rooftop Cafe &amp; Bar
          </span>
          <p className="max-w-xs text-xs leading-relaxed text-white/60">
            Megham rooftop café and infinity pool above a stone forecourt, reflecting fountain,
            connected parking loop and dedicated pedestrian paths. Drag to orbit · scroll to zoom.
          </p>
        </div>
      </header>

      {/* View presets */}
      <nav className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2 px-4 md:bottom-7">
        {(Object.keys(VIEWS) as ViewId[]).map((id) => (
          <button
            key={id}
            onClick={() => goto(id)}
            className={cn(
              'rounded-full border px-4 py-2 text-xs font-medium backdrop-blur-md transition',
              view.id === id && !autoRotate
                ? 'border-pink-400/70 bg-pink-500/25 text-pink-100 shadow-[0_0_18px_rgba(255,45,149,0.35)]'
                : 'border-white/10 bg-black/40 text-white/75 hover:border-white/30 hover:bg-black/60',
            )}
          >
            {VIEWS[id].label}
          </button>
        ))}
      </nav>

      {/* Inspector panel */}
      <aside
        className={cn(
          'absolute right-0 top-0 flex h-full w-[300px] max-w-[88vw] flex-col transition-transform duration-300',
          panelOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="absolute -left-10 top-5 flex h-10 w-10 items-center justify-center rounded-l-xl border border-r-0 border-white/10 bg-black/50 text-white/80 backdrop-blur-md hover:bg-black/70 md:top-7"
          aria-label="Toggle inspector"
        >
          {panelOpen ? '›' : '‹'}
        </button>
        <div className="m-5 flex max-h-[calc(100%-2.5rem)] flex-col gap-5 overflow-y-auto rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur-md md:m-7 md:max-h-[calc(100%-3.5rem)]">
          <section>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">Render</h2>
            <div className="grid grid-cols-2 gap-2">
              <Toggle label="Night" on={night} onClick={() => setNight((v) => !v)} accent="pink" />
              <Toggle label="Bloom" on={bloom} onClick={() => setBloom((v) => !v)} accent="cyan" />
              <Toggle label="Auto-orbit" on={autoRotate} onClick={() => setAutoRotate((v) => !v)} accent="amber" />
              <Toggle
                label="All layers"
                on={Object.values(layers).every(Boolean)}
                onClick={() => {
                  const all = Object.values(layers).every(Boolean);
                  setLayers(LAYERS.reduce((acc, l) => ({ ...acc, [l.id]: !all }), {} as LayerState));
                }}
                accent="violet"
              />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">Mesh layers</h2>
            <ul className="space-y-1">
              {LAYERS.map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => toggleLayer(l.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-white/80 hover:bg-white/5"
                  >
                    <span className={cn(!layers[l.id] && 'text-white/35 line-through')}>{l.label}</span>
                    <span
                      className={cn(
                        'h-2.5 w-2.5 rounded-full transition',
                        layers[l.id] ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/15',
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">Asset budget</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <Stat k="Frame draw calls" v={frame.calls} />
              <Stat k="Frame triangles" v={fmt(frame.triangles)} />
              <Stat k="Static meshes" v={asset?.meshes ?? '—'} />
              <Stat k="Instanced meshes" v={asset?.instancedMeshes ?? '—'} />
              <Stat k="Instances" v={asset?.instances ?? '—'} />
              <Stat k="Materials" v={asset?.materials ?? '—'} />
              <Stat k="Asset triangles" v={asset ? fmt(asset.triangles) : '—'} />
              <Stat k="Point lights" v={asset?.lights ?? '—'} />
            </dl>
          </section>

          <section className="space-y-2">
            <button
              onClick={handleExport}
              disabled={!root || exporting}
              className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-fuchsia-500 px-4 py-2.5 text-sm font-semibold shadow-[0_0_24px_rgba(236,72,153,0.4)] transition hover:brightness-110 disabled:opacity-50"
            >
              {exporting ? 'Packing GLB…' : 'Export .glb for Lokam Mini'}
            </button>
            <p className="text-[11px] leading-relaxed text-white/45">
              Y-up, metres, origin at ground-centre. Named groups (MainBuilding, Entrance, RooftopCafe, InfinityPool,
              RooftopBar, SeatingArea, Signage, Lights, Decor, Site_Parking, Site_Perimeter), shared PBR materials, GPU instancing
              &amp; emissive-strength neon. Every window is 2 triangles — rooms are ray-marched in the shader, so
              re-apply <span className="font-mono text-white/60">createInteriorMaterial()</span> to{' '}
              <span className="font-mono text-white/60">Windows_ParallaxInteriors</span> after importing the GLB.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-lg bg-white/5 px-2.5 py-1.5">
      <dt className="text-[10px] uppercase tracking-wider text-white/40">{k}</dt>
      <dd className="font-mono text-sm text-white/90">{v}</dd>
    </div>
  );
}

const ACCENT: Record<string, string> = {
  pink: 'border-pink-400/60 bg-pink-500/20 text-pink-100',
  cyan: 'border-cyan-300/60 bg-cyan-400/20 text-cyan-100',
  amber: 'border-amber-300/60 bg-amber-400/20 text-amber-100',
  violet: 'border-violet-300/60 bg-violet-400/20 text-violet-100',
};

function Toggle({ label, on, onClick, accent }: { label: string; on: boolean; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-xl border px-3 py-2 text-xs font-medium transition',
        on ? ACCENT[accent] : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10',
      )}
    >
      {label}
    </button>
  );
}
