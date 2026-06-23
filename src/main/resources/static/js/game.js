import * as THREE from 'three';
import { buildEnvironment } from './scene-build.js';
import { DISGUISE_NAMES, resolvePropType, sampleMeshColor } from './scene-build.js';
import { createHumanoid, createDisguiseVisual, getHumanoidVariant } from './player-models.js';

const WORLD_WIDTH = 3200;
const WORLD_DEPTH = 2000;
const PLAYER_RADIUS = 22;
const ROOM_W = 128;
const ROOM_D = 80;
const EYE_HEIGHT = 1.55;
const SHOOT_COOLDOWN_MS = 350;
const TP_DISTANCE = 5.5;
const GAME_BASE = location.pathname === '/game' || location.pathname.startsWith('/game/') ? '/game' : '';

function apiUrl(path) {
  return `${GAME_BASE}${path}`;
}

const state = {
  roomId: null,
  playerId: null,
  clientId: getClientId(),
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
  previewAngle: 0,
  intentionalLeave: false
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
document.getElementById('leave-btn').addEventListener('click', () => { leaveGame(); });
enterBtn.addEventListener('click', enterScene);
readyBtn.addEventListener('click', toggleReady);
startBtn.addEventListener('click', () => sendMessage({ type: 'START', roomId: state.roomId, playerId: state.playerId }));
nextRoundBtn.addEventListener('click', () => sendMessage({ type: 'NEXT_ROUND', roomId: state.roomId, playerId: state.playerId }));

window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  const key = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    e.preventDefault();
  }
  state.keys[key] = true;
  if (key === 'e') {
    sampleColorAtCrosshair();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.target.matches('input, textarea')) return;
  state.keys[e.key.toLowerCase()] = false;
});
canvas.addEventListener('click', onCanvasClick);
document.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('pointerlockchange', onPointerLockChange);
window.addEventListener('resize', onResize);
function buildLeaveUrl(roomId, playerId, clientId) {
  const params = new URLSearchParams({ clientId });
  if (playerId) {
    params.set('playerId', playerId);
  }
  return apiUrl(`/api/rooms/${encodeURIComponent(roomId)}/leave?${params}`);
}

function notifyPageLeave() {
  if (!state.roomId || !state.clientId || state.intentionalLeave) {
    return;
  }
  const url = buildLeaveUrl(state.roomId, state.playerId, state.clientId);
  fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
  navigator.sendBeacon(url);
}

window.addEventListener('pagehide', notifyPageLeave);
window.addEventListener('beforeunload', notifyPageLeave);
startLobbyRoomListPolling();

function getClientId() {
  const key = 'doodle-client-id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
  }
  return id;
}

async function refreshRoomList() {
  try {
    const response = await fetch(apiUrl('/api/rooms'));
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
    const response = await fetch(apiUrl('/api/rooms'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerNameInput.value, clientId: state.clientId })
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
    const response = await fetch(apiUrl(`/api/rooms/${roomId}/join`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: playerNameInput.value, clientId: state.clientId })
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
  document.body.classList.add('in-game');
  roomIdLabel.textContent = state.roomId;
  if (!state.threeReady) initThree();
  connectWebSocket();
  startMoveLoop();
  onResize();
  requestAnimationFrame(onResize);
}

async function leaveGame() {
  exitPointerLock();
  state.intentionalLeave = true;
  const roomId = state.roomId;
  const playerId = state.playerId;
  const clientId = state.clientId;
  if (roomId && clientId) {
    try {
      const response = await fetch(buildLeaveUrl(roomId, playerId, clientId), { method: 'POST' });
      if (!response.ok) {
        console.warn('离开房间失败:', await response.text());
      }
    } catch (err) {
      console.warn('离开房间请求失败', err);
    }
  }
  if (state.ws) {
    if (state.ws.readyState === WebSocket.OPEN) {
      sendMessage({ type: 'LEAVE', roomId, playerId });
    }
    state.ws.close();
  }
  resetToLobby();
}

function resetToLobby() {
  document.body.classList.remove('in-game');
  state.roomId = null;
  state.playerId = null;
  state.snapshot = null;
  state.ws = null;
  gamePanel.classList.add('hidden');
  lobbyPanel.classList.remove('hidden');
  hideError(gameError);
  crosshair.classList.add('hidden');
  startLobbyRoomListPolling();
  refreshRoomList();
}

function connectWebSocket() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  state.ws = new WebSocket(`${protocol}://${location.host}${apiUrl('/ws/game')}`);
  state.ws.onopen = () => {
    sendMessage({ type: 'JOIN', roomId: state.roomId, playerId: state.playerId });
  };
  state.ws.onmessage = (event) => handleServerMessage(JSON.parse(event.data));
  state.ws.onclose = () => {
    if (!state.intentionalLeave) {
      hintBar.textContent = '连接已断开，请刷新页面重试';
    }
    state.intentionalLeave = false;
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
        ? '第三人称躲藏：WASD 移动，E 伪装成瞄准的道具'
        : '点击画面锁定鼠标';
    } else if (me.role === 'HIDER' && snapshot.phase === 'SEEKING') {
      hintBar.textContent = '保持伪装，别被猎人发现';
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
  scene.fog = new THREE.Fog(0x9fd4ff, 70, 220);

  camera = new THREE.PerspectiveCamera(75, 16 / 10, 0.1, 280);
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
  sun.position.set(48, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  scene.add(sun);
}

function addProp(mesh, pickable = true) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (pickable) pickableMeshes.push(mesh);
}

function addPropGroup(group, pickable = true) {
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (pickable) pickableMeshes.push(child);
    }
  });
  scene.add(group);
}

function buildRoom() {
  buildEnvironment(scene, addProp, addPropGroup, ROOM_W, ROOM_D);
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

function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

function playerVisualKey(player) {
  const phase = state.snapshot?.phase;
  const disguised = isGameplay() && player.role === 'HIDER' && !player.found && player.disguise;
  if (disguised) return `disguise:${player.disguise}`;
  if (player.role === 'SEEKER' && isGameplay()) return 'seeker';
  return `human:${getHumanoidVariant(player, phase)}:${player.color || '#FFFFFF'}`;
}

function rebuildPlayerVisual(root, player) {
  while (root.children.length) {
    const child = root.children[0];
    root.remove(child);
    disposeObject3D(child);
  }
  const disguised = isGameplay() && player.role === 'HIDER' && !player.found && player.disguise;
  if (disguised) {
    const prop = createDisguiseVisual(player.disguise);
    if (prop) root.add(prop);
    else root.add(createHumanoid(hexToNumber(player.color || '#FFFFFF'), 'hider'));
  } else if (player.role === 'SEEKER' && isGameplay()) {
    root.add(createHumanoid(0xffffff, 'seeker'));
  } else {
    const variant = getHumanoidVariant(player, state.snapshot?.phase);
    root.add(createHumanoid(hexToNumber(player.color || '#FFFFFF'), variant));
  }
}

function createPlayerAvatar(player) {
  const root = new THREE.Group();
  root.userData.playerId = player.id;
  root.userData.visualKey = '';
  scene.add(root);
  playerMeshes.set(player.id, root);
  rebuildPlayerVisual(root, player);
  root.userData.visualKey = playerVisualKey(player);
  return root;
}

function updatePlayerAvatar(root, player) {
  const nextKey = playerVisualKey(player);
  if (root.userData.visualKey !== nextKey) {
    rebuildPlayerVisual(root, player);
    root.userData.visualKey = nextKey;
  }
}

function createPlayerMesh(player) {
  return createPlayerAvatar(player);
}

function syncPlayerMeshes() {
  if (!state.snapshot) return;

  const visibleIds = new Set();
  state.snapshot.players.forEach((player) => {
    if (isGameplay() && player.role === 'HIDER' && player.found) return;
    if (state.snapshot.phase === 'LOBBY' && !player.entered) return;

    visibleIds.add(player.id);
    let root = playerMeshes.get(player.id);
    if (!root) root = createPlayerAvatar(player);
    updatePlayerAvatar(root, player);

    const pos = backendToWorld(player.x, player.y);
    root.position.set(pos.x, 0, pos.z);
    root.visible = true;

    const isMe = player.id === state.playerId;
    if (isThirdPerson() && isMe) {
      root.visible = true;
    } else if (isSeekerFirstPerson() && isMe) {
      root.visible = false;
    }

    root.scale.setScalar(isMe ? 1.05 : 1);

    if (isMe && isThirdPerson() && state.pointerLocked) {
      root.rotation.y = state.yaw;
    }
  });

  playerMeshes.forEach((mesh, id) => {
    if (!visibleIds.has(id)) mesh.visible = false;
  });
}

function updatePreviewCamera() {
  state.previewAngle += 0.003;
  const r = 84;
  camera.position.set(Math.sin(state.previewAngle) * r, 48, Math.cos(state.previewAngle) * r);
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
  const cx = pos.x + Math.sin(state.yaw) * TP_DISTANCE;
  const cz = pos.z + Math.cos(state.yaw) * TP_DISTANCE;
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

function getCameraMoveDelta(forward, strafe, speed) {
  const moveForward = new THREE.Vector3();
  camera.getWorldDirection(moveForward);
  moveForward.y = 0;
  if (moveForward.lengthSq() < 1e-6) {
    moveForward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
  } else {
    moveForward.normalize();
  }

  const moveRight = new THREE.Vector3().crossVectors(moveForward, new THREE.Vector3(0, 1, 0)).normalize();
  return {
    dx: (forward * moveForward.x + strafe * moveRight.x) * speed,
    dz: (forward * moveForward.z + strafe * moveRight.z) * speed
  };
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
      speed = 0.28;
    } else if (me.role === 'HIDER' && !me.found && isGameplay()) {
      canMove = true;
      speed = state.snapshot.phase === 'HIDING' ? 0.28 : 0.1;
    } else if (me.role === 'SEEKER' && state.snapshot.phase === 'SEEKING') {
      canMove = true;
      speed = 0.24;
    }
    if (!canMove) return;

    let forward = 0;
    let strafe = 0;
    if (state.keys.w || state.keys.arrowup) forward += 1;
    if (state.keys.s || state.keys.arrowdown) forward -= 1;
    if (state.keys.a || state.keys.arrowleft) strafe -= 1;
    if (state.keys.d || state.keys.arrowright) strafe += 1;
    if (forward === 0 && strafe === 0) return;

    const { dx, dz } = getCameraMoveDelta(forward, strafe, speed);

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
  const hits = raycaster.intersectObjects(targets, true);

  playGunRecoil();
  addTracer(hits[0]?.point);

  for (const hit of hits) {
    let node = hit.object;
    while (node) {
      if (node.userData?.playerId) {
        sendMessage({
          type: 'SHOOT',
          roomId: state.roomId,
          playerId: state.playerId,
          targetPlayerId: node.userData.playerId
        });
        return;
      }
      node = node.parent;
    }
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
  if (!me || me.role !== 'HIDER' || !isGameplay() || me.found) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(pickableMeshes, true);
  if (hits.length === 0) return;

  const hit = hits[0].object;
  const propType = resolvePropType(hit);
  if (!propType) {
    hintBar.textContent = '请对准场景里的道具（树、箱子、长椅等）';
    return;
  }

  const color = colorToHex(sampleMeshColor(hit));
  me.color = color;
  me.disguise = propType;
  sendMessage({
    type: 'CAMOUFLAGE',
    roomId: state.roomId,
    playerId: state.playerId,
    color,
    disguise: propType
  });
  const label = DISGUISE_NAMES[propType] || propType;
  hintBar.textContent = `已伪装成：${label}`;
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
