package canfield.bia.hockey;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.concurrent.atomic.AtomicInteger;

@JsonIgnoreProperties(ignoreUnknown = true)
public class Goal {
    private static final AtomicInteger idSource = new AtomicInteger();

    private final Integer id = idSource.incrementAndGet();

    private int period;
    private int time;
    private int playerNumber;
    private Integer primaryAssistNumber;
    private Integer secondaryAssistNumber;

    public Integer getId() {
        return id;
    }

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

    public Integer getPrimaryAssistNumber() {
        return primaryAssistNumber;
    }

    public void setPrimaryAssistNumber(Integer primaryAssistNumber) {
        this.primaryAssistNumber = primaryAssistNumber;
    }

    public Integer getSecondaryAssistNumber() {
        return secondaryAssistNumber;
    }

    public void setSecondaryAssistNumber(Integer secondaryAssistNumber) {
        this.secondaryAssistNumber = secondaryAssistNumber;
    }

    @JsonIgnore
    public Integer getAssistNumber() {
        return primaryAssistNumber;
    }

    public void setAssistNumber(Integer assistNumber) {
        this.primaryAssistNumber = assistNumber;
    }
}
