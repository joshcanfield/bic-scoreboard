package canfield.bia.hockey.scoreboard;

/**
 *
 */
public interface Clock {

    void start();

    void stop();

    boolean isRunning();

    int getMinutes();

    void setMinutes(int minutes);

    int getSeconds();

    void setSeconds(int seconds);

    int getRemainingMillis();

    void setRemainingMillis(int millis);
}
