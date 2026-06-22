package xyz.xiewenwen.seek.model;

public class Player {

	private String id;
	private String name;
	private PlayerRole role = PlayerRole.HIDER;
	private double x = 400;
	private double y = 300;
	private String color = "#FFFFFF";
	private boolean found;
	private boolean host;
	private boolean ready;
	private boolean entered;

	public Player() {
	}

	public Player(String id, String name, boolean host) {
		this.id = id;
		this.name = name;
		this.host = host;
		this.ready = host;
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
}
