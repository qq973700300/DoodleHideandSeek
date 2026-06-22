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
			default -> {
			}
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
		sessions.remove(session.getId());
		roomService.unbindSession(session.getId());
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
		roomService.camouflagePlayer(room, message.getPlayerId(), message.getColor());
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
			broadcastRoom(room);
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
