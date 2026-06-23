package xyz.xiewenwen.seek.model;

import java.util.ArrayList;
import java.util.List;

public class GameRoom {

	public static final int CANVAS_WIDTH = 3200;
	public static final int CANVAS_HEIGHT = 2000;
	public static final int HIDING_SECONDS = 20;
	public static final int SEEKING_SECONDS = 60;
	public static final double PLAYER_RADIUS = 22;

	private String id;
	private String hostId;
	private GamePhase phase = GamePhase.LOBBY;
	private List<Player> players = new ArrayList<>();
	private long phaseEndsAt;
	private int round = 0;
	private String seekerId;

	public GameRoom() {
	}

	public GameRoom(String id, String hostId) {
		this.id = id;
		this.hostId = hostId;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getHostId() {
		return hostId;
	}

	public void setHostId(String hostId) {
		this.hostId = hostId;
	}

	public GamePhase getPhase() {
		return phase;
	}

	public void setPhase(GamePhase phase) {
		this.phase = phase;
	}

	public List<Player> getPlayers() {
		return players;
	}

	public void setPlayers(List<Player> players) {
		this.players = players;
	}

	public long getPhaseEndsAt() {
		return phaseEndsAt;
	}

	public void setPhaseEndsAt(long phaseEndsAt) {
		this.phaseEndsAt = phaseEndsAt;
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

	public Player findPlayer(String playerId) {
		return players.stream()
				.filter(p -> p.getId().equals(playerId))
				.findFirst()
				.orElse(null);
	}

	public long getPhaseRemainingMs() {
		if (phaseEndsAt <= 0) {
			return 0;
		}
		return Math.max(0, phaseEndsAt - System.currentTimeMillis());
	}
}
