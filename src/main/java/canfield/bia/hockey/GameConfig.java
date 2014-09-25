package canfield.bia.hockey;

import java.util.List;

public class GameConfig {
    public List<Integer> getPeriodLengths() {
        return periodLengths;
    }

    public void setPeriodLengths(List<Integer> periodLengths) {
        this.periodLengths = periodLengths;
    }

    private List<Integer> periodLengths;
}
