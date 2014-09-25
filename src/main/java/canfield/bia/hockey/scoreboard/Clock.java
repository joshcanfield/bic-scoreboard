package canfield.bia.hockey.scoreboard;

/**
 *
 */
public interface Clock {

    void start();

    void stop();

    int getMinutes();

    void setMinutes(int minutes);

    int getSeconds();

    void setSeconds(int seconds);

    boolean isRunning();

    int getRemainingMillis();

    void setRemainingMillis(int millis);
}
