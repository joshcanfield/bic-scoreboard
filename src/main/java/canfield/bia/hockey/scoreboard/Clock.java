package canfield.bia.hockey.scoreboard;

/**
 *
 */
public interface Clock {

  static int getMinutes(int millis) {
    return (millis + 999) / (60 * 1000);
  }

  static int getSeconds(int millis) {
    return (millis + 999) / 1000 % 60;
  }

  static int getTenthsOfSecond(int millis) {
    return (millis + 999) / 100 % 10;
  }

  void start();

  void stop();

  boolean isRunning();

  ClockTime getTime();

  boolean hasExpired();

  void setTime(int minutes, int seconds);

  class ClockTime {
    int minutes;
    int seconds;
    int tenthsOfSeconds;

    ClockTime(int minutes, int seconds, int tenthsOfSeconds) {
      this.minutes = minutes;
      this.seconds = seconds;
      this.tenthsOfSeconds = tenthsOfSeconds;
    }

    public int getMinutes() {
      return minutes;
    }

    public int getSeconds() {
      return seconds;
    }

    public int getTenthsOfSeconds() {
      return tenthsOfSeconds;
    }
  }
}
