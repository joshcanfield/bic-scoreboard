package canfield.bia.hockey;

import java.util.List;

@SuppressWarnings("unused")
public class GameConfig {
  /**
   * Configures default penalty times
   */
  private boolean stopClock;

  /**
   * 0 - warm-ups
   * 1-2 - period in minutes
   */
  private List<Integer> periodLengths;

  /**
   * Shift buzzer for rec games
   */
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

  public boolean isStopClock() {
    return stopClock;
  }

  public void setStopClock(boolean stopClock) {
    this.stopClock = stopClock;
  }
}
