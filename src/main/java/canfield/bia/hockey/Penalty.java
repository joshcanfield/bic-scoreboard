package canfield.bia.hockey;

/**
 *
 */
public class Penalty {
    private int playerNumber;
    private int servingPlayerNumber;
    // how long is the penalty
    private int time;

    private int offIceTime;

    private int startTime;

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

    public int getOffIceTime() {
        return offIceTime;
    }

    public void setOffIceTime(int offIceTime) {
        this.offIceTime = offIceTime;
    }

    public int getStartTime() {
        return startTime;
    }

    public void setStartTime(int startTime) {
        this.startTime = startTime;
    }
}
