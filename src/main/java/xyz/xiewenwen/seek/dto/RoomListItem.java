package xyz.xiewenwen.seek.dto;

public class RoomListItem {

	private String roomId;
	private String hostName;
	private int playerCount;
	private int maxPlayers;

	public RoomListItem() {
	}

	public RoomListItem(String roomId, String hostName, int playerCount, int maxPlayers) {
		this.roomId = roomId;
		this.hostName = hostName;
		this.playerCount = playerCount;
		this.maxPlayers = maxPlayers;
	}

	public String getRoomId() {
		return roomId;
	}

	public void setRoomId(String roomId) {
		this.roomId = roomId;
	}

	public String getHostName() {
		return hostName;
	}

	public void setHostName(String hostName) {
		this.hostName = hostName;
	}

	public int getPlayerCount() {
		return playerCount;
	}

	public void setPlayerCount(int playerCount) {
		this.playerCount = playerCount;
	}

	public int getMaxPlayers() {
		return maxPlayers;
	}

	public void setMaxPlayers(int maxPlayers) {
		this.maxPlayers = maxPlayers;
	}
}
