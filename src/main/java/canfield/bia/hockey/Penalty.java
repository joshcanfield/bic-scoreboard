package canfield.bia.hockey;

import java.util.concurrent.atomic.AtomicInteger;

public class Penalty {
    private static AtomicInteger idSource = new AtomicInteger();

    private Integer id = idSource.incrementAndGet();

    private int playerNumber;

    private int servingPlayerNumber;

    // how long is the penalty
    private int time;

    private int elapsed;

    private int period;

    private int offIceTime;

    private int startTime;

    public int getPeriod() {
        return period;
    }

    public void setPeriod(int period) {
        this.period = period;
    }

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

    public boolean isExpired() {
        return elapsed >= time;
    }

    public Integer getId() {
        return id;
    }

    public int getElapsed() {
        return elapsed;
    }

    public void setElapsed(int elapsed) {
        this.elapsed = elapsed;
    }
}
