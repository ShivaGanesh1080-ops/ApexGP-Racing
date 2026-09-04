import * as THREE from 'three';
import './styles.css';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const STORAGE_KEY = 'apexgp-progress-v1';
const MAX_SPEED = 78;
const TOTAL_LAPS = 2;

const circuits = [
  { name: 'SUNSET RUN', tag: 'DUSK / STREET CIRCUIT', rx: 56, rz: 37, wobble: 3.8, waves: 3, phase: .2, sky: 0x8e5a4d, fog: 0x8e5a4d },
  { name: 'PACIFIC CREST', tag: 'COAST / FAST FLOW', rx: 63, rz: 31, wobble: 5.2, waves: 4, phase: 1.1, sky: 0x4e8796, fog: 0x6e9aa3 },
  { name: 'NEON DOCKS', tag: 'NIGHT / TECHNICAL', rx: 48, rz: 43, wobble: 6.2, waves: 5, phase: 2.0, sky: 0x1b2740, fog: 0x1b2740 },
  { name: 'RED CANYON', tag: 'DESERT / HIGH GRIP', rx: 68, rz: 34, wobble: 4.6, waves: 3, phase: 2.8, sky: 0xb7724a, fog: 0xb7724a },
  { name: 'ALPINE RING', tag: 'MOUNTAIN / CLIMB', rx: 54, rz: 44, wobble: 4.0, waves: 4, phase: 3.7, sky: 0x60768c, fog: 0x778999 },
  { name: 'MONSOON GP', tag: 'RAIN / LOW VISIBILITY', rx: 60, rz: 39, wobble: 5.9, waves: 5, phase: 4.6, sky: 0x4f6268, fog: 0x657376 },
  { name: 'METRO LOOP', tag: 'CITY / LATE BRAKING', rx: 45, rz: 49, wobble: 3.4, waves: 6, phase: 5.4, sky: 0x52617b, fog: 0x52617b },
  { name: 'BLACK FOREST', tag: 'FOREST / BLIND CRESTS', rx: 69, rz: 40, wobble: 6.8, waves: 4, phase: 6.1, sky: 0x30493f, fog: 0x56655b },
  { name: 'AURORA BAY', tag: 'NIGHT / ENDURANCE', rx: 57, rz: 35, wobble: 4.7, waves: 5, phase: 7.0, sky: 0x27395a, fog: 0x394d69 },
  { name: 'CHAMPIONS WAY', tag: 'FINALE / EVERYTHING', rx: 73, rz: 45, wobble: 7.2, waves: 6, phase: 7.8, sky: 0x714b49, fog: 0x714b49 }
];

const levels = Array.from({ length: 100 }, (_, i) => {
  const circuitIndex = Math.floor(i / 10);
  const stage = (i % 10) + 1;
  const circuit = circuits[circuitIndex];
  return {
    number: i + 1,
    circuitIndex,
    stage,
    name: circuit.name,
    tag: circuit.tag,
    difficulty: Math.min(.92, .12 + i * .0082),
    aiSpeed: 39 + i * .29,
    laps: i > 69 ? 3 : 2,
    weather: circuitIndex === 5 ? 'rain' : circuitIndex === 2 || circuitIndex === 8 ? 'night' : circuitIndex === 4 || circuitIndex === 7 ? 'overcast' : 'clear'
  };
});

const defaultProgress = { unlocked: 1, completed: [], bestTimes: {}, gp: 0 };
let progress = loadProgress();

const app = {
  scene: null,
  camera: null,
  renderer: null,
  clock: new THREE.Clock(),
  world: null,
  curve: null,
  trackLength: 1,
  roadWidth: 9,
  sun: null,
  playerCar: null,
  remoteCar: null,
  opponents: [],
  selectedLevel: 1,
  mode: 'menu',
  running: false,
  raceReady: false,
  playerProgress: 0,
  playerLane: 0,
  playerSpeed: 0,
  raceStart: 0,
  finishShown: false,
  input: { throttle: false, brake: false, left: false, right: false },
  remote: { progress: 0, lane: 0, speed: 0, connected: false },
  mp: { peer: null, conn: null, host: false, code: '', lastSend: 0 },
  ambience: { target: new THREE.Color(0x8e5a4d), current: new THREE.Color(0x8e5a4d) }
};

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return { ...defaultProgress, ...(saved || {}), completed: Array.isArray(saved?.completed) ? saved.completed : [] };
  } catch {
    return { ...defaultProgress, completed: [] };
  }
}

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* storage is optional */ }
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const hundredths = Math.floor((seconds % 1) * 100).toString().padStart(2, '0');
  return `${mins}:${secs}.${hundredths}`;
}
function showToast(message, duration = 2600) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), duration);
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((screen) => screen.classList.toggle('active', screen.id === id));
}
function hideScreens() { document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active')); }

function createRenderer() {
  app.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  app.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  app.renderer.setSize(window.innerWidth, window.innerHeight);
  app.renderer.shadowMap.enabled = true;
  app.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  app.renderer.toneMappingExposure = 1.05;
  $('game-root').appendChild(app.renderer.domElement);
}

function createScene() {
  app.scene = new THREE.Scene();
  app.scene.fog = new THREE.Fog(0x8e5a4d, 35, 210);
  app.camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, .1, 500);
  app.camera.position.set(0, 5, 11);
  app.world = new THREE.Group();
  app.scene.add(app.world);

  const hemi = new THREE.HemisphereLight(0xb9d9e0, 0x152018, 1.75);
  app.scene.add(hemi);
  app.sun = new THREE.DirectionalLight(0xffd5a1, 3.6);
  app.sun.position.set(-80, 100, 42);
  app.sun.castShadow = true;
  app.sun.shadow.mapSize.set(1024, 1024);
  app.sun.shadow.camera.left = -110;
  app.sun.shadow.camera.right = 110;
  app.sun.shadow.camera.top = 110;
  app.sun.shadow.camera.bottom = -110;
  app.scene.add(app.sun);
  app.scene.add(new THREE.AmbientLight(0x95a4bc, .45));
}

function makeRibbon(curve, width, segments = 240, y = 0) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const left = p.clone().addScaledVector(normal, width / 2);
    const right = p.clone().addScaledVector(normal, -width / 2);
    left.y = y; right.y = y;
    positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
    uvs.push(0, t * 18, 1, t * 18);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeCurb(curve, roadWidth, side, segments = 240) {
  const width = .48;
  const positions = [];
  const colors = [];
  const indices = [];
  const red = new THREE.Color(0xd93632);
  const cream = new THREE.Color(0xe9e3d4);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const center = p.clone().addScaledVector(normal, side * (roadWidth / 2 + width / 2));
    const a = center.clone().addScaledVector(normal, -side * width / 2);
    const b = center.clone().addScaledVector(normal, side * width / 2);
    a.y = .045; b.y = .045;
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const color = Math.floor(i / 5) % 2 ? red : cream;
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function trackSample(progressValue) {
  const t = ((progressValue % 1) + 1) % 1;
  const point = app.curve.getPointAt(t);
  const tangent = app.curve.getTangentAt(t).normalize();
  const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  return { point, tangent, normal, t };
}

function placeVehicle(vehicle, progressValue, lane) {
  if (!vehicle || !app.curve) return;
  const sample = trackSample(progressValue);
  vehicle.position.copy(sample.point).addScaledVector(sample.normal, lane * 1.62);
  vehicle.position.y = .38;
  vehicle.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z);
}

function makeVehicle(bodyColor, accentColor, isPlayer = false) {
  const root = new THREE.Group();
  root.userData.isPlayer = isPlayer;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, .34, 2.45), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: .35, metalness: .58 }));
  body.position.y = .45;
  body.castShadow = true;
  root.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(.62, 2.15, 4, 1, false), new THREE.MeshStandardMaterial({ color: bodyColor, roughness: .35, metalness: .5 }));
  nose.rotation.x = -Math.PI / 2;
  nose.rotation.z = Math.PI / 4;
  nose.scale.set(1, 1, .8);
  nose.position.set(0, .43, -1.86);
  nose.castShadow = true;
  root.add(nose);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(.62, 16, 8), new THREE.MeshStandardMaterial({ color: 0x101923, roughness: .12, metalness: .72, transparent: true, opacity: .94 }));
  cockpit.scale.set(1.0, .37, 1.18);
  cockpit.position.set(0, .72, .25);
  cockpit.castShadow = true;
  root.add(cockpit);

  const sidepodMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: .32, metalness: .48 });
  [-1, 1].forEach((side) => {
    const sidepod = new THREE.Mesh(new THREE.BoxGeometry(.38, .27, 1.55), sidepodMaterial);
    sidepod.position.set(side * 1.06, .46, .05);
    sidepod.castShadow = true;
    root.add(sidepod);
  });

  const wingMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: .28, metalness: .52 });
  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(2.82, .1, .22), wingMaterial);
  frontWing.position.set(0, .31, -2.57);
  frontWing.castShadow = true;
  root.add(frontWing);
  const rearWing = new THREE.Mesh(new THREE.BoxGeometry(2.62, .14, .18), wingMaterial);
  rearWing.position.set(0, .98, 1.65);
  rearWing.castShadow = true;
  root.add(rearWing);
  const rearPost = new THREE.Mesh(new THREE.BoxGeometry(.12, .48, .12), wingMaterial);
  rearPost.position.set(0, .72, 1.63);
  root.add(rearPost);

  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: .9, metalness: .12 });
  const wheelAccent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: .5, metalness: .45 });
  [-1, 1].forEach((side) => {
    [-1.28, 1.2].forEach((z) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.33, .33, .24, 14), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.08, .32, z);
      wheel.castShadow = true;
      root.add(wheel);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .25, 12), wheelAccent);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(side * 1.08, .32, z);
      root.add(hub);
    });
  });

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(.08, .025, 3.5), new THREE.MeshBasicMaterial({ color: accentColor }));
  stripe.position.set(0, .66, -.22);
  root.add(stripe);
  const tailLight = new THREE.PointLight(0xff2b2b, isPlayer ? 1.8 : .7, 5);
  tailLight.position.set(0, .58, 1.86);
  root.add(tailLight);
  return root;
}

function createTree(scale = 1, tint = 0x244c3d) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12 * scale, .18 * scale, 1.3 * scale, 7), new THREE.MeshStandardMaterial({ color: 0x4b3325, roughness: 1 }));
  trunk.position.y = .65 * scale;
  trunk.castShadow = true;
  tree.add(trunk);
  const foliage = new THREE.Mesh(new THREE.ConeGeometry(.9 * scale, 2.7 * scale, 7), new THREE.MeshStandardMaterial({ color: tint, roughness: .98 }));
  foliage.position.y = 2.2 * scale;
  foliage.castShadow = true;
  tree.add(foliage);
  const upper = new THREE.Mesh(new THREE.ConeGeometry(.58 * scale, 1.9 * scale, 7), new THREE.MeshStandardMaterial({ color: new THREE.Color(tint).offsetHSL(0, -.02, .08), roughness: 1 }));
  upper.position.y = 3.45 * scale;
  upper.castShadow = true;
  tree.add(upper);
  return tree;
}

function addGrandstand(sample, side, index) {
  const stand = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(9, .7, 4.8), new THREE.MeshStandardMaterial({ color: 0x343b45, roughness: .84 }));
  base.position.y = .35;
  base.castShadow = true;
  stand.add(base);
  for (let row = 0; row < 3; row++) {
    const seats = new THREE.Mesh(new THREE.BoxGeometry(7.4, .15, .72), new THREE.MeshStandardMaterial({ color: row % 2 ? 0xe5322c : 0xf4c46d, roughness: .7 }));
    seats.position.set(0, 1.1 + row * .52, -1.25 + row * .5);
    seats.castShadow = true;
    stand.add(seats);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(9.7, .18, 5.3), new THREE.MeshStandardMaterial({ color: 0x111821, roughness: .58, metalness: .22 }));
  roof.position.y = 3.05;
  roof.castShadow = true;
  stand.add(roof);
  stand.position.copy(sample.point).addScaledVector(sample.normal, side * 16);
  stand.position.y = 0;
  stand.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
  app.world.add(stand);
  if (index % 2 === 0) addBillboard(sample, side);
}

function addBillboard(sample, side) {
  const board = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.25, .14), new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: .66, metalness: .22 }));
  board.position.copy(sample.point).addScaledVector(sample.normal, side * 12.5);
  board.position.y = 3.4;
  board.rotation.y = Math.atan2(sample.tangent.x, sample.tangent.z) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
  board.castShadow = true;
  app.world.add(board);
}

function addLamp(sample, side, color = 0xf4c46d) {
  const lamp = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.035, .06, 3.2, 6), new THREE.MeshStandardMaterial({ color: 0x4c5056, metalness: .7, roughness: .4 }));
  pole.position.y = 1.6;
  lamp.add(pole);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 8), new THREE.MeshBasicMaterial({ color }));
  bulb.position.y = 3.2;
  lamp.add(bulb);
  lamp.position.copy(sample.point).addScaledVector(sample.normal, side * 6.2);
  app.world.add(lamp);
}

function addFinishLine(curve, roadWidth) {
  const sample = trackSample(0);
  const stripeCount = 12;
  const square = roadWidth / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(square, .055, 1.55), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xf2eee3 : 0x101216, roughness: .82 }));
    tile.position.copy(sample.point).addScaledVector(sample.normal, -roadWidth / 2 + square / 2 + i * square);
    tile.position.y = .09;
    tile.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), sample.normal);
    tile.castShadow = true;
    app.world.add(tile);
  }
}

function clearWorld() {
  while (app.world.children.length) app.world.remove(app.world.children[0]);
  app.opponents = [];
  app.playerCar = null;
  app.remoteCar = null;
}

function createTrack(level) {
  clearWorld();
  const circuit = circuits[level.circuitIndex];
  const detail = 1 + level.stage * .012;
  const rawPoints = [];
  const pointCount = 22;
  for (let i = 0; i < pointCount; i++) {
    const a = (i / pointCount) * TAU;
    const wobble = Math.sin(a * circuit.waves + circuit.phase) * circuit.wobble + Math.sin(a * 2.1 + circuit.phase) * 1.2;
    const x = Math.sin(a) * (circuit.rx + wobble) * detail;
    const z = Math.cos(a) * (circuit.rz + Math.cos(a * 2 + circuit.phase) * 2.1) * detail;
    rawPoints.push(new THREE.Vector3(x, 0, z));
  }
  app.curve = new THREE.CatmullRomCurve3(rawPoints, true, 'centripetal', .5);
  app.trackLength = app.curve.getLength();
  app.roadWidth = 9.1 - level.difficulty * .42;
  app.scene.background = new THREE.Color(circuit.sky);
  app.scene.fog.color.setHex(circuit.fog);
  app.scene.fog.near = level.weather === 'rain' ? 25 : 37;
  app.scene.fog.far = level.weather === 'night' ? 170 : 230;
  app.ambience.target.setHex(circuit.sky);
  app.sun.intensity = level.weather === 'night' ? .6 : level.weather === 'overcast' ? 1.8 : 3.4;
  app.sun.color.setHex(level.weather === 'night' ? 0x7189db : level.weather === 'rain' ? 0xcbd4d7 : 0xffd5a1);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ color: level.weather === 'night' ? 0x121923 : 0x18261e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.18;
  ground.receiveShadow = true;
  app.world.add(ground);

  const shoulder = new THREE.Mesh(makeRibbon(app.curve, app.roadWidth + 1.45, 260, -.01), new THREE.MeshStandardMaterial({ color: 0x75736a, roughness: 1 }));
  shoulder.receiveShadow = true;
  app.world.add(shoulder);
  const road = new THREE.Mesh(makeRibbon(app.curve, app.roadWidth, 260, .015), new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: .9, metalness: .03 }));
  road.receiveShadow = true;
  road.castShadow = true;
  app.world.add(road);
  [-1, 1].forEach((side) => {
    const curb = new THREE.Mesh(makeCurb(app.curve, app.roadWidth, side, 260), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .82 }));
    curb.receiveShadow = true;
    app.world.add(curb);
  });
  addFinishLine(app.curve, app.roadWidth);

  const seed = level.number * 9.731;
  const seeded = (n) => Math.abs(Math.sin(seed + n * 18.13));
  for (let i = 0; i < Math.floor(95 + level.stage * 2); i++) {
    const t = (i * .127 + seeded(i) * .21) % 1;
    const sample = trackSample(t);
    const side = i % 2 ? 1 : -1;
    const offset = 12 + seeded(i + 3) * 28;
    const tree = createTree(.75 + seeded(i + 8) * 1.05, level.weather === 'night' ? 0x182f35 : level.circuitIndex === 3 ? 0x536839 : 0x244c3d);
    tree.position.copy(sample.point).addScaledVector(sample.normal, side * offset);
    tree.position.y = 0;
    tree.rotation.y = seeded(i + 4) * TAU;
    app.world.add(tree);
  }
  for (let i = 0; i < 10; i++) {
    const sample = trackSample((i + .15) / 10);
    if (i % 2 === 0) addGrandstand(sample, i % 4 ? 1 : -1, i);
    addLamp(sample, i % 2 ? 1 : -1, level.weather === 'night' ? 0x89d8ff : 0xf4c46d);
  }

  // Distant low-poly peaks give the camera a readable horizon without heavy assets.
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * TAU;
    const radius = 125 + seeded(i + 45) * 30;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(8 + seeded(i + 50) * 12, 18 + seeded(i + 54) * 28, 5), new THREE.MeshStandardMaterial({ color: level.weather === 'night' ? 0x1a2538 : 0x3d4a43, roughness: 1 }));
    peak.position.set(Math.sin(a) * radius, 10, Math.cos(a) * radius);
    app.world.add(peak);
  }

  app.playerCar = makeVehicle(0xe5322c, 0xf4c46d, true);
  app.world.add(app.playerCar);
  const aiColors = [0x2d7fe6, 0xe7e5dc, 0x44b895, 0xf39a38, 0xb44bcb];
  const aiAccents = [0xa8d8ff, 0xe5322c, 0x14221e, 0x202a4d, 0xf4c46d];
  for (let i = 0; i < 5; i++) {
    const ai = makeVehicle(aiColors[i], aiAccents[i], false);
    app.world.add(ai);
    app.opponents.push({ car: ai, progress: -.018 - i * .014, lane: (i % 2 ? 1 : -1) * (.35 + (i % 3) * .16), speed: level.aiSpeed + (4 - i) * 1.8, wobble: i * 1.7 });
  }
  if (app.mode === 'multiplayer') {
    app.remoteCar = makeVehicle(0x37a3e8, 0xf3f2e7, false);
    app.world.add(app.remoteCar);
  }
  placeVehicle(app.playerCar, 0, 0);
  app.opponents.forEach((opponent) => placeVehicle(opponent.car, opponent.progress, opponent.lane));
  if (app.remoteCar) placeVehicle(app.remoteCar, 0, 1.2);
}

function getRaceOrder() {
  const entries = [{ id: 'player', progress: app.playerProgress }];
  app.opponents.forEach((opponent, index) => entries.push({ id: `ai-${index}`, progress: opponent.progress }));
  if (app.mode === 'multiplayer' && app.remote.connected) entries.push({ id: 'friend', progress: app.remote.progress });
  entries.sort((a, b) => b.progress - a.progress);
  return entries;
}

function updateHud() {
  const level = levels[app.selectedLevel - 1];
  const position = getRaceOrder().findIndex((entry) => entry.id === 'player') + 1;
  $('hud-circuit').textContent = level.name;
  $('hud-level').textContent = `LVL ${String(level.number).padStart(2, '0')}`;
  $('hud-position').textContent = `P${position}`;
  $('hud-lap').textContent = `LAP ${Math.min(level.laps, Math.floor(app.playerProgress) + 1)} / ${level.laps}`;
  $('hud-speed').textContent = String(Math.round(app.playerSpeed * 3.6)).padStart(3, '0');
  $('hud-gear').textContent = app.playerSpeed < 2 ? 'N' : String(clamp(Math.floor(app.playerSpeed / 10) + 1, 1, 8));
  $('hud-rpm').style.width = `${clamp((app.playerSpeed / MAX_SPEED) * 100 + (app.input.throttle ? 8 : 0), 0, 100)}%`;
  $('hud-time').textContent = formatTime((performance.now() - app.raceStart) / 1000);
}

function updateCamera(dt) {
  const sample = trackSample(app.playerProgress);
  const desired = sample.point.clone().addScaledVector(sample.tangent, -8.6).add(new THREE.Vector3(0, 4.05, 0));
  app.camera.position.lerp(desired, 1 - Math.pow(.001, dt));
  const target = sample.point.clone().addScaledVector(sample.tangent, 8.5).add(new THREE.Vector3(0, .65, 0));
  app.camera.lookAt(target);
  app.camera.fov = 53 + clamp(app.playerSpeed / MAX_SPEED, 0, 1) * 7;
  app.camera.updateProjectionMatrix();
}

function updateRace(dt) {
  if (!app.raceReady) return;
  const level = levels[app.selectedLevel - 1];
  if (app.running) {
    const throttle = app.input.throttle;
    const brake = app.input.brake;
    const acceleration = throttle ? 31 : -8.5;
    const braking = brake ? 48 : 0;
    app.playerSpeed += (acceleration - braking) * dt;
    app.playerSpeed -= (app.playerSpeed * .09 + 1.2) * dt;
    if (!throttle && app.playerSpeed < 7) app.playerSpeed = Math.max(0, app.playerSpeed - 8 * dt);
    app.playerSpeed = clamp(app.playerSpeed, 0, MAX_SPEED - level.difficulty * 4);

    const steerInput = (app.input.right ? 1 : 0) - (app.input.left ? 1 : 0);
    const grip = .42 + app.playerSpeed / MAX_SPEED * .48;
    app.playerLane += steerInput * grip * dt * 2.9;
    app.playerLane -= app.playerLane * .13 * dt;
    app.playerLane = clamp(app.playerLane, -2.05, 2.05);
    if (Math.abs(app.playerLane) > 1.72) app.playerSpeed = Math.max(10, app.playerSpeed - 14 * dt);
    app.playerProgress += (app.playerSpeed / app.trackLength) * dt;

    app.opponents.forEach((opponent) => {
      const pace = opponent.speed + Math.sin(performance.now() * .0007 + opponent.wobble) * 1.8;
      opponent.progress += (pace / app.trackLength) * dt;
      opponent.lane += Math.sin(performance.now() * .0008 + opponent.wobble) * dt * .02;
      opponent.lane = clamp(opponent.lane, -1.25, 1.25);
      placeVehicle(opponent.car, opponent.progress, opponent.lane);
    });
    placeVehicle(app.playerCar, app.playerProgress, app.playerLane);

    if (app.remoteCar && app.remote.connected) placeVehicle(app.remoteCar, app.remote.progress, app.remote.lane);
    if (app.mp.conn && app.mp.conn.open && performance.now() - app.mp.lastSend > 75) {
      app.mp.lastSend = performance.now();
      app.mp.conn.send({ type: 'state', progress: app.playerProgress, lane: app.playerLane, speed: app.playerSpeed, level: app.selectedLevel });
    }
    if (app.playerProgress >= level.laps) finishRace();
    updateHud();
  }
  updateCamera(dt);
  app.ambience.current.lerp(app.ambience.target, .015);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(app.clock.getDelta(), .05);
  updateRace(dt);
  if (app.renderer && app.scene && app.camera) app.renderer.render(app.scene, app.camera);
}

function beginCountdown(level, multiplayer) {
  app.raceReady = false;
  app.running = false;
  $('countdown-round').textContent = `ROUND ${String(level.number).padStart(2, '0')} • ${level.name}`;
  showScreen('countdown-screen');
  const values = ['3', '2', '1', 'GO'];
  let index = 0;
  const tick = () => {
    $('countdown-value').textContent = values[index];
    $('countdown-value').style.animation = 'none';
    void $('countdown-value').offsetWidth;
    $('countdown-value').style.animation = 'pulse .9s ease both';
    if (index === values.length - 1) {
      setTimeout(() => {
        hideScreens();
        $('race-hud').classList.remove('hidden');
        app.raceReady = true;
        app.running = true;
        app.raceStart = performance.now();
        $('race-hint').textContent = multiplayer ? 'CONNECTED GRID  •  W / ↑ accelerate  •  A D / ← → steer' : 'W / ↑ accelerate  •  A D / ← → steer  •  S / ↓ brake';
      }, 650);
      return;
    }
    index += 1;
    setTimeout(tick, 920);
  };
  tick();
}

function startRace(levelNumber = app.selectedLevel, multiplayer = false) {
  app.selectedLevel = clamp(Number(levelNumber) || 1, 1, 100);
  app.mode = multiplayer ? 'multiplayer' : 'single';
  const level = levels[app.selectedLevel - 1];
  app.playerProgress = .006;
  app.playerLane = 0;
  app.playerSpeed = 0;
  app.finishShown = false;
  app.remote = { progress: .002, lane: 1.2, speed: 0, connected: Boolean(app.mp.conn?.open) };
  createTrack(level);
  $('race-hud').classList.remove('hidden');
  beginCountdown(level, multiplayer);
}

function finishRace() {
  if (app.finishShown) return;
  app.finishShown = true;
  app.running = false;
  app.raceReady = false;
  $('race-hud').classList.add('hidden');
  const position = getRaceOrder().findIndex((entry) => entry.id === 'player') + 1;
  const level = levels[app.selectedLevel - 1];
  const elapsed = (performance.now() - app.raceStart) / 1000;
  const won = position === 1;
  if (won || app.mode === 'single') {
    progress.completed = [...new Set([...progress.completed, app.selectedLevel])];
    progress.unlocked = Math.max(progress.unlocked, Math.min(100, app.selectedLevel + 1));
    progress.bestTimes[app.selectedLevel] = Math.min(progress.bestTimes[app.selectedLevel] || Infinity, elapsed);
    progress.gp += won ? 100 + app.selectedLevel * 5 : 25;
    saveProgress();
  }
  renderLevelGrid();
  updateGarage();
  $('finish-position').textContent = `P${position}`;
  $('finish-title').textContent = won ? 'APEX SECURED' : 'CHECKERED FLAG';
  $('finish-summary').textContent = won ? 'Clean lines. Maximum commitment. The next level is unlocked.' : `You finished in position ${position}. Learn the sector and attack again.`;
  $('finish-time').textContent = formatTime(elapsed);
  $('finish-level').textContent = String(app.selectedLevel).padStart(2, '0');
  $('finish-reward').textContent = won ? `+${100 + app.selectedLevel * 5} GP` : '+25 GP';
  $('next-level-btn').textContent = app.selectedLevel >= 100 ? 'Replay level' : 'Next level';
  $('next-level-btn').classList.toggle('hidden', app.mode === 'multiplayer');
  showScreen('finish-screen');
}

function renderLevelGrid() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  levels.forEach((level) => {
    const button = document.createElement('button');
    const unlocked = level.number <= progress.unlocked;
    const completed = progress.completed.includes(level.number);
    button.className = `level-cell ${unlocked ? 'unlocked' : ''} ${completed ? 'completed' : ''} ${level.number === app.selectedLevel ? 'current' : ''}`;
    button.disabled = !unlocked;
    button.innerHTML = `<span class="level-circuit">${String(level.circuitIndex + 1).padStart(2, '0')}</span><span class="level-number">${String(level.number).padStart(2, '0')}</span><span class="level-star">${completed ? '★' : unlocked ? '•' : '×'}</span>`;
    button.addEventListener('click', () => startRace(level.number, false));
    grid.appendChild(button);
  });
  $('level-progress').textContent = `${progress.unlocked} / 100`;
}

function updateGarage() {
  $('garage-balance').textContent = `${progress.gp} GP`;
  const rating = progress.completed.length >= 75 ? 'LEGEND' : progress.completed.length >= 40 ? 'ACE' : progress.completed.length >= 15 ? 'PRO' : 'ROOKIE';
  $('driver-rating').textContent = rating;
}

function renderHostLevelSelect() {
  const select = $('host-level-select');
  if (!select) return;
  select.innerHTML = levels.slice(0, Math.max(1, progress.unlocked)).map((level) => `<option value="${level.number}">LEVEL ${String(level.number).padStart(2, '0')} • ${level.name}</option>`).join('');
  select.value = String(app.selectedLevel);
}

function setupPeerEvents() {
  if (!Peer) {
    showToast('Multiplayer service is unavailable. Practice mode is still ready.');
    return null;
  }
  return Peer;
}

function setConnectionLabel(text, color = '') {
  const label = $('connection-label');
  label.textContent = text;
  label.style.color = color || '';
}

function attachConnection(conn, isHost) {
  app.mp.conn = conn;
  app.mp.host = isHost;
  conn.on('open', () => {
    app.remote.connected = true;
    setConnectionLabel('CONNECTED', '#52d77e');
    $('mp-status').textContent = isHost ? 'Friend connected. Choose a level and start the race.' : 'Connected. Waiting for the host to start the race.';
    if (isHost) conn.send({ type: 'hello', level: app.selectedLevel });
    showToast(isHost ? 'Friend joined the grid.' : 'Connected to the host.');
  });
  conn.on('data', (message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'hello') {
      app.remote.connected = true;
      setConnectionLabel('CONNECTED', '#52d77e');
      $('mp-status').textContent = 'Friend connected. Choose a level and start the race.';
      return;
    }
    if (message.type === 'state') {
      app.remote.progress = Number(message.progress) || 0;
      app.remote.lane = Number(message.lane) || 0;
      app.remote.speed = Number(message.speed) || 0;
      app.remote.connected = true;
      return;
    }
    if (message.type === 'race_start' && !isHost) {
      startRace(Number(message.level) || 1, true);
    }
  });
  conn.on('close', () => {
    app.remote.connected = false;
    setConnectionLabel('DISCONNECTED', '#e98b78');
    $('mp-status').textContent = 'Your friend left the room. Practice mode remains available.';
    showToast('Friend disconnected.');
  });
  conn.on('error', () => {
    app.remote.connected = false;
    setConnectionLabel('CONNECTION ERROR', '#e98b78');
    $('mp-status').textContent = 'Could not keep the room connection open.';
  });
}

function closePeer() {
  try { app.mp.conn?.close(); app.mp.peer?.destroy(); } catch { /* already closed */ }
  app.mp.conn = null;
  app.mp.peer = null;
  app.remote.connected = false;
}

function createRoom() {
  const Peer = setupPeerEvents();
  if (!Peer) return;
  closePeer();
  const code = randomCode();
  app.mp.code = code;
  app.mp.host = true;
  setConnectionLabel('STARTING ROOM', '#f4c46d');
  $('host-code').textContent = code;
  $('host-code-wrap').classList.remove('hidden');
  $('host-level-label').classList.remove('hidden');
  $('host-level-select').classList.remove('hidden');
  renderHostLevelSelect();
  $('host-start-btn').classList.remove('hidden');
  $('mp-status').textContent = 'Waiting for a friend to join…';
  const peer = new Peer(code.toLowerCase(), { debug: 1 });
  app.mp.peer = peer;
  peer.on('open', () => setConnectionLabel('WAITING FOR FRIEND', '#f4c46d'));
  peer.on('connection', (conn) => attachConnection(conn, true));
  peer.on('error', (error) => {
    const message = error?.type === 'unavailable-id' ? 'Room code was taken. Create another room.' : 'Could not start the room. Try again.';
    setConnectionLabel('ROOM ERROR', '#e98b78');
    $('mp-status').textContent = `${message} (${error?.type || 'unknown'})`;
    showToast(message);
  });
}

function joinRoom() {
  const Peer = setupPeerEvents();
  if (!Peer) return;
  const code = $('join-code').value.trim().toLowerCase();
  if (code.length < 4) { showToast('Enter the room code your friend shared.'); return; }
  closePeer();
  app.mp.host = false;
  setConnectionLabel('CONNECTING', '#f4c46d');
  $('mp-status').textContent = 'Finding the host…';
  const peer = new Peer(undefined, { debug: 1 });
  app.mp.peer = peer;
  peer.on('open', () => {
    const conn = peer.connect(code, { reliable: true });
    attachConnection(conn, false);
  });
  peer.on('error', (error) => {
    setConnectionLabel('NOT FOUND', '#e98b78');
    $('mp-status').textContent = `Room not found or no longer available (${error?.type || 'unknown'}).`;
    showToast('Could not find that room. Check the code.');
  });
}

function startHostedRace() {
  if (!app.mp.conn?.open) { showToast('Wait for your friend to connect first.'); return; }
  const selected = Number($('host-level-select')?.value || 1);
  const level = clamp(selected, 1, Math.max(progress.unlocked, 1));
  app.selectedLevel = level;
  app.mp.conn.send({ type: 'race_start', level });
  startRace(level, true);
}

function copyRoomCode() {
  const code = app.mp.code;
  if (!code) return;
  navigator.clipboard?.writeText(code).then(() => showToast('Room code copied.')).catch(() => showToast(`Share this code: ${code}`));
}

function setupInput() {
  const keyMap = { ArrowUp: 'throttle', KeyW: 'throttle', ArrowDown: 'brake', KeyS: 'brake', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  window.addEventListener('keydown', (event) => {
    const key = keyMap[event.code];
    if (!key) return;
    app.input[key] = true;
    event.preventDefault();
  }, { passive: false });
  window.addEventListener('keyup', (event) => {
    const key = keyMap[event.code];
    if (!key) return;
    app.input[key] = false;
    event.preventDefault();
  }, { passive: false });
  const bindTouch = (id, key) => {
    const element = $(id);
    const set = (value, event) => { app.input[key] = value; event.preventDefault(); };
    element.addEventListener('pointerdown', (event) => { element.setPointerCapture?.(event.pointerId); set(true, event); });
    element.addEventListener('pointerup', (event) => set(false, event));
    element.addEventListener('pointercancel', (event) => set(false, event));
    element.addEventListener('pointerleave', (event) => { if (event.buttons === 0) set(false, event); });
  };
  bindTouch('touch-left', 'left');
  bindTouch('touch-right', 'right');
  bindTouch('touch-brake', 'brake');
  bindTouch('touch-throttle', 'throttle');
}

function setupUi() {
  $('practice-btn').addEventListener('click', () => showScreen('level-screen'));
  $('multiplayer-btn').addEventListener('click', () => showScreen('multiplayer-screen'));
  $('garage-btn').addEventListener('click', () => { updateGarage(); showScreen('garage-screen'); });
  document.querySelectorAll('[data-back]').forEach((button) => button.addEventListener('click', () => showScreen(button.dataset.back)));
  $('create-room-btn').addEventListener('click', createRoom);
  $('join-room-btn').addEventListener('click', joinRoom);
  $('copy-code-btn').addEventListener('click', copyRoomCode);
  $('host-start-btn').addEventListener('click', startHostedRace);
  $('finish-menu-btn').addEventListener('click', () => { app.mode = 'menu'; $('race-hud').classList.add('hidden'); showScreen('menu-screen'); });
  $('next-level-btn').addEventListener('click', () => {
    const next = app.selectedLevel >= 100 ? app.selectedLevel : app.selectedLevel + 1;
    startRace(next, false);
  });
  $('join-code').addEventListener('input', (event) => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  renderLevelGrid();
  renderHostLevelSelect();
  updateGarage();
}

function setupInstall() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.__apexInstallPrompt = event;
  });
}

function resize() {
  if (!app.renderer || !app.camera) return;
  app.camera.aspect = window.innerWidth / window.innerHeight;
  app.camera.updateProjectionMatrix();
  app.renderer.setSize(window.innerWidth, window.innerHeight);
}

createRenderer();
createScene();
setupUi();
setupInput();
setupInstall();
window.addEventListener('resize', resize);
setTimeout(() => $('loading-screen').classList.add('ready'), 700);
animate();
