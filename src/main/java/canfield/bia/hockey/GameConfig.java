package canfield.bia.hockey;

import java.util.List;

public class GameConfig {
    private List<Integer> periodLengths;
    private String type;
    private Integer gameLengthMinutes;

    public Integer getShiftBuzzerIntervalSeconds() {
        return shiftBuzzerIntervalSeconds;
    }

    public void setShiftBuzzerIntervalSeconds(final Integer shiftBuzzerIntervalSeconds) {
        this.shiftBuzzerIntervalSeconds = shiftBuzzerIntervalSeconds;
    }

    public Integer getGameLengthMinutes() {
        return gameLengthMinutes;
    }

    public void setGameLengthMinutes(final Integer gameLengthMinutes) {
        this.gameLengthMinutes = gameLengthMinutes;
    }

    public String getType() {
        return type;
    }

    public void setType(final String type) {
        this.type = type;
    }

    private Integer shiftBuzzerIntervalSeconds;

    public List<Integer> getPeriodLengths() {
        return periodLengths;
    }

    public void setPeriodLengths(List<Integer> periodLengths) {
        this.periodLengths = periodLengths;
    }
}
