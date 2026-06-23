import * as THREE from 'three';
import { cloneDisguiseProp } from './scene-build.js';

function part(geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

export function createHumanoid(colorHex = 0xffffff, variant = 'hider') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5, metalness: 0.05 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xf5f5f5 });

  g.add(part(new THREE.CapsuleGeometry(0.38, 0.55, 6, 12), bodyMat, 0, 0.72, 0));
  g.add(part(new THREE.SphereGeometry(0.34, 12, 12), bodyMat, 0, 1.38, 0));
  g.add(part(new THREE.SphereGeometry(0.22, 10, 10), bellyMat, 0, 0.68, 0.28));
  g.add(part(new THREE.SphereGeometry(0.09, 8, 8), eyeWhite, -0.11, 1.45, 0.28));
  g.add(part(new THREE.SphereGeometry(0.09, 8, 8), eyeWhite, 0.11, 1.45, 0.28));
  g.add(part(new THREE.SphereGeometry(0.045, 6, 6), eyeMat, -0.11, 1.45, 0.34));
  g.add(part(new THREE.SphereGeometry(0.045, 6, 6), eyeMat, 0.11, 1.45, 0.34));
  g.add(part(new THREE.CapsuleGeometry(0.09, 0.32, 4, 8), bodyMat, -0.38, 0.62, 0, 0, 0, 0.35));
  g.add(part(new THREE.CapsuleGeometry(0.09, 0.32, 4, 8), bodyMat, 0.38, 0.62, 0, 0, 0, -0.35));
  g.add(part(new THREE.CapsuleGeometry(0.11, 0.38, 4, 8), bodyMat, -0.16, 0.38, 0.06));
  g.add(part(new THREE.CapsuleGeometry(0.11, 0.38, 4, 8), bodyMat, 0.16, 0.38, 0.06));
  g.add(part(new THREE.ConeGeometry(0.1, 0.5, 6), bodyMat, 0, 0.82, -0.34, 0.7, 0, 0));

  if (variant === 'seeker') {
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xff4444, roughness: 0.45 });
    g.add(part(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 10), hatMat, 0, 1.72, 0));
    g.add(part(new THREE.BoxGeometry( 0.45, 0.06, 0.45), hatMat, 0, 1.84, 0));
  } else if (variant === 'lobby') {
    const tagMat = new THREE.MeshStandardMaterial({ color: 0x6ea8ff, emissive: 0x224488, emissiveIntensity: 0.25 });
    g.add(part(new THREE.BoxGeometry(0.35, 0.12, 0.06), tagMat, 0, 1.05, 0.32));
  }

  return g;
}

export function createDisguiseVisual(propType) {
  return cloneDisguiseProp(propType);
}

export function getHumanoidVariant(player, phase) {
  if (phase === 'LOBBY' || phase === 'ROUND_END') return 'lobby';
  if (player.role === 'SEEKER') return 'seeker';
  return 'hider';
}
