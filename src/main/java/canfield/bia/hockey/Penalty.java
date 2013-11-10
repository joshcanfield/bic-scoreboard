package canfield.bia.hockey;

/**
 *
 */
public class Penalty {
    private int playerNumber;
    private int servingPlayerNumber;
    // how long is the penalty
    private int time;

    private long offIceTime;

    private long startTime;

    public int getPlayerNumber() {
        return playerNumber;
    }

    public void setPlayerNumber(int playerNumber) {
        this.playerNumber = playerNumber;
    }

    public int getServingPlayerNumber() {
        return servingPlayerNumber;
    }

    public void setServingPlayerNumber(int servingPlayerNumber) {
        this.servingPlayerNumber = servingPlayerNumber;
    }

    public int getTime() {
        return time;
    }

    public void setTime(int time) {
        this.time = time;
    }

    public long getOffIceTime() {
        return offIceTime;
    }

    public void setOffIceTime(long offIceTime) {
        this.offIceTime = offIceTime;
    }

    public long getStartTime() {
        return startTime;
    }

    public void setStartTime(long startTime) {
        this.startTime = startTime;
    }
}
