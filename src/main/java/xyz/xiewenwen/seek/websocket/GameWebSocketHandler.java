package xyz.xiewenwen.seek.websocket;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import tools.jackson.databind.ObjectMapper;
import xyz.xiewenwen.seek.dto.GameMessage;
import xyz.xiewenwen.seek.dto.RoomSnapshot;
import xyz.xiewenwen.seek.model.GameRoom;
import xyz.xiewenwen.seek.model.Player;
import xyz.xiewenwen.seek.service.RoomService;

@Component
public class GameWebSocketHandler extends TextWebSocketHandler {

	private static final String ATTR_ROOM_ID = "roomId";
	private static final String ATTR_PLAYER_ID = "playerId";
	private static final String ATTR_LEFT = "left";

	private final RoomService roomService;
	private final ObjectMapper objectMapper;
	private final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
	private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

	public GameWebSocketHandler(RoomService roomService, ObjectMapper objectMapper) {
		this.roomService = roomService;
		this.objectMapper = objectMapper;
		scheduler.scheduleAtFixedRate(this::tickRooms, 1, 1, TimeUnit.SECONDS);
	}

	@Override
	public void afterConnectionEstablished(WebSocketSession session) {
		sessions.put(session.getId(), session);
	}

	@Override
	protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		GameMessage incoming = objectMapper.readValue(message.getPayload(), GameMessage.class);
		String type = incoming.getType();
		if (type == null) {
			return;
		}

		switch (type) {
			case "JOIN" -> handleJoin(session, incoming);
			case "START" -> handleStart(session, incoming);
			case "NEXT_ROUND" -> handleNextRound(session, incoming);
			case "MOVE" -> handleMove(session, incoming);
			case "CAMOUFLAGE" -> handleCamouflage(session, incoming);
			case "SHOOT" -> handleShoot(session, incoming);
			case "SEEK_CLICK" -> handleSeekClick(session, incoming);
			case "READY" -> handleReady(session, incoming);
			case "ENTER" -> handleEnter(session, incoming);
			case "KICK" -> handleKick(session, incoming);
			case "LEAVE" -> handleLeave(session, incoming);
			default -> {
			}
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
		sessions.remove(session.getId());
		disconnectSession(session);
	}

	private void handleLeave(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null) {
			return;
		}
		markPlayerLeft(session, room.getId(), message.getPlayerId());
	}

	private void disconnectSession(WebSocketSession session) {
		if (Boolean.TRUE.equals(session.getAttributes().get(ATTR_LEFT))) {
			roomService.unbindSession(session.getId());
			clearSessionAttributes(session);
			return;
		}
		String roomId = getSessionRoomId(session);
		String playerId = getSessionPlayerId(session);
		roomService.unbindSession(session.getId());
		clearSessionAttributes(session);
		if (roomId == null || playerId == null) {
			return;
		}
		try {
			onPlayerLeft(roomId, playerId);
		} catch (IOException ex) {
			// ignore broadcast failures during disconnect
		}
	}

	private void markPlayerLeft(WebSocketSession session, String roomId, String playerId) throws IOException {
		if (Boolean.TRUE.equals(session.getAttributes().get(ATTR_LEFT))) {
			return;
		}
		session.getAttributes().put(ATTR_LEFT, true);
		onPlayerLeft(roomId, playerId);
		roomService.unbindSession(session.getId());
		clearSessionAttributes(session);
	}

	private String getSessionRoomId(WebSocketSession session) {
		Object roomId = session.getAttributes().get(ATTR_ROOM_ID);
		if (roomId != null) {
			return roomId.toString();
		}
		return roomService.getRoomIdForSession(session.getId());
	}

	private String getSessionPlayerId(WebSocketSession session) {
		Object playerId = session.getAttributes().get(ATTR_PLAYER_ID);
		if (playerId != null) {
			return playerId.toString();
		}
		return roomService.getPlayerIdForSession(session.getId());
	}

	private void clearSessionAttributes(WebSocketSession session) {
		session.getAttributes().remove(ATTR_ROOM_ID);
		session.getAttributes().remove(ATTR_PLAYER_ID);
		session.getAttributes().remove(ATTR_LEFT);
	}

	private void onPlayerLeft(String roomId, String playerId) throws IOException {
		String clientId = null;
		GameRoom roomBefore = roomService.getRoom(roomId);
		if (roomBefore != null) {
			Player player = roomBefore.findPlayer(playerId);
			if (player != null) {
				clientId = player.getClientId();
			}
		}
		boolean deleted = roomService.leaveRoom(roomId, playerId, clientId);
		if (!deleted) {
			GameRoom room = roomService.getRoom(roomId);
			if (room != null) {
				broadcastRoom(room);
			}
		}
	}

	private void handleJoin(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = roomService.getRoom(message.getRoomId());
		if (room == null) {
			sendError(session, "房间不存在");
			return;
		}
		Player player = room.findPlayer(message.getPlayerId());
		if (player == null) {
			sendError(session, "玩家不存在");
			return;
		}
		roomService.bindSession(session.getId(), room.getId(), message.getPlayerId());
		session.getAttributes().put(ATTR_ROOM_ID, room.getId());
		session.getAttributes().put(ATTR_PLAYER_ID, message.getPlayerId());
		session.getAttributes().remove(ATTR_LEFT);
		send(session, envelope("JOINED", roomService.toSnapshot(room)));
		broadcastRoom(room);
	}

	private void handleStart(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null) {
			return;
		}
		try {
			roomService.startGame(room, message.getPlayerId());
			broadcastRoom(room);
		} catch (IllegalStateException ex) {
			sendError(session, ex.getMessage());
		}
	}

	private void handleNextRound(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null) {
			return;
		}
		try {
			roomService.nextRound(room, message.getPlayerId());
			broadcastRoom(room);
		} catch (IllegalStateException ex) {
			sendError(session, ex.getMessage());
		}
	}

	private void handleMove(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null || message.getX() == null || message.getY() == null) {
			return;
		}
		roomService.movePlayer(room, message.getPlayerId(), message.getX(), message.getY());
		broadcastRoom(room);
	}

	private void handleCamouflage(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null || message.getColor() == null) {
			return;
		}
		roomService.camouflagePlayer(room, message.getPlayerId(), message.getColor(), message.getDisguise());
		broadcastRoom(room);
	}

	private void handleReady(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null) {
			return;
		}
		try {
			boolean ready = message.getReady() == null || message.getReady();
			roomService.setReady(room, message.getPlayerId(), ready);
			broadcastRoom(room);
		} catch (IllegalStateException ex) {
			sendError(session, ex.getMessage());
		}
	}

	private void handleEnter(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null) {
			return;
		}
		try {
			roomService.enterScene(room, message.getPlayerId());
			broadcastRoom(room);
		} catch (IllegalStateException ex) {
			sendError(session, ex.getMessage());
		}
	}

	private void handleKick(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null || message.getTargetPlayerId() == null) {
			return;
		}
		try {
			roomService.kickPlayer(room, message.getPlayerId(), message.getTargetPlayerId());
			notifyKicked(message.getTargetPlayerId(), room.getId());
			if (roomService.getRoom(room.getId()) != null) {
				broadcastRoom(room);
			}
		} catch (IllegalStateException | IllegalArgumentException ex) {
			sendError(session, ex.getMessage());
		}
	}

	private void notifyKicked(String playerId, String roomId) throws IOException {
		for (WebSocketSession session : sessions.values()) {
			String pid = roomService.getPlayerIdForSession(session.getId());
			if (playerId.equals(pid) && session.isOpen()) {
				send(session, envelope("KICKED", Map.of("message", "你已被房主移出房间")));
				roomService.unbindSession(session.getId());
			}
		}
	}

	private void handleShoot(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null || message.getTargetPlayerId() == null) {
			return;
		}
		Player found = roomService.seekShoot(room, message.getPlayerId(), message.getTargetPlayerId());
		if (found != null) {
			broadcastRoom(room);
			broadcast(room, envelope("PLAYER_FOUND", Map.of(
					"playerId", found.getId(),
					"name", found.getName())));
		}
	}

	private void handleSeekClick(WebSocketSession session, GameMessage message) throws IOException {
		GameRoom room = requireRoom(session, message.getRoomId());
		if (room == null || message.getX() == null || message.getY() == null) {
			return;
		}
		Player found = roomService.seekClick(room, message.getPlayerId(), message.getX(), message.getY());
		if (found != null) {
			broadcastRoom(room);
			broadcast(room, envelope("PLAYER_FOUND", Map.of(
					"playerId", found.getId(),
					"name", found.getName())));
		}
	}

	private GameRoom requireRoom(WebSocketSession session, String roomId) throws IOException {
		String boundRoomId = roomService.getRoomIdForSession(session.getId());
		if (boundRoomId == null || roomId == null || !boundRoomId.equalsIgnoreCase(roomId)) {
			sendError(session, "请先加入房间");
			return null;
		}
		return roomService.getRoom(roomId);
	}

	private void tickRooms() {
		roomService.purgeStaleLobbyPlayers(roomService.getConnectedPlayerIds());
		for (String roomId : roomService.getRoomIds()) {
			GameRoom room = roomService.getRoom(roomId);
			if (room == null) {
				continue;
			}
			try {
				if (roomService.advancePhaseIfNeeded(room)) {
					broadcastRoom(room);
				}
			} catch (IOException ex) {
				// ignore broadcast failures during tick
			}
		}
	}

	private void broadcastRoom(GameRoom room) throws IOException {
		RoomSnapshot snapshot = roomService.toSnapshot(room);
		broadcast(room, envelope("ROOM_STATE", snapshot));
	}

	private void broadcast(GameRoom room, String payload) throws IOException {
		for (WebSocketSession session : sessions.values()) {
			String boundRoomId = roomService.getRoomIdForSession(session.getId());
			if (boundRoomId != null && boundRoomId.equals(room.getId()) && session.isOpen()) {
				session.sendMessage(new TextMessage(payload));
			}
		}
	}

	private void send(WebSocketSession session, String payload) throws IOException {
		if (session.isOpen()) {
			session.sendMessage(new TextMessage(payload));
		}
	}

	private void sendError(WebSocketSession session, String error) throws IOException {
		send(session, envelope("ERROR", Map.of("message", error)));
	}

	private String envelope(String type, Object data) {
		try {
			return objectMapper.writeValueAsString(Map.of("type", type, "data", data));
		} catch (Exception ex) {
			return "{\"type\":\"ERROR\",\"data\":{\"message\":\"序列化失败\"}}";
		}
	}
}
