package xyz.xiewenwen.seek.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import xyz.xiewenwen.seek.dto.CreateRoomRequest;
import xyz.xiewenwen.seek.dto.JoinRoomRequest;
import xyz.xiewenwen.seek.dto.JoinRoomResponse;
import xyz.xiewenwen.seek.dto.LeaveRoomRequest;
import xyz.xiewenwen.seek.dto.RoomListItem;
import xyz.xiewenwen.seek.model.GameRoom;
import xyz.xiewenwen.seek.model.Player;

import java.util.List;
import xyz.xiewenwen.seek.service.RoomService;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

	private final RoomService roomService;

	public RoomController(RoomService roomService) {
		this.roomService = roomService;
	}

	@GetMapping
	public List<RoomListItem> listRooms() {
		return roomService.listOpenRooms();
	}

	@PostMapping
	public JoinRoomResponse createRoom(@RequestBody CreateRoomRequest request) {
		GameRoom room = roomService.createRoom(request.getName(), request.getClientId());
		Player host = room.getPlayers().get(0);
		return new JoinRoomResponse(room.getId(), host.getId(), true);
	}

	@PostMapping("/{roomId}/join")
	public JoinRoomResponse joinRoom(@PathVariable String roomId, @RequestBody JoinRoomRequest request) {
		GameRoom room = roomService.joinRoom(roomId, request.getName(), request.getClientId());
		Player player = roomService.findPlayerByClientId(roomId, request.getClientId());
		if (player == null) {
			player = room.getPlayers().get(room.getPlayers().size() - 1);
		}
		return new JoinRoomResponse(room.getId(), player.getId(), player.isHost());
	}

	@PostMapping("/{roomId}/leave")
	public void leaveRoom(
			@PathVariable String roomId,
			@RequestParam(required = false) String playerId,
			@RequestParam(required = false) String clientId,
			@RequestBody(required = false) LeaveRoomRequest request) {
		String resolvedPlayerId = playerId;
		String resolvedClientId = clientId;
		if (request != null) {
			if (resolvedPlayerId == null) {
				resolvedPlayerId = request.getPlayerId();
			}
			if (resolvedClientId == null) {
				resolvedClientId = request.getClientId();
			}
		}
		roomService.leaveRoom(roomId, resolvedPlayerId, resolvedClientId);
	}

	@ExceptionHandler(IllegalArgumentException.class)
	@ResponseStatus(HttpStatus.NOT_FOUND)
	public String handleNotFound(IllegalArgumentException ex) {
		return ex.getMessage();
	}

	@ExceptionHandler(IllegalStateException.class)
	@ResponseStatus(HttpStatus.BAD_REQUEST)
	public String handleBadRequest(IllegalStateException ex) {
		return ex.getMessage();
	}
}
