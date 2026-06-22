package xyz.xiewenwen.seek.dto;

import java.util.List;

import xyz.xiewenwen.seek.model.GamePhase;
import xyz.xiewenwen.seek.model.Player;

public class RoomSnapshot {

	private String roomId;
	private GamePhase phase;
	private int round;
	private String seekerId;
	private long phaseRemainingMs;
	private List<Player> players;

	public RoomSnapshot() {
	}

	public String getRoomId() {
		return roomId;
	}

	public void setRoomId(String roomId) {
		this.roomId = roomId;
	}

	public GamePhase getPhase() {
		return phase;
	}

	public void setPhase(GamePhase phase) {
		this.phase = phase;
	}

	public int getRound() {
		return round;
	}

	public void setRound(int round) {
		this.round = round;
	}

	public String getSeekerId() {
		return seekerId;
	}

	public void setSeekerId(String seekerId) {
		this.seekerId = seekerId;
	}

	public long getPhaseRemainingMs() {
		return phaseRemainingMs;
	}

	public void setPhaseRemainingMs(long phaseRemainingMs) {
		this.phaseRemainingMs = phaseRemainingMs;
	}

	public List<Player> getPlayers() {
		return players;
	}

	public void setPlayers(List<Player> players) {
		this.players = players;
	}
}
