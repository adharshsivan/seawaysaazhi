import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Exports the building group to a binary .glb and triggers a download.
 * Instanced meshes are written with EXT_mesh_gpu_instancing,
 * neon materials carry KHR_materials_emissive_strength and the
 * point lights are stored via KHR_lights_punctual.
 */
export async function exportGLB(root: THREE.Object3D, filename = 'lokam_sky_lounge.glb') {
  // Temporarily force everything visible so hidden layers are still in the file.
  const hidden: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!o.visible) {
      hidden.push(o);
      o.visible = true;
    }
  });

  const exporter = new GLTFExporter();
  try {
    const result = await exporter.parseAsync(root, {
      binary: true,
      onlyVisible: true,
      includeCustomExtensions: false,
    });
    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    hidden.forEach((o) => (o.visible = false));
  }
}
