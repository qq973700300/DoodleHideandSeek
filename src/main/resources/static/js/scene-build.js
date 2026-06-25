import * as THREE from 'three';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.04, ...opts });
}

function mesh(geo, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

function buildPineTree(x, z, scale = 1) {
  const g = new THREE.Group();
  const wood = mat(0x5c4033);
  const leaf = mat(0x2d6a4f);
  g.add(mesh(new THREE.CylinderGeometry(0.35 * scale, 0.55 * scale, 2.2 * scale, 8), wood, 0, 1.1 * scale, 0));
  g.add(mesh(new THREE.ConeGeometry(1.6 * scale, 2.4 * scale, 8), leaf, 0, 3.2 * scale, 0));
  g.add(mesh(new THREE.ConeGeometry(1.3 * scale, 2 * scale, 8), leaf, 0, 4.6 * scale, 0));
  g.add(mesh(new THREE.ConeGeometry(0.9 * scale, 1.6 * scale, 8), leaf, 0, 5.8 * scale, 0));
  g.position.set(x, 0, z);
  return g;
}

function buildRoundTree(x, z, scale = 1) {
  const g = new THREE.Group();
  const wood = mat(0x6a4a2d);
  const leaf = mat(0x4a8f4a);
  g.add(mesh(new THREE.CylinderGeometry(0.4 * scale, 0.55 * scale, 2.8 * scale, 10), wood, 0, 1.4 * scale, 0));
  g.add(mesh(new THREE.SphereGeometry(1.5 * scale, 10, 10), leaf, 0, 3.8 * scale, 0));
  g.add(mesh(new THREE.SphereGeometry(1.1 * scale, 10, 10), leaf, 0.9 * scale, 4.2 * scale, 0.4 * scale));
  g.add(mesh(new THREE.SphereGeometry(0.9 * scale, 10, 10), leaf, -0.8 * scale, 3.9 * scale, -0.3 * scale));
  g.position.set(x, 0, z);
  return g;
}

function buildBush(x, z, scale = 1) {
  const g = new THREE.Group();
  const leaf = mat(0x3d8b5a);
  [[0, 0.6, 0], [0.7, 0.5, 0.3], [-0.6, 0.45, -0.2], [0.2, 0.9, -0.5], [-0.3, 0.75, 0.6]].forEach(([px, py, pz]) => {
    g.add(mesh(new THREE.SphereGeometry(0.75 * scale, 8, 8), leaf, px * scale, py * scale, pz * scale));
  });
  g.position.set(x, 0, z);
  return g;
}

function buildRockCluster(x, z, scale = 1) {
  const g = new THREE.Group();
  const rock = mat(0x7a7f86, { roughness: 0.95 });
  const geo = new THREE.DodecahedronGeometry(1, 0);
  [[0, 0.5, 0, 1.2], [0.9, 0.35, 0.4, 0.85], [-0.7, 0.3, -0.5, 0.7], [0.3, 0.25, -0.8, 0.55]].forEach(([px, py, pz, s]) => {
    const m = mesh(geo, rock, px * scale, py * scale, pz * scale);
    m.scale.setScalar(s * scale);
    m.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(m);
  });
  g.position.set(x, 0, z);
  return g;
}

function buildCrate(x, z, scale = 1, color = 0xb8860b) {
  const g = new THREE.Group();
  const body = mat(color);
  const plank = mat(0x8b6914);
  const s = scale;
  g.add(mesh(new THREE.BoxGeometry(1.8 * s, 1.8 * s, 1.8 * s), body, 0, 0.9 * s, 0));
  g.add(mesh(new THREE.BoxGeometry(1.85 * s, 0.12 * s, 0.12 * s), plank, 0, 0.9 * s, 0.92 * s));
  g.add(mesh(new THREE.BoxGeometry(0.12 * s, 1.85 * s, 0.12 * s), plank, 0.92 * s, 0.9 * s, 0));
  g.position.set(x, 0, z);
  return g;
}

function buildBarrel(x, z, scale = 1) {
  const g = new THREE.Group();
  const body = mat(0x6b4423);
  const band = mat(0x444444, { metalness: 0.5, roughness: 0.4 });
  g.add(mesh(new THREE.CylinderGeometry(0.65 * scale, 0.7 * scale, 1.4 * scale, 12), body, 0, 0.7 * scale, 0));
  [0.35, 0.7, 1.05].forEach((y) => {
    g.add(mesh(new THREE.TorusGeometry(0.68 * scale, 0.05 * scale, 6, 16), band, 0, y * scale, 0, Math.PI / 2, 0, 0));
  });
  g.position.set(x, 0, z);
  return g;
}

function buildHayBale(x, z, rot = 0) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), mat(0xd4a017), 0, 0.8, 0, 0, 0, Math.PI / 2));
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildParkBench(x, z, rot = 0) {
  const g = new THREE.Group();
  const wood = mat(0x5c4033);
  const metal = mat(0x555555, { metalness: 0.6 });
  g.add(mesh(new THREE.BoxGeometry(2.8, 0.15, 0.9), wood, 0, 0.55, 0));
  g.add(mesh(new THREE.BoxGeometry(2.8, 0.7, 0.12), wood, 0, 0.95, -0.35));
  [[-1.1, 0.25, 0.3], [1.1, 0.25, 0.3], [-1.1, 0.25, -0.3], [1.1, 0.25, -0.3]].forEach(([px, py, pz]) => {
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), metal, px, py, pz));
  });
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildPicnicTable(x, z, rot = 0) {
  const g = new THREE.Group();
  const wood = mat(0x8b7355);
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.12, 1.6), wood, 0, 1.05, 0));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.12, 0.5), wood, 0, 0.55, 1.05));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.12, 0.5), wood, 0, 0.55, -1.05));
  [[-1.3, 0.5, 0.6], [1.3, 0.5, 0.6], [-1.3, 0.5, -0.6], [1.3, 0.5, -0.6]].forEach(([px, py, pz]) => {
    g.add(mesh(new THREE.BoxGeometry(0.15, 1, 0.15), wood, px, py, pz));
  });
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildShed(x, z, rot = 0) {
  const g = new THREE.Group();
  const wall = mat(0xa08060);
  const roof = mat(0x8b4513);
  const door = mat(0x4a3728);
  g.add(mesh(new THREE.BoxGeometry(5, 3.2, 4), wall, 0, 1.6, 0));
  g.add(mesh(new THREE.BoxGeometry(5.4, 0.25, 4.4), roof, 0, 3.2, 0));
  g.add(mesh(new THREE.BoxGeometry(5.2, 1.5, 0.15), roof, 0, 4, 0));
  g.add(mesh(new THREE.BoxGeometry(1.2, 2.2, 0.12), door, 0, 1.1, 2.01));
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildGazebo(x, z) {
  const g = new THREE.Group();
  const wood = mat(0xc9a66b);
  const roof = mat(0x6b3a2a);
  [[-2, 0, -2], [2, 0, -2], [-2, 0, 2], [2, 0, 2]].forEach(([px, , pz]) => {
    g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.5, 8), wood, px, 1.75, pz));
  });
  g.add(mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.2, 16), roof, 0, 3.6, 0));
  g.add(mesh(new THREE.ConeGeometry(3.5, 1.8, 8), roof, 0, 4.7, 0));
  g.position.set(x, 0, z);
  return g;
}

function buildLampPost(x, z) {
  const g = new THREE.Group();
  const metal = mat(0x333333, { metalness: 0.7, roughness: 0.35 });
  const lamp = mat(0xfff3c4, { emissive: 0xffd966, emissiveIntensity: 0.35 });
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 4.2, 8), metal, 0, 2.1, 0));
  g.add(mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), lamp, 0, 4.2, 0));
  g.position.set(x, 0, z);
  return g;
}

function buildPlaygroundSlide(x, z, rot = 0) {
  const g = new THREE.Group();
  const frame = mat(0xe63946);
  const slide = mat(0x4cc9f0);
  const platform = mat(0xffd166);
  g.add(mesh(new THREE.BoxGeometry(2.5, 0.2, 2.5), platform, 0, 2.5, 0));
  [[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1]].forEach(([px, , pz]) => {
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.5, 8), frame, px, 1.25, pz));
  });
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.08, 3.5), slide, 1.4, 1.2, 0, -0.55, 0, 0));
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildCar(x, z, rot = 0, color = 0xe63946) {
  const g = new THREE.Group();
  const body = mat(color, { metalness: 0.35, roughness: 0.45 });
  const glass = mat(0x87ceeb, { metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.7 });
  const tire = mat(0x222222, { roughness: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(3.6, 0.9, 1.8), body, 0, 0.65, 0));
  g.add(mesh(new THREE.BoxGeometry(2, 0.75, 1.5), body, -0.2, 1.35, 0));
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.6, 1.52), glass, -0.2, 1.4, 0));
  [[-1.1, 0.35, 0.95], [1.1, 0.35, 0.95], [-1.1, 0.35, -0.95], [1.1, 0.35, -0.95]].forEach(([px, py, pz]) => {
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12), tire, px, py, pz, 0, 0, Math.PI / 2));
  });
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildBusStop(x, z, rot = 0) {
  const g = new THREE.Group();
  const frame = mat(0x444444, { metalness: 0.5 });
  const panel = mat(0x88ccff, { transparent: true, opacity: 0.45 });
  const roof = mat(0x666666);
  g.add(mesh(new THREE.BoxGeometry(4, 0.15, 2.2), roof, 0, 2.8, 0));
  [[-1.8, 0, -0.9], [1.8, 0, -0.9], [-1.8, 0, 0.9], [1.8, 0, 0.9]].forEach(([px, , pz]) => {
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8), frame, px, 1.4, pz));
  });
  g.add(mesh(new THREE.BoxGeometry(0.08, 2.2, 2), panel, -1.5, 1.3, 0));
  g.add(mesh(new THREE.BoxGeometry(3.2, 0.12, 0.6), mat(0x5c4033), 0, 0.5, 0.5));
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildFlowerBed(x, z) {
  const g = new THREE.Group();
  const colors = [0xff6b6b, 0xffd93d, 0xff8cc8, 0x6bcb77, 0x4d96ff];
  g.add(mesh(new THREE.BoxGeometry(3.5, 0.35, 2), mat(0x5c4033), 0, 0.17, 0));
  for (let i = 0; i < 12; i++) {
    const fx = (Math.random() - 0.5) * 2.8;
    const fz = (Math.random() - 0.5) * 1.5;
    g.add(mesh(new THREE.SphereGeometry(0.18, 6, 6), mat(colors[i % colors.length]), fx, 0.45, fz));
    g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), mat(0x2d6a4f), fx, 0.3, fz));
  }
  g.position.set(x, 0, z);
  return g;
}

function buildFenceSegment(x, z, length, rot = 0) {
  const g = new THREE.Group();
  const wood = mat(0x8b6914);
  const count = Math.ceil(length / 1.5);
  for (let i = 0; i <= count; i++) {
    const px = -length / 2 + i * (length / count);
    g.add(mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), wood, px, 0.6, 0));
  }
  g.add(mesh(new THREE.BoxGeometry(length, 0.1, 0.08), wood, 0, 0.85, 0));
  g.add(mesh(new THREE.BoxGeometry(length, 0.1, 0.08), wood, 0, 0.45, 0));
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildFountain(x, z) {
  const g = new THREE.Group();
  const stone = mat(0x9aa0a6, { roughness: 0.85 });
  const water = mat(0x4cc9f0, { transparent: true, opacity: 0.75, metalness: 0.3 });
  g.add(mesh(new THREE.CylinderGeometry(2.5, 2.8, 0.6, 16), stone, 0, 0.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.08, 16), water, 0, 0.55, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.8, 10), stone, 0, 1.2, 0));
  g.add(mesh(new THREE.SphereGeometry(0.5, 10, 10), water, 0, 2.2, 0));
  g.position.set(x, 0, z);
  return g;
}

function buildSofa(x, z, rot = 0, color = 0x5b8cff) {
  const g = new THREE.Group();
  const fabric = mat(color);
  g.add(mesh(new THREE.BoxGeometry(3, 0.7, 1.4), fabric, 0, 0.45, 0));
  g.add(mesh(new THREE.BoxGeometry(3, 1.1, 0.35), fabric, 0, 0.95, -0.52));
  g.add(mesh(new THREE.BoxGeometry(0.35, 0.9, 1.4), fabric, -1.32, 0.75, 0));
  g.add(mesh(new THREE.BoxGeometry(0.35, 0.9, 1.4), fabric, 1.32, 0.75, 0));
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildBookshelf(x, z, rot = 0) {
  const g = new THREE.Group();
  const shelf = mat(0x6b4423);
  const bookColors = [0xe63946, 0x457b9d, 0x2a9d8f, 0xf4a261, 0x9b5de5];
  g.add(mesh(new THREE.BoxGeometry(3, 4, 0.8), shelf, 0, 2, 0));
  [0.8, 1.6, 2.4, 3.2].forEach((y) => {
    for (let i = 0; i < 5; i++) {
      const h = 0.5 + Math.random() * 0.35;
      g.add(mesh(new THREE.BoxGeometry(0.35, h, 0.55), mat(bookColors[i % bookColors.length]), -1 + i * 0.45, y + h / 2 - 0.15, 0.05));
    }
  });
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildSandBox(x, z) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(3.5, 0.5, 3.5), mat(0x8b6914), 0, 0.25, 0));
  g.add(mesh(new THREE.BoxGeometry(3.1, 0.35, 3.1), mat(0xe9c46a), 0, 0.42, 0));
  g.position.set(x, 0, z);
  return g;
}

function buildSignPost(x, z, rot = 0) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 3, 8), mat(0x555555, { metalness: 0.5 }), 0, 1.5, 0));
  g.add(mesh(new THREE.BoxGeometry(2.2, 1, 0.12), mat(0x2a6f97), 0, 2.6, 0));
  g.rotation.y = rot;
  g.position.set(x, 0, z);
  return g;
}

function buildLowWall(x, z, w, d, h = 1.2) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(0xd4b896), 0, h / 2, 0));
  g.position.set(x, 0, z);
  return g;
}

function buildColoredBlock(x, z, w, h, d, color) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(color), 0, h / 2, 0));
  g.position.set(x, 0, z);
  return g;
}

function placeProp(addPropGroup, model, propType) {
  model.userData.propType = propType;
  model.traverse((child) => {
    child.userData.propType = propType;
  });
  addPropGroup(model);
}

export const DISGUISE_NAMES = {
  pine_tree: '松树',
  round_tree: '阔叶树',
  bush: '灌木',
  rock_cluster: '岩石',
  crate: '木箱',
  barrel: '木桶',
  hay_bale: '草垛',
  picnic_table: '野餐桌',
  park_bench: '长椅',
  shed: '木棚',
  gazebo: '凉亭',
  fountain: '喷泉',
  playground_slide: '滑梯',
  sandbox: '沙坑',
  bus_stop: '公交站',
  car: '汽车',
  sofa: '沙发',
  bookshelf: '书架',
  flower_bed: '花坛',
  sign_post: '路牌',
  low_wall: '矮墙',
  colored_block: '色块',
  fence: '围栏',
  lamp_post: '路灯'
};

const DISGUISE_SCALE = {
  pine_tree: 1,
  round_tree: 1,
  bush: 1,
  rock_cluster: 1,
  crate: 1,
  barrel: 1,
  hay_bale: 1,
  picnic_table: 1,
  park_bench: 1,
  shed: 0.85,
  gazebo: 0.75,
  fountain: 0.9,
  playground_slide: 0.85,
  sandbox: 1,
  bus_stop: 0.9,
  car: 0.95,
  sofa: 1,
  bookshelf: 0.9,
  flower_bed: 1,
  sign_post: 1,
  low_wall: 1,
  colored_block: 1,
  fence: 1,
  lamp_post: 1
};

const DISGUISE_BUILDERS = {
  pine_tree: (s) => buildPineTree(0, 0, s),
  round_tree: (s) => buildRoundTree(0, 0, s),
  bush: (s) => buildBush(0, 0, s),
  rock_cluster: (s) => buildRockCluster(0, 0, s),
  crate: (s) => buildCrate(0, 0, s),
  barrel: (s) => buildBarrel(0, 0, s),
  hay_bale: () => buildHayBale(0, 0, 0),
  picnic_table: () => buildPicnicTable(0, 0, 0),
  park_bench: () => buildParkBench(0, 0, 0),
  shed: () => buildShed(0, 0, 0),
  gazebo: () => buildGazebo(0, 0),
  fountain: () => buildFountain(0, 0),
  playground_slide: () => buildPlaygroundSlide(0, 0, 0),
  sandbox: () => buildSandBox(0, 0),
  bus_stop: () => buildBusStop(0, 0, 0),
  car: () => buildCar(0, 0, 0, 0xe63946),
  sofa: () => buildSofa(0, 0, 0, 0x5b8cff),
  bookshelf: () => buildBookshelf(0, 0, 0),
  flower_bed: () => buildFlowerBed(0, 0),
  sign_post: () => buildSignPost(0, 0, 0),
  low_wall: () => buildLowWall(0, 0, 1, 1, 1.2),
  colored_block: () => buildColoredBlock(0, 0, 2, 2, 2, 0xcccccc),
  fence: () => buildFenceSegment(0, 0, 4, 0),
  lamp_post: () => buildLampPost(0, 0)
};

export const DISGUISE_COLLISION = {};
for (const [type, builder] of Object.entries(DISGUISE_BUILDERS)) {
  const scale = DISGUISE_SCALE[type] ?? 1;
  const model = builder(scale);
  const bounds = new THREE.Box3().setFromObject(model);
  const halfW = Math.max(0.4, (bounds.max.x - bounds.min.x) * 0.55 * 0.5);
  const halfD = Math.max(0.4, (bounds.max.z - bounds.min.z) * 0.55 * 0.5);
  DISGUISE_COLLISION[type] = { halfW, halfD };
}

export function resolvePropType(object) {
  let current = object;
  while (current) {
    if (current.userData?.propType) return current.userData.propType;
    current = current.parent;
  }
  return null;
}

export function cloneDisguiseProp(propType) {
  const builder = DISGUISE_BUILDERS[propType];
  if (!builder) return null;
  const scale = DISGUISE_SCALE[propType] ?? 1;
  const model = builder(scale);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  if (scale !== 1 && !['pine_tree', 'round_tree', 'bush', 'rock_cluster', 'crate', 'barrel'].includes(propType)) {
    model.scale.setScalar(scale);
  }
  return model;
}

export function sampleMeshColor(object) {
  if (object?.material?.color) {
    return object.material.color;
  }
  return new THREE.Color(0xffffff);
}

export function buildEnvironment(scene, addProp, addPropGroup, ROOM_W, ROOM_D) {
  const grass = mat(0x5a9e4a);
  const grassDark = mat(0x4a8f3a);
  const pathMat = mat(0x9a9590, { roughness: 0.95 });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), grass);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  addProp(floor);

  [[-20, -15, 18, 12], [22, 8, 14, 10], [0, 0, 32, 20], [-35, 20, 16, 14]].forEach(([x, z, w, d]) => {
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(w, d), grassDark);
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, 0.01, z);
    patch.receiveShadow = true;
    addProp(patch);
  });

  [[0, 5, 8, 50], [-30, -10, 35, 6], [25, -20, 6, 30]].forEach(([x, z, w, d]) => {
    const path = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(x, 0.02, z);
    path.receiveShadow = true;
    addProp(path);
  });

  const wallMat = mat(0xc9a66b);
  addProp(mesh(new THREE.BoxGeometry(ROOM_W, 7, 0.6), wallMat, 0, 3.5, -ROOM_D / 2));
  addProp(mesh(new THREE.BoxGeometry(0.6, 7, ROOM_D), wallMat, -ROOM_W / 2, 3.5, 0));
  addProp(mesh(new THREE.BoxGeometry(0.6, 7, ROOM_D), wallMat, ROOM_W / 2, 3.5, 0));

  for (let i = -56; i <= 56; i += 14) {
    addProp(mesh(new THREE.BoxGeometry(0.4, 6.5, 0.4), mat(0x8b6914), i, 3.25, -ROOM_D / 2 + 0.5));
  }

  const backdrop = mat(0x3d6b4f);
  [[-ROOM_W / 2 + 2, 0, 12, 8], [ROOM_W / 2 - 2, 0, 12, 8]].forEach(([x, z, r, h]) => {
    addProp(mesh(new THREE.ConeGeometry(r, h, 8), backdrop, x, h / 2 - 0.5, z));
  });

  placeProp(addPropGroup, buildLowWall(0, 0, 0.8, 28, 2.8), 'low_wall');
  placeProp(addPropGroup, buildLowWall(-20, -18, 22, 0.8, 2.8), 'low_wall');
  placeProp(addPropGroup, buildLowWall(30, 12, 0.8, 18, 2.2), 'low_wall');
  placeProp(addPropGroup, buildLowWall(-40, 8, 16, 0.8, 1.8), 'low_wall');

  placeProp(addPropGroup, buildColoredBlock(-48, -20, 3.5, 2.5, 3, 0xe85d5d), 'colored_block');
  placeProp(addPropGroup, buildColoredBlock(44, 16, 4, 3, 3.5, 0xf4c542), 'colored_block');
  placeProp(addPropGroup, buildColoredBlock(-36, 24, 5, 2.2, 4, 0x5b8cff), 'colored_block');
  placeProp(addPropGroup, buildColoredBlock(52, -24, 3, 4, 3, 0x9aa0a6), 'colored_block');
  placeProp(addPropGroup, buildColoredBlock(38, -32, 4, 2.8, 5, 0x4caf50), 'colored_block');
  placeProp(addPropGroup, buildColoredBlock(-52, 28, 3.5, 3.2, 3.5, 0x9c27b0), 'colored_block');

  [
    [40, -24, 1.1], [-44, -28, 0.95], [-16, 32, 1], [56, 8, 1.15], [-56, -8, 0.9],
    [12, -36, 1], [-8, -30, 1.05], [48, -8, 0.85], [-50, 18, 1.1], [20, 28, 0.95]
  ].forEach(([x, z, s]) => placeProp(addPropGroup, buildPineTree(x, z, s), 'pine_tree'));

  [
    [30, 22, 1], [-28, 14, 0.9], [8, -12, 1.1], [-58, -22, 0.85], [58, -18, 1]
  ].forEach(([x, z, s]) => placeProp(addPropGroup, buildRoundTree(x, z, s), 'round_tree'));

  [
    [18, 6], [-12, -6], [42, -28], [-46, -6], [6, 24], [-36, -32], [50, 12], [-22, 20]
  ].forEach(([x, z]) => placeProp(addPropGroup, buildBush(x, z, 0.85 + Math.random() * 0.3), 'bush'));

  [
    [-10, 14], [34, -6], [-48, -12], [14, -28], [-58, 8], [46, 28]
  ].forEach(([x, z]) => placeProp(addPropGroup, buildRockCluster(x, z, 0.8 + Math.random() * 0.4), 'rock_cluster'));

  placeProp(addPropGroup, buildCrate(-24, 10, 1.1, 0xb8860b), 'crate');
  placeProp(addPropGroup, buildCrate(-22.5, 10, 1, 0xcd853f), 'crate');
  placeProp(addPropGroup, buildCrate(-23, 11.5, 0.85, 0xdaa520), 'crate');
  placeProp(addPropGroup, buildCrate(36, -18, 1), 'crate');
  placeProp(addPropGroup, buildCrate(38, -18, 0.9, 0xcd853f), 'crate');

  [[-14, -22], [28, 26], [-42, 4], [52, -8]].forEach(([x, z]) => placeProp(addPropGroup, buildBarrel(x, z), 'barrel'));
  [[-32, -14, 0.5], [10, -8, 1.2], [44, 22, 0.8]].forEach(([x, z, r]) => placeProp(addPropGroup, buildHayBale(x, z, r), 'hay_bale'));

  placeProp(addPropGroup, buildPicnicTable(-8, 8, 0.3), 'picnic_table');
  placeProp(addPropGroup, buildPicnicTable(28, -12, -0.6), 'picnic_table');
  placeProp(addPropGroup, buildParkBench(16, 24, 0.2), 'park_bench');
  placeProp(addPropGroup, buildParkBench(-28, -8, 1.1), 'park_bench');
  placeProp(addPropGroup, buildParkBench(48, 20, -0.4), 'park_bench');
  placeProp(addPropGroup, buildParkBench(-50, -18, 0.7), 'park_bench');

  placeProp(addPropGroup, buildShed(-55, -28, 0.4), 'shed');
  placeProp(addPropGroup, buildShed(58, 24, -1.2), 'shed');
  placeProp(addPropGroup, buildGazebo(0, -22), 'gazebo');
  placeProp(addPropGroup, buildFountain(-2, 2), 'fountain');
  placeProp(addPropGroup, buildPlaygroundSlide(22, 18, 0.8), 'playground_slide');
  placeProp(addPropGroup, buildSandBox(18, -8), 'sandbox');
  placeProp(addPropGroup, buildBusStop(-48, 12, 0.5), 'bus_stop');
  placeProp(addPropGroup, buildCar(42, -32, 0.3, 0xe63946), 'car');
  placeProp(addPropGroup, buildCar(-38, -26, -0.8, 0x457b9d), 'car');
  placeProp(addPropGroup, buildSofa(-18, 4, 0.6, 0x5b8cff), 'sofa');
  placeProp(addPropGroup, buildSofa(14, -16, -0.2, 0xe76f51), 'sofa');
  placeProp(addPropGroup, buildBookshelf(-58, 0, Math.PI / 2), 'bookshelf');
  placeProp(addPropGroup, buildFlowerBed(-24, 22), 'flower_bed');
  placeProp(addPropGroup, buildFlowerBed(36, 6), 'flower_bed');
  placeProp(addPropGroup, buildSignPost(8, 30, 0.2), 'sign_post');

  [[-50, -35, 18, 0], [50, -35, 18, 0], [-50, 35, 18, Math.PI / 2], [50, 35, 18, -Math.PI / 2]].forEach(([x, z, len, r]) => {
    placeProp(addPropGroup, buildFenceSegment(x, z, len, r), 'fence');
  });

  [
    [-58, -30], [-58, -10], [-58, 10], [58, -20], [58, 0], [58, 20]
  ].forEach(([x, z]) => placeProp(addPropGroup, buildLampPost(x, z), 'lamp_post'));

  addProp(mesh(new THREE.BoxGeometry(32, 0.08, 20), mat(0x8b7355), 0, 0.04, 0));
  addProp(mesh(new THREE.BoxGeometry(20, 0.08, 14), mat(0x7a6348), 36, 0.04, -12));
  addProp(mesh(new THREE.BoxGeometry(18, 0.08, 12), mat(0x6d5c44), -40, 0.04, 16));

  const cloudMat = mat(0xffffff, { transparent: true, opacity: 0.85 });
  [[-30, 28, -20], [20, 32, 10], [50, 26, -30], [-50, 30, 25]].forEach(([x, y, z]) => {
    const cloud = new THREE.Group();
    cloud.add(mesh(new THREE.SphereGeometry(3, 8, 8), cloudMat, 0, 0, 0));
    cloud.add(mesh(new THREE.SphereGeometry(2.2, 8, 8), cloudMat, 2.5, -0.3, 0));
    cloud.add(mesh(new THREE.SphereGeometry(2.5, 8, 8), cloudMat, -2.2, -0.2, 0.5));
    cloud.position.set(x, y, z);
    scene.add(cloud);
  });
}

export function buildSeekerWaitingRoom() {
  const room = new THREE.Group();
  const floorMat = mat(0x6b5b4f, { roughness: 0.92 });
  const wallMat = mat(0x8b7d6b, { roughness: 0.88 });
  const trimMat = mat(0x4a4035);
  const lampMat = mat(0xfff3d6, { emissive: 0xfff0cc, emissiveIntensity: 0.35 });

  room.add(mesh(new THREE.PlaneGeometry(14, 14), floorMat, 0, 0, 0, -Math.PI / 2, 0, 0));
  room.add(mesh(new THREE.BoxGeometry(14, 4.2, 0.35), wallMat, 0, 2.1, -7));
  room.add(mesh(new THREE.BoxGeometry(14, 4.2, 0.35), wallMat, 0, 2.1, 7));
  room.add(mesh(new THREE.BoxGeometry(0.35, 4.2, 14), wallMat, -7, 2.1, 0));
  room.add(mesh(new THREE.BoxGeometry(0.35, 4.2, 14), wallMat, 7, 2.1, 0));
  room.add(mesh(new THREE.BoxGeometry(14.4, 0.25, 14.4), trimMat, 0, 4.2, 0));

  const bench = new THREE.Group();
  bench.add(mesh(new THREE.BoxGeometry(3.2, 0.18, 1.1), mat(0x5c4033), 0, 0.55, 0));
  bench.add(mesh(new THREE.BoxGeometry(3.2, 0.55, 0.16), mat(0x5c4033), 0, 0.95, -0.42));
  bench.add(mesh(new THREE.BoxGeometry(0.16, 0.55, 1.1), mat(0x5c4033), -1.45, 0.28, 0));
  bench.add(mesh(new THREE.BoxGeometry(0.16, 0.55, 1.1), mat(0x5c4033), 1.45, 0.28, 0));
  bench.position.set(-2.2, 0, 2.4);
  room.add(bench);

  const lamp = new THREE.Group();
  lamp.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 8), mat(0x444444, { metalness: 0.5 }), 0, 3.85, 0));
  lamp.add(mesh(new THREE.SphereGeometry(0.45, 10, 10), lampMat, 0, 3.45, 0));
  lamp.position.set(0, 0, -4.5);
  room.add(lamp);

  const poster = mesh(new THREE.PlaneGeometry(4.2, 1.4), mat(0x3d5a80), 0, 2.2, -6.82);
  room.add(poster);

  room.position.set(200, 0, 0);
  return room;
}
