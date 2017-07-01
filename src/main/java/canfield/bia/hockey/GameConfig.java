package canfield.bia.hockey;

import java.util.List;

public class GameConfig {
    private List<Integer> periodLengths;
    private Integer buzzerIntervalSeconds;

    public Integer getBuzzerIntervalSeconds() {
        return buzzerIntervalSeconds;
    }

    public void setBuzzerIntervalSeconds(final Integer buzzerIntervalSeconds) {
        this.buzzerIntervalSeconds = buzzerIntervalSeconds;
    }

    public List<Integer> getPeriodLengths() {
        return periodLengths;
    }

    public void setPeriodLengths(List<Integer> periodLengths) {
        this.periodLengths = periodLengths;
    }
}
