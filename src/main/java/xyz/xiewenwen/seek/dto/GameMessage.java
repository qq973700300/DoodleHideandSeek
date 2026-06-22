package xyz.xiewenwen.seek.dto;

import tools.jackson.databind.JsonNode;

public class GameMessage {

	private String type;
	private String playerId;
	private String roomId;
	private Double x;
	private Double y;
	private String color;
	private String targetPlayerId;
	private Boolean ready;
	private JsonNode payload;

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getPlayerId() {
		return playerId;
	}

	public void setPlayerId(String playerId) {
		this.playerId = playerId;
	}

	public String getRoomId() {
		return roomId;
	}

	public void setRoomId(String roomId) {
		this.roomId = roomId;
	}

	public Double getX() {
		return x;
	}

	public void setX(Double x) {
		this.x = x;
	}

	public Double getY() {
		return y;
	}

	public void setY(Double y) {
		this.y = y;
	}

	public String getColor() {
		return color;
	}

	public void setColor(String color) {
		this.color = color;
	}

	public String getTargetPlayerId() {
		return targetPlayerId;
	}

	public void setTargetPlayerId(String targetPlayerId) {
		this.targetPlayerId = targetPlayerId;
	}

	public Boolean getReady() {
		return ready;
	}

	public void setReady(Boolean ready) {
		this.ready = ready;
	}

	public JsonNode getPayload() {
		return payload;
	}

	public void setPayload(JsonNode payload) {
		this.payload = payload;
	}
}
