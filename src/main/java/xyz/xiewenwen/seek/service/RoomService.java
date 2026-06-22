package xyz.xiewenwen.seek.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import xyz.xiewenwen.seek.dto.RoomListItem;
import xyz.xiewenwen.seek.dto.RoomSnapshot;
import xyz.xiewenwen.seek.model.GamePhase;
import xyz.xiewenwen.seek.model.GameRoom;
import xyz.xiewenwen.seek.model.Player;
import xyz.xiewenwen.seek.model.PlayerRole;

@Service
public class RoomService {

	private static final int MAX_PLAYERS = 8;
	private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

	private final Map<String, GameRoom> rooms = new ConcurrentHashMap<>();
	private final Map<String, String> sessionRooms = new ConcurrentHashMap<>();
	private final Map<String, String> sessionPlayers = new ConcurrentHashMap<>();
	private final Random random = new Random();

	public GameRoom createRoom(String hostName) {
		String roomId = generateRoomCode();
		String playerId = java.util.UUID.randomUUID().toString();
		GameRoom room = new GameRoom(roomId, playerId);
		Player host = new Player(playerId, sanitizeName(hostName), true);
		spawnPlayer(host);
		room.getPlayers().add(host);
		rooms.put(roomId, room);
		return room;
	}

	public GameRoom joinRoom(String roomId, String playerName) {
		GameRoom room = rooms.get(roomId.toUpperCase());
		if (room == null) {
			throw new IllegalArgumentException("房间不存在");
		}
		if (room.getPhase() != GamePhase.LOBBY) {
			throw new IllegalStateException("游戏已开始，无法加入");
		}
		if (room.getPlayers().size() >= MAX_PLAYERS) {
			throw new IllegalStateException("房间已满");
		}
		String playerId = java.util.UUID.randomUUID().toString();
		Player player = new Player(playerId, sanitizeName(playerName), false);
		spawnPlayer(player);
		room.getPlayers().add(player);
		return room;
	}

	public GameRoom getRoom(String roomId) {
		return rooms.get(roomId.toUpperCase());
	}

	public Iterable<String> getRoomIds() {
		return rooms.keySet();
	}

	public List<RoomListItem> listOpenRooms() {
		List<RoomListItem> result = new ArrayList<>();
		for (GameRoom room : rooms.values()) {
			if (room.getPhase() != GamePhase.LOBBY) {
				continue;
			}
			if (room.getPlayers().size() >= MAX_PLAYERS) {
				continue;
			}
			Player host = room.findPlayer(room.getHostId());
			String hostName = host != null ? host.getName() : "未知";
			result.add(new RoomListItem(room.getId(), hostName, room.getPlayers().size(), MAX_PLAYERS));
		}
		result.sort((a, b) -> a.getRoomId().compareTo(b.getRoomId()));
		return result;
	}

	public void bindSession(String sessionId, String roomId, String playerId) {
		sessionRooms.put(sessionId, roomId.toUpperCase());
		sessionPlayers.put(sessionId, playerId);
	}

	public void unbindSession(String sessionId) {
		sessionRooms.remove(sessionId);
		sessionPlayers.remove(sessionId);
	}

	public String getPlayerIdForSession(String sessionId) {
		return sessionPlayers.get(sessionId);
	}

	public String getRoomIdForSession(String sessionId) {
		return sessionRooms.get(sessionId);
	}

	public RoomSnapshot toSnapshot(GameRoom room) {
		RoomSnapshot snapshot = new RoomSnapshot();
		snapshot.setRoomId(room.getId());
		snapshot.setPhase(room.getPhase());
		snapshot.setRound(room.getRound());
		snapshot.setSeekerId(room.getSeekerId());
		snapshot.setPhaseRemainingMs(room.getPhaseRemainingMs());
		snapshot.setPlayers(new ArrayList<>(room.getPlayers()));
		return snapshot;
	}

	public synchronized void startGame(GameRoom room, String requesterId) {
		if (!room.getHostId().equals(requesterId)) {
			throw new IllegalStateException("只有房主可以开始游戏");
		}
		if (room.getPhase() != GamePhase.LOBBY && room.getPhase() != GamePhase.ROUND_END) {
			throw new IllegalStateException("当前无法开始");
		}
		if (room.getPlayers().size() < 2) {
			throw new IllegalStateException("至少需要 2 名玩家");
		}
		if (!allPlayersReady(room)) {
			throw new IllegalStateException("所有玩家准备后才能开始");
		}
		beginRound(room);
	}

	public synchronized void setReady(GameRoom room, String playerId, boolean ready) {
		if (room.getPhase() != GamePhase.LOBBY && room.getPhase() != GamePhase.ROUND_END) {
			throw new IllegalStateException("当前无法准备");
		}
		Player player = room.findPlayer(playerId);
		if (player == null) {
			throw new IllegalArgumentException("玩家不存在");
		}
		if (player.isHost()) {
			if (!player.isEntered()) {
				throw new IllegalStateException("请先进入场景");
			}
			player.setReady(true);
			return;
		}
		if (!player.isEntered()) {
			throw new IllegalStateException("请先进入场景");
		}
		player.setReady(ready);
	}

	public synchronized void enterScene(GameRoom room, String playerId) {
		if (room.getPhase() != GamePhase.LOBBY) {
			throw new IllegalStateException("只有等待阶段可以进入场景");
		}
		Player player = room.findPlayer(playerId);
		if (player == null) {
			throw new IllegalArgumentException("玩家不存在");
		}
		player.setEntered(true);
	}

	public synchronized void kickPlayer(GameRoom room, String hostId, String targetId) {
		if (!room.getHostId().equals(hostId)) {
			throw new IllegalStateException("只有房主可以踢人");
		}
		if (room.getPhase() != GamePhase.LOBBY) {
			throw new IllegalStateException("游戏进行中无法踢人");
		}
		if (hostId.equals(targetId)) {
			throw new IllegalStateException("不能踢出自己");
		}
		Player target = room.findPlayer(targetId);
		if (target == null) {
			throw new IllegalArgumentException("玩家不存在");
		}
		room.getPlayers().removeIf(p -> p.getId().equals(targetId));
	}

	public synchronized void removePlayer(GameRoom room, String playerId) {
		room.getPlayers().removeIf(p -> p.getId().equals(playerId));
		if (room.getPlayers().isEmpty()) {
			rooms.remove(room.getId());
			return;
		}
		if (room.getHostId().equals(playerId)) {
			Player newHost = room.getPlayers().get(0);
			newHost.setHost(true);
			newHost.setReady(true);
			room.setHostId(newHost.getId());
		}
	}

	public synchronized void movePlayer(GameRoom room, String playerId, double x, double y) {
		Player player = room.findPlayer(playerId);
		if (player == null) {
			return;
		}
		if (room.getPhase() == GamePhase.LOBBY) {
			if (!player.isEntered()) {
				return;
			}
		} else if (room.getPhase() != GamePhase.HIDING && room.getPhase() != GamePhase.SEEKING) {
			return;
		} else if (player.getRole() == PlayerRole.HIDER) {
			if (player.isFound()) {
				return;
			}
		} else if (player.getRole() == PlayerRole.SEEKER) {
			if (room.getPhase() != GamePhase.SEEKING || !playerId.equals(room.getSeekerId())) {
				return;
			}
		} else {
			return;
		}
		double radius = GameRoom.PLAYER_RADIUS;
		player.setX(clamp(x, radius, GameRoom.CANVAS_WIDTH - radius));
		player.setY(clamp(y, radius, GameRoom.CANVAS_HEIGHT - radius));
	}

	public synchronized void camouflagePlayer(GameRoom room, String playerId, String color) {
		if (room.getPhase() != GamePhase.HIDING) {
			return;
		}
		Player player = room.findPlayer(playerId);
		if (player == null || player.getRole() != PlayerRole.HIDER) {
			return;
		}
		player.setColor(normalizeColor(color));
	}

	public synchronized Player seekShoot(GameRoom room, String seekerId, String targetPlayerId) {
		if (room.getPhase() != GamePhase.SEEKING) {
			return null;
		}
		if (!seekerId.equals(room.getSeekerId())) {
			return null;
		}
		Player target = room.findPlayer(targetPlayerId);
		if (target == null || target.getRole() != PlayerRole.HIDER || target.isFound()) {
			return null;
		}
		target.setFound(true);
		target.setRole(PlayerRole.SPECTATOR);
		return target;
	}

	public synchronized Player seekClick(GameRoom room, String seekerId, double x, double y) {
		if (room.getPhase() != GamePhase.SEEKING) {
			return null;
		}
		if (!seekerId.equals(room.getSeekerId())) {
			return null;
		}
		Player nearest = null;
		double nearestDistance = Double.MAX_VALUE;
		for (Player player : room.getPlayers()) {
			if (player.getRole() != PlayerRole.HIDER || player.isFound()) {
				continue;
			}
			double distance = Math.hypot(player.getX() - x, player.getY() - y);
			if (distance <= GameRoom.PLAYER_RADIUS + 8 && distance < nearestDistance) {
				nearest = player;
				nearestDistance = distance;
			}
		}
		if (nearest != null) {
			nearest.setFound(true);
			nearest.setRole(PlayerRole.SPECTATOR);
		}
		return nearest;
	}

	public synchronized boolean advancePhaseIfNeeded(GameRoom room) {
		if (room.getPhase() == GamePhase.LOBBY || room.getPhase() == GamePhase.ROUND_END) {
			return false;
		}
		if (System.currentTimeMillis() < room.getPhaseEndsAt()) {
			if (room.getPhase() == GamePhase.SEEKING && allHidersFound(room)) {
				enterRoundEnd(room);
				return true;
			}
			return false;
		}
		if (room.getPhase() == GamePhase.HIDING) {
			enterSeeking(room);
		} else if (room.getPhase() == GamePhase.SEEKING) {
			enterRoundEnd(room);
		}
		return true;
	}

	public synchronized void nextRound(GameRoom room, String requesterId) {
		if (!room.getHostId().equals(requesterId)) {
			throw new IllegalStateException("只有房主可以开始下一局");
		}
		if (room.getPhase() != GamePhase.ROUND_END) {
			throw new IllegalStateException("当前不是回合结束阶段");
		}
		if (!allPlayersReady(room)) {
			throw new IllegalStateException("所有玩家准备后才能开始");
		}
		beginRound(room);
	}

	private boolean allPlayersReady(GameRoom room) {
		return room.getPlayers().stream().allMatch(p -> p.isReady() && p.isEntered());
	}

	private void beginRound(GameRoom room) {
		room.setRound(room.getRound() + 1);
		List<Player> candidates = new ArrayList<>(room.getPlayers());
		Player seeker = candidates.get(random.nextInt(candidates.size()));
		room.setSeekerId(seeker.getId());
		for (Player player : room.getPlayers()) {
			player.setFound(false);
			player.setColor("#FFFFFF");
			player.setEntered(true);
			if (!player.isHost()) {
				player.setReady(false);
			}
			spawnPlayer(player);
			if (player.getId().equals(seeker.getId())) {
				player.setRole(PlayerRole.SEEKER);
			} else {
				player.setRole(PlayerRole.HIDER);
			}
		}
		room.setPhase(GamePhase.HIDING);
		room.setPhaseEndsAt(System.currentTimeMillis() + GameRoom.HIDING_SECONDS * 1000L);
	}

	private void enterRoundEnd(GameRoom room) {
		room.setPhase(GamePhase.ROUND_END);
		room.setPhaseEndsAt(0);
		for (Player player : room.getPlayers()) {
			if (player.getRole() == PlayerRole.HIDER) {
				player.setRole(PlayerRole.SPECTATOR);
			}
			if (!player.isHost()) {
				player.setReady(false);
			}
		}
	}

	private void enterSeeking(GameRoom room) {
		room.setPhase(GamePhase.SEEKING);
		room.setPhaseEndsAt(System.currentTimeMillis() + GameRoom.SEEKING_SECONDS * 1000L);
	}

	private boolean allHidersFound(GameRoom room) {
		return room.getPlayers().stream()
				.noneMatch(p -> p.getRole() == PlayerRole.HIDER && !p.isFound());
	}

	private void spawnPlayer(Player player) {
		double radius = GameRoom.PLAYER_RADIUS;
		player.setX(radius + random.nextDouble() * (GameRoom.CANVAS_WIDTH - radius * 2));
		player.setY(radius + random.nextDouble() * (GameRoom.CANVAS_HEIGHT - radius * 2));
	}

	private String generateRoomCode() {
		StringBuilder code = new StringBuilder(4);
		for (int i = 0; i < 4; i++) {
			code.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
		}
		if (rooms.containsKey(code.toString())) {
			return generateRoomCode();
		}
		return code.toString();
	}

	private String sanitizeName(String name) {
		if (name == null || name.isBlank()) {
			return "玩家";
		}
		return name.trim().substring(0, Math.min(name.trim().length(), 12));
	}

	private double clamp(double value, double min, double max) {
		return Math.max(min, Math.min(max, value));
	}

	private String normalizeColor(String color) {
		if (color == null || !color.matches("#?[0-9A-Fa-f]{6}")) {
			return "#FFFFFF";
		}
		return color.startsWith("#") ? color.toUpperCase() : "#" + color.toUpperCase();
	}
}
