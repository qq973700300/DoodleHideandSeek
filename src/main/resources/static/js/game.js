import * as THREE from 'three';

const WORLD_WIDTH = 800;
const WORLD_DEPTH = 500;
const PLAYER_RADIUS = 22;
const ROOM_W = 32;
const ROOM_D = 20;
const EYE_HEIGHT = 1.55;
const SHOOT_COOLDOWN_MS = 350;
const TP_DISTANCE = 5.5;

const state = {
  roomId: null,
  playerId: null,
  isHost: false,
  snapshot: null,
  ws: null,
  keys: {},
  moveTimer: null,
  threeReady: false,
  pointerLocked: false,
  yaw: 0,
  pitch: 0,
  lastShot: 0,
  previewAngle: 0
};

const canvas = document.getElementById('game-canvas');
const crosshair = document.getElementById('crosshair');
const previewBadge = document.getElementById('preview-badge');
const lobbyPanel = document.getElementById('lobby-panel');
const gamePanel = document.getElementById('game-panel');
const lobbyError = document.getElementById('lobby-error');
const gameError = document.getElementById('game-error');
const playerNameInput = document.getElementById('player-name');
const roomCodeInput = document.getElementById('room-code');
const roomIdLabel = document.getElementById('room-id-label');
const phaseLabel = document.getElementById('phase-label');
const timerLabel = document.getElementById('timer-label');
const hintBar = document.getElementById('hint-bar');
const playerList = document.getElementById('player-list');
const readyCount = document.getElementById('ready-count');
const enterBtn = document.getElementById('enter-btn');
const readyBtn = document.getElementById('ready-btn');
const startBtn = document.getElementById('start-btn');
const nextRoundBtn = document.getElementById('next-round-btn');
const roomListEl = document.getElementById('room-list');
const refreshRoomsBtn = document.getElementById('refresh-rooms-btn');

let scene;
let camera;
let renderer;
let raycaster;
let playerMeshes = new Map();
let pickableMeshes = [];
let gunGroup;
let tracers = [];
let roomListTimer = null;

document.getElementById('create-room-btn').addEventListener('click', createRoom);
document.getElementById('join-room-btn').addEventListener('click', () => joinRoomById(roomCodeInput.value.trim().toUpperCase()));
refreshRoomsBtn.addEventListener('click', refreshRoomList);
document.getElementById('leave-btn').addEventListener('click', leaveGame);
enterBtn.addEventListener('click', enterScene);
readyBtn.addEventListener('click', toggleReady);
startBtn.addEventListener('click', () => sendMessage({ type: 'START', roomId: state.roomId, playerId: state.playerId }));
nextRoundBtn.addEventListener('click', () => sendMessage({ type: 'NEXT_ROUND', roomId: state.roomId, playerId: state.playerId }));

window.addEventListener('keydown', (e) => {
  state.keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'e') {
    sampleColorAtCrosshair();
  }
});
window.addEventListener('keyup', (e) => { state.keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('click', onCanvasClick);
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('pointerlockchange', onPointerLockChange);
window.addEventListener('resize', onResize);
startLobbyRoomListPolling();

async function refreshRoomList() {
  try {
    const response = await fetch('/api/rooms');
    if (!response.ok) throw new Error('加载房间失败');
    renderRoomList(await response.json());
  } catch {
    renderRoomList([]);
    roomListEl.innerHTML = '<li class="room-list-empty">加载失败，请稍后刷新</li>';
  }
}

function renderRoomList(rooms) {
  roomListEl.innerHTML = '';
  if (!rooms.length) {
    roomListEl.innerHTML = '<li class="room-list-empty">暂无房间，创建一个吧</li>';
    return;
  }
  rooms.forEach((room) => {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'room-item-info';
    info.innerHTML = `
      <div class="room-item-id">房间 ${room.roomId}</div>
      <div class="room-item-meta">房主：${room.hostName} · ${room.playerCount}/${room.maxPlayers} 人</div>
    `;
    const joinBtn = document.createElement('button');
    joinBtn.className = 'btn primary';
    joinBtn.textContent = '加入';
    joinBtn.addEventListener('click', () => joinRoomById(room.roomId));
    li.appendChild(info);
    li.appendChild(joinBtn);
    roomListEl.appendChild(li);
  });
}

function startLobbyRoomListPolling() {
  stopLobbyRoomListPolling();
  refreshRoomList();
  roomListTimer = setInterval(refreshRoomList, 3000);
}

function stopLobbyRoomListPolling() {
  if (roomListTimer) {
    clearInterval(roomListTimer);
    roomListTimer = null;
  }
}

async function createRoom() {
  hideError(lobbyError);
  try {
    const response = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerNameInput.value })
    });
    if (!response.ok) throw new Error(await response.text());
    enterRoom(await response.json());
  } catch (err) {
    showError(lobbyError, err.message || '创建房间失败');
  }
}

async function joinRoomById(roomId) {
  hideError(lobbyError);
  if (!roomId) {
    showError(lobbyError, '请选择或输入房间号');
    return;
  }
  try {
    const response = await fetch(`/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerNameInput.value })
    });
    if (!response.ok) throw new Error(await response.text());
    enterRoom(await response.json());
  } catch (err) {
    showError(lobbyError, err.message || '加入房间失败');
    refreshRoomList();
  }
}

function enterRoom(data) {
  stopLobbyRoomListPolling();
  state.roomId = data.roomId;
  state.playerId = data.playerId;
  state.isHost = data.host;
  lobbyPanel.classList.add('hidden');
  gamePanel.classList.remove('hidden');
  roomIdLabel.textContent = state.roomId;
  if (!state.threeReady) initThree();
  connectWebSocket();
  startMoveLoop();
  onResize();
}

function leaveGame() {
  exitPointerLock();
  if (state.ws) state.ws.close();
  state.roomId = null;
  state.playerId = null;
  state.snapshot = null;
  gamePanel.classList.add('hidden');
  lobbyPanel.classList.remove('hidden');
  hideError(gameError);
  crosshair.classList.add('hidden');
  startLobbyRoomListPolling();
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${protocol}://${location.host}/ws/game`);
  state.ws.onopen = () => {
    sendMessage({ type: 'JOIN', roomId: state.roomId, playerId: state.playerId });
  };
  state.ws.onmessage = (event) => handleServerMessage(JSON.parse(event.data));
  state.ws.onclose = () => {
    hintBar.textContent = '连接已断开，请刷新页面重试';
    exitPointerLock();
  };
}

function sendMessage(payload) {
  if (state.ws?.readyState === WebSocket.OPEN) {
    state.ws.send(JSON.stringify(payload));
  }
}

function handleServerMessage(message) {
  switch (message.type) {
    case 'ERROR':
      showError(gameError, message.data.message);
      break;
    case 'KICKED':
      alert(message.data.message);
      leaveGame();
      break;
    case 'JOINED':
    case 'ROOM_STATE':
      state.snapshot = message.data;
      updateUi();
      syncPlayerMeshes();
      break;
    case 'PLAYER_FOUND':
      hintBar.textContent = `命中：${message.data.name}！`;
      break;
    default:
      break;
  }
}

function getMe() {
  return state.snapshot?.players.find((p) => p.id === state.playerId) ?? null;
}

function isGameplay() {
  return state.snapshot?.phase === 'HIDING' || state.snapshot?.phase === 'SEEKING';
}

function isWaitingPhase() {
  return state.snapshot?.phase === 'LOBBY' || state.snapshot?.phase === 'ROUND_END';
}

function isSeekerFirstPerson() {
  const me = getMe();
  return !!(me && me.role === 'SEEKER' && state.snapshot?.phase === 'SEEKING');
}

function isThirdPerson() {
  const me = getMe();
  if (!me || !state.snapshot) return false;
  if (isGameplay()) return me.role === 'HIDER';
  if (isWaitingPhase()) return me.entered;
  return false;
}

function canControlCamera() {
  return isSeekerFirstPerson() || isThirdPerson();
}

function allPlayersReady() {
  if (!state.snapshot) return false;
  return state.snapshot.players.every((p) => p.ready && p.entered);
}

function enterScene() {
  sendMessage({ type: 'ENTER', roomId: state.roomId, playerId: state.playerId });
}

function toggleReady() {
  const me = getMe();
  if (!me || me.host) return;
  sendMessage({
    type: 'READY',
    roomId: state.roomId,
    playerId: state.playerId,
    ready: !me.ready
  });
}

function kickPlayer(targetId) {
  sendMessage({
    type: 'KICK',
    roomId: state.roomId,
    playerId: state.playerId,
    targetPlayerId: targetId
  });
}

function updateUi() {
  const snapshot = state.snapshot;
  if (!snapshot) return;

  const phaseText = {
    LOBBY: '等待开局',
    HIDING: '伪装阶段',
    SEEKING: '寻找阶段',
    ROUND_END: '回合结束'
  };
  phaseLabel.textContent = `${phaseText[snapshot.phase] || snapshot.phase} · 第 ${snapshot.round} 局`;
  timerLabel.textContent = snapshot.phaseRemainingMs > 0
    ? `${Math.ceil(snapshot.phaseRemainingMs / 1000)} 秒`
    : '';

  const me = getMe();
  const inLobby = snapshot.phase === 'LOBBY';
  const inRoundEnd = snapshot.phase === 'ROUND_END';
  const ready = allPlayersReady();
  const readyNum = snapshot.players.filter((p) => p.ready).length;

  readyCount.textContent = `(${readyNum}/${snapshot.players.length} 已准备)`;

  enterBtn.classList.toggle('hidden', !(inLobby && me && !me.entered));
  readyBtn.classList.toggle('hidden', !(me && !me.host && (inLobby || inRoundEnd)));
  startBtn.classList.toggle('hidden', !(state.isHost && inLobby));
  nextRoundBtn.classList.toggle('hidden', !(state.isHost && inRoundEnd));

  if (me && !me.host) {
    readyBtn.textContent = me.ready ? '取消准备' : '准备';
    readyBtn.classList.toggle('primary', !me.ready);
    readyBtn.disabled = !me.entered;
  }

  const canStart = ready && snapshot.players.length >= 2;
  startBtn.disabled = !canStart;
  nextRoundBtn.disabled = !canStart;

  previewBadge.classList.toggle('hidden', !(inLobby && me && !me.entered));

  if (me) {
    if (inLobby && !me.entered) {
      hintBar.textContent = '正在预览场景，点击「进入场景」加入房间';
      crosshair.classList.add('hidden');
    } else if (inLobby && me.entered) {
      hintBar.textContent = state.isHost
        ? (canStart ? '全员已进入并准备，可以开始游戏' : '等待所有玩家进入并准备')
        : (me.ready ? '已准备，等待其他玩家和房主开始' : '请点击准备');
    } else if (isSeekerFirstPerson()) {
      hintBar.textContent = state.pointerLocked
        ? '第一人称猎人：WASD 移动，左键射击'
        : '点击画面锁定鼠标';
    } else if (me.role === 'HIDER' && snapshot.phase === 'HIDING') {
      hintBar.textContent = state.pointerLocked
        ? '第三人称躲藏：WASD 移动，E 吸色伪装'
        : '点击画面锁定鼠标';
    } else if (me.role === 'HIDER' && snapshot.phase === 'SEEKING') {
      hintBar.textContent = '第三人称：保持隐蔽，别被猎人发现';
    } else if (inRoundEnd) {
      hintBar.textContent = '回合结束，请准备后由房主开始下一局';
      exitPointerLock();
    } else {
      hintBar.textContent = '观战中';
    }
  }

  renderPlayerList(snapshot, me);
  updateGunVisibility();
}

function renderPlayerList(snapshot, me) {
  playerList.innerHTML = '';
  snapshot.players.forEach((player) => {
    const li = document.createElement('li');
    if (player.id === state.playerId) li.classList.add('me');

    const meta = document.createElement('div');
    meta.className = 'player-meta';
    const nameLine = document.createElement('div');
    nameLine.textContent = `${player.name}${player.host ? '（房主）' : ''}`;
    meta.appendChild(nameLine);

    const status = document.createElement('div');
    status.className = 'player-status';
    if (snapshot.phase === 'LOBBY') {
      if (player.entered) {
        status.textContent = player.ready ? '已进入 · 已准备' : '已进入 · 未准备';
        status.classList.add(player.ready ? 'ready' : 'not-ready');
      } else {
        status.textContent = '未进入场景';
        status.classList.add('not-ready');
      }
    } else if (snapshot.phase === 'ROUND_END') {
      status.textContent = player.ready ? '已准备' : '未准备';
      status.classList.add(player.ready ? 'ready' : 'not-ready');
    } else {
      const roleText = { HIDER: '躲藏者', SEEKER: '猎人', SPECTATOR: player.found ? '已出局' : '观战' };
      status.textContent = roleText[player.role] || player.role;
      status.classList.add('in-scene');
    }
    meta.appendChild(status);
    li.appendChild(meta);

    if (state.isHost && snapshot.phase === 'LOBBY' && !player.host && player.id !== me?.id) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'btn kick';
      kickBtn.textContent = '踢出';
      kickBtn.addEventListener('click', () => kickPlayer(player.id));
      li.appendChild(kickBtn);
    }

    playerList.appendChild(li);
  });
}

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fd4ff);
  scene.fog = new THREE.Fog(0x9fd4ff, 20, 55);

  camera = new THREE.PerspectiveCamera(75, 16 / 10, 0.1, 120);
  camera.rotation.order = 'YXZ';

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  raycaster = new THREE.Raycaster();
  addLights();
  buildRoom();
  buildGun();

  state.threeReady = true;
  animate();
}

function buildGun() {
  gunGroup = new THREE.Group();
  const gunMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.6, roughness: 0.35 });
  gunGroup.add(
    createPart(new THREE.BoxGeometry(0.1, 0.14, 0.45), gunMat, [0, 0, -0.1]),
    createPart(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), gunMat, [0, 0.04, -0.42], [Math.PI / 2, 0, 0]),
    createPart(new THREE.BoxGeometry(0.08, 0.18, 0.1), gunMat, [0, -0.12, 0.05])
  );
  gunGroup.position.set(0.28, -0.22, -0.5);
  gunGroup.visible = false;
  camera.add(gunGroup);
  scene.add(camera);
}

function createPart(geometry, material, pos, rot = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...pos);
  mesh.rotation.set(...rot);
  return mesh;
}

function addLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.1);
  sun.position.set(12, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  scene.add(sun);
}

function addProp(mesh, pickable = true) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (pickable) pickableMeshes.push(mesh);
}

function buildRoom() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0x6db34a })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  pickableMeshes.push(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xc9a66b });
  addProp(new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 7, 0.6), wallMat).translateX(0).translateY(3.5).translateZ(-ROOM_D / 2));
  addProp(new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, ROOM_D), wallMat).translateX(-ROOM_W / 2).translateY(3.5));
  addProp(new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, ROOM_D), wallMat).translateX(ROOM_W / 2).translateY(3.5));

  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x8b5a2b }));
  beam.position.set(0, 6.8, -ROOM_D / 2 + 0.2);
  addProp(beam);

  const redBox = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 3), new THREE.MeshStandardMaterial({ color: 0xe85d5d }));
  redBox.position.set(-12, 1.25, -5);
  addProp(redBox);

  const yellowBox = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3.5), new THREE.MeshStandardMaterial({ color: 0xf4c542 }));
  yellowBox.position.set(11, 1.5, 4);
  addProp(yellowBox);

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 3.5, 10), new THREE.MeshStandardMaterial({ color: 0x6a4a2d }));
  trunk.position.set(10, 1.75, -6);
  addProp(trunk);

  const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 16), new THREE.MeshStandardMaterial({ color: 0x5a8f4a }));
  crown.position.set(10, 4.5, -6);
  addProp(crown);

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 2.5), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  tableTop.position.set(-2, 2.2, 2);
  addProp(tableTop);

  const tableLegMat = new THREE.MeshStandardMaterial({ color: 0xd9d9d9 });
  [[-4.2, 1.1, 1.1], [-4.2, 1.1, 2.9], [0.2, 1.1, 1.1], [0.2, 1.1, 2.9]].forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.35), tableLegMat);
    leg.position.set(x, y, z);
    addProp(leg);
  });

  const bench = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x4a6741 }));
  bench.position.set(4, 0.8, 6);
  addProp(bench);

  const rug = new THREE.Mesh(new THREE.BoxGeometry(8, 0.08, 5), new THREE.MeshStandardMaterial({ color: 0x8b7355 }));
  rug.position.set(0, 0.04, 0);
  addProp(rug);
}

function worldToBackend(x, z) {
  return {
    x: ((x + ROOM_W / 2) / ROOM_W) * WORLD_WIDTH,
    y: ((z + ROOM_D / 2) / ROOM_D) * WORLD_DEPTH
  };
}

function backendToWorld(x, y) {
  return {
    x: (x / WORLD_WIDTH) * ROOM_W - ROOM_W / 2,
    z: (y / WORLD_DEPTH) * ROOM_D - ROOM_D / 2
  };
}

function createPlayerMesh(player) {
  const geometry = new THREE.CapsuleGeometry(0.55, 1.2, 6, 12);
  const material = new THREE.MeshStandardMaterial({
    color: hexToNumber(player.color || '#FFFFFF'),
    roughness: 0.65
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.userData.playerId = player.id;
  scene.add(mesh);
  playerMeshes.set(player.id, mesh);
  return mesh;
}

function syncPlayerMeshes() {
  if (!state.snapshot) return;

  const visibleIds = new Set();
  state.snapshot.players.forEach((player) => {
    if (isGameplay() && player.role === 'HIDER' && player.found) return;
    if (state.snapshot.phase === 'LOBBY' && !player.entered) return;

    visibleIds.add(player.id);
    let mesh = playerMeshes.get(player.id);
    if (!mesh) mesh = createPlayerMesh(player);

    const pos = backendToWorld(player.x, player.y);
    mesh.position.set(pos.x, 1.1, pos.z);
    mesh.visible = true;

    const isMe = player.id === state.playerId;
    if (isThirdPerson() && isMe) {
      mesh.visible = true;
    } else if (isSeekerFirstPerson() && isMe) {
      mesh.visible = false;
    }

    if (player.role === 'SEEKER' && isGameplay()) {
      mesh.material.color.setHex(0xff6b6b);
    } else {
      mesh.material.color.setHex(hexToNumber(player.color || '#FFFFFF'));
    }
    mesh.scale.setScalar(isMe ? 1.05 : 1);
  });

  playerMeshes.forEach((mesh, id) => {
    if (!visibleIds.has(id)) mesh.visible = false;
  });
}

function updatePreviewCamera() {
  state.previewAngle += 0.003;
  const r = 22;
  camera.position.set(Math.sin(state.previewAngle) * r, 14, Math.cos(state.previewAngle) * r);
  camera.lookAt(0, 1.5, 0);
}

function updateFirstPersonCamera() {
  const me = getMe();
  if (!me) return;
  const pos = backendToWorld(me.x, me.y);
  camera.position.set(pos.x, EYE_HEIGHT, pos.z);
  camera.rotation.y = state.yaw;
  camera.rotation.x = state.pitch;
}

function updateThirdPersonCamera() {
  const me = getMe();
  if (!me) return;
  const pos = backendToWorld(me.x, me.y);
  const cx = pos.x - Math.sin(state.yaw) * TP_DISTANCE;
  const cz = pos.z - Math.cos(state.yaw) * TP_DISTANCE;
  camera.position.set(cx, EYE_HEIGHT + 1.8, cz);
  camera.lookAt(pos.x, 1.2, pos.z);
}

function updateGunVisibility() {
  if (!gunGroup) return;
  gunGroup.visible = isSeekerFirstPerson();
}

function animate() {
  requestAnimationFrame(animate);

  const me = getMe();
  if (state.snapshot?.phase === 'LOBBY' && me && !me.entered) {
    updatePreviewCamera();
  } else if (isSeekerFirstPerson()) {
    updateFirstPersonCamera();
  } else if (isThirdPerson()) {
    updateThirdPersonCamera();
  } else if (isWaitingPhase()) {
    updatePreviewCamera();
  }

  updateTracers();
  renderer.render(scene, camera);
}

function onResize() {
  if (!renderer || !camera) return;
  const wrap = canvas.parentElement;
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  if (width === 0 || height === 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function startMoveLoop() {
  if (state.moveTimer) clearInterval(state.moveTimer);
  state.moveTimer = setInterval(() => {
    const me = getMe();
    if (!me || !state.snapshot) return;

    let canMove = false;
    let speed = 0.18;

    if (state.snapshot.phase === 'LOBBY' && me.entered) {
      canMove = true;
      speed = 0.2;
    } else if (me.role === 'HIDER' && !me.found && isGameplay()) {
      canMove = true;
      speed = state.snapshot.phase === 'HIDING' ? 0.22 : 0.08;
    } else if (me.role === 'SEEKER' && state.snapshot.phase === 'SEEKING') {
      canMove = true;
      speed = 0.18;
    }
    if (!canMove) return;

    let forward = 0;
    let strafe = 0;
    if (state.keys.w || state.keys.arrowup) forward += 1;
    if (state.keys.s || state.keys.arrowdown) forward -= 1;
    if (state.keys.a || state.keys.arrowleft) strafe -= 1;
    if (state.keys.d || state.keys.arrowright) strafe += 1;
    if (forward === 0 && strafe === 0) return;

    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    const dx = (strafe * cos + forward * sin) * speed;
    const dz = (strafe * -sin + forward * cos) * speed;

    const pos = backendToWorld(me.x, me.y);
    const marginX = (PLAYER_RADIUS / WORLD_WIDTH) * ROOM_W;
    const marginZ = (PLAYER_RADIUS / WORLD_DEPTH) * ROOM_D;
    const nextX = clamp(pos.x + dx, -ROOM_W / 2 + marginX, ROOM_W / 2 - marginX);
    const nextZ = clamp(pos.z + dz, -ROOM_D / 2 + marginZ, ROOM_D / 2 - marginZ);
    const backend = worldToBackend(nextX, nextZ);

    me.x = backend.x;
    me.y = backend.y;
    sendMessage({ type: 'MOVE', roomId: state.roomId, playerId: state.playerId, x: backend.x, y: backend.y });
  }, 50);
}

function onCanvasClick() {
  if (!canControlCamera()) return;
  if (!state.pointerLocked) canvas.requestPointerLock();
}

function onMouseDown(event) {
  if (!state.pointerLocked || !isSeekerFirstPerson()) return;
  if (event.button === 0) shoot();
}

function onMouseMove(event) {
  if (!state.pointerLocked || !canControlCamera()) return;
  const sensitivity = 0.0022;
  state.yaw -= event.movementX * sensitivity;
  state.pitch -= event.movementY * sensitivity;
  if (isThirdPerson()) {
    state.pitch = clamp(state.pitch, -0.4, 0.8);
  } else {
    state.pitch = clamp(state.pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
  }
}

function onPointerLockChange() {
  state.pointerLocked = document.pointerLockElement === canvas;
  crosshair.classList.toggle('hidden', !state.pointerLocked || !canControlCamera());
  canvas.classList.toggle('locked', state.pointerLocked);
  updateUi();
}

function exitPointerLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

function shoot() {
  const now = Date.now();
  if (now - state.lastShot < SHOOT_COOLDOWN_MS) return;
  state.lastShot = now;

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = [...playerMeshes.values()].filter((m) => m.visible && m.userData.playerId !== state.playerId);
  const hits = raycaster.intersectObjects(targets, false);

  playGunRecoil();
  addTracer(hits[0]?.point);

  if (hits.length > 0) {
    sendMessage({
      type: 'SHOOT',
      roomId: state.roomId,
      playerId: state.playerId,
      targetPlayerId: hits[0].object.userData.playerId
    });
  }
}

function playGunRecoil() {
  if (!gunGroup) return;
  gunGroup.position.z += 0.06;
  setTimeout(() => { gunGroup.position.z = -0.5; }, 80);
}

function addTracer(hitPoint) {
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const end = hitPoint ? hitPoint.clone() : origin.clone().add(direction.clone().multiplyScalar(30));
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([origin, end]),
    new THREE.LineBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 })
  );
  scene.add(line);
  tracers.push({ line, expires: Date.now() + 120 });
}

function updateTracers() {
  const now = Date.now();
  tracers = tracers.filter((tracer) => {
    if (now >= tracer.expires) {
      scene.remove(tracer.line);
      tracer.line.geometry.dispose();
      tracer.line.material.dispose();
      return false;
    }
    tracer.line.material.opacity = (tracer.expires - now) / 120;
    return true;
  });
}

function sampleColorAtCrosshair() {
  const me = getMe();
  if (!me || me.role !== 'HIDER' || state.snapshot?.phase !== 'HIDING') return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(pickableMeshes, false);
  if (hits.length === 0) return;
  const color = colorToHex(hits[0].object.material.color);
  me.color = color;
  sendMessage({ type: 'CAMOUFLAGE', roomId: state.roomId, playerId: state.playerId, color });
  hintBar.textContent = `已吸色：${color}`;
  syncPlayerMeshes();
}

function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(el) {
  el.classList.add('hidden');
}

function colorToHex(color) {
  return `#${color.getHexString().toUpperCase()}`;
}

function hexToNumber(hex) {
  return Number.parseInt(hex.replace('#', ''), 16);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
