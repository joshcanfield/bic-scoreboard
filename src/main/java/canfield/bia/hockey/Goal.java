package canfield.bia.hockey;

public class Goal {
    int period;
    int time;
    int playerNumber;
    int assistNumber;

    public int getPeriod() {
        return period;
    }

    public void setPeriod(int period) {
        this.period = period;
    }

    public int getTime() {
        return time;
    }

    public void setTime(int time) {
        this.time = time;
    }

    public int getPlayerNumber() {
        return playerNumber;
    }

    public void setPlayerNumber(int playerNumber) {
        this.playerNumber = playerNumber;
    }

    public int getAssistNumber() {
        return assistNumber;
    }

    public void setAssistNumber(int assistNumber) {
        this.assistNumber = assistNumber;
    }
}
