package canfield.bia.hockey.scoreboard;

/**
 * A count-down clock that holds the time remaining and supports pause/resume without losing time fidelity.
 */
public class GameClock implements Clock {
  /**
   * How much time is left on the clock?
   */
  private int timeRemainingMillis;

  /**
   * Is the clock paused?
   */
  private boolean isRunning = false;

  /**
   * When the clock was started
   */
  private long clockStartMillis;

  public GameClock(int minutes, int seconds) {
    setTime(minutes, seconds);
  }

  public void reset() {
    timeRemainingMillis = 0;
  }

  @Override
  public boolean isRunning() {
    return isRunning;
  }

  @Override
  public ClockTime getTime() {
    int remainingMillis = getRemainingMillis();
    return new ClockTime(
        Clock.getMinutes(remainingMillis),
        Clock.getSeconds(remainingMillis),
        Clock.getTenthsOfSecond(remainingMillis)
    );
  }

  private int getRemainingMillis() {
    if (isRunning) {
      // Calculate based on time elapsed since last clock start
      long now = System.currentTimeMillis();
      int elapsed = (int) (now - clockStartMillis);
      final int actualRemaining = timeRemainingMillis - elapsed;
      return actualRemaining < 0 ? 0 : actualRemaining;
    }
    return timeRemainingMillis;
  }

  @Override
  public boolean hasExpired() {
    return getRemainingMillis() == 0;
  }

  @Override
  public void setTime(int minutes, int seconds) {
    timeRemainingMillis = minutes * 60 * 1000 + seconds * 1000;
    clockStartMillis = System.currentTimeMillis();
  }


  @Override
  public void start() {
    clockStartMillis = System.currentTimeMillis();
    isRunning = true;
  }

  /**
   * Stops the clock and updates the elapsed time counter
   */
  @Override
  public void stop() {
    isRunning = false;

    long now = System.currentTimeMillis();
    long elapsed = now - clockStartMillis;
    clockStartMillis = 0;
    timeRemainingMillis -= elapsed;
    if (timeRemainingMillis < 0) {
      timeRemainingMillis = 0;
    }
  }
}
