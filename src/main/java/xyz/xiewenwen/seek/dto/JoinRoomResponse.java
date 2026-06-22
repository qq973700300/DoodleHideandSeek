package xyz.xiewenwen.seek.dto;

public class JoinRoomResponse {

	private String roomId;
	private String playerId;
	private boolean host;

	public JoinRoomResponse() {
	}

	public JoinRoomResponse(String roomId, String playerId, boolean host) {
		this.roomId = roomId;
		this.playerId = playerId;
		this.host = host;
	}

	public String getRoomId() {
		return roomId;
	}

	public void setRoomId(String roomId) {
		this.roomId = roomId;
	}

	public String getPlayerId() {
		return playerId;
	}

	public void setPlayerId(String playerId) {
		this.playerId = playerId;
	}

	public boolean isHost() {
		return host;
	}

	public void setHost(boolean host) {
		this.host = host;
	}
}
