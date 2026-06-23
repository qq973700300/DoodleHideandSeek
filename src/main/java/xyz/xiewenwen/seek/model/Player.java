package xyz.xiewenwen.seek.model;

public class Player {

	private String id;
	private String name;
	private PlayerRole role = PlayerRole.HIDER;
	private double x = 400;
	private double y = 300;
	private String color = "#FFFFFF";
	private String disguise;
	private boolean found;
	private boolean host;
	private boolean ready;
	private boolean entered;
	private String clientId;
	private long joinedAt = System.currentTimeMillis();

	public Player() {
	}

	public Player(String id, String name, boolean host, String clientId) {
		this.id = id;
		this.name = name;
		this.host = host;
		this.ready = host;
		this.clientId = clientId;
		this.joinedAt = System.currentTimeMillis();
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public PlayerRole getRole() {
		return role;
	}

	public void setRole(PlayerRole role) {
		this.role = role;
	}

	public double getX() {
		return x;
	}

	public void setX(double x) {
		this.x = x;
	}

	public double getY() {
		return y;
	}

	public void setY(double y) {
		this.y = y;
	}

	public String getColor() {
		return color;
	}

	public void setColor(String color) {
		this.color = color;
	}

	public String getDisguise() {
		return disguise;
	}

	public void setDisguise(String disguise) {
		this.disguise = disguise;
	}

	public boolean isFound() {
		return found;
	}

	public void setFound(boolean found) {
		this.found = found;
	}

	public boolean isHost() {
		return host;
	}

	public void setHost(boolean host) {
		this.host = host;
	}

	public boolean isReady() {
		return ready;
	}

	public void setReady(boolean ready) {
		this.ready = ready;
	}

	public boolean isEntered() {
		return entered;
	}

	public void setEntered(boolean entered) {
		this.entered = entered;
	}

	public String getClientId() {
		return clientId;
	}

	public void setClientId(String clientId) {
		this.clientId = clientId;
	}

	public long getJoinedAt() {
		return joinedAt;
	}

	public void setJoinedAt(long joinedAt) {
		this.joinedAt = joinedAt;
	}
}
